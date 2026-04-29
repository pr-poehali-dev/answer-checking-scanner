import { useState } from "react";
import Icon from "@/components/ui/icon";
import { appStore, useAppStore } from "@/store/appStore";
import { authApi } from "@/lib/api";

export function ProfileCard() {
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
