import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";

interface LogEntry {
  time: string;
  type: "error" | "warn" | "log" | "fetch" | "action";
  message: string;
  detail?: string;
}

const MAX_ENTRIES = 300;

function timestamp() {
  return new Date().toLocaleTimeString("ru-RU", { hour12: false });
}

export default function TesterLogger() {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogEntry["type"] | "all">("all");
  const bottomRef = useRef<HTMLDivElement>(null);

  const addLog = (entry: LogEntry) => {
    setLogs((prev) => {
      const next = [...prev, entry];
      return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next;
    });
  };

  useEffect(() => {
    // ── console.error ──────────────────────────────────────────────
    const origError = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      origError(...args);
      addLog({ time: timestamp(), type: "error", message: args.map(String).join(" ") });
    };

    // ── console.warn ───────────────────────────────────────────────
    const origWarn = console.warn.bind(console);
    console.warn = (...args: unknown[]) => {
      origWarn(...args);
      addLog({ time: timestamp(), type: "warn", message: args.map(String).join(" ") });
    };

    // ── console.log ────────────────────────────────────────────────
    const origLog = console.log.bind(console);
    console.log = (...args: unknown[]) => {
      origLog(...args);
      addLog({ time: timestamp(), type: "log", message: args.map(String).join(" ") });
    };

    // ── Глобальные JS-ошибки ───────────────────────────────────────
    const onError = (e: ErrorEvent) => {
      addLog({
        time: timestamp(),
        type: "error",
        message: `[JS] ${e.message}`,
        detail: `${e.filename}:${e.lineno}:${e.colno}`,
      });
    };
    const onUnhandled = (e: PromiseRejectionEvent) => {
      addLog({
        time: timestamp(),
        type: "error",
        message: `[Promise] ${String(e.reason)}`,
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandled);

    // ── Перехват fetch ─────────────────────────────────────────────
    const origFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
      const method = init?.method || "GET";
      const start = Date.now();
      try {
        const res = await origFetch(input, init);
        const elapsed = Date.now() - start;
        const entry: LogEntry = {
          time: timestamp(),
          type: "fetch",
          message: `${method} ${url} → ${res.status} ${res.statusText} (${elapsed}ms)`,
        };
        if (!res.ok) {
          const cloned = res.clone();
          try {
            const body = await cloned.text();
            entry.detail = body.slice(0, 500);
          } catch { /* ignore */ }
        }
        addLog(entry);
        return res;
      } catch (err) {
        addLog({
          time: timestamp(),
          type: "error",
          message: `[fetch] ${method} ${url} → FAILED: ${String(err)}`,
        });
        throw err;
      }
    };

    // ── Клики и навигация ──────────────────────────────────────────
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      const text = (target.textContent || "").trim().slice(0, 60);
      const cls = target.className?.toString?.()?.slice(0, 60) || "";
      addLog({
        time: timestamp(),
        type: "action",
        message: `click <${tag}> "${text}"`,
        detail: cls ? `class: ${cls}` : undefined,
      });
    };
    const onPopState = () => {
      addLog({ time: timestamp(), type: "action", message: `navigate → ${location.pathname}` });
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);

    return () => {
      console.error = origError;
      console.warn = origWarn;
      console.log = origLog;
      window.fetch = origFetch;
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandled);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  // Скролл вниз при открытии
  useEffect(() => {
    if (open) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [open, logs]);

  const hasErrors = logs.some((l) => l.type === "error");
  const filtered = filter === "all" ? logs : logs.filter((l) => l.type === filter);

  const copyAll = () => {
    const text = filtered
      .map((l) => `[${l.time}] [${l.type.toUpperCase()}] ${l.message}${l.detail ? `\n  → ${l.detail}` : ""}`)
      .join("\n");
    navigator.clipboard.writeText(text);
  };

  const typeColor: Record<LogEntry["type"], string> = {
    error: "text-red-400",
    warn: "text-yellow-400",
    log: "text-gray-300",
    fetch: "text-blue-400",
    action: "text-green-400",
  };

  const typeBg: Record<LogEntry["type"] | "all", string> = {
    all: "bg-gray-600",
    error: "bg-red-700",
    warn: "bg-yellow-700",
    log: "bg-gray-600",
    fetch: "bg-blue-700",
    action: "bg-green-700",
  };

  return (
    <>
      {/* Кнопка-жук */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Тестер: открыть лог"
        className={`
          fixed bottom-5 right-5 z-[9999] w-12 h-12 rounded-full shadow-lg
          flex items-center justify-center text-white text-xl
          transition-all duration-200 hover:scale-110
          ${hasErrors ? "bg-red-600 animate-pulse" : "bg-gray-800 hover:bg-gray-700"}
        `}
      >
        🐛
      </button>

      {/* Панель лога */}
      {open && (
        <div className="fixed bottom-20 right-5 z-[9999] w-[480px] max-w-[95vw] h-[60vh] bg-gray-900 text-white rounded-xl shadow-2xl flex flex-col border border-gray-700 overflow-hidden">
          {/* Шапка */}
          <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700 flex-shrink-0">
            <span className="font-mono text-sm font-bold text-gray-200">🐛 Tester Log</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{logs.length} записей</span>
              <button
                onClick={copyAll}
                title="Скопировать лог"
                className="text-xs bg-blue-700 hover:bg-blue-600 px-2 py-1 rounded font-mono"
              >
                Копировать
              </button>
              <button
                onClick={() => setLogs([])}
                title="Очистить"
                className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded font-mono"
              >
                Очистить
              </button>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white ml-1">
                <Icon name="X" size={16} />
              </button>
            </div>
          </div>

          {/* Фильтры */}
          <div className="flex gap-1 px-3 py-2 bg-gray-850 border-b border-gray-700 flex-shrink-0 flex-wrap bg-gray-900">
            {(["all", "error", "warn", "fetch", "action", "log"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`text-xs px-2 py-0.5 rounded font-mono transition-colors ${
                  filter === t ? typeBg[t] : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
                {t === "all" ? "Все" : t.toUpperCase()}
                {t !== "all" && (
                  <span className="ml-1 opacity-70">{logs.filter((l) => l.type === t).length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Записи */}
          <div className="flex-1 overflow-y-auto font-mono text-xs p-2 space-y-0.5">
            {filtered.length === 0 && (
              <div className="text-gray-500 text-center mt-8">Пока нет записей</div>
            )}
            {filtered.map((entry, i) => (
              <div key={i} className="flex gap-2 hover:bg-gray-800 rounded px-1 py-0.5">
                <span className="text-gray-500 shrink-0">{entry.time}</span>
                <span className={`shrink-0 font-bold ${typeColor[entry.type]}`}>
                  [{entry.type.toUpperCase()}]
                </span>
                <span className="break-all text-gray-200 leading-relaxed">
                  {entry.message}
                  {entry.detail && (
                    <span className="block text-gray-400 pl-2">{entry.detail}</span>
                  )}
                </span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
      )}
    </>
  );
}
