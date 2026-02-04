import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./assets/main.css";
import { hardResetAuthState, initAuthSafe } from "./auth/auth";

async function bootstrap() {
  try {
    await initAuthSafe();
  } catch {
    await hardResetAuthState();
  }

  const app = createApp(App);
  app.use(router);

  await router.isReady();
  app.mount("#app");
}

bootstrap();
