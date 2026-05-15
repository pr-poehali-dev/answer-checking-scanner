import { useState } from "react";
import Icon from "@/components/ui/icon";
import { appStore, useAppStore } from "@/store/appStore";
import { yadiskOAuth } from "@/lib/yadisk";
import CompanyFooter from "@/components/CompanyFooter";

export default function YadiskRequiredGate() {
  const { teacher } = useAppStore();
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    if (!teacher?.login || !teacher?.authToken) return;
    setConnecting(true);
    try {
      yadiskOAuth.saveAuthBeforeRedirect(teacher.login, teacher.authToken);
      await yadiskOAuth.startAuth();
    } catch (e) {
      alert((e as Error).message || "Не удалось начать авторизацию");
      setConnecting(false);
    }
  };

  const handleLogout = () => appStore.logout();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center py-10 px-4">
        <div className="w-full max-w-md">

          {/* Шапка */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <img src="https://cdn.poehali.dev/projects/d27f4839-edaf-47f9-8c40-4a5b1af76f6d/bucket/7bd38a19-122a-479d-96c5-931aa6ce875c.jpg" alt="САОУ" className="w-10 h-10 rounded-sm object-contain" />
              <div>
                <p className="text-sm font-bold">САОУ</p>
                <p className="text-xs text-muted-foreground">{teacher?.name}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <Icon name="LogOut" size={13} />
              Выйти
            </button>
          </div>

          {/* Hero-блок */}
          <div className="border border-border rounded-sm overflow-hidden mb-6"
            style={{ background: "linear-gradient(135deg, hsl(197 71% 25%) 0%, hsl(210 60% 32%) 100%)" }}>
            <div className="p-6 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="Cloud" size={18} className="text-sky-300" />
                <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Яндекс.Диск</span>
              </div>
              <h1 className="text-xl font-bold mb-2">Привяжите Яндекс.Диск</h1>
              <p className="text-sm opacity-85">
                САОУ хранит все ваши данные — учеников, работы, результаты и файлы — исключительно на вашем личном Яндекс.Диске. Без привязки система не работает.
              </p>
            </div>
          </div>

          {/* Почему это обязательно */}
          <div className="border border-border rounded-sm bg-white p-5 mb-5">
            <p className="text-sm font-semibold mb-3">Зачем это нужно?</p>
            <ul className="space-y-2.5">
              {[
                { icon: "Shield", text: "Данные принадлежат только вам — мы их не храним на своих серверах" },
                { icon: "CloudUpload", text: "Ученики, работы, результаты автоматически синхронизируются" },
                { icon: "Download", text: "Готовые файлы (тесты, презентации, конспекты) сохраняются прямо на диск" },
                { icon: "Smartphone", text: "Доступ к данным с любого устройства через Яндекс.Диск" },
              ].map(item => (
                <li key={item.icon} className="flex items-start gap-2.5">
                  <Icon name={item.icon} size={14} className="text-primary mt-0.5 flex-shrink-0" fallback="Check" />
                  <span className="text-xs text-muted-foreground leading-relaxed">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Кнопка подключения */}
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full inline-flex items-center justify-center gap-2.5 py-3.5 text-sm font-bold rounded-sm text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: "hsl(197 71% 35%)" }}
          >
            {connecting ? (
              <>
                <Icon name="Loader2" size={16} className="animate-spin" />
                Переход на Яндекс…
              </>
            ) : (
              <>
                <Icon name="Cloud" size={16} />
                Привязать Яндекс.Диск
              </>
            )}
          </button>

          <p className="text-center text-xs text-muted-foreground mt-3">
            После авторизации вы сразу попадёте в систему
          </p>
        </div>
      </div>
      <CompanyFooter />
    </div>
  );
}