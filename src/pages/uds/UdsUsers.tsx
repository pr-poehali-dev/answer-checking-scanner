import { useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { udsApi, UdsUser, UdsPerms, UdsUserDetail, UdsPayment, UdsCharge } from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  teacher: "Учитель", student: "Ученик", tester: "Тестер", admin: "Админ",
};

interface Props { login: string; token: string; perms: UdsPerms; }

export default function UdsUsers({ login, token, perms }: Props) {
  const [users, setUsers] = useState<UdsUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async (query: string) => {
    setLoading(true); setError("");
    try {
      const res = await udsApi.users(login, token, query.trim() || undefined);
      setUsers(res.users);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [login, token]);

  useEffect(() => { load(""); }, [load]);
  useEffect(() => {
    const t = setTimeout(() => load(q), 350);
    return () => clearTimeout(t);
  }, [q, load]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-sm bg-destructive/5 border border-destructive/20">
          <Icon name="AlertCircle" size={14} className="text-destructive" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      <div>
        <h2 className="text-sm font-bold mb-2">Пользователи</h2>
        <div className="relative">
          <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Поиск по ФИО, логину, email, телефону…"
            className="w-full border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {loading && <Icon name="Loader2" size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />}
        </div>
      </div>

      <div className="border border-border rounded-lg bg-white divide-y divide-border overflow-hidden">
        {users.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground p-6 text-center">Никого не найдено</p>
        )}
        {users.map(u => (
          <button key={u.login} onClick={() => setSelected(u.login)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 text-left">
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <Icon name={u.role === "student" ? "Backpack" : "User"} size={15} className="text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{u.full_name || u.login}</p>
              <p className="text-xs text-muted-foreground truncate">
                {u.login} · {ROLE_LABELS[u.role] || u.role}
                {u.study_group ? ` · ${u.study_group}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {!u.is_active && <span className="text-[10px] text-red-500 font-medium">заблок.</span>}
              {u.role === "student" && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${u.bound ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-500"}`}>
                  {u.bound ? "привязан" : "не привязан"}
                </span>
              )}
              {u.panel_role && <Icon name="ShieldCheck" size={13} className="text-blue-500" />}
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <UserDetail login={login} token={token} perms={perms} targetLogin={selected}
          onClose={() => setSelected(null)} onChanged={() => load(q)} />
      )}
    </div>
  );
}

