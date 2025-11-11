// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./layout/Layout";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Forgot from "./pages/Forgot";
import Reset from "./pages/Reset";
import CnpjRequest from "./pages/CnpjRequest";

import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";

// usa exatamente os arquivos que você criou
import Campaigns from "./pages/Campanhas";
import Reports from "./pages/Relatorios";
import Settings from "./pages/Configuracoes";
import Restaurants from "./pages/Restaurantes";

// --------- Helpers / Guards ----------
function getSessionUser() {
  try { return JSON.parse(sessionStorage.getItem("user") || "{}"); }
  catch { return {}; }
}
function getAuthState() {
  const u = getSessionUser();
  const token = u?.token || sessionStorage.getItem("token") || "";
  return { user: u, token };
}

function RequireAuth({ children }) {
  const { token } = getAuthState();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { user, token } = getAuthState();
  if (!token) return <Navigate to="/login?role=admin" replace />;
  if (user?.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
}

// Home redireciona conforme login
function HomeRedirect() {
  const { token } = getAuthState();
  return token ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Home = Dashboard (se logado) */}
      <Route path="/" element={<HomeRedirect />} />

      {/* Auth públicas */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot" element={<Forgot />} />
      <Route path="/reset" element={<Reset />} />
      <Route path="/onboarding" element={<CnpjRequest />} />

      {/* Área autenticada com Layout (sidebar + outlet) */}
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        {/* index do shell = Dashboard */}
        <Route index element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Menu comum */}
        <Route path="/campanhas" element={<Campaigns />} />
        <Route path="/relatorios" element={<Reports />} />
        <Route path="/configuracoes" element={<Settings />} />

        {/* Restaurantes = somente admin */}
        <Route
          path="/restaurantes"
          element={
            <RequireAdmin>
              <Restaurants />
            </RequireAdmin>
          }
        />

        {/* Admin extra */}
        <Route
          path="/admin/users"
          element={
            <RequireAdmin>
              <Users />
            </RequireAdmin>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
