import axios from "axios";

export const TOKEN_KEY = "sams.token";

/** Axios instance pointed at the Express API (proxied in dev). */
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    // Session expired: clear token and bounce to login.
    if (error?.response?.status === 401 && !location.pathname.startsWith("/login")) {
      localStorage.removeItem(TOKEN_KEY);
      location.href = "/login";
    }
    return Promise.reject(error);
  },
);

/** Extract a readable message from an API error. */
export function apiError(e: any, fallback = "Something went wrong") {
  return e?.response?.data?.message ?? e?.message ?? fallback;
}
