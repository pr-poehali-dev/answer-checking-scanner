import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { appStore } from "@/store/appStore";
import { vkAuth } from "@/lib/vkAuth";
import { buildConsent } from "@/lib/appVersion";
import CompanyFooter from "@/components/CompanyFooter";

export default function VkCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("Входим через ВКонтакте…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const deviceId = params.get("device_id") || "";
    const error = params.get("error");

    if (error) {
      setStatus("error");
      setMessage(params.get("error_description") || "Авторизация отклонена");
      return;
    }
    if (!code || !state) {
      setStatus("error");
      setMessage("Не получен код авторизации от ВКонтакте");
      return;
    }

    const role = vkAuth.loadRole();

    (async () => {
      const res = await appStore.vkLogin({
        code,
        state,
        device_id: deviceId,
        redirect_uri: vkAuth.callbackUri(),
        role,
        consent: buildConsent("registration_vk"),
      });
      if (res.ok) {
        setStatus("ok");
        setMessage("Готово! Открываем личный кабинет…");
        setTimeout(() => navigate("/", { replace: true }), 1000);
      } else {
        setStatus("error");
        setMessage(res.error || "Не удалось войти через ВКонтакте");
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full border border-border rounded-sm bg-white p-8 text-center">
          <div className="mb-4">
            {status === "loading" && (
              <Icon name="Loader2" size={48} className="mx-auto text-primary animate-spin" />
            )}
            {status === "ok" && (
              <Icon name="CircleCheck" size={48} className="mx-auto text-green-500" fallback="CheckCircle" />
            )}
            {status === "error" && (
              <Icon name="CircleAlert" size={48} className="mx-auto text-destructive" fallback="AlertCircle" />
            )}
          </div>
          <p className="text-sm font-semibold mb-1">
            {status === "loading" ? "Вход через ВКонтакте" : status === "ok" ? "Готово" : "Ошибка"}
          </p>
          <p className="text-xs text-muted-foreground mb-4">{message}</p>
          {status === "error" && (
            <button
              onClick={() => navigate("/", { replace: true })}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90"
            >
              Вернуться в приложение
            </button>
          )}
        </div>
      </div>
      <CompanyFooter variant="full" />
    </div>
  );
}
