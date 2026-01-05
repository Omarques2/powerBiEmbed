import { createRouter, createWebHistory } from "vue-router";
import { getActiveAccount } from "../auth/auth";

import LoginView from "../views/LoginView.vue";
import CallbackView from "../views/CallbackView.vue";
import ShellView from "../views/ShellView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", component: LoginView },
    { path: "/auth/callback", component: CallbackView },
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
