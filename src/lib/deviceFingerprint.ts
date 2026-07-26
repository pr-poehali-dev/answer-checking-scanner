// Стабильный «отпечаток устройства» — не для слежки, а только чтобы не дать
// активировать пробный период дважды с одного и того же браузера/устройства,
// даже если создать новый аккаунт с другим email.
const FP_KEY = "aousp_device_fp_v1";

export function getDeviceFingerprint(): string {
  try {
    let fp = localStorage.getItem(FP_KEY);
    if (!fp) {
      fp = (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(FP_KEY, fp);
    }
    return fp;
  } catch {
    return "";
  }
}
