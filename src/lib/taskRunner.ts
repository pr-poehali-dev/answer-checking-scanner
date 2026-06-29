// Менеджер фоновых задач генерации ИИ.
// Запущенная генерация продолжается даже при переходе в другой раздел
// (компонент может размонтироваться — задача живёт здесь, вне React).
import { useState, useEffect } from "react";

export interface TaskState {
  running: boolean;
  stage: string;
  progress: number;   // 0..100 (для задач с прогресс-баром)
  elapsed: number;    // секунд с начала
  error: string | null;
  success: string | null;
}

const EMPTY: TaskState = {
  running: false,
  stage: "",
  progress: 0,
  elapsed: 0,
  error: null,
  success: null,
};

type Listener = () => void;

interface TaskRecord {
  state: TaskState;
  listeners: Set<Listener>;
  timer: ReturnType<typeof setInterval> | null;
}

const tasks = new Map<string, TaskRecord>();

function getRecord(key: string): TaskRecord {
  let rec = tasks.get(key);
  if (!rec) {
    rec = { state: { ...EMPTY }, listeners: new Set(), timer: null };
    tasks.set(key, rec);
  }
  return rec;
}

function emit(rec: TaskRecord) {
  rec.listeners.forEach(l => l());
}

function patch(key: string, partial: Partial<TaskState>) {
  const rec = getRecord(key);
  rec.state = { ...rec.state, ...partial };
  emit(rec);
}

/** Колбэки, которыми задача обновляет своё состояние во время работы. */
export interface TaskHandle {
  setStage: (stage: string) => void;
  setProgress: (progress: number) => void;
}

/** Параметры запуска фоновой задачи. */
interface RunOptions<T> {
  /** Уникальный ключ задачи (например "worksheets", "tests", "presentations"). */
  key: string;
  /** Основная работа: вернёт текст успеха или undefined. */
  run: (handle: TaskHandle) => Promise<string | void>;
  /** Авто-прогресс (псевдо-таймер). Если задан — раннер сам тикает прогресс. */
  autoProgress?: boolean;
}

export const taskRunner = {
  getState(key: string): TaskState {
    return getRecord(key).state;
  },

  isRunning(key: string): boolean {
    return getRecord(key).state.running;
  },

  subscribe(key: string, listener: Listener): () => void {
    const rec = getRecord(key);
    rec.listeners.add(listener);
    return () => rec.listeners.delete(listener);
  },

  /** Сбросить сообщения об ошибке/успехе (например при правке формы). */
  clearMessages(key: string) {
    patch(key, { error: null, success: null });
  },

  /** Запускает фоновую задачу. Если уже выполняется — игнорирует повторный запуск. */
  async run<T>({ key, run, autoProgress }: RunOptions<T>): Promise<void> {
    const rec = getRecord(key);
    if (rec.state.running) return;

    rec.state = { ...EMPTY, running: true };
    emit(rec);

    // Таймер времени + псевдо-прогресс
    if (rec.timer) clearInterval(rec.timer);
    rec.timer = setInterval(() => {
      const s = rec.state;
      let nextProgress = s.progress;
      if (autoProgress) {
        if (s.progress < 40) nextProgress = s.progress + 2.2;
        else if (s.progress < 70) nextProgress = s.progress + 0.9;
        else if (s.progress < 88) nextProgress = s.progress + 0.3;
      }
      rec.state = { ...s, elapsed: s.elapsed + 1, progress: nextProgress };
      emit(rec);
    }, 1000);

    const handle: TaskHandle = {
      setStage: (stage: string) => patch(key, { stage }),
      setProgress: (progress: number) => patch(key, { progress }),
    };

    try {
      const successMsg = await run(handle);
      if (rec.timer) { clearInterval(rec.timer); rec.timer = null; }
      patch(key, { running: false, stage: "", progress: 0, elapsed: 0, success: successMsg || "Готово!" });
    } catch (e) {
      if (rec.timer) { clearInterval(rec.timer); rec.timer = null; }
      patch(key, { running: false, stage: "", progress: 0, elapsed: 0, error: (e as Error).message || "Не удалось выполнить" });
    }
  },
};

/** React-хук: подписка на состояние фоновой задачи по ключу. */
export function useTaskState(key: string): TaskState {
  const [s, setS] = useState<TaskState>(() => taskRunner.getState(key));
  useEffect(() => {
    setS(taskRunner.getState(key));
    return taskRunner.subscribe(key, () => setS({ ...taskRunner.getState(key) }));
  }, [key]);
  return s;
}
