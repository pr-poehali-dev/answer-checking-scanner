import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { usePersistedState } from "@/hooks/usePersistedState";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = "https://functions.poehali.dev/058ab416-2ba0-49e2-bc62-f54319603522";

const SUGGESTED = [
  "Объясни теорему Пифагора простыми словами",
  "Как составить план урока по математике?",
  "Придумай 5 интересных заданий по истории для 7 класса",
  "Как объяснить ученикам закон Ньютона?",
];

export function ChatSection() {
  const [messages, setMessages] = usePersistedState<Message[]>("chat:messages", []);
  const [input, setInput] = usePersistedState("chat:input", "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Ошибка сервера");
      setMessages([...newMessages, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка соединения");
      setMessages(newMessages); // оставляем сообщение пользователя
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-64px)]">

      {/* Шапка */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <Icon name="Sparkles" size={18} className="text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">GigaChat</h2>
            <p className="text-xs text-gray-400">Сбер ИИ · отвечает на любые вопросы</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1.5 transition-colors"
          >
            <Icon name="Trash2" size={13} />
            Очистить
          </button>
        )}
      </div>

      {/* Область сообщений */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50">

        {/* Приветствие */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg mb-4">
              <Icon name="Sparkles" size={28} className="text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Чат с ИИ</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-xs">
              Задавайте любые вопросы — по предметам, методике преподавания или чему угодно ещё
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-left text-xs px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-violet-300 hover:bg-violet-50 text-gray-600 hover:text-violet-700 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Сообщения */}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                <Icon name="Sparkles" size={13} className="text-white" />
              </div>
            )}
            <div
              className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-violet-600 text-white rounded-br-sm"
                  : "bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100"
              }`}
            >
              {msg.content}
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0 ml-2 mt-0.5">
                <Icon name="User" size={13} className="text-gray-500" />
              </div>
            )}
          </div>
        ))}

        {/* Индикатор загрузки */}
        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
              <Icon name="Sparkles" size={13} className="text-white" />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center">
                <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        {/* Ошибка */}
        {error && (
          <div className="flex justify-center">
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs text-red-600">
              <Icon name="AlertCircle" size={13} />
              {error}
              <button onClick={() => setError(null)} className="ml-1 hover:text-red-800">
                <Icon name="X" size={12} />
              </button>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Поле ввода */}
      <div className="px-4 py-3 border-t bg-white">
        <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2 focus-within:border-violet-400 focus-within:bg-white transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Напишите сообщение... (Enter — отправить, Shift+Enter — новая строка)"
            rows={1}
            className="flex-1 bg-transparent text-sm text-gray-800 resize-none outline-none placeholder-gray-400 max-h-32 py-1"
            style={{ lineHeight: "1.5" }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="w-8 h-8 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 transition-colors mb-0.5"
          >
            <Icon name="Send" size={14} className="text-white" />
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-300 mt-1.5">GigaChat · Сбер · бесплатно</p>
      </div>
    </div>
  );
}