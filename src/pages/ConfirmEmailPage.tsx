import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { appStore } from "@/store/appStore";
import CompanyFooter from "@/components/CompanyFooter";

// Страница подтверждения email по ссылке из письма: /confirm-email?token=...
export default function ConfirmEmailPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("Подтверждаем почту…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Ссылка повреждена: не найден код подтверждения");
      return;
    }

    (async () => {
      const res = await appStore.confirmEmailLink(token);
      if (res.ok) {
        setStatus("ok");
        setMessage("Почта подтверждена! Открываем личный кабинет…");
        setTimeout(() => navigate("/", { replace: true }), 1200);
      } else {
        setStatus("error");
        setMessage(res.error || "Не удалось подтвердить почту");
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
            {status === "loading" ? "Подтверждение" : status === "ok" ? "Готово" : "Ошибка"}
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
