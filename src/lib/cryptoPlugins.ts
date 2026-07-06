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

const EXT_MISSING = "Не найдено расширение «CryptoPro Extension for CAdES» в браузере. Установите КриптоПро ЭЦП Browser plug-in 2.0, добавьте расширение в браузер и перезапустите его.";
const CSP_NOT_READY = "КриптоПро ЭЦП Browser plug-in не готов. Проверьте, что установлен КриптоПро CSP, плагин 2.0 и включено расширение браузера, затем перезапустите браузер.";

// Ждём, пока на объекте cadesplugin появятся рабочие методы. Расширению нужно
// время на подгрузку nmcades_plugin_api.js — поэтому опрашиваем с запасом.
function waitForMethods(ms: number): Promise<boolean> {
  const started = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const cp = window.cadesplugin;
      if (cp && typeof cp.async_spawn === "function" && typeof cp.CreateObjectAsync === "function") {
        resolve(true);
        return;
      }
      if (Date.now() - started >= ms) {
        resolve(false);
        return;
      }
      setTimeout(tick, 150);
    };
    tick();
  });
}

const cryptopro = {
  async api(): Promise<any> {
    if (cpCache) return cpCache;

    // 1. Загружаем cadesplugin_api.js (если ещё не загружен) и ждём появления
    //    самого объекта window.cadesplugin.
    if (!window.cadesplugin) {
      await loadScript(cadespluginUrl).catch(() => {
        throw new Error(EXT_MISSING);
      });
      for (let i = 0; i < 60 && !window.cadesplugin; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    if (!window.cadesplugin) {
      throw new Error(EXT_MISSING);
    }

    // 2. window.cadesplugin — Promise готовности (как на ФНС). Он резолвится,
    //    когда расширение подгрузило свой мост. ВАЖНО: этот Promise может
    //    зареджектиться по таймауту при слишком ранней проверке и «залипнуть»
    //    навсегда. Поэтому НЕ полагаемся только на него: параллельно ждём
    //    появления рабочих методов на объекте (они и есть признак готовности).
    const ready = window.cadesplugin
      .then(() => true)
      .catch(() => false);

    // Ждём либо резолва Promise, либо появления методов — что наступит раньше,
    // но не дольше 15 секунд (расширению нужно время на «рукопожатие»).
    const hasMethods = await Promise.race([
      ready.then((ok: boolean) => ok && waitForMethods(0)),
      waitForMethods(15000),
    ]).catch(() => false);

    const cp = window.cadesplugin;
    if (!hasMethods || !cp || typeof cp.async_spawn !== "function" || typeof cp.CreateObjectAsync !== "function") {
      // Даём последний шанс — вдруг методы появились только что.
      const late = await waitForMethods(3000);
      const cp2 = window.cadesplugin;
      if (!late || !cp2 || typeof cp2.async_spawn !== "function") {
        throw new Error(CSP_NOT_READY);
      }
      cpCache = cp2;
      return cp2;
    }

    cpCache = cp;
    return cp;
  },

  /**
   * Безопасная обёртка над cp.async_spawn: перехватывает внутренние сбои моста
   * КриптоПро (в т.ч. «Cannot read properties of undefined (reading 'async_spawn')»)
   * и превращает их в понятное сообщение. При сбое сбрасывает кэш, чтобы следующая
   * попытка переинициализировала плагин.
   */
  async spawn<T>(gen: (cp: any) => Generator<any, T, any>): Promise<T> {
    const cp = await this.api();
    try {
      return (await cp.async_spawn(function* (this: any): any {
        return yield* gen(cp);
      })) as T;
    } catch (e) {
      const msg = (e as Error)?.message || String(e);
      if (/async_spawn|Cannot read prop|undefined \(reading/i.test(msg)) {
        cpCache = null; // сброс кэша — плагин был «полуготов»
        throw new Error(CSP_NOT_READY);
      }
      throw e;
    }
  },

  /**
   * Перечисляет сертификаты из личного хранилища «My» (для входа с выбором носителя).
   */
  async listCertificates(): Promise<CryptoProMedia[]> {
    return await this.spawn(function* (cp: any): any {
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
    return await this.spawn(function* (cp: any): any {
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
    const certB64 = stripPem(certPem);
    await this.spawn(function* (cp: any): any {
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
    return await this.spawn(function* (cp: any): any {
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