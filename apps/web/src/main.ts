import { createApp } from "vue";
import App from "./App.vue";
import "./assets/main.css";

import router from "./router";
import { initAuth } from "./auth/auth";

async function bootstrap() {
  await initAuth();
  createApp(App).use(router).mount("#app");
}

bootstrap();
