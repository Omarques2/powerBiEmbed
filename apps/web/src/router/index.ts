import { createRouter, createWebHistory } from "vue-router";
import { getActiveAccount } from "../auth/auth";

import LoginView from "../views/LoginView.vue";
import CallbackView from "../views/CallbackView.vue";
import ShellView from "../views/ShellView.vue";
import PendingView from "../views/PendingView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", component: LoginView },
    { path: "/auth/callback", component: CallbackView },
    { path: "/pending", component: PendingView, meta: { requiresAuth: true } },
    { path: "/", redirect: "/app" },
    { path: "/app", component: ShellView, meta: { requiresAuth: true } },
  ],
});

router.beforeEach((to) => {
  if (!to.meta.requiresAuth) return true;
  const acc = getActiveAccount();
  if (!acc) return "/login";
  return true;
});

export default router;
