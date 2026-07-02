/**
 * Интеграция с криптоплагинами Рутокен и КриптоПро для выпуска и использования
 * сертификатов УДС с НЕИЗВЛЕКАЕМЫМ ключом (ключевая пара создаётся на токене / в CSP).
 *
 * Требуется установленный на ПК сотрудника плагин:
 *  - Рутокен:  Rutoken Plugin (https://www.rutoken.ru/products/all/rutoken-plugin/)
 *  - КриптоПро: КриптоПро ЭЦП Browser plug-in
 *
 * Без плагина выпуск физически невозможен.
 */

export type ContainerType = "rutoken" | "cryptopro";

export interface IssueResult {
  csr: string;          // PKCS#10 в PEM
  context: unknown;     // внутренний контекст (id ключа / контейнер)
}

export interface SignResult {
  signature: string;    // base64
  fingerprint: string;  // SHA-256 hex отпечаток сертификата
}

export interface RutokenDevice {
  id: number;           // внутренний id устройства в плагине
  label: string;        // метка/имя токена
  model: string;        // модель (Rutoken ECP 3.0 и т.п.)
  supportsGost: boolean;// эвристика поддержки ГОСТ по модели
}

// ГОСТ-контейнер, созданный на токене (ШАГ 1 перед выпуском сертификата)
 
