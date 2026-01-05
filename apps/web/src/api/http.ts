import axios from "axios";
import { acquireApiToken } from "../auth/auth";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

export const http = axios.create({
  baseURL: apiBaseUrl,
});

http.interceptors.request.use(async (config) => {
  const path = window.location.pathname;
  if (path.startsWith("/login") || path.startsWith("/auth/callback")) {
    return config;
  }

  const token = await acquireApiToken();
  config.headers = config.headers ?? {};
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});