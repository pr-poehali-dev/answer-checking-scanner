import Icon from "@/components/ui/icon";
import { useAppStore } from "@/store/appStore";
import { WorksheetsForm } from "./worksheets/WorksheetsForm";
import { WorksheetCard } from "./worksheets/WorksheetCard";

export function WorksheetsSection() {
  const { worksheets } = useAppStore();

  return (
    <div className="animate-slide-up space-y-6">
      {/* ── Hero ── */}
      <div className="border border-border rounded-xl overflow-hidden shadow-sm"
        style={{ background: "linear-gradient(135deg, #0D1B3E 0%, #1B4F9C 60%, #00B4D8 100%)" }}>
        <div className="px-6 py-5 text-white">
          <div className="flex items-center gap-2 mb-1.5">
            <Icon name="Sparkles" size={16} className="text-yellow-300" />
            <span className="text-xs font-semibold uppercase tracking-wider opacity-80">ИИ-генератор</span>
          </div>
          <h2 className="text-xl font-bold mb-1">Рабочие листы за минуту</h2>
          <p className="text-xs opacity-85 leading-relaxed max-w-2xl">
            Укажите тему, класс, описание и число заданий — ИИ подберёт материал строго по программе
            Минпросвещения РФ, при необходимости добавит фото и карты, и оформит всё в фирменный
            бланк САОУ с красивой окантовкой и полями для ФИО и класса ученика.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {["Программа Минпросвещения РФ", "Фото и карты от ИИ", "Фирменный бланк САОУ", "Поля ФИО и класс"].map(t => (
              <span key={t} className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Форма ── */}
      <WorksheetsForm />

      {/* ── История ── */}
      <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between" style={{ background: "hsl(var(--muted))" }}>
          <div className="flex items-center gap-2.5">
            <Icon name="History" size={15} className="text-muted-foreground" />
            <p className="text-sm font-bold">История рабочих листов</p>
          </div>
          {worksheets.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {worksheets.length}
            </span>
          )}
        </div>

        {worksheets.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #0D1B3E10, #00B4D820)" }}>
              <Icon name="FileSpreadsheet" size={26} className="text-primary/50" fallback="FileText" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground mb-1">Здесь появятся ваши рабочие листы</p>
            <p className="text-xs text-muted-foreground">Создайте первый — займёт около минуты</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {worksheets.map(w => (
              <WorksheetCard key={w.id} item={w} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
