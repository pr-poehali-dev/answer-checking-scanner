// Локальное хранилище данных пользователя (на его устройстве).
// Данные остаются у пользователя даже без интернета и мгновенно доступны при
// открытии приложения, а затем синхронизируются с нашим сервером.

const PREFIX = "aousp_data_";

export interface LocalSnapshot<S, W, R, P, T, WS, SY> {
  students: S[];
  works: W[];
  results: R[];
  presentations: P[];
  generatedTests: T[];
  worksheets: WS[];
  synopses: SY[];
  savedAt: string;
}

type AnySnapshot = LocalSnapshot<
  Record<string, unknown>, Record<string, unknown>, Record<string, unknown>,
  Record<string, unknown>, Record<string, unknown>, Record<string, unknown>,
  Record<string, unknown>
>;

function key(login: string) {
  return PREFIX + login;
}

/** Убирает тяжёлые вложения (base64-файлы), чтобы влезть в лимит браузера. */
function stripHeavy(data: AnySnapshot): AnySnapshot {
  return {
    ...data,
    synopses: data.synopses.map(s => {
      const copy = { ...s };
      delete copy.docxB64;
      return copy;
    }),
  };
}

/** Оставляет только самое важное — если места совсем мало. */
function minimal(data: AnySnapshot): AnySnapshot {
  return {
    students: data.students,
    works: data.works,
    results: data.results,
    presentations: [],
    generatedTests: [],
    worksheets: [],
    synopses: [],
    savedAt: data.savedAt,
  };
}

/**
 * Сохраняет данные пользователя на его устройстве.
 * При нехватке места последовательно уменьшает объём, чтобы главное (ученики,
 * работы, результаты) сохранилось в любом случае.
 */
export function saveLocalData(login: string, data: Omit<AnySnapshot, "savedAt">): boolean {
  if (!login) return false;
  const full: AnySnapshot = { ...data, savedAt: new Date().toISOString() };
  const attempts = [full, stripHeavy(full), minimal(full)];
  for (const attempt of attempts) {
    try {
      localStorage.setItem(key(login), JSON.stringify(attempt));
      return true;
    } catch { /* нет места — пробуем меньший объём */ }
  }
  return false;
}

/** Читает данные пользователя с его устройства. */
export function loadLocalData(login: string): AnySnapshot | null {
  if (!login) return null;
  try {
    const raw = localStorage.getItem(key(login));
    if (!raw) return null;
    const d = JSON.parse(raw);
    return {
      students: Array.isArray(d.students) ? d.students : [],
      works: Array.isArray(d.works) ? d.works : [],
      results: Array.isArray(d.results) ? d.results : [],
      presentations: Array.isArray(d.presentations) ? d.presentations : [],
      generatedTests: Array.isArray(d.generatedTests) ? d.generatedTests : [],
      worksheets: Array.isArray(d.worksheets) ? d.worksheets : [],
      synopses: Array.isArray(d.synopses) ? d.synopses : [],
      savedAt: typeof d.savedAt === "string" ? d.savedAt : "",
    };
  } catch { return null; }
}

/** Полностью убирает данные пользователя с устройства. */
export function clearLocalData(login: string) {
  if (!login) return;
  try { localStorage.removeItem(key(login)); } catch { /* ignore */ }
}

/** Когда данные последний раз сохранялись на устройстве. */
export function localSavedAt(login: string): string | null {
  return loadLocalData(login)?.savedAt || null;
}
