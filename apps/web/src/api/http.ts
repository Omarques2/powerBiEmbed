import axios from "axios";
import { acquireApiToken, hardResetAuthState } from "../auth/auth";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

export const http = axios.create({
  baseURL: apiBaseUrl,
});

http.interceptors.request.use(async (config) => {
  // Permite chamadas "public" quando você quiser (raras)
  const skipAuth =
    (config.headers as any)?.["X-Skip-Auth"] === "1" ||
    (config as any).skipAuth === true;

  if (skipAuth) return config;

  const token = await acquireApiToken();
  config.headers = config.headers ?? {};
  (config.headers as any).Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      await hardResetAuthState();
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        if (path !== "/login" && path !== "/auth/callback") {
          window.location.assign("/login");
        }
      }
    }
    return Promise.reject(error);
  },
);
