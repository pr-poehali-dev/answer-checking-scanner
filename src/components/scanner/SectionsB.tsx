import { useState } from "react";
import Icon from "@/components/ui/icon";
import { ScoreBar } from "./shared";
import { appStore, useAppStore } from "@/store/appStore";
import { yadiskOAuth } from "@/lib/yadisk";

function gradeColor(g: string) {
  if (g === "5") return "#22c55e";
  if (g === "4") return "#3b82f6";
  if (g === "3") return "#f59e0b";
  return "#ef4444";
}

export function ResultsSection() {
  const { results, students, works } = useAppStore();
  const [search, setSearch] = useState("");
  const [filterWorkId, setFilterWorkId] = useState<string>("all");

  const filtered = results.filter(r => {
    const student = students.find(s => s.code === r.studentCode);
    const matchSearch = !search ||
      (student?.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      r.studentCode.includes(search);
    const matchWork = filterWorkId === "all" || r.workId === filterWorkId;
    return matchSearch && matchWork;
  });

  const avg = filtered.length > 0
    ? Math.round(filtered.reduce((a, r) => a + r.score, 0) / filtered.length)
    : 0;
  const maxScore = filtered.length > 0 ? Math.max(...filtered.map(r => r.score)) : 0;
  const grade5 = filtered.filter(r => r.grade === "5").length;

  if (results.length === 0) {
    return (
      <div className="animate-slide-up">
        <div className="border border-dashed border-border rounded-sm p-12 text-center">
          <Icon name="BarChart2" size={36} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-semibold mb-1">Результатов пока нет</p>
          <p className="text-xs text-muted-foreground">Загрузите и распознайте бланки в разделе «Загрузка бланков»</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-slide-up space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Всего результатов", value: results.length, icon: "Users" },
          { label: "Средний балл", value: avg, icon: "TrendingUp" },
          { label: "Максимальный балл", value: maxScore, icon: "Award" },
          { label: "Оценок «5»", value: grade5, icon: "Star" },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <Icon name={s.icon} size={15} className="text-muted-foreground" fallback="Info" />
            </div>
            <p className="text-2xl font-bold mono">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Поиск по фамилии или коду..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 text-sm border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-ring w-56"
          />
        </div>
        <select value={filterWorkId} onChange={e => setFilterWorkId(e.target.value)}
          className="border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="all">Все работы</option>
          {works.map(w => (
            <option key={w.id} value={w.id}>№{w.id} · {w.type}: {w.subject}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="border border-border rounded-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted">
          <p className="text-sm font-semibold">Результаты ({filtered.length})</p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {["#", "Ученик", "Код", "Работа", "Верных", "Балл", "Оценка", "Дата"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((r, i) => {
              const student = students.find(s => s.code === r.studentCode);
              const work = works.find(w => w.id === r.workId);
              return (
                <tr key={`${r.workId}-${r.studentCode}`} className="table-row-hover bg-white">
                  <td className="px-4 py-3 text-xs text-muted-foreground mono">{String(i + 1).padStart(2, "0")}</td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {student?.name ?? <span className="text-muted-foreground italic">Неизвестен</span>}
                    {student && <span className="text-xs text-muted-foreground ml-1">{student.classNum}{student.classLetter}</span>}
                  </td>
                  <td className="px-4 py-3 mono text-xs font-bold text-muted-foreground">{r.studentCode}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {work ? `№${work.id}` : r.workId}
                  </td>
                  <td className="px-4 py-3 w-32"><ScoreBar value={r.totalCount > 0 ? Math.round(r.correctCount / r.totalCount * 100) : 0} /></td>
                  <td className="px-4 py-3 mono text-sm font-semibold text-center">{r.score}/{r.totalCount}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm text-sm font-bold"
                      style={{ background: gradeColor(r.grade) + "20", color: gradeColor(r.grade) }}>
                      {r.grade}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(r.scannedAt).toLocaleDateString("ru-RU")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}



function YadiskCard() {
  const { yadiskConnected, yadiskUser, yadiskSyncing, yadiskLastSync } = useAppStore();
  const [connecting, setConnecting] = useState(false);

  const connect = async () => {
    const { teacher } = appStore.getState();
    if (!teacher?.login || !teacher?.authToken) {
      alert("Вы не авторизованы. Войдите в личный кабинет и попробуйте снова.");
      return;
    }
    setConnecting(true);
    try {
      yadiskOAuth.saveAuthBeforeRedirect(teacher.login, teacher.authToken);
      await yadiskOAuth.startAuth();
    } catch (e) {
      alert((e as Error).message || "Не удалось начать авторизацию");
      setConnecting(false);
    }
  };

  const disconnect = () => {
    if (!confirm("Отключить Яндекс.Диск? Локальные данные сохранятся, но автосинхронизация остановится.")) return;
    appStore.disconnectYadisk();
  };

  const syncNow = async () => {
    const r = await appStore.syncToYadisk();
    if (!r.ok) alert(`Ошибка: ${r.error}`);
  };

  const loadNow = async () => {
    const r = await appStore.loadFromYadisk();
    if (!r.ok) alert(`Ошибка: ${r.error}`);
    else alert(`Загружено: ${r.studentsCount} учеников, ${r.worksCount} работ`);
  };

  return (
    <div className="border border-border rounded-sm bg-white">
      <div className="px-4 py-3 border-b border-border bg-muted flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="Cloud" size={15} className="text-primary" />
          <p className="text-sm font-semibold">Яндекс.Диск</p>
        </div>
        {yadiskConnected ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
            <Icon name="CircleCheck" size={12} fallback="CheckCircle" />
            Подключён
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Не подключён</span>
        )}
      </div>

      <div className="p-4">
        {!yadiskConnected ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Подключите свой Яндекс.Диск — приложение будет автоматически сохранять список учеников,
              работы и результаты в папку <span className="mono font-semibold">АОУСПТ</span> на вашем диске.
              Данные принадлежат только вам.
            </p>
            <button
              onClick={connect}
              disabled={connecting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-sm transition-colors disabled:opacity-50"
              style={{ background: "#FC3F1D", color: "#fff" }}
            >
              <Icon name={connecting ? "Loader2" : "Link"} size={14} className={connecting ? "animate-spin" : ""} />
              {connecting ? "Перенаправляем…" : "Подключить Яндекс.Диск"}
            </button>
            <p className="text-xs text-muted-foreground">
              Откроется страница Яндекса для входа и подтверждения доступа.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Аккаунт */}
            <div className="flex items-center gap-3 p-3 border border-border rounded-sm bg-muted/30">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon name="User" size={15} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{yadiskUser?.display_name || yadiskUser?.login || "Аккаунт Яндекса"}</p>
                {yadiskUser?.default_email && (
                  <p className="text-xs text-muted-foreground truncate">{yadiskUser.default_email}</p>
                )}
              </div>
              <button
                onClick={disconnect}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-border text-xs font-medium rounded-sm hover:bg-destructive hover:text-destructive-foreground transition-colors"
              >
                <Icon name="Unplug" size={12} fallback="LogOut" />
                Отключить
              </button>
            </div>

            {/* Статус автосохранения */}
            <div className="flex items-center gap-3 p-3 rounded-sm border"
              style={yadiskSyncing
                ? { background: "hsl(210 80% 56% / 0.06)", borderColor: "hsl(210 80% 56% / 0.3)" }
                : { background: "hsl(142 71% 45% / 0.06)", borderColor: "hsl(142 71% 45% / 0.3)" }
              }
            >
              {yadiskSyncing ? (
                <Icon name="Loader2" size={16} className="animate-spin flex-shrink-0" style={{ color: "#3b82f6" }} />
              ) : (
                <Icon name="CloudCheck" size={16} className="flex-shrink-0" style={{ color: "#22c55e" }} fallback="CheckCircle" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: yadiskSyncing ? "#3b82f6" : "#16a34a" }}>
                  {yadiskSyncing ? "Сохранение…" : "Автосохранение включено"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {yadiskLastSync
                    ? `Сохранено: ${new Date(yadiskLastSync).toLocaleString("ru-RU")}`
                    : "Сохранение происходит автоматически при любых изменениях"}
                </p>
              </div>
            </div>

            {/* Ручные кнопки */}
            <div className="flex gap-2">
              <button
                onClick={syncNow}
                disabled={yadiskSyncing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs font-medium rounded-sm hover:bg-muted transition-colors disabled:opacity-50"
              >
                <Icon name="CloudUpload" size={13} fallback="Upload" />
                Сохранить сейчас
              </button>
              <button
                onClick={loadNow}
                disabled={yadiskSyncing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs font-medium rounded-sm hover:bg-muted transition-colors disabled:opacity-50"
              >
                <Icon name="CloudDownload" size={13} fallback="Download" />
                Загрузить с Диска
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Папка: <span className="mono font-semibold">АОУСПТ/</span> — ученики, работы, результаты.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsSection() {
  return (
    <div className="animate-slide-up space-y-6">
      <YadiskCard />
      <div className="grid grid-cols-2 gap-6">
        <div className="border border-border rounded-sm">
          <div className="px-4 py-3 border-b border-border bg-muted">
            <p className="text-sm font-semibold">Параметры теста</p>
          </div>
          <div className="p-4 space-y-4">
            {[
              { label: "Количество заданий (часть 1)", value: "26" },
              { label: "Количество заданий (часть 2)", value: "7" },
              { label: "Максимальный первичный балл", value: "54" },
              { label: "Минимальный тестовый балл (порог)", value: "36" },
              { label: "Минимальный балл для поступления", value: "72" },
            ].map((f, i) => (
              <div key={i} className="flex items-center justify-between">
                <label className="text-sm">{f.label}</label>
                <input
                  type="text"
                  defaultValue={f.value}
                  className="border border-border rounded-sm px-3 py-1.5 text-sm mono font-medium w-20 text-center focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="border border-border rounded-sm">
          <div className="px-4 py-3 border-b border-border bg-muted">
            <p className="text-sm font-semibold">Шкала перевода ЕГЭ</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {["Первичный", "Тестовый", "Уровень"].map(h => (
                  <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {[
                [0, 0, "Нет зачёта"], [5, 24, "Ниже порога"], [10, 36, "Порог"],
                [17, 52, "Базовый"], [23, 64, "Повышенный"], [28, 75, "Хороший"],
                [31, 89, "Высокий"], [32, 96, "Максимум"],
              ].map(([raw, sc, lvl], i) => (
                <tr key={i} className="table-row-hover bg-white">
                  <td className="px-4 py-2 mono font-medium">{raw}</td>
                  <td className="px-4 py-2 mono font-bold" style={{ color: Number(sc) >= 80 ? "#22c55e" : Number(sc) >= 52 ? "#3b82f6" : Number(sc) >= 36 ? "#f59e0b" : "#ef4444" }}>{sc}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{lvl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border border-border rounded-sm">
        <div className="px-4 py-3 border-b border-border bg-muted">
          <p className="text-sm font-semibold">Параметры распознавания</p>
        </div>
        <div className="p-4 grid grid-cols-2 gap-4">
          {[
            { label: "Язык распознавания", value: "Русский + Цифры" },
            { label: "Чувствительность", value: "Высокая" },
            { label: "Исправление перекосов", value: "Авто" },
            { label: "Режим ночного сканера", value: "Выкл" },
          ].map((f, i) => (
            <div key={i} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
              <label className="text-sm">{f.label}</label>
              <span className="text-sm font-semibold text-primary">{f.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}