import { useState } from "react";
import Icon from "@/components/ui/icon";

const AD_IMAGE = "/promotion/vk-ad-saou.jpg";
const COVER_IMAGE = "/promotion/vk-cover-saou.jpg";

interface PostVariant {
  id: string;
  title: string;
  text: string;
}

const POSTS: PostVariant[] = [
  {
    id: "main",
    title: "Основной пост",
    text: `Проверка работ за 5 минут вместо часа 📋

САОУ — ИИ-платформа для учителей и учеников школ и колледжей.

Что умеет:
✅ Сканер бланков ответов — проверка целого класса за 5 минут
✅ ИИ-генератор тестов и контрольных работ
✅ Презентации и конспекты уроков по ФГОС
✅ Журнал учеников и автоматический подсчёт оценок
✅ Все данные хранятся на серверах в РФ

Тарифы:
• Месяц — 199 ₽
• Полгода — 1099 ₽ (выгода 8%)
• Год — 2299 ₽ (выгода 4%)

Первые 5 дней — бесплатно, карта не нужна.

Попробовать: saou.ru
#САОУ #учителям #школа #образование`,
  },
  {
    id: "short",
    title: "Короткий пост (сторис/карусель)",
    text: `Проверяете работы вручную? 😩
А можно за 5 минут — сканером ✅

САОУ — платформа для учителей: сканер бланков, генератор тестов, презентации и конспекты по ФГОС.

5 дней бесплатно, дальше от 199 ₽/мес.

saou.ru`,
  },
  {
    id: "pain",
    title: "Пост «боль → решение»",
    text: `Тратите вечер на проверку 30 работ? 🕐

Загрузите фото бланков — САОУ проверит класс за 5 минут и сам выставит оценки в журнал.

Плюс ИИ-генератор тестов, готовые конспекты и презентации по ФГОС — не нужно готовиться с нуля.

Первые 5 дней бесплатно, без карты.
Дальше — от 199 ₽ в месяц.

saou.ru`,
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };
  return (
    <button onClick={copy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-sm border border-border hover:bg-muted transition-colors">
      <Icon name={copied ? "Check" : "Copy"} size={13} className={copied ? "text-green-600" : ""} />
      {copied ? "Скопировано" : "Скопировать текст"}
    </button>
  );
}

const STEPS = [
  { title: "Оформите сообщество", text: "Скачайте баннер-шапку ниже и загрузите его в настройках сообщества → «Обложка сообщества» — это первое, что видят посетители." },
  { title: "Откройте VK Реклама", text: "Зайдите на vk.com/ads из сообщества или личного кабинета — раздел «Реклама»." },
  { title: "Создайте кампанию", text: "Выберите цель «Продвижение сообщества/сайта» → тип объявления «Универсальная запись» или «Карусель»." },
  { title: "Загрузите изображение", text: "Скачайте квадратную картинку выше (полное качество, 2160×2160) и прикрепите к объявлению." },
  { title: "Вставьте текст", text: "Скопируйте один из готовых текстов поста ниже — можно менять под аудиторию." },
  { title: "Укажите ссылку", text: "В поле ссылки укажите сайт: saou.ru" },
  { title: "Настройте аудиторию", text: "Рекомендуем: учителя и родители школьников, интересы «образование», «школа», города — по вашему региону." },
  { title: "Запустите показ", text: "Установите дневной бюджет и запустите — VK Реклама покажет объявление выбранной аудитории." },
];

export default function UdsPromotion() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-sm font-bold flex items-center gap-2">
          <Icon name="Megaphone" size={16} fallback="Radio" /> Продвижение
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Готовые материалы для рекламы САОУ ВКонтакте — изображение, тексты постов и пошаговая инструкция.
        </p>
      </div>

      {/* Изображение для рекламы */}
      <div className="border border-border rounded-lg bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted flex items-center justify-between">
          <p className="text-xs font-semibold flex items-center gap-2">
            <Icon name="Image" size={14} /> Рекламное изображение
          </p>
          <span className="text-[10px] text-muted-foreground font-mono">2160 × 2160 px</span>
        </div>
        <div className="p-4 flex flex-col sm:flex-row gap-4 items-start">
          <img src={AD_IMAGE} alt="Рекламный баннер САОУ"
            className="w-full sm:w-64 rounded-sm border border-border shadow-sm flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Изображение в фирменных цветах САОУ: заголовок, ключевые возможности платформы,
              актуальные тарифы (199 / 1099 / 2299 ₽) и адрес сайта. Готово для загрузки в VK Рекламу
              как основной креатив объявления или пост в сообществе.
            </p>
            <a href={AD_IMAGE} download="saou-vk-ad.jpg"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 transition-opacity">
              <Icon name="Download" size={14} />
              Скачать в полном качестве
            </a>
          </div>
        </div>
      </div>

      {/* Шапка сообщества ВКонтакте */}
      <div className="border border-border rounded-lg bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted flex items-center justify-between">
          <p className="text-xs font-semibold flex items-center gap-2">
            <Icon name="PanelTop" size={14} fallback="Image" /> Шапка сообщества ВКонтакте
          </p>
          <span className="text-[10px] text-muted-foreground font-mono">1590 × 400 px</span>
        </div>
        <div className="p-4 space-y-3">
          <img src={COVER_IMAGE} alt="Шапка сообщества САОУ ВКонтакте"
            className="w-full rounded-sm border border-border shadow-sm" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground leading-relaxed flex-1">
              Готовый баннер для обложки сообщества ВКонтакте — точный размер под требования VK,
              логотип, название и слоган САОУ, ссылка на сайт. Загрузите его в разделе управления
              сообществом → «Обложка сообщества».
            </p>
            <a href={COVER_IMAGE} download="saou-vk-cover.jpg"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 transition-opacity flex-shrink-0 self-start">
              <Icon name="Download" size={14} />
              Скачать баннер
            </a>
          </div>
        </div>
      </div>

      {/* Тексты постов */}
      <div className="border border-border rounded-lg bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted">
          <p className="text-xs font-semibold flex items-center gap-2">
            <Icon name="FileText" size={14} /> Тексты постов
          </p>
        </div>
        <div className="divide-y divide-border">
          {POSTS.map(p => (
            <div key={p.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold">{p.title}</p>
                <CopyButton text={p.text} />
              </div>
              <pre className="text-xs text-foreground bg-muted/40 rounded-sm p-3 whitespace-pre-wrap leading-relaxed font-sans">
                {p.text}
              </pre>
            </div>
          ))}
        </div>
      </div>

      {/* Инструкция */}
      <div className="border border-border rounded-lg bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted">
          <p className="text-xs font-semibold flex items-center gap-2">
            <Icon name="ListChecks" size={14} /> Как запустить рекламу ВКонтакте
          </p>
        </div>
        <div className="p-4 space-y-3">
          {STEPS.map((s, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                {i + 1}
              </div>
              <div>
                <p className="text-xs font-semibold">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}