export interface GostContainer {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  plugin: any;
  deviceId: number;
  keyId: string;
  pin: string;
  algorithm: string;    // человекочитаемое имя сработавшего ГОСТ-алгоритма
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

// ════════════════════════ RUTOKEN ════════════════════════════════════════════
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global { interface Window { rutoken?: any; cadesplugin?: any; chrome?: any; } }

// Официальные api-скрипты грузим как обычные <script src> (через Vite ?url),
// чтобы они выполнились в окне страницы и подцепили мост, внедрённый расширением.
import rutokenAdapterUrl from "@aktivco/rutoken-plugin/rutoken-plugin.min.js?url";
import cadespluginUrl from "crypto-pro-cadesplugin/dist/lib/cadesplugin_api.js?url";

// Загрузка внешнего скрипта в <head> один раз
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

let rtPluginCache: any = null;

// Человекочитаемые сообщения по кодам ошибок Рутокен Плагина
function rutokenErrorMessage(err: any): string {
  const code = typeof err === "number" ? err
    : (err && (err.code ?? err.errorCode ?? err.message));
  const n = Number(code);
  const MAP: Record<number, string> = {
    2:   "Токен не поддерживает выбранный алгоритм ключа. Обновите Рутокен Плагин и драйверы, либо используйте токен с поддержкой ГОСТ.",
    8:   "Рутокен не подключён или был извлечён. Вставьте токен и попробуйте снова.",
    18:  "Неверный PIN-код Рутокена.",
    19:  "PIN-код заблокирован: исчерпаны попытки ввода. Разблокируйте токен через «Панель управления Рутокен».",
    93:  "Неверный PIN-код Рутокена. Введите корректный PIN и попробуйте снова.",
    94:  "Требуется PIN-код Рутокена. Введите PIN в поле ниже.",
    113: "PIN-код заблокирован. Разблокируйте токен через «Панель управления Рутокен».",
  };
  if (!Number.isNaN(n) && MAP[n]) return MAP[n];
  if (typeof err === "string") return err;
  if (err && err.message) return String(err.message);
  return `Ошибка Рутокена (код ${code}). Проверьте PIN-код и подключение токена.`;
}

async function rtLogin(plugin: any, deviceId: number, pin: string): Promise<void> {
  if (!pin) throw new Error("Введите PIN-код Рутокена в поле ниже.");
  try {
    await plugin.login(deviceId, pin);
  } catch (e) {
    throw new Error(rutokenErrorMessage(e));
  }
}

async function ensureRutokenAdapter(): Promise<void> {
  if (window.rutoken) return;
  await loadScript(rutokenAdapterUrl);
  // Адаптер инициализируется асинхронно — ждём появления window.rutoken
  for (let i = 0; i < 50 && !window.rutoken; i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
}

const rutoken = {
  async plugin(): Promise<any> {
    if (rtPluginCache) return rtPluginCache;
    await ensureRutokenAdapter();
    const rt = window.rutoken;
    if (!rt || !rt.ready) {
      throw new Error("Не найдено расширение «Адаптер Рутокен Плагин» в браузере. Установите его по ссылке ниже, включите и перезапустите браузер.");
    }
    await rt.ready;
    const isChromiumOrFF = !!window.chrome || typeof (window as any).InstallTrigger !== "undefined";
    if (isChromiumOrFF && rt.isExtensionInstalled) {
      const extOk = await rt.isExtensionInstalled();
      if (!extOk) throw new Error("Расширение «Адаптер Rutoken Plugin» не установлено в браузере.");
    }
    if (rt.isPluginInstalled) {
      const plugOk = await rt.isPluginInstalled();
      if (!plugOk) throw new Error("Rutoken Plugin не установлен. Установите плагин и перезапустите браузер.");
    }
    const plugin = await rt.loadPlugin();
    rtPluginCache = plugin;
    return plugin;
  },

  async firstDevice(plugin: any): Promise<number> {
    const devices: number[] = await plugin.enumerateDevices();
    if (!devices || devices.length === 0) throw new Error("Рутокен не найден. Подключите токен.");
    return devices[0];
  },

  /** Список подключённых устройств Рутокен с человекочитаемыми метками. */
  async listDevices(): Promise<RutokenDevice[]> {
    const plugin = await this.plugin();
    const ids: number[] = await plugin.enumerateDevices();
    if (!ids || ids.length === 0) return [];
    const out: RutokenDevice[] = [];
    for (const id of ids) {
      let label = `Рутокен #${id}`;
      let model = "";
      try {
        // Название модели токена (например «Rutoken ECP <3.0>»)
        if (plugin.getDeviceInfo) {
          const DI_LABEL = plugin.TOKEN_INFO_LABEL ?? 1;
          const DI_MODEL = plugin.TOKEN_INFO_MODEL ?? 2;
          const l = await plugin.getDeviceInfo(id, DI_LABEL).catch(() => "");
          const m = await plugin.getDeviceInfo(id, DI_MODEL).catch(() => "");
          if (l) label = String(l);
          if (m) model = String(m);
        }
      } catch { /* метка необязательна */ }
      out.push({ id, label, model, supportsGost: /ECP|ЭЦП|2\.0|3\.0/i.test(`${label} ${model}`) });
    }
    return out;
  },

  /**
   * ШАГ 1. Создаёт неизвлекаемый ГОСТ-контейнер (ключевую пару) на токене.
   * Перебирает ГОСТ-2012 (256) → ГОСТ-2001 — что поддержит токен.
   * Возвращает контекст с keyId и названием сработавшего алгоритма.
   */
  async createGostContainer(pin: string, deviceId?: number): Promise<GostContainer> {
    const plugin = await this.plugin();
    if (deviceId == null) deviceId = await this.firstDevice(plugin);
    await rtLogin(plugin, deviceId, pin);
    try {
      const GostR3410_2012_256 = plugin.KEY_ALGORITHM_GOST3410_2012_256 ?? 4;
      const GostR3410_2001 = plugin.KEY_ALGORITHM_GOST3410_2001 ?? 1;
      const variants: Array<{ algo: number; opts: any; name: string }> = [
        { algo: GostR3410_2012_256, opts: { paramset: "A" }, name: "ГОСТ Р 34.10-2012 (256 бит)" },
        { algo: GostR3410_2012_256, opts: {}, name: "ГОСТ Р 34.10-2012 (256 бит)" },
        { algo: GostR3410_2001, opts: { paramset: "A" }, name: "ГОСТ Р 34.10-2001" },
        { algo: GostR3410_2001, opts: {}, name: "ГОСТ Р 34.10-2001" },
      ];

      let keyId: string | null = null;
      let algorithm = "";
      let lastErr: any = null;
      for (const v of variants) {
        try {
          // generateKeyPair(deviceId, extractable, keyLabel, keyOptions, keyAlgorithm)
          keyId = await plugin.generateKeyPair(deviceId, false, "", v.opts, v.algo);
          if (keyId != null) { algorithm = v.name; break; }
        } catch (e) {
          lastErr = e;
        }
      }
      // Последняя попытка — старая сигнатура без явного алгоритма
      if (keyId == null) {
        try {
          keyId = await plugin.generateKeyPair(deviceId, false, "", { paramset: "A" });
          algorithm = "ГОСТ (авто)";
        } catch (e) {
          lastErr = e;
        }
      }
      if (keyId == null) throw lastErr ?? new Error("Не удалось создать ГОСТ-контейнер на Рутокене");

      return { plugin, deviceId, keyId, pin, algorithm };
    } catch (e) {
      throw new Error(rutokenErrorMessage(e));
    }
  },

  /**
   * ШАГ 2. Формирует запрос на сертификат (CSR) на основе готового ГОСТ-контейнера.
   * Если контейнер не передан — создаёт его сам (обратная совместимость).
   */
  async issue(subjectCN: string, pin: string, deviceId?: number, container?: GostContainer): Promise<IssueResult> {
    const ctn = container ?? await this.createGostContainer(pin, deviceId);
    const { plugin, deviceId: devId, keyId } = ctn;
    try {
      const dn = [{ rdn: "commonName", value: subjectCN }, { rdn: "organizationName", value: "САОУ" }, { rdn: "organizationUnitName", value: "УДС" }];
      let csrB64: string | null = null;
      let lastErr: any = null;
      for (const csrOpts of [{ signAlgorithm: "GOST R 34.10-2012-256" }, {}]) {
        try {
          csrB64 = await plugin.createPkcs10(devId, keyId, { dn }, csrOpts);
          if (csrB64) break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!csrB64) throw lastErr ?? new Error("Не удалось создать запрос на сертификат");

      return { csr: csrB64.includes(PEM_HEAD) ? csrB64 : toPemCsr(csrB64), context: { plugin, deviceId: devId, keyId, pin } };
    } catch (e) {
      throw new Error(rutokenErrorMessage(e));
    }
  },

  async install(ctx: any, certPem: string): Promise<void> {
    const { plugin, deviceId } = ctx;
    const certB64 = stripPem(certPem);
    await plugin.importCertificate(deviceId, certB64, plugin.CERT_CATEGORY_USER ?? 1);
  },

  async sign(nonce: string, pin: string, deviceId?: number): Promise<SignResult> {
    const plugin = await this.plugin();
    if (deviceId == null) deviceId = await this.firstDevice(plugin);
    await rtLogin(plugin, deviceId, pin);
    const certs: string[] = await plugin.enumerateCertificates(deviceId, plugin.CERT_CATEGORY_USER ?? 1);
    if (!certs || certs.length === 0) throw new Error("На токене нет сертификата УДС");
    const certId = certs[0];
    const info = await plugin.parseCertificate(deviceId, certId);
    const fingerprint = (info.fingerprint || info.serialNumber || "").toLowerCase();
    const signature = await plugin.rawSign
      ? await plugin.rawSign(deviceId, certId, btoa(nonce), {})
      : await plugin.sign(deviceId, certId, btoa(nonce), plugin.DATA_FORMAT_PLAIN ?? 0, {});
    return { signature, fingerprint };
  },
};

// ════════════════════════ КРИПТОПРО ══════════════════════════════════════════
let cpCache: any = null;

const cryptopro = {
  async api(): Promise<any> {
    if (cpCache) return cpCache;
    // Официальный cadesplugin_api.js сам внедряет глобальный window.cadesplugin
    if (!window.cadesplugin) {
      await loadScript(cadespluginUrl);
      for (let i = 0; i < 50 && !window.cadesplugin; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    const cp = window.cadesplugin;
    if (!cp) {
      throw new Error("Не найдено расширение «CryptoPro Extension for CAdES» в браузере. Установите его и перезапустите браузер.");
    }
    // Дожидаемся готовности плагина (cadesplugin — это Promise)
    await cp;
    cpCache = cp;
    return cp;
  },

  async issue(subjectCN: string): Promise<IssueResult> {
    const cp = await this.api();
    // Генерация запроса с созданием неизвлекаемого ключа в контейнере CSP
    return await cp.async_spawn(function* (this: any): any {
      const oPrivateKey = yield cp.CreateObjectAsync("X509Enrollment.CX509PrivateKey");
      yield oPrivateKey.propset_ProviderName("Crypto-Pro GOST R 34.10-2012 Cryptographic Service Provider");
      yield oPrivateKey.propset_KeySpec(1);
      yield oPrivateKey.propset_Exportable(false); // НЕизвлекаемый ключ
      const oRequest = yield cp.CreateObjectAsync("X509Enrollment.CX509CertificateRequestPkcs10");
      yield oRequest.InitializeFromPrivateKey(1, oPrivateKey, "");
      const oDN = yield cp.CreateObjectAsync("X509Enrollment.CX500DistinguishedName");
      yield oDN.Encode(`CN="${subjectCN}", O=САОУ, OU=УДС`, 0);
      yield oRequest.propset_Subject(oDN);
      const oEnroll = yield cp.CreateObjectAsync("X509Enrollment.CX509Enrollment");
      yield oEnroll.InitializeFromRequest(oRequest);
      const csrB64 = yield oEnroll.CreateRequest(1);
      return { csr: csrB64.includes(PEM_HEAD) ? csrB64 : toPemCsr(csrB64), context: { oEnroll } };
    });
  },

  async install(ctx: any, certPem: string): Promise<void> {
    const cp = await this.api();
    const certB64 = stripPem(certPem);
    await cp.async_spawn(function* (this: any): any {
      const oEnroll = ctx.oEnroll || (yield cp.CreateObjectAsync("X509Enrollment.CX509Enrollment"));
      yield oEnroll.InstallResponse(0, certB64, 0, "");
    });
  },

  async sign(nonce: string): Promise<SignResult> {
    const cp = await this.api();
    return await cp.async_spawn(function* (this: any): any {
      const oStore = yield cp.CreateObjectAsync("CAdESCOM.Store");
      yield oStore.Open(2, "My", 0);
      const oCerts = yield oStore.Certificates;
      const count = yield oCerts.Count;
      if (count < 1) throw new Error("Нет сертификата УДС в хранилище");
      const oCert = yield oCerts.Item(1);
      const thumb = (yield oCert.Thumbprint).toLowerCase();
      const oSigner = yield cp.CreateObjectAsync("CAdESCOM.CPSigner");
      yield oSigner.propset_Certificate(oCert);
      const oSignedData = yield cp.CreateObjectAsync("CAdESCOM.CADESCOM_BASE64_TO_BINARY");
      yield oSignedData;
      const oSD = yield cp.CreateObjectAsync("CAdESCOM.CadesSignedData");
      yield oSD.propset_Content(btoa(nonce));
      const signature = yield oSD.SignCades(oSigner, 1, true);
      yield oStore.Close();
      return { signature: signature.replace(/\s+/g, ""), fingerprint: thumb };
    });
  },
};
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Унифицированный фасад ─────────────────────────────────────────────────────
export const cryptoPlugins = {
  /** ШАГ 1 (только Рутокен): создать ГОСТ-контейнер на выбранном носителе. */
  async createRutokenContainer(pin?: string, deviceId?: number): Promise<GostContainer> {
    return rutoken.createGostContainer(pin || "", deviceId);
  },

  async issue(type: ContainerType, subjectCN: string, pin?: string, deviceId?: number, container?: GostContainer): Promise<IssueResult> {
    return type === "rutoken"
      ? rutoken.issue(subjectCN, pin || "", deviceId, container)
      : cryptopro.issue(subjectCN);
  },
  async install(type: ContainerType, ctx: unknown, certPem: string): Promise<void> {
    return type === "rutoken" ? rutoken.install(ctx, certPem) : cryptopro.install(ctx, certPem);
  },
  async sign(type: ContainerType, nonce: string, pin?: string, deviceId?: number): Promise<SignResult> {
    return type === "rutoken" ? rutoken.sign(nonce, pin || "", deviceId) : cryptopro.sign(nonce);
  },

  /** Список подключённых носителей Рутокен (для выбора конкретного токена). */
  async listRutokenDevices(): Promise<RutokenDevice[]> {
    try {
      return await rutoken.listDevices();
    } catch {
      return [];
    }
  },

  /** Проверяет, установлен ли и доступен плагин нужного типа. */
  async isAvailable(type: ContainerType): Promise<boolean> {
    try {
      if (type === "rutoken") {
        const plugin = await rutoken.plugin();
        return !!plugin;
      }
      const cp = await cryptopro.api();
      return !!cp;
    } catch {
      return false;
    }
  },

  /** Возвращает {ok, reason} с понятным объяснением, чего не хватает. */
  async diagnose(type: ContainerType): Promise<{ ok: boolean; reason: string }> {
    try {
      if (type === "rutoken") {
        await rutoken.plugin();
        return { ok: true, reason: "Плагин Рутокен готов" };
      }
      await cryptopro.api();
      return { ok: true, reason: "КриптоПро готов" };
    } catch (e) {
      return { ok: false, reason: (e as Error).message || "Плагин не найден" };
    }
  },
};