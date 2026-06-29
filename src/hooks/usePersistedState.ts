import { useState, useEffect, useRef, Dispatch, SetStateAction } from "react";

/**
 * Как useState, но значение автоматически сохраняется в localStorage по ключу
 * и восстанавливается при следующем монтировании (переход между разделами,
 * перезагрузка страницы). Черновики форм не сбрасываются.
 *
 * @param key      Уникальный ключ хранилища (например "form:tests").
 * @param initial  Значение по умолчанию, если в хранилище ничего нет.
 */
export function usePersistedState<T>(
  key: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const storageKey = `draft:${key}`;

  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      /* ignore */
    }
    return initial;
  });

  // Чтобы не писать в хранилище на самом первом рендере без необходимости
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* ignore (например, приватный режим / переполнение) */
    }
  }, [storageKey, value]);

  return [value, setValue];
}

/** Удалить сохранённый черновик по ключу (например, после успешной отправки). */
export function clearPersistedState(key: string) {
  try {
    localStorage.removeItem(`draft:${key}`);
  } catch {
    /* ignore */
  }
}

export default usePersistedState;
