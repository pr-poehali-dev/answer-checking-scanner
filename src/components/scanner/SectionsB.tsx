import { useState } from "react";
import Icon from "@/components/ui/icon";
import { ScoreBar } from "./shared";
import { appStore, useAppStore } from "@/store/appStore";
import { yadiskOAuth } from "@/lib/yadisk";
import { authApi } from "@/lib/api";

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

function ProfileCard() {
  const { teacher } = useAppStore();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    first_name: teacher?.firstName || "",
    last_name: teacher?.lastName || "",
    email: teacher?.email || "",
    school: teacher?.school || "",
    current_password: "",
    new_password: "",
    new_password2: "",
  });

  const startEdit = () => {
    setForm({
      first_name: teacher?.firstName || "",
      last_name: teacher?.lastName || "",
      email: teacher?.email || "",
      school: teacher?.school || "",
      current_password: "",
      new_password: "",
      new_password2: "",
    });
    setError("");
    setSuccess("");
    setEditing(true);
  };

  const cancel = () => { setEditing(false); setError(""); setSuccess(""); };

  const save = async () => {
    if (!teacher) return;
    setError("");
    setSuccess("");
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError("Укажите имя и фамилию");
      return;
    }
    if (form.new_password && form.new_password !== form.new_password2) {
      setError("Новые пароли не совпадают");
      return;
    }
    if (form.new_password && !form.current_password) {
      setError("Для смены пароля укажите текущий пароль");
      return;
    }
    setSaving(true);
    try {
      const result = await authApi.updateProfile(teacher.authToken, {
        login: teacher.login,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim() || undefined,
        school: form.school.trim() || undefined,
        current_password: form.current_password || undefined,
        new_password: form.new_password || undefined,
      });
      appStore.updateTeacherProfile({
        name: result.full_name,
        firstName: result.first_name,
        lastName: result.last_name,
        email: result.email,
        school: result.school || teacher.school,
      });
      setSuccess("Данные сохранены");
      setEditing(false);
    } catch (e) {
      setError((e as Error).message || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  if (!teacher) return null;

  const subColor = teacher.subscriptionActive ? "#22c55e" : teacher.subscriptionStatus === "expired" ? "#ef4444" : "#94a3b8";
  const subLabel = teacher.subscriptionActive ? "Активна" : teacher.subscriptionStatus === "expired" ? "Истекла" : "Не активна";

  return (
    <div className="border border-border rounded-sm bg-white">
      <div className="px-4 py-3 border-b border-border bg-muted flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="User" size={15} className="text-primary" />
          <p className="text-sm font-semibold">Личный кабинет</p>
        </div>
        {!editing && (
          <button
            onClick={startEdit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs font-medium rounded-sm hover:bg-muted transition-colors"
          >
            <Icon name="Pencil" size={12} />
            Редактировать
          </button>
        )}
      </div>

      <div className="p-4">
        {!editing ? (
          <div className="space-y-4">
            {/* Подписка */}
            <div className="flex items-center gap-3 p-3 rounded-sm border border-border bg-muted/30">
              <Icon name="BadgeCheck" size={18} style={{ color: subColor }} fallback="Award" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Подписка</p>
                <p className="text-sm font-semibold" style={{ color: subColor }}>{subLabel}</p>
              </div>
              {teacher.subscriptionUntil && (
                <span className="text-xs text-muted-foreground">
                  до {new Date(teacher.subscriptionUntil).toLocaleDateString("ru-RU")}
                </span>
              )}
            </div>

            {/* Данные */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {[
                { label: "Логин", value: teacher.login },
                { label: "Школа", value: teacher.school },
                { label: "Имя", value: teacher.firstName || "—" },
                { label: "Фамилия", value: teacher.lastName || "—" },
                { label: "Email", value: teacher.email || "—" },
              ].map(f => (
                <div key={f.label}>
                  <p className="text-xs text-muted-foreground mb-0.5">{f.label}</p>
                  <p className="text-sm font-medium">{f.value}</p>
                </div>
              ))}
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Пароль</p>
                <p className="text-sm font-medium text-muted-foreground">••••••••</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "last_name", label: "Фамилия", type: "text" },
                { key: "first_name", label: "Имя", type: "text" },
                { key: "email", label: "Email", type: "email" },
                { key: "school", label: "Школа", type: "text" },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-muted-foreground mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    value={form[f.key as keyof typeof form]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-border rounded-sm px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3">Смена пароля (необязательно)</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: "current_password", label: "Текущий пароль" },
                  { key: "new_password", label: "Новый пароль" },
                  { key: "new_password2", label: "Повторите новый" },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs text-muted-foreground mb-1">{f.label}</label>
                    <input
                      type="password"
                      value={form[f.key as keyof typeof form]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full border border-border rounded-sm px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="••••••"
                    />
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-sm border border-destructive/30 bg-destructive/5 text-destructive text-xs">
                <Icon name="CircleAlert" size={14} fallback="AlertCircle" />
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <Icon name={saving ? "Loader2" : "Save"} size={14} className={saving ? "animate-spin" : ""} />
                {saving ? "Сохраняем…" : "Сохранить"}
              </button>
              <button
                onClick={cancel}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 border border-border text-sm font-medium rounded-sm hover:bg-muted transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        {success && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded-sm border border-green-200 bg-green-50 text-green-700 text-xs">
            <Icon name="CircleCheck" size={14} fallback="CheckCircle" />
            {success}
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsSection() {
  return (
    <div className="animate-slide-up space-y-6">
      <ProfileCard />
      <YadiskCard />
    </div>
  );
}