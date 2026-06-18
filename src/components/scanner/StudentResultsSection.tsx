import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { useAppStore } from "@/store/appStore";
import { studentLinkApi, type StudentResultRow } from "@/lib/api";

const GRADE_COLOR: Record<string, string> = {
  "5": "hsl(142 60% 38%)",
  "4": "hsl(200 70% 42%)",
  "3": "hsl(38 80% 45%)",
  "2": "hsl(0 70% 50%)",
};

export function StudentResultsSection() {
  const { teacher } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [bound, setBound] = useState(false);
  const [results, setResults] = useState<StudentResultRow[]>([]);

  useEffect(() => {
    if (!teacher) return;
    setLoading(true);
    studentLinkApi.myResults(teacher.login)
      .then(d => { setBound(d.bound); setResults(d.results || []); })
      .catch(() => { setBound(false); setResults([]); })
      .finally(() => setLoading(false));
  }, [teacher?.login]);

  const goToSettings = () => {
    window.dispatchEvent(new CustomEvent("student-navigate", { detail: "settings" }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Icon name="Loader2" size={24} className="animate-spin text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Загружаем ваши результаты…</p>
      </div>
    );
  }

  if (!bound) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Icon name="LinkIcon" size={28} className="text-primary" fallback="Link" />
        </div>
        <h2 className="text-lg font-bold mb-2">Аккаунт не привязан</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Чтобы видеть свои результаты, введите <strong>код привязки</strong> (8 символов), который выдал учитель.
        </p>
        <button
          onClick={goToSettings}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity"
        >
          <Icon name="Settings" size={15} />
          Привязать в настройках
        </button>
      </div>
    );
  }

  if (!results.length) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <Icon name="Inbox" size={28} className="text-muted-foreground" />
        </div>
        <h2 className="text-lg font-bold mb-2">Пока нет результатов</h2>
        <p className="text-sm text-muted-foreground">
          Здесь появятся ваши оценки за проверенные работы, как только учитель их загрузит.
        </p>
      </div>
    );
  }

  const avg = (results.reduce((s, r) => s + (parseInt(r.grade || "0") || 0), 0) / results.filter(r => r.grade && r.grade !== "—").length) || 0;

  return (
    <div className="animate-slide-up space-y-5 max-w-3xl">
      {/* Сводка */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="border border-border rounded-sm bg-white p-4">
          <p className="text-xs text-muted-foreground mb-1">Работ проверено</p>
          <p className="text-2xl font-bold">{results.length}</p>
        </div>
        <div className="border border-border rounded-sm bg-white p-4">
          <p className="text-xs text-muted-foreground mb-1">Средний балл</p>
          <p className="text-2xl font-bold">{avg ? avg.toFixed(1) : "—"}</p>
        </div>
        <div className="border border-border rounded-sm bg-white p-4 col-span-2 sm:col-span-1">
          <p className="text-xs text-muted-foreground mb-1">Лучший результат</p>
          <p className="text-2xl font-bold">
            {Math.max(...results.map(r => r.score || 0))}<span className="text-sm text-muted-foreground"> б.</span>
          </p>
        </div>
      </div>

      {/* Список работ */}
      <div className="space-y-2">
        {results.map((r) => (
          <div key={r.workId} className="border border-border rounded-sm bg-white p-4 flex items-center gap-4">
            <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
              style={{ background: GRADE_COLOR[r.grade || ""] || "hsl(var(--muted-foreground))" }}>
              {r.grade || "—"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{r.workTitle || r.subject || "Работа"}</p>
              <p className="text-xs text-muted-foreground">
                {r.subject ? `${r.subject} · ` : ""}{r.workDate || ""}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold">{r.correctCount}/{r.totalCount}</p>
              <p className="text-xs text-muted-foreground">{r.score} баллов</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StudentResultsSection;
