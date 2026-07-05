import LandingPage from "@/pages/LandingPage";

/**
 * Публичный лендинг, доступный по прямой ссылке /home всегда —
 * даже если в этой вкладке/сессии уже выполнен вход в ЛК.
 * Нужен для кнопки «На главную» из личного кабинета (открывается в новой вкладке).
 */
export default function PublicHomePage() {
  return (
    <LandingPage
      onLogin={() => { window.location.href = "/"; }}
      onRegister={() => { window.location.href = "/"; }}
      onTrial={() => { window.location.href = "/"; }}
      onOuLogin={() => { window.location.href = "/"; }}
    />
  );
}
