import { useState } from "react";
import Icon from "@/components/ui/icon";
import VkIcon from "@/components/ui/vk-icon";
import { vkAuth } from "@/lib/vkAuth";

interface VkLoginButtonProps {
  role?: "teacher" | "student";
  label?: string;
  onError?: (message: string) => void;
}

export default function VkLoginButton({ role = "teacher", label = "Войти через ВКонтакте", onError }: VkLoginButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await vkAuth.startAuth(role);
    } catch (e) {
      setLoading(false);
      onError?.((e as Error).message || "Не удалось открыть страницу ВКонтакте");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 py-2.5 border border-border text-sm font-semibold rounded-sm hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ color: "#0077FF" }}
    >
      {loading ? (
        <Icon name="Loader2" size={16} className="animate-spin" />
      ) : (
        <VkIcon size={16} />
      )}
      {loading ? "Открываем ВКонтакте…" : label}
    </button>
  );
}
