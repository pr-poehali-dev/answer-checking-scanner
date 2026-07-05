// Единая версия сайта и даты редакции юридических документов.
// Обновляйте APP_VERSION при значимых изменениях, а даты — при правках документов.

export const APP_VERSION = "1.4.0";

// Дата последней редакции сайта/документов (единый источник)
export const SITE_REVISION_DATE = "05.07.2026";

// Даты для юридических документов
export const LEGAL_DATES = {
  privacyEffective: "26.04.2026",
  privacyRevised: "05.07.2026",
  ofertaEffective: "26.04.2026",
  ofertaRevised: "05.07.2026",
};

// Формирует данные о согласии для отправки на сервер (доказательная база).
// context — с какой формы дано согласие (registration, institution_registration, sjou_application и т.д.)
export function buildConsent(context: string) {
  return {
    context,
    documents: "oferta,privacy",
    app_version: APP_VERSION,
    privacy_revision: LEGAL_DATES.privacyRevised,
    oferta_revision: LEGAL_DATES.ofertaRevised,
  };
}