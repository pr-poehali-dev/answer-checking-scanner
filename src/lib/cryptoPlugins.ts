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

// ── Загрузка внешних скриптов плагинов ─────────────────────────────────────────
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Не удалось загрузить ${src}`));
    document.head.appendChild(s);
  });
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
declare global { interface Window { rutoken?: any; cadesplugin?: any; } }

const rutoken = {
  async plugin(): Promise<any> {
    await loadScript("https://localhost:53415/api/rutoken.js").catch(() => {});
    const rt = window.rutoken;
    if (!rt) throw new Error("Плагин Рутокен не найден. Установите Rutoken Plugin и перезапустите браузер.");
    const ext = await rt.ready
      .then(() => (rt.isExtensionInstalled ? rt.isExtensionInstalled() : Promise.resolve(true)))
      .then((ok: boolean) => (ok ? (rt.isPluginInstalled ? rt.isPluginInstalled() : Promise.resolve(true)) : Promise.reject(new Error("Расширение Рутокен не установлено"))))
      .then((ok: boolean) => (ok ? rt.loadPlugin() : Promise.reject(new Error("Плагин Рутокен не установлен"))));
    return ext;
  },

  async firstDevice(plugin: any): Promise<number> {
    const devices: number[] = await plugin.enumerateDevices();
    if (!devices || devices.length === 0) throw new Error("Рутокен не найден. Подключите токен.");
    return devices[0];
  },

  async issue(subjectCN: string, pin: string): Promise<IssueResult> {
    const plugin = await this.plugin();
    const deviceId = await this.firstDevice(plugin);
    await plugin.login(deviceId, pin);
    // Генерируем ключевую пару ГОСТ на самом токене (неизвлекаемую)
    const keyOptions = { paramset: "A" };
    const keyId = await plugin.generateKeyPair(deviceId, false, "", keyOptions);
    const dn = [{ rdn: "commonName", value: subjectCN }, { rdn: "organizationName", value: "САОУ" }, { rdn: "organizationUnitName", value: "УДС" }];
    const csrB64 = await plugin.createPkcs10(deviceId, keyId, { dn }, {});
    return { csr: csrB64.includes(PEM_HEAD) ? csrB64 : toPemCsr(csrB64), context: { plugin, deviceId, keyId, pin } };
  },

  async install(ctx: any, certPem: string): Promise<void> {
    const { plugin, deviceId } = ctx;
    const certB64 = stripPem(certPem);
    await plugin.importCertificate(deviceId, certB64, plugin.CERT_CATEGORY_USER ?? 1);
  },

  async sign(nonce: string, pin: string): Promise<SignResult> {
    const plugin = await this.plugin();
    const deviceId = await this.firstDevice(plugin);
    await plugin.login(deviceId, pin);
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
const cryptopro = {
  async api(): Promise<any> {
    await loadScript("/cadesplugin_api.js").catch(() => {});
    const cp = window.cadesplugin;
    if (!cp) throw new Error("КриптоПро ЭЦП Browser plug-in не найден. Установите плагин и КриптоПро CSP.");
    await cp;
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
  async issue(type: ContainerType, subjectCN: string, pin?: string): Promise<IssueResult> {
    return type === "rutoken" ? rutoken.issue(subjectCN, pin || "") : cryptopro.issue(subjectCN);
  },
  async install(type: ContainerType, ctx: unknown, certPem: string): Promise<void> {
    return type === "rutoken" ? rutoken.install(ctx, certPem) : cryptopro.install(ctx, certPem);
  },
  async sign(type: ContainerType, nonce: string, pin?: string): Promise<SignResult> {
    return type === "rutoken" ? rutoken.sign(nonce, pin || "") : cryptopro.sign(nonce);
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
};