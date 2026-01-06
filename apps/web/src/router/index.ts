import { createRouter, createWebHistory } from "vue-router";
import { getActiveAccount, initAuthOnce } from "../auth/auth";
import { getMeCached } from "../auth/me";

import LoginView from "../views/LoginView.vue";
import CallbackView from "../views/CallbackView.vue";
import ShellView from "../views/ShellView.vue";
import PendingView from "../views/PendingView.vue";
import AdminView from "../views/AdminView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", component: LoginView },
    { path: "/auth/callback", component: CallbackView },

    { path: "/pending", component: PendingView, meta: { requiresAuth: true } },
    { path: "/", redirect: "/app" },

    { path: "/app", component: ShellView, meta: { requiresAuth: true, requiresActive: true } },
    { path: "/admin", component: AdminView, meta: { requiresAuth: true, requiresActive: true, requiresAdmin: true } },
  ],
});

router.beforeEach(async (to) => {
  // Sempre garanta MSAL inicializado antes de qualquer decisão
  await initAuthOnce();
  const acc = getActiveAccount();

  // Se já estiver logado e tentar ir pra /login, redireciona
  if (to.path === "/login" && acc) {
    const me = await getMeCached(false);
    if (!me) return "/app"; // fallback
    return me.status === "active" ? "/app" : "/pending";
  }

  // Rotas públicas seguem normalmente
  if (!to.meta.requiresAuth) return true;

  // Precisa estar logado no MSAL
  if (!acc) return "/login";

  // Se rota exige active, valida /users/me
  if (to.meta.requiresActive) {
    const me = await getMeCached(false);
    if (!me) return "/login";
    if (me.status !== "active") return "/pending";
  }

  // Admin check
  if (to.meta.requiresAdmin) {
    try {
      await (await import("../api/http")).http.get("/admin/me");
    } catch (e: any) {
      const code = e?.response?.status;
      if (code === 401) return "/login";
      if (code === 403) return "/app";
      return "/app";
    }
  }

  return true;
});

export default router;