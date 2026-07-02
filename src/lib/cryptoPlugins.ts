/**
 * Интеграция с КриптоПро для выпуска и использования сертификатов УДС
 * с НЕИЗВЛЕКАЕМЫМ ключом ГОСТ (ключевая пара создаётся в контейнере КриптоПро CSP).
 *
 * Требуется установленное на ПК сотрудника ПО:
 *  - КриптоПро CSP (криптопровайдер, генерация ключа ГОСТ)
 *  - КриптоПро ЭЦП Browser plug-in (+ расширение браузера)
 *
 * Без КриптоПро выпуск и вход по сертификату физически невозможны.
 */

export interface IssueResult {
  csr: string;          // PKCS#10 в PEM
  context: unknown;     // внутренний контекст выпуска (CX509Enrollment)
}

export interface SignResult {
  signature: string;    // base64
  fingerprint: string;  // SHA-1/thumbprint сертификата (hex)
}

/** Носитель/сертификат КриптоПро для выбора пользователем. */
export interface CryptoProMedia {
  thumbprint: string;   // отпечаток сертификата (идентификатор выбора)
  subject: string;      // CN владельца
  issuer: string;       // кем выдан
  validTo: string;      // срок действия «до» (локальная дата)
  container: string;    // имя ключевого контейнера/носителя
}

const PEM_HEAD = "-----BEGIN CERTIFICATE REQUEST-----";
const PEM_FOOT = "-----END CERTIFICATE REQUEST-----";

function toPemCsr(base64: string): string {
  const clean = base64.replace(/\s+/g, "");
  const lines = clean.match(/.{1,64}/g)?.join("\n") ?? clean;
  return `${PEM_HEAD}\n${lines}\n${PEM_FOOT}`;
}

function stripPem(pem: string): string {
  return pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
}

// ════════════════════════ КРИПТОПРО ══════════════════════════════════════════
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global { interface Window { cadesplugin?: any; } }

// Официальный cadesplugin_api.js грузим как обычный <script src> (через Vite ?url),
// чтобы он выполнился в окне страницы и подцепил мост, внедрённый расширением.
import cadespluginUrl from "crypto-pro-cadesplugin/dist/lib/cadesplugin_api.js?url";

const loadedScripts = new Set<string>();
function loadScript(src: string): Promise<void> {
  if (loadedScripts.has(src)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = false;
    s.onload = () => { loadedScripts.add(src); resolve(); };
    s.onerror = () => reject(new Error(`Не удалось загрузить ${src}`));
    document.head.appendChild(s);
  });
}

// Провайдер ГОСТ-2012 (256). При отсутствии CSP выпуск невозможен.
const GOST_2012_PROVIDER = "Crypto-Pro GOST R 34.10-2012 Cryptographic Service Provider";
const CADES_STORE_MY = "My";

let cpCache: any = null;

