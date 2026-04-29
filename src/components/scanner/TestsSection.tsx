import Icon from "@/components/ui/icon";
import { TestsForm } from "./TestsForm";
import { TestsHistory } from "./TestsHistory";

export function TestsSection() {
  return (
    <div className="animate-slide-up space-y-5">
      {/* Hero */}
      <div className="border border-border rounded-sm overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(160 60% 25%) 0%, hsl(160 50% 32%) 100%)" }}>
        <div className="px-6 py-5 text-white">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="Sparkles" size={16} className="text-yellow-300" />
            <span className="text-xs font-semibold uppercase tracking-wider opacity-80">ИИ-генератор</span>
          </div>
          <h2 className="text-xl font-bold mb-1">Тесты, проверочные и контрольные за минуту</h2>
          <p className="text-xs opacity-80">
            ИИ создаст вопросы по теме, рассчитает шкалу оценок и автоматически добавит работу в раздел «Работы»
            с готовыми ответами для сканера. Файл .docx сохранится на Я.Диск.
          </p>
        </div>
      </div>

      <TestsForm />
      <TestsHistory />
    </div>
  );
}

export default TestsSection;
