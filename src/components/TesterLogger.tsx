import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";

interface LogEntry {
  time: string;
  type: "error" | "warn" | "log" | "fetch" | "action";
  message: string;
  detail?: string;
}

const MAX_ENTRIES = 300;

function ts() {
  return new Date().toLocaleTimeString("ru-RU", { hour12: false });
}

// Глобальное хранилище логов (вне React, чтобы перехватчики не зависели от ре-рендеров)
const listeners: Array<(e: LogEntry) => void> = [];
let installed = false;

function addGlobal(entry: LogEntry) {
  listeners.forEach((fn) => fn(entry));
}

function installInterceptors() {
  if (installed) return;
  installed = true;

  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => { origError(...args); addGlobal({ time: ts(), type: "error", message: args.map(String).join(" ") }); };

  const origWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => { origWarn(...args); addGlobal({ time: ts(), type: "warn", message: args.map(String).join(" ") }); };

  const origLog = console.log.bind(console);
  console.log = (...args: unknown[]) => { origLog(...args); addGlobal({ time: ts(), type: "log", message: args.map(String).join(" ") }); };

  window.addEventListener("error", (e: ErrorEvent) => {
    addGlobal({ time: ts(), type: "error", message: `[JS] ${e.message}`, detail: `${e.filename}:${e.lineno}:${e.colno}` });
  });
  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    addGlobal({ time: ts(), type: "error", message: `[Promise] ${String(e.reason)}` });
  });

  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    const method = init?.method || "GET";
    const start = Date.now();
    try {
      const res = await origFetch(input, init);
      const elapsed = Date.now() - start;
      const entry: LogEntry = { time: ts(), type: "fetch", message: `${method} ${url} → ${res.status} ${res.statusText} (${elapsed}ms)` };
      if (!res.ok) {
        try { entry.detail = (await res.clone().text()).slice(0, 500); } catch { /* ignore */ }
      }
      addGlobal(entry);
      return res;
    } catch (err) {
      addGlobal({ time: ts(), type: "error", message: `[fetch] ${method} ${url} → FAILED: ${String(err)}` });
      throw err;
    }
  };

  document.addEventListener("click", (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    const text = (t.textContent || "").trim().slice(0, 60);
    addGlobal({ time: ts(), type: "action", message: `click <${t.tagName.toLowerCase()}> "${text}"` });
  }, true);

  window.addEventListener("popstate", () => {
    addGlobal({ time: ts(), type: "action", message: `navigate → ${location.pathname}` });
  });
}

// ── Компонент (встраивается в хедер ЛК) ─────────────────────────────────────
export default function TesterLogger() {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogEntry["type"] | "all">("all");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    installInterceptors();
    const handler = (e: LogEntry) => setLogs((prev) => {
      const next = [...prev, e];
      return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next;
    });
    listeners.push(handler);
    return () => { const i = listeners.indexOf(handler); if (i >= 0) listeners.splice(i, 1); };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  }, [open, logs.length]);

  const hasErrors = logs.some((l) => l.type === "error");
  const filtered = filter === "all" ? logs : logs.filter((l) => l.type === filter);

  const copyAll = () => {
    const text = filtered.map((l) =>
      `[${l.time}] [${l.type.toUpperCase()}] ${l.message}${l.detail ? `\n  → ${l.detail}` : ""}`
    ).join("\n");
    navigator.clipboard.writeText(text);
  };

  const typeColor: Record<LogEntry["type"], string> = {
    error: "text-red-400", warn: "text-yellow-400", log: "text-gray-300", fetch: "text-blue-400", action: "text-green-400",
  };
  const typeBg: Record<LogEntry["type"] | "all", string> = {
    all: "bg-gray-600", error: "bg-red-700", warn: "bg-yellow-700", log: "bg-gray-600", fetch: "bg-blue-700", action: "bg-green-700",
  };

  const panel = open ? createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-none flex items-end justify-end p-4">
      <div className="pointer-events-auto w-[500px] max-w-[95vw] h-[65vh] bg-gray-900 text-white rounded-xl shadow-2xl flex flex-col border border-gray-700 overflow-hidden">
        {/* Шапка */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700 flex-shrink-0">
          <span className="font-mono text-sm font-bold text-gray-200">🐛 Tester Log</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{logs.length} записей</span>
            <button onClick={copyAll} className="text-xs bg-blue-700 hover:bg-blue-600 px-2 py-1 rounded font-mono">
              Копировать
            </button>
            <button onClick={() => setLogs([])} className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded font-mono">
              Очистить
            </button>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white ml-1">
              <Icon name="X" size={16} />
            </button>
          </div>
        </div>

        {/* Фильтры */}
        <div className="flex gap-1 px-3 py-2 border-b border-gray-700 flex-shrink-0 flex-wrap bg-gray-900">
          {(["all", "error", "warn", "fetch", "action", "log"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`text-xs px-2 py-0.5 rounded font-mono transition-colors ${filter === t ? typeBg[t] : "bg-gray-700 hover:bg-gray-600"}`}
            >
              {t === "all" ? "Все" : t.toUpperCase()}
              {t !== "all" && <span className="ml-1 opacity-70">{logs.filter((l) => l.type === t).length}</span>}
            </button>
          ))}
        </div>

        {/* Записи */}
        <div className="flex-1 overflow-y-auto font-mono text-xs p-2 space-y-0.5">
          {filtered.length === 0 && (
            <div className="text-gray-500 text-center mt-8">Пока нет записей — выполни действие</div>
          )}
          {filtered.map((entry, i) => (
            <div key={i} className="flex gap-2 hover:bg-gray-800 rounded px-1 py-0.5">
              <span className="text-gray-500 shrink-0">{entry.time}</span>
              <span className={`shrink-0 font-bold ${typeColor[entry.type]}`}>[{entry.type.toUpperCase()}]</span>
              <span className="break-all text-gray-200 leading-relaxed">
                {entry.message}
                {entry.detail && <span className="block text-gray-400 pl-2">{entry.detail}</span>}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Лог тестера"
        className={`
          relative inline-flex items-center justify-center w-8 h-8 rounded-md text-base transition-colors
          ${open ? "bg-gray-200 text-gray-800" : "hover:bg-gray-100 text-gray-500"}
        `}
      >
        🐛
        {hasErrors && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        )}
      </button>
      {panel}
    </>
  );
}
