import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./assets/main.css";
import { initAuthSafe } from "./auth/auth";

function bootstrap() {
  const isCallbackRoute =
    typeof window !== "undefined" && window.location.pathname === "/auth/callback";

  const app = createApp(App);
  app.use(router);
  app.mount("#app");

  // Warm-up assíncrono: não bloqueia primeiro paint.
  if (!isCallbackRoute) {
    void initAuthSafe();
  }
}

bootstrap();
