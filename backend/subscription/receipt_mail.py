"""
Электронные чеки САОУ — письмо на почту пользователя после успешной оплаты.

Отправляется с ящика check@saou.ru (создан на хостинге). Пароль ящика хранится
зашифрованным в таблице system_mailboxes — тем же ключом MAIL_ENCRYPTION_KEY,
что и остальные системные ящики сервиса.

Чек носит информационный характер: фискальный чек формирует ЮKassa как
оператор фискальных данных (мы передаём ей receipt при создании платежа).
"""
import os
import ssl
import socket
import base64
import hashlib
import smtplib
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email import utils as email_utils

SMTP_HOST = os.environ.get("UDS_SMTP_HOST", "").strip()
MAIL_SMTP_HOST = os.environ.get("MAIL_SMTP_HOST", "").strip()
SMTP_TIMEOUT = 8

# Ящик, с которого уходят чеки об оплате
RECEIPT_SENDER = os.environ.get("RECEIPT_SENDER", "check@saou.ru")

COMPANY_NAME = "ООО «Компания «Немзор»"
COMPANY_INN = "2907019688"
COMPANY_KPP = "290701001"
COMPANY_OGRN = "1262900002947"
COMPANY_PHONE = "+7 (995) 222-81-29"
SITE_URL = os.environ.get("SITE_URL", "").strip().rstrip("/") or "https://saou.ru"


def _mail_fernet():
    """Расшифровщик пароля почтового ящика (ключ общий для всех системных ящиков)."""
    from cryptography.fernet import Fernet
    key = os.environ.get("MAIL_ENCRYPTION_KEY", "").strip()
    if not key:
        raise RuntimeError("MAIL_ENCRYPTION_KEY не задан")
    try:
        return Fernet(key.encode())
    except Exception:
        derived = base64.urlsafe_b64encode(hashlib.sha256(key.encode()).digest())
        return Fernet(derived)


def _sender_credentials(cur, schema: str) -> tuple[str, str]:
    """(email, пароль) ящика check@saou.ru из system_mailboxes."""
    cur.execute(
        f"SELECT password_enc FROM {schema}.system_mailboxes "
        f"WHERE LOWER(email_address) = %s AND status = 'active'",
        (RECEIPT_SENDER.lower(),)
    )
    row = cur.fetchone()
    if row and row[0]:
        return RECEIPT_SENDER, _mail_fernet().decrypt(row[0].encode()).decode()
    raise RuntimeError(
        f"Ящик {RECEIPT_SENDER} не найден в system_mailboxes — "
        f"подготовьте его через УДС (Почта)."
    )


def _server_host_from_isp() -> str | None:
    url = os.environ.get("ISPMANAGER_URL", "").strip()
    if not url:
        return None
    host = url.replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
    return host or None


def _smtp_candidates():
    """Перебор host/port — как в auth: сначала персональный сервер хостинга (его
    IP прописан в SPF домена), потом общий почтовый хост."""
    hosts = []
    for h in [MAIL_SMTP_HOST, _server_host_from_isp(), SMTP_HOST, "mail.hosting.reg.ru"]:
        if h and h not in hosts:
            hosts.append(h)
    out = []
    for h in hosts:
        out.append((h, 465, "ssl"))
        out.append((h, 587, "starttls"))
    return out


def _send_email(cur, schema: str, to_email: str, subject: str,
                text_body: str, html_body: str) -> None:
    """Отправляет письмо-чек (текст + HTML) с ящика check@saou.ru."""
    smtp_user, smtp_password = _sender_credentials(cur, schema)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = email_utils.formataddr(("САОУ — чеки", smtp_user))
    msg["To"] = to_email
    msg["Reply-To"] = smtp_user
    msg["Date"] = email_utils.formatdate(localtime=True)
    msg["Message-ID"] = email_utils.make_msgid(domain=smtp_user.split("@")[-1] or "saou.ru")
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))
    raw = msg.as_string()

    ctx = ssl.create_default_context()
    last_err = None
    unresolved = set()
    for host, port, mode in _smtp_candidates():
        if host in unresolved:
            continue
        try:
            socket.getaddrinfo(host, port)
        except Exception:
            unresolved.add(host)
            last_err = f"хост {host} не найден"
            continue
        try:
            if mode == "ssl":
                with smtplib.SMTP_SSL(host, port, context=ctx, timeout=SMTP_TIMEOUT) as s:
                    s.login(smtp_user, smtp_password)
                    s.sendmail(smtp_user, [to_email], raw)
            else:
                with smtplib.SMTP(host, port, timeout=SMTP_TIMEOUT) as s:
                    s.ehlo(); s.starttls(context=ctx); s.ehlo()
                    s.login(smtp_user, smtp_password)
                    s.sendmail(smtp_user, [to_email], raw)
            print(f"[RECEIPT] OK via {host}:{port} to={to_email}")
            return
        except smtplib.SMTPAuthenticationError as e:
            print(f"[RECEIPT] AUTH FAIL {host}:{port}: {e}")
            raise RuntimeError("Неверный пароль почтового ящика чеков")
        except Exception as e:
            last_err = str(e)
            print(f"[RECEIPT] FAIL {host}:{port} ({mode}): {e}")
            continue
    raise RuntimeError(f"Не удалось отправить чек: {last_err or 'соединение закрыто'}")


