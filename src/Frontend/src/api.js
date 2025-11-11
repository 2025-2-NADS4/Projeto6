// src/api.js
import axios from "axios";

export const api = axios.create({
  baseURL: "http://127.0.0.1:5001", // pode trocar por import.meta.env.VITE_API_URL se quiser .env
});

// Anexa automaticamente o Bearer token de quem está logado
api.interceptors.request.use((config) => {
  try {
    const user = JSON.parse(sessionStorage.getItem("user") || "{}");
    if (user?.token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${user.token}`;
    }
  } catch (e) {
    // se o JSON estiver inválido, ignora e segue sem token
  }
  return config;
});

// Se o token expirar ou não tiver permissão, manda pro login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      // opcional: limpe a sessão
      // sessionStorage.removeItem("user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);
