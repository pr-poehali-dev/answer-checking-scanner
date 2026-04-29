import { useState } from "react";
import Icon from "@/components/ui/icon";
import { appStore, useAppStore } from "@/store/appStore";
import { yadiskOAuth } from "@/lib/yadisk";

export function YadiskCard() {
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
