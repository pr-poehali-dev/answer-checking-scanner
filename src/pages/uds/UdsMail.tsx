import { useState, useEffect, useCallback, useRef } from "react";
import { udsApi, type MailContact, type MailThread, type MailMessage, type MailingAudience, type MailingStatus } from "@/lib/api";
import UdsMailSidebar, { type Peer } from "@/pages/uds/UdsMailSidebar";
import UdsMailConversation from "@/pages/uds/UdsMailConversation";
import UdsMailComposeModal from "@/pages/uds/UdsMailComposeModal";
import UdsMailingModal from "@/pages/uds/UdsMailingModal";

interface Props {
  login: string;
  token: string;
  myAddress?: string | null;
  canMailing?: boolean;
}

export default function UdsMail({ login, token, myAddress, canMailing }: Props) {
  const [tab, setTab] = useState<"chats" | "contacts">("chats");
  const [threads, setThreads] = useState<MailThread[]>([]);
  const [contacts, setContacts] = useState<MailContact[]>([]);
  const [search, setSearch] = useState("");
  const [peer, setPeer] = useState<Peer | null>(null);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [subject, setSubject] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [ispCheck, setIspCheck] = useState<{ ok: boolean; text: string } | null>(null);
  const [ispBusy, setIspBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Модалка «Написать» — новое письмо на произвольный адрес
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeError, setComposeError] = useState("");
  const [composeSending, setComposeSending] = useState(false);

  // Модалка «Рассылка» — массовая отправка (Глава/Зам. Главы)
  const [mailingOpen, setMailingOpen] = useState(false);
  const [mailingAudience, setMailingAudience] = useState<MailingAudience>("all");
  const [mailingRoles, setMailingRoles] = useState<string[]>([]);
  const [mailingStatus, setMailingStatus] = useState<MailingStatus>("planned");
  const [mailingSubject, setMailingSubject] = useState("");
  const [mailingBody, setMailingBody] = useState("");
  const [mailingError, setMailingError] = useState("");
  const [mailingSending, setMailingSending] = useState(false);
  const [mailingResult, setMailingResult] = useState<{ sent: number; total: number; sender: string } | null>(null);

  const testIsp = async () => {
    setIspBusy(true); setIspCheck(null);
    try {
      const r = await udsApi.mailTestIsp(login, token);
      setIspCheck({ ok: r.ok, text: r.ok ? (r.message || "Связь с ISPmanager есть") : (r.reason || "Ошибка") });
    } catch (e) {
      setIspCheck({ ok: false, text: (e as Error).message });
    } finally {
      setIspBusy(false);
    }
  };

  const loadThreads = useCallback(async () => {
    setLoadingList(true);
    try {
      const d = await udsApi.mailThreads(login, token);
      setThreads(d.threads);
    } catch (e) { setError((e as Error).message); }
    finally { setLoadingList(false); }
  }, [login, token]);

  const loadContacts = useCallback(async (q: string) => {
    try {
      const d = await udsApi.mailContacts(login, token, q);
      setContacts(d.contacts);
    } catch (e) { setError((e as Error).message); }
  }, [login, token]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  useEffect(() => {
    if (tab === "contacts") {
      const t = setTimeout(() => loadContacts(search), 300);
      return () => clearTimeout(t);
    }
  }, [tab, search, loadContacts]);

  const openPeer = useCallback(async (p: Peer) => {
    setPeer(p); setError(""); setMessages([]); setLoadingThread(true);
    try {
      const d = await udsApi.mailThread(login, token, p.address);
      setMessages(d.messages);
    } catch (e) { setError((e as Error).message); }
    finally { setLoadingThread(false); }
  }, [login, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    if (!peer || !draft.trim()) return;
    setSending(true); setError("");
    try {
      const res = await udsApi.mailSend(login, token, peer.address, subject.trim(), draft.trim());
      setDraft(""); setSubject("");
      const d = await udsApi.mailThread(login, token, peer.address);
      setMessages(d.messages);
      loadThreads();
      // Сообщение сохранено, но не ушло на внешний адрес — предупреждаем
      if (res.warning) setError(res.warning);
    } catch (e) { setError((e as Error).message); }
    finally { setSending(false); }
  };

  const isExternal = peer && !peer.address.toLowerCase().endsWith("@saou.ru");

  const openCompose = () => {
    setComposeTo(""); setComposeSubject(""); setComposeBody(""); setComposeError("");
    setComposeOpen(true);
  };

  const sendCompose = async () => {
    const to = composeTo.trim().toLowerCase();
    const text = composeBody.trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      setComposeError("Укажите корректный email-адрес"); return;
    }
    if (!text) {
      setComposeError("Введите текст сообщения"); return;
    }
    setComposeSending(true); setComposeError("");
    try {
      const res = await udsApi.mailSend(login, token, to, composeSubject.trim(), text);
      setComposeOpen(false);
      // Переходим в диалог с этим адресом
      const d = await udsApi.mailThread(login, token, to);
      setPeer({ address: to, name: to });
      setMessages(d.messages);
      setDraft(""); setSubject("");
      loadThreads();
      if (res.warning) setError(res.warning);
    } catch (e) {
      setComposeError((e as Error).message);
    } finally {
      setComposeSending(false);
    }
  };

  const openMailing = () => {
    setMailingAudience("all"); setMailingRoles([]); setMailingStatus("planned");
    setMailingSubject(""); setMailingBody(""); setMailingError(""); setMailingResult(null);
    setMailingOpen(true);
  };

  const toggleMailingRole = (role: string) => {
    setMailingRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  const sendMailing = async () => {
    const subj = mailingSubject.trim();
    const text = mailingBody.trim();
    if (mailingAudience === "roles" && mailingRoles.length === 0) {
      setMailingError("Выберите хотя бы одну роль"); return;
    }
    if (!subj) { setMailingError("Укажите тему сообщения"); return; }
    if (!text) { setMailingError("Введите текст сообщения"); return; }
    setMailingSending(true); setMailingError(""); setMailingResult(null);
    try {
      const res = await udsApi.mailingSend(login, token, {
        audience: mailingAudience,
        roles: mailingAudience === "roles" ? mailingRoles : undefined,
        status: mailingStatus,
        subject: subj,
        body: text,
      });
      setMailingResult({ sent: res.sent, total: res.recipients_count, sender: res.sender });
    } catch (e) {
      setMailingError((e as Error).message);
    } finally {
      setMailingSending(false);
    }
  };

  return (
    <div className="border border-border rounded-sm bg-white overflow-hidden flex h-[calc(100vh-220px)] min-h-[420px]">
      <UdsMailSidebar
        tab={tab}
        setTab={setTab}
        threads={threads}
        loadingList={loadingList}
        contacts={contacts}
        search={search}
        setSearch={setSearch}
        peer={peer}
        onOpenPeer={openPeer}
        canMailing={canMailing}
        onOpenCompose={openCompose}
        onOpenMailing={openMailing}
      />

      <UdsMailConversation
        peer={peer}
        myAddress={myAddress}
        testIsp={testIsp}
        ispBusy={ispBusy}
        ispCheck={ispCheck}
        onBack={() => setPeer(null)}
        loadingThread={loadingThread}
        messages={messages}
        bottomRef={bottomRef}
        isExternal={isExternal}
        subject={subject}
        setSubject={setSubject}
        draft={draft}
        setDraft={setDraft}
        onSend={send}
        sending={sending}
        error={error}
      />

      {composeOpen && (
        <UdsMailComposeModal
          composeTo={composeTo}
          setComposeTo={setComposeTo}
          composeSubject={composeSubject}
          setComposeSubject={setComposeSubject}
          composeBody={composeBody}
          setComposeBody={setComposeBody}
          composeError={composeError}
          composeSending={composeSending}
          onClose={() => setComposeOpen(false)}
          onSend={sendCompose}
        />
      )}

      {mailingOpen && (
        <UdsMailingModal
          mailingAudience={mailingAudience}
          setMailingAudience={setMailingAudience}
          mailingRoles={mailingRoles}
          toggleMailingRole={toggleMailingRole}
          mailingStatus={mailingStatus}
          setMailingStatus={setMailingStatus}
          mailingSubject={mailingSubject}
          setMailingSubject={setMailingSubject}
          mailingBody={mailingBody}
          setMailingBody={setMailingBody}
          mailingError={mailingError}
          mailingSending={mailingSending}
          mailingResult={mailingResult}
          onClose={() => setMailingOpen(false)}
          onSend={sendMailing}
        />
      )}
    </div>
  );
}