function UserDetail({ login, token, perms, targetLogin, onClose, onChanged }: {
  login: string; token: string; perms: UdsPerms; targetLogin: string;
  onClose: () => void; onChanged: () => void;
}) {
  const [user, setUser] = useState<UdsUserDetail | null>(null);
  const [payments, setPayments] = useState<UdsPayment[]>([]);
  const [charges, setCharges] = useState<UdsCharge[]>([]);
  const [tab, setTab] = useState<"info" | "payments" | "actions">("info");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await udsApi.userDetail(login, token, targetLogin);
      setUser(res.user); setPayments(res.payments); setCharges(res.charges);
    } catch (e) { setError((e as Error).message); }
  }, [login, token, targetLogin]);

  useEffect(() => { reload(); }, [reload]);

  const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString("ru-RU") : "—";

  // Действия
  const [tokensRub, setTokensRub] = useState("");
  const [subMonths, setSubMonths] = useState(1);
  const [newPass, setNewPass] = useState("");

  const act = async (fn: () => Promise<unknown>, after = true) => {
    setBusy(true); setError("");
    try { await fn(); if (after) { await reload(); onChanged(); } }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <p className="text-sm font-bold">{user?.full_name || targetLogin}</p>
            <p className="text-xs text-muted-foreground">
              {targetLogin}{user ? ` · ${ROLE_LABELS[user.role] || user.role}` : ""}
              {user && !user.is_active && <span className="text-red-500"> · заблокирован</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><Icon name="X" size={16} /></button>
        </div>

        <div className="flex border-b border-border px-5 gap-0 sticky top-[57px] bg-white z-10">
          {([["info", "Информация"], ["payments", "Платежи и списания"], ["actions", "Действия"]] as const).map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 ${tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
              {lbl}
            </button>
          ))}
        </div>

        {error && (
          <div className="mx-5 mt-3 flex items-center gap-2 p-2.5 rounded-sm bg-destructive/5 border border-destructive/20">
            <Icon name="AlertCircle" size={13} className="text-destructive" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        {!user ? (
          <div className="p-10 text-center"><Icon name="Loader2" size={20} className="animate-spin text-muted-foreground mx-auto" /></div>
        ) : tab === "info" ? (
          <div className="p-5 grid grid-cols-2 gap-3 text-xs">
            <Info label="Эл. почта" value={user.email || "—"} />
            <Info label="Телефон" value={user.phone || "—"} />
            <Info label="Школа" value={user.school || "—"} />
            <Info label="Класс/группа" value={user.study_group || "—"} />
            <Info label="Предмет" value={user.subject || "—"} />
            <Info label="Панельная роль" value={user.panel_role || "—"} />
            <Info label="Подписка" value={user.subscription_status} />
            <Info label="Подписка до" value={fmt(user.subscription_until)} />
            <Info label="Баланс ИИ" value={`${user.ai_balance_rub.toFixed(2)} ₽`} />
            <Info label="Триал до" value={fmt(user.trial_until)} />
            <Info label="Создан" value={fmt(user.created_at)} />
            <Info label="Создал" value={user.created_by || "—"} />
            <Info label="Последний вход" value={fmt(user.last_seen_at)} />
            <Info label="Статус" value={user.is_active ? "Активен" : "Заблокирован"} />
            {user.role === "student" && (
              <>
                <Info label="Привязка" value={user.bound ? "да" : "нет"} />
                <Info label="Код привязки" value={user.bind_code || "—"} />
                <Info label="Учитель" value={user.teacher_login || "—"} />
              </>
            )}
          </div>
        ) : tab === "payments" ? (
          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold mb-2">История платежей / подписок ({payments.length})</p>
              <div className="space-y-1.5">
                {payments.length === 0 && <p className="text-xs text-muted-foreground">Платежей нет</p>}
                {payments.map((p, i) => (
                  <div key={i} className="text-xs border border-border rounded px-2.5 py-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{p.plan} · {p.months} мес</span>
                      <span className={p.status === "succeeded" ? "text-green-600" : "text-muted-foreground"}>{p.status}</span>
                    </div>
                    <p className="text-muted-foreground mt-0.5">
                      {p.amount_rub.toFixed(2)} ₽ · {p.source}{p.granted_by ? ` (${p.granted_by})` : ""} · {fmt(p.paid_at || p.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold mb-2">История начислений / списаний ИИ ({charges.length})</p>
              <div className="space-y-1.5">
                {charges.length === 0 && <p className="text-xs text-muted-foreground">Операций нет</p>}
                {charges.map((c, i) => (
                  <div key={i} className="text-xs border border-border rounded px-2.5 py-1.5 flex items-center justify-between">
                    <span>{c.action}</span>
                    <span className={c.amount_rub >= 0 ? "text-green-600" : "text-red-600"}>
                      {c.amount_rub >= 0 ? "+" : ""}{c.amount_rub.toFixed(2)} ₽
                    </span>
                    <span className="text-muted-foreground">{c.balance_rub_after.toFixed(2)} ₽</span>
                    <span className="text-muted-foreground">{fmt(c.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Подписка — все */}
            {perms.can_subscription && (
              <ActionBlock icon="CalendarCheck" title="Подписка">
                <div className="flex items-center gap-2">
                  <select value={subMonths} onChange={e => setSubMonths(Number(e.target.value))}
                    className="border border-border rounded px-2 py-1.5 text-xs">
                    {[1, 2, 3, 6, 12].map(m => <option key={m} value={m}>{m} мес</option>)}
                  </select>
                  <button disabled={busy} onClick={() => act(() => udsApi.grantSubscription(login, token, targetLogin, subMonths))}
                    className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded hover:opacity-90 disabled:opacity-50">
                    Выдать / продлить
                  </button>
                  <button disabled={busy} onClick={() => act(() => udsApi.grantSubscription(login, token, targetLogin, 1, true))}
                    className="px-3 py-1.5 border border-border text-xs rounded hover:bg-muted disabled:opacity-50">
                    Отозвать
                  </button>
                </div>
              </ActionBlock>
            )}

            {/* Токены — по правам */}
            {perms.can_tokens && (
              <ActionBlock icon="Coins" title="Баланс ИИ (₽)">
                <div className="flex items-center gap-2">
                  <input value={tokensRub} onChange={e => setTokensRub(e.target.value)} placeholder="напр. 100 или -50"
                    className="w-32 border border-border rounded px-2 py-1.5 text-xs" />
                  <button disabled={busy || !tokensRub} onClick={() => act(async () => { await udsApi.grantTokens(login, token, targetLogin, Number(tokensRub)); setTokensRub(""); })}
                    className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded hover:opacity-90 disabled:opacity-50">
                    Начислить
                  </button>
                </div>
              </ActionBlock>
            )}

            {/* Смена пароля — все */}
            {perms.can_block_user && targetLogin !== "admin" && (
              <ActionBlock icon="KeyRound" title="Смена пароля">
                <div className="flex items-center gap-2">
                  <input type="text" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="новый пароль (≥6)"
                    className="flex-1 border border-border rounded px-2 py-1.5 text-xs" />
                  <button disabled={busy || newPass.length < 6} onClick={() => act(async () => { await udsApi.resetUserPassword(login, token, targetLogin, newPass); setNewPass(""); }, false)}
                    className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded hover:opacity-90 disabled:opacity-50">
                    Сменить
                  </button>
                </div>
              </ActionBlock>
            )}

            {/* Блокировка — все */}
            {perms.can_block_user && targetLogin !== "admin" && (
              <ActionBlock icon="Ban" title="Доступ">
                <button disabled={busy} onClick={() => act(() => udsApi.blockUser(login, token, targetLogin, user.is_active))}
                  className={`px-3 py-1.5 text-xs font-semibold rounded disabled:opacity-50 ${user.is_active ? "bg-red-500 text-white hover:bg-red-600" : "bg-green-600 text-white hover:bg-green-700"}`}>
                  {user.is_active ? "Заблокировать" : "Разблокировать"}
                </button>
              </ActionBlock>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBlock({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon name={icon} size={14} className="text-muted-foreground" fallback="Circle" />
        <p className="text-xs font-semibold">{title}</p>
      </div>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className="font-medium break-words">{value}</p>
    </div>
  );
}
