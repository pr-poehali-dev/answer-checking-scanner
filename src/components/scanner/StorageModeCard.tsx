import Icon from "@/components/ui/icon";
import { appStore, useAppStore, type StorageMode } from "@/store/appStore";

export function StorageModeCard() {
  const { storageMode } = useAppStore();

  const choose = (mode: StorageMode) => {
    if (mode === storageMode) return;
    appStore.setStorageMode(mode);
  };

  const OPTIONS: { mode: StorageMode; title: string; badge?: string; icon: string; desc: string }[] = [
    {
      mode: "yadisk",
      title: "Яндекс.Диск",
      badge: "Рекомендуется",
      icon: "Cloud",
      desc: "Документы сохраняются на ваш Яндекс.Диск, доступны с любого устройства.",
    },
    {
      mode: "device",
      title: "Сохранение на данное устройство",
      icon: "MonitorSmartphone",
      desc: "Документы скачиваются на ваш компьютер, ноутбук или телефон.",
    },
  ];

  return (
    <div className="border border-border rounded-sm bg-white">
      <div className="px-4 py-3 border-b border-border bg-muted flex items-center gap-2">
        <Icon name="HardDriveDownload" size={15} className="text-primary" fallback="Save" />
        <p className="text-sm font-semibold">Способ хранения документов</p>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          Выберите, где сохранять созданные документы и файлы. Изменение применится к новым документам.
        </p>
        {OPTIONS.map(opt => {
          const active = storageMode === opt.mode;
          return (
            <button
              key={opt.mode}
              type="button"
              onClick={() => choose(opt.mode)}
              className={`w-full text-left rounded-lg border-2 p-3 transition-all ${
                active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  active ? "bg-primary/15" : "bg-muted"
                }`}>
                  <Icon name={opt.icon} size={18} className={active ? "text-primary" : "text-muted-foreground"} fallback="Save" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-bold ${active ? "text-primary" : "text-foreground"}`}>{opt.title}</p>
                    {opt.badge && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{opt.desc}</p>
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
    </div>
  );
}
