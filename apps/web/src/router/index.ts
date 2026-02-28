import { createRouter, createWebHistory } from "vue-router";
import { authClient } from "../auth/sigfarm-auth";
import { getMeCached } from "../auth/me";
import { createAuthNavigationGuard } from "./auth-guard";
import { resetRouteLoading, startRouteLoading, stopRouteLoading } from "../ui/loading/routeLoading";
import { http } from "../api/http";

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
    {
      path: "/admin",
      component: AdminView,
      meta: { requiresAuth: true, requiresActive: true, requiresAdmin: true },
    },
  ],
});

const AUTH_ROUTES = new Set(["/login", "/auth/callback", "/pending"]);

function isAuthRoute(path: string): boolean {
  return AUTH_ROUTES.has(path);
}

const authNavigationGuard = createAuthNavigationGuard({
  ensureSession: () => authClient.ensureSession(),
  exchangeSession: () => authClient.exchangeSession(),
  getMeCached,
  checkAdminAccess: async () => {
    try {
      await http.get("/admin/me");
      return "allowed" as const;
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401) return "unauthorized" as const;
      if (status === 403) return "forbidden" as const;
      return "error" as const;
    }
  },
});

router.beforeEach(async (to, from) => {
  const isAuthTarget = isAuthRoute(to.path);
  const isAuthSource = isAuthRoute(from.path);

  if (isAuthTarget || isAuthSource) {
    resetRouteLoading();
  } else if (
    to.fullPath !== from.fullPath &&
    ((from.path === "/app" && to.path === "/admin") ||
      (from.path === "/admin" && to.path === "/app"))
  ) {
    startRouteLoading();
  } else {
    resetRouteLoading();
  }

  return authNavigationGuard(to);
});

router.afterEach(() => {
  stopRouteLoading();
});

router.onError(() => {
  resetRouteLoading();
});

export default router;
