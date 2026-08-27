// Вход/регистрация через ВКонтакте (VK ID, PKCE). Роль (учитель/ученик) сохраняется
// в sessionStorage перед редиректом, чтобы восстановить её после возврата на /vk-callback.
import { authApi } from "@/lib/api";

const LS_ROLE = "saou_vk_role";

function callbackUri(): string {
  return `${window.location.origin}/vk-callback`;
}

export const vkAuth = {
  /** Запустить вход через ВКонтакте: получить ссылку и перейти на неё */
  startAuth: async (role: "teacher" | "student" = "teacher") => {
    sessionStorage.setItem(LS_ROLE, role);
    const { url } = await authApi.vkAuthUrl(callbackUri());
    window.location.href = url;
  },

  /** Восстановить роль, выбранную перед редиректом (по умолчанию — ученик) */
  loadRole: (): "teacher" | "student" => {
    const v = sessionStorage.getItem(LS_ROLE);
    sessionStorage.removeItem(LS_ROLE);
    return v === "teacher" ? "teacher" : "student";
  },

  callbackUri,
};
