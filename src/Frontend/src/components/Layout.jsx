import { Link, useLocation } from "react-router-dom";

export default function Layout({ children }) {
  const user = safeUser();
  const isAdmin = user?.role === "admin";
  const { pathname } = useLocation();

  const Item = ({ to, icon, label }) => (
    <Link
      to={to}
      className={`menu-item ${pathname === to ? "active" : ""}`}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 16px",
        background: pathname === to ? "#FF8C00" : "#FF9F1C",
        color: "#fff",
        borderRadius: 12,
        marginBottom: 12,
        textDecoration: "none",
        boxShadow: "0 6px 18px rgba(255,159,28,.25)",
        fontWeight: 600,
        letterSpacing: .2,
      }}
    >
      <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        {label}
      </span>
      <span style={{ fontWeight: 900, opacity: .9 }}>›</span>
    </Link>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#FFF7EF" }}>
      {/* Sidebar */}
      <aside style={{ width: 260, padding: 20 }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          {/* se tiver logo, coloca em /public/logo.png */}
          <img src="/logo.png" alt="InovaTech" style={{ width: 120, opacity: .95 }} />
        </div>
        <Item to="/home" icon="🏠" label="Início" />
        <Item to="/dashboard" icon="📊" label="Dashboard" />
        <Item to="/campanhas" icon="🎯" label="Campanhas" />
        <Item to="/relatorios" icon="📈" label="Relatórios" />
        <Item to="/configuracoes" icon="⚙️" label="Configurações" />
        {isAdmin && <Item to="/restaurantes" icon="👥" label="Restaurantes" />}
      </aside>

      {/* Conteúdo */}
      <main style={{ flex: 1, padding: 24 }}>{children}</main>
    </div>
  );
}

function safeUser() {
  try { return JSON.parse(sessionStorage.getItem("user") || "{}"); }
  catch { return {}; }
}
