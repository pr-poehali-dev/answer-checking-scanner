import { useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { udsApi, UdsAllData as AllData, UdsDataSection } from "@/lib/api";

interface Props {
  login: string;
  token: string;
  targetLogin: string;
  targetName?: string;
  onClose: () => void;
}

/** Человекочитаемые названия полей записей. */
const FIELD_LABELS: Record<string, string> = {
  work_id: "ID работы", work_type: "Тип работы", subject: "Предмет",
  class_label: "Класс", work_date: "Дата работы", total_questions: "Всего вопросов",
  part1_count: "Часть 1", part2_count: "Часть 2", answer_key: "Ключ ответов",
  max_score: "Макс. балл", topic: "Тема", generated_by_ai: "Создано ИИ",
  created_at: "Создано", updated_at: "Изменено",
  material_id: "ID материала", material_type: "Тип материала", title: "Название",
  filename: "Файл", size_bytes: "Размер, байт", uploaded_to_yadisk: "На Я.Диске",
  content: "Содержимое",
  student_code: "Код ученика", bind_code: "Код привязки", full_name: "ФИО",
  bound_login: "Привязан к логину", bound_at: "Привязан",
  work_title: "Работа", correct_count: "Верных", total_count: "Всего",
  score: "Балл", grade: "Оценка", answers: "Ответы", scanned_at: "Проверено",
  teacher_login: "Учитель",
  action: "Действие", entity_type: "Объект", entity_id: "ID объекта",
  details: "Подробности",
  plan: "Тариф", amount: "Сумма", currency: "Валюта", months: "Месяцев",
  provider: "Провайдер", status: "Статус", source: "Источник",
  granted_by: "Выдал", paid_at: "Оплачено", subscription_until: "Подписка до",
  tokens: "Токены", amount_kopecks: "Сумма, коп.",
  balance_kopecks_after: "Баланс после, коп.",
  context: "Контекст", documents: "Документы", app_version: "Версия",
  privacy_revision: "Политика (ред.)", oferta_revision: "Оферта (ред.)",
  ip_address: "IP-адрес",
  id: "№", section: "Раздел", operator_login: "Оператор",
  work_label: "Вид работы", word_count: "Слов", page_estimate: "Страниц",
};

const SECTION_ICONS: Record<string, string> = {
  works: "FileText", materials: "FolderOpen", students: "Users",
  results: "ClipboardCheck", my_results: "Award", activity: "Activity",
  payments: "CreditCard", ai_logs: "Sparkles", consents: "ShieldCheck",
  tickets: "MessageCircle", projects: "BookOpen",
};

export default function UdsAllData({ login, token, targetLogin, targetName, onClose }: Props) {
  const [data, setData] = useState<AllData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [openSection, setOpenSection] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await udsApi.allData(login, token, targetLogin);
      setData(res);
      const first = res.sections.find(s => s.items.length > 0);
      if (first) setOpenSection(first.key);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [login, token, targetLogin]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold flex items-center gap-2">
              <Icon name="Database" size={15} className="text-primary" />
              Все данные · {targetName || targetLogin}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data ? `${data.total} записей · ${data.retention_note}` : targetLogin}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted flex-shrink-0">
            <Icon name="X" size={16} />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-3 flex items-start gap-2 p-3 rounded-sm bg-destructive/5 border border-destructive/20">
            <Icon name="AlertCircle" size={14} className="text-destructive mt-0.5" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center">
            <Icon name="Loader2" size={22} className="animate-spin text-muted-foreground mx-auto" />
            <p className="text-xs text-muted-foreground mt-3">Собираем данные с сервера…</p>
          </div>
        ) : !data ? null : (
          <div className="flex-1 overflow-y-auto styled-scrollbar p-5 space-y-2">
            {data.sections.map(s => (
              <SectionBlock key={s.key} section={s}
                open={openSection === s.key}
                onToggle={() => setOpenSection(openSection === s.key ? null : s.key)} />
            ))}
            <div className="flex items-start gap-2 p-3 rounded-sm bg-blue-50 border border-blue-100 mt-4">
              <Icon name="Info" size={13} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-blue-700 leading-relaxed">
                Данные хранятся на нашем сервере и автоматически очищаются через {data.retention_days} дней
                после последнего изменения — у каждой записи свой отсчёт. Факт просмотра зафиксирован в журнале УДС.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionBlock({ section, open, onToggle }: {
  section: UdsDataSection; open: boolean; onToggle: () => void;
}) {
  const empty = section.items.length === 0;
  return (
    <div className={`border rounded-lg overflow-hidden ${empty ? "border-border/60" : "border-border"}`}>
      <button onClick={empty ? undefined : onToggle}
        className={`w-full flex items-center gap-2.5 px-3.5 py-3 text-left ${empty ? "cursor-default" : "hover:bg-muted/30"}`}>
        <Icon name={SECTION_ICONS[section.key] || "File"} size={14}
          className={empty ? "text-muted-foreground/50" : "text-primary"} />
        <p className={`text-xs font-semibold flex-1 ${empty ? "text-muted-foreground" : ""}`}>
          {section.label}
        </p>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${empty ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
          {section.items.length}
        </span>
        {!empty && (
          <Icon name={open ? "ChevronUp" : "ChevronDown"} size={14} className="text-muted-foreground" />
        )}
      </button>

      {open && !empty && (
        <div className="border-t border-border divide-y divide-border/60">
          {section.items.map((item, i) => <RecordRow key={i} item={item} index={i} />)}
        </div>
      )}
    </div>
  );
}

function RecordRow({ item, index }: { item: Record<string, unknown>; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const entries = Object.entries(item).filter(([, v]) => v !== null && v !== "" && v !== undefined);
  const title = String(item.title || item.work_title || item.full_name || item.topic ||
    item.action || item.subject || item.plan || item.work_label || `Запись ${index + 1}`);

  return (
    <div className="px-3.5 py-2.5">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-2 text-left">
        <Icon name={expanded ? "ChevronDown" : "ChevronRight"} size={12} className="text-muted-foreground flex-shrink-0" />
        <p className="text-xs font-medium flex-1 truncate">{title}</p>
        {typeof item.updated_at === "string" || typeof item.created_at === "string" ? (
          <span className="text-[10px] text-muted-foreground flex-shrink-0">
            {new Date(String(item.updated_at || item.created_at)).toLocaleDateString("ru-RU")}
          </span>
        ) : null}
      </button>

      {expanded && (
        <div className="mt-2 ml-5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
          {entries.map(([k, v]) => (
            <FieldValue key={k} name={k} value={v} />
          ))}
        </div>
      )}
    </div>
  );
}

function FieldValue({ name, value }: { name: string; value: unknown }) {
  const label = FIELD_LABELS[name] || name;
  const isObj = typeof value === "object" && value !== null;
  const wide = isObj || (typeof value === "string" && value.length > 60);

  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      {isObj ? (
        <pre className="text-[10px] bg-muted/50 rounded p-2 mt-0.5 overflow-x-auto whitespace-pre-wrap break-words max-h-64 overflow-y-auto styled-scrollbar">
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : typeof value === "boolean" ? (
        <p className="text-[11px] font-medium">{value ? "да" : "нет"}</p>
      ) : (
        <p className="text-[11px] font-medium break-words whitespace-pre-wrap">{String(value)}</p>
      )}
    </div>
  );
}