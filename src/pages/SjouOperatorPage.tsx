import { useState, useEffect, useCallback } from "react";
import { API, PWD_KEY, OP_NUM_KEY, Application, Message } from "@/components/sjou/operator/types";
import OperatorLogin from "@/components/sjou/operator/OperatorLogin";
import ApplicationsList from "@/components/sjou/operator/ApplicationsList";
import ApplicationDetail from "@/components/sjou/operator/ApplicationDetail";

export default function SjouOperatorPage() {
  const [pwd, setPwd] = useState(() => localStorage.getItem(PWD_KEY) || "");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  const [apps, setApps] = useState<Application[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState("pending");
  const [selected, setSelected] = useState<Application | null>(null);
  const [comment, setComment] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [operatorNumber, setOperatorNumber] = useState(() => localStorage.getItem(OP_NUM_KEY) || "");

  const [messages, setMessages] = useState<Message[]>([]);
  const [msgText, setMsgText] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  useEffect(() => {
    localStorage.setItem(OP_NUM_KEY, operatorNumber);
  }, [operatorNumber]);

  const load = useCallback(
    async (password: string, status: string) => {
      setLoading(true);
      setAuthError("");
      try {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list", status, operator_password: password }),
        });
        if (res.status === 401) {
          const d = await res.json().catch(() => ({}));
          setAuthed(false);
          setAuthError("Неверный пароль оператора " + (d.debug ? JSON.stringify(d.debug) : ""));
          localStorage.removeItem(PWD_KEY);
          return;
        }
        const data = await res.json();
        setApps(data.applications || []);
        setCounts(data.counts || {});
        setAuthed(true);
        localStorage.setItem(PWD_KEY, password);
      } catch {
        setAuthError("Ошибка соединения");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (pwd) load(pwd, filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authed) load(pwd, filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const doLogin = (e: React.FormEvent) => {
    e.preventDefault();
    load(pwd, filter);
  };

  const loadMessages = useCallback(
    async (appId: number) => {
      try {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "messages", id: appId, operator_password: pwd }),
        });
        const data = await res.json();
        setMessages(data.messages || []);
      } catch {
        setMessages([]);
      }
    },
    [pwd],
  );

  const openApp = (a: Application) => {
    setSelected(a);
    setComment(a.operator_comment || "");
    setMsgText("");
    setMessages([]);
    loadMessages(a.id);
  };

  const review = async (decision: "approved" | "rejected") => {
    if (!selected) return;
    setReviewing(true);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review",
          id: selected.id,
          decision,
          comment,
          inn: selected.inn,
          operator_number: operatorNumber,
          operator_password: pwd,
        }),
      });
      if (!res.ok) throw new Error();
      setSelected(null);
      setComment("");
      load(pwd, filter);
    } catch {
      setAuthError("Ошибка при сохранении решения");
    } finally {
      setReviewing(false);
    }
  };

  const sendMessage = async () => {
    if (!selected || !msgText.trim()) return;
    setSendingMsg(true);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_message",
          id: selected.id,
          message: msgText.trim(),
          operator_number: operatorNumber,
          operator_password: pwd,
        }),
      });
      if (!res.ok) throw new Error();
      setMsgText("");
      loadMessages(selected.id);
    } catch {
      setAuthError("Ошибка при отправке сообщения");
    } finally {
      setSendingMsg(false);
    }
  };

  // ---- Экран входа ----
  if (!authed) {
    return (
      <OperatorLogin
        pwd={pwd}
        setPwd={setPwd}
        authError={authError}
        loading={loading}
        doLogin={doLogin}
      />
    );
  }

  // ---- Панель ----
  return (
    <div className="min-h-screen bg-slate-100">
      <ApplicationsList
        operatorNumber={operatorNumber}
        setOperatorNumber={setOperatorNumber}
        onLogout={() => { localStorage.removeItem(PWD_KEY); setAuthed(false); setPwd(""); }}
        filter={filter}
        setFilter={setFilter}
        counts={counts}
        loading={loading}
        apps={apps}
        openApp={openApp}
      />

      {/* Детальная карточка заявки */}
      {selected && (
        <ApplicationDetail
          selected={selected}
          onClose={() => setSelected(null)}
          comment={comment}
          setComment={setComment}
          operatorNumber={operatorNumber}
          reviewing={reviewing}
          review={review}
          messages={messages}
          msgText={msgText}
          setMsgText={setMsgText}
          sendingMsg={sendingMsg}
          sendMessage={sendMessage}
        />
      )}
    </div>
  );
}