const cryptopro = {
  async api(): Promise<any> {
    if (cpCache) return cpCache;
    if (!window.cadesplugin) {
      await loadScript(cadespluginUrl);
      for (let i = 0; i < 50 && !window.cadesplugin; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    const cadesplugin = window.cadesplugin;
    if (!cadesplugin) {
      throw new Error("Не найдено расширение «CryptoPro Extension for CAdES» в браузере. Установите КриптоПро ЭЦП Browser plug-in и включите расширение.");
    }
    // window.cadesplugin — Promise готовности; методы остаются на самом объекте.
    try {
      await cadesplugin;
    } catch {
      throw new Error("КриптоПро ЭЦП Browser plug-in не готов. Установите КриптоПро CSP и плагин, включите расширение и перезапустите браузер.");
    }
    const cp = window.cadesplugin;
    if (!cp || typeof cp.async_spawn !== "function" || typeof cp.CreateObjectAsync !== "function") {
      throw new Error("КриптоПро ЭЦП Browser plug-in недоступен. Проверьте установку КриптоПро CSP и плагина, включите расширение и перезапустите браузер.");
    }
    cpCache = cp;
    return cp;
  },

  /**
   * Перечисляет сертификаты из личного хранилища «My» (для входа с выбором носителя).
   */
  async listCertificates(): Promise<CryptoProMedia[]> {
    const cp = await this.api();
    return await cp.async_spawn(function* (this: any): any {
      const list: CryptoProMedia[] = [];
      const oStore = yield cp.CreateObjectAsync("CAdESCOM.Store");
      yield oStore.Open(2, CADES_STORE_MY, 0); // CAPICOM_CURRENT_USER_STORE, readonly
      const oCerts = yield oStore.Certificates;
      const count = yield oCerts.Count;
      for (let i = 1; i <= count; i++) {
        try {
          const oCert = yield oCerts.Item(i);
          const thumbprint = String(yield oCert.Thumbprint).toLowerCase();
          const subjectName = String(yield oCert.SubjectName);
          const issuerName = String(yield oCert.IssuerName);
          const validTo = new Date(yield oCert.ValidToDate).toLocaleDateString("ru-RU");
          // Имя контейнера (носителя) — из закрытого ключа, если доступно
          let container = "";
          try {
            const hasPk = yield oCert.HasPrivateKey();
            if (hasPk) {
              const oPk = yield oCert.PrivateKey;
              container = String(yield oPk.ContainerName);
            }
          } catch { /* контейнер необязателен */ }
          list.push({
            thumbprint,
            subject: extractCN(subjectName),
            issuer: extractCN(issuerName),
            validTo,
            container: container || "—",
          });
        } catch { /* пропускаем нечитаемый сертификат */ }
      }
      yield oStore.Close();
      return list;
    });
  },

  /**
   * ШАГ 1+2. Создаёт неизвлекаемый ГОСТ-ключ в контейнере CSP и формирует CSR.
   * Ключ генерируется КриптоПро CSP; пользователь может выбрать носитель
   * при появлении диалога КриптоПро (реестр/носитель/токен через CSP).
   */
  async issue(subjectCN: string): Promise<IssueResult> {
    const cp = await this.api();
    return await cp.async_spawn(function* (this: any): any {
      const oPrivateKey = yield cp.CreateObjectAsync("X509Enrollment.CX509PrivateKey");
      yield oPrivateKey.propset_ProviderName(GOST_2012_PROVIDER);
      yield oPrivateKey.propset_KeySpec(1);              // AT_KEYEXCHANGE/подпись
      yield oPrivateKey.propset_Exportable(false);       // НЕизвлекаемый ключ
      const oRequest = yield cp.CreateObjectAsync("X509Enrollment.CX509CertificateRequestPkcs10");
      yield oRequest.InitializeFromPrivateKey(1, oPrivateKey, "");
      const oDN = yield cp.CreateObjectAsync("X509Enrollment.CX500DistinguishedName");
      yield oDN.Encode(`CN="${subjectCN}", O=САОУ, OU=УДС`, 0);
      yield oRequest.propset_Subject(oDN);
      const oEnroll = yield cp.CreateObjectAsync("X509Enrollment.CX509Enrollment");
      yield oEnroll.InitializeFromRequest(oRequest);
      const csrB64 = yield oEnroll.CreateRequest(1);     // base64 PKCS#10
      return { csr: csrB64.includes(PEM_HEAD) ? csrB64 : toPemCsr(csrB64), context: { oEnroll } };
    });
  },

  /** ШАГ 3. Устанавливает выпущенный сертификат в контейнер CSP. */
  async install(ctx: any, certPem: string): Promise<void> {
    const cp = await this.api();
    const certB64 = stripPem(certPem);
    await cp.async_spawn(function* (this: any): any {
      const oEnroll = ctx?.oEnroll || (yield cp.CreateObjectAsync("X509Enrollment.CX509Enrollment"));
      yield oEnroll.InstallResponse(0, certB64, 0, "");
    });
  },

  /**
   * Подпись nonce выбранным сертификатом (вход).
   * thumbprint — отпечаток выбранного носителя/сертификата; если не задан,
   * берётся первый доступный.
   */
  async sign(nonce: string, thumbprint?: string): Promise<SignResult> {
    const cp = await this.api();
    return await cp.async_spawn(function* (this: any): any {
      const oStore = yield cp.CreateObjectAsync("CAdESCOM.Store");
      yield oStore.Open(2, CADES_STORE_MY, 0);
      const oCerts = yield oStore.Certificates;
      const count = yield oCerts.Count;
      if (count < 1) { yield oStore.Close(); throw new Error("Нет сертификата УДС в хранилище КриптоПро"); }

      // Выбираем сертификат по отпечатку, иначе — первый
      let oCert: any = null;
      if (thumbprint) {
        const tp = thumbprint.toLowerCase();
        for (let i = 1; i <= count; i++) {
          const c = yield oCerts.Item(i);
          const t = String(yield c.Thumbprint).toLowerCase();
          if (t === tp) { oCert = c; break; }
        }
        if (!oCert) { yield oStore.Close(); throw new Error("Выбранный носитель/сертификат не найден в хранилище"); }
      } else {
        oCert = yield oCerts.Item(1);
      }

      const thumb = String(yield oCert.Thumbprint).toLowerCase();
      const oSigner = yield cp.CreateObjectAsync("CAdESCOM.CPSigner");
      yield oSigner.propset_Certificate(oCert);
      const oSD = yield cp.CreateObjectAsync("CAdESCOM.CadesSignedData");
      yield oSD.propset_Content(btoa(nonce));
      const signature = yield oSD.SignCades(oSigner, 1, true);
      yield oStore.Close();
      return { signature: String(signature).replace(/\s+/g, ""), fingerprint: thumb };
    });
  },
};

function extractCN(dn: string): string {
  const m = dn.match(/CN=([^,]+)/i);
  return m ? m[1].trim() : dn;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Унифицированный фасад (только КриптоПро) ──────────────────────────────────
export const cryptoPlugins = {
  /** Создать ГОСТ-ключ в контейнере CSP и получить CSR. */
  async issue(subjectCN: string): Promise<IssueResult> {
    return cryptopro.issue(subjectCN);
  },

  /** Установить выпущенный сертификат УДС в контейнер КриптоПро. */
  async install(ctx: unknown, certPem: string): Promise<void> {
    return cryptopro.install(ctx, certPem);
  },

  /** Подписать nonce выбранным сертификатом (вход). */
  async sign(nonce: string, thumbprint?: string): Promise<SignResult> {
    return cryptopro.sign(nonce, thumbprint);
  },

  /** Список сертификатов/носителей для выбора при входе. */
  async listCertificates(): Promise<CryptoProMedia[]> {
    try {
      return await cryptopro.listCertificates();
    } catch {
      return [];
    }
  },

  /** Проверяет доступность КриптоПро. */
  async isAvailable(): Promise<boolean> {
    try {
      await cryptopro.api();
      return true;
    } catch {
      return false;
    }
  },

  /** Возвращает {ok, reason} с понятным объяснением, чего не хватает. */
  async diagnose(): Promise<{ ok: boolean; reason: string }> {
    try {
      await cryptopro.api();
      return { ok: true, reason: "КриптоПро готов" };
    } catch (e) {
      return { ok: false, reason: (e as Error).message || "КриптоПро не найден" };
    }
  },
};