def _fmt_money(rub: float) -> str:
    return f"{rub:,.2f}".replace(",", " ").replace(".", ",") + " ₽"


def _fmt_dt(dt: datetime) -> str:
    return dt.strftime("%d.%m.%Y %H:%M")


def _receipt_html(rows: list[tuple[str, str]], title: str, amount_rub: float,
                  footer_note: str) -> str:
    """Простая таблица чека — без внешних картинок и скриптов, чтобы письмо
    гарантированно отображалось во всех почтовых клиентах."""
    tr = "".join(
        f'<tr>'
        f'<td style="padding:7px 0;color:#64748b;font-size:13px;">{k}</td>'
        f'<td style="padding:7px 0;text-align:right;font-size:13px;color:#0f172a;'
        f'font-weight:600;">{v}</td></tr>'
        for k, v in rows
    )
    return f"""<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px 12px;background:#f1f5f9;
             font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"
         style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:10px;
                overflow:hidden;border:1px solid #e2e8f0;">
    <tr>
      <td style="background:#1e3a5f;padding:22px 26px;color:#ffffff;">
        <div style="font-size:12px;letter-spacing:1.4px;opacity:.75;
                    text-transform:uppercase;">Электронный чек</div>
        <div style="font-size:21px;font-weight:700;margin-top:4px;">САОУ</div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 26px 6px;">
        <div style="font-size:15px;color:#0f172a;font-weight:600;">{title}</div>
        <div style="font-size:30px;font-weight:700;color:#16a34a;margin:10px 0 18px;">
          {_fmt_money(amount_rub)}
        </div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
               style="border-top:1px solid #e2e8f0;">
          {tr}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 26px 22px;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;
                    padding:12px 14px;font-size:12px;color:#64748b;line-height:1.6;">
          {footer_note}
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:0 26px 24px;font-size:11px;color:#94a3b8;line-height:1.7;">
        {COMPANY_NAME}<br>
        ИНН {COMPANY_INN} · КПП {COMPANY_KPP} · ОГРН {COMPANY_OGRN}<br>
        {COMPANY_PHONE} · <a href="{SITE_URL}" style="color:#64748b;">{SITE_URL}</a>
      </td>
    </tr>
  </table>
</body></html>"""


def send_payment_receipt(cur, schema: str, *, to_email: str, full_name: str,
                         personal_account: str | None, kind: str,
                         plan_name: str, amount_rub: float, payment_id: str,
                         paid_at: datetime | None = None,
                         subscription_until: datetime | None = None,
                         balance_rub: float | None = None,
                         is_recurrent: bool = False) -> None:
    """Отправляет чек об оплате.

    kind: "subscription" — покупка/продление подписки, "balance" — пополнение
    баланса ИИ. Ошибку наружу не пробрасываем — оплата уже прошла, и письмо
    не должно ломать ответ пользователю (вызывающий код ловит исключение).
    """
    paid_at = paid_at or datetime.utcnow()
    is_sub = kind == "subscription"
    title = "Оплата подписки САОУ" if is_sub else "Пополнение баланса ИИ"

    rows: list[tuple[str, str]] = [("Плательщик", full_name or "—")]
    if personal_account:
        rows.append(("Лицевой счёт", personal_account))
    rows.append(("Услуга", plan_name))
    rows.append(("Дата и время", _fmt_dt(paid_at)))
    rows.append(("Способ оплаты", "Банковская карта" + (" (автоплатёж)" if is_recurrent else "")))
    rows.append(("Номер платежа", payment_id or "—"))
    if is_sub and subscription_until:
        rows.append(("Подписка активна до", subscription_until.strftime("%d.%m.%Y")))
    if not is_sub and balance_rub is not None:
        rows.append(("Баланс после пополнения", _fmt_money(balance_rub)))

    footer_note = (
        "Платёж проведён через ЮKassa. Фискальный чек по 54-ФЗ формирует и "
        "направляет вам ЮKassa отдельным письмом. Данное письмо носит "
        "информационный характер и подтверждает зачисление платежа в САОУ."
    )
    if is_recurrent:
        footer_note += (
            " Списание выполнено автоматически по подключённому автоплатежу — "
            "отключить его можно в личном кабинете: Настройки → Оплаты, карты, автоплатежи."
        )

    subject = f"САОУ — чек об оплате {_fmt_money(amount_rub)}"

    text_lines = [
        "Здравствуйте!", "",
        f"{title} — {_fmt_money(amount_rub)}", "",
    ]
    for k, v in rows:
        text_lines.append(f"{k}: {v}")
    text_lines += [
        "",
        "Платёж проведён через ЮKassa. Фискальный чек по 54-ФЗ ЮKassa",
        "направит вам отдельным письмом.",
        "",
        f"{COMPANY_NAME}",
        f"ИНН {COMPANY_INN} · КПП {COMPANY_KPP} · ОГРН {COMPANY_OGRN}",
        f"{COMPANY_PHONE} · {SITE_URL}",
    ]

    _send_email(
        cur, schema, to_email, subject,
        "\n".join(text_lines),
        _receipt_html(rows, title, amount_rub, footer_note),
    )
