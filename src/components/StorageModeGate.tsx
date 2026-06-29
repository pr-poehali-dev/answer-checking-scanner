import { useState } from "react";
import Icon from "@/components/ui/icon";
import { appStore, useAppStore, type StorageMode } from "@/store/appStore";
import CompanyFooter from "@/components/CompanyFooter";

export default function StorageModeGate() {
  const { teacher } = useAppStore();
  const [selected, setSelected] = useState<StorageMode | null>(null);

  const handleContinue = () => {
    if (!selected) return;
    appStore.setStorageMode(selected);
  };

  const handleLogout = () => appStore.logout();

  const OPTIONS: {
    mode: StorageMode;
    title: string;
    badge?: string;
    icon: string;
    desc: string;
    points: string[];
    color: string;
  }[] = [
    {
      mode: "yadisk",
      title: "Яндекс.Диск",
      badge: "Рекомендуется",
      icon: "Cloud",
      desc: "Документы и файлы сохраняются на ваш личный Яндекс.Диск.",
      points: [
        "Доступ к файлам с любого устройства",
        "Автоматическая синхронизация и резервная копия",
        "Ничего не потеряется при смене телефона или компьютера",
      ],
      color: "hsl(197 71% 35%)",
    },
    {
      mode: "device",
      title: "Сохранение на данное устройство",
      icon: "MonitorSmartphone",
      desc: "Документы сохраняются на ваш компьютер, ноутбук или телефон.",
      points: [
        "Файл скачивается сразу при создании",
        "Хранится в папке «Загрузки» на устройстве",
        "Не требует подключения внешних сервисов",
      ],
      color: "hsl(215 60% 35%)",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center py-10 px-4">
        <div className="w-full max-w-lg">

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

          {/* Заголовок */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1.5">
              <Icon name="HardDriveDownload" size={18} className="text-primary" fallback="Save" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Где хранить документы</span>
            </div>
            <h1 className="text-xl font-bold mb-1.5">Выберите способ сохранения</h1>
            <p className="text-sm text-muted-foreground">
              Все созданные документы и файлы будут сохраняться выбранным способом.
              Это нужно сделать один раз — позже можно изменить в настройках.
            </p>
          </div>

          {/* Варианты */}
          <div className="space-y-3 mb-6">
            {OPTIONS.map(opt => {
              const active = selected === opt.mode;
              return (
                <button
                  key={opt.mode}
                  type="button"
                  onClick={() => setSelected(opt.mode)}
                  className={`w-full text-left rounded-lg border-2 p-4 transition-all ${
                    active ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-white hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: opt.color }}>
                      <Icon name={opt.icon} size={20} className="text-white" fallback="Save" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-sm font-bold">{opt.title}</p>
                        {opt.badge && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-2">{opt.desc}</p>
                      <ul className="space-y-1">
                        {opt.points.map(p => (
                          <li key={p} className="flex items-start gap-1.5">
                            <Icon name="Check" size={12} className="text-primary mt-0.5 flex-shrink-0" />
                            <span className="text-[11px] text-muted-foreground leading-snug">{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                      active ? "border-primary bg-primary" : "border-muted-foreground/30"
                    }`}>
                      {active && <Icon name="Check" size={12} className="text-white" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Кнопка продолжения */}
          <button
            onClick={handleContinue}
            disabled={!selected}
            className="w-full inline-flex items-center justify-center gap-2 py-3.5 text-sm font-bold rounded-sm text-primary-foreground bg-primary transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name="ArrowRight" size={16} />
            Продолжить
          </button>

          <p className="text-center text-xs text-muted-foreground mt-3">
            Способ хранения можно изменить в любой момент в разделе «Настройки»
          </p>
        </div>
      </div>
      <CompanyFooter />
    </div>
  );
}
