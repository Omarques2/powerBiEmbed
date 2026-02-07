import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./assets/main.css";
import { hardResetAuthState, initAuthSafe } from "./auth/auth";

async function bootstrap() {
  const isCallbackRoute =
    typeof window !== "undefined" && window.location.pathname === "/auth/callback";

  if (!isCallbackRoute) {
    try {
      await initAuthSafe();
    } catch {
      await hardResetAuthState();
    }
  }

  const app = createApp(App);
  app.use(router);

  await router.isReady();
  app.mount("#app");
}

bootstrap();
