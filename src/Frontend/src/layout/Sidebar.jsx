// src/layout/Sidebar.jsx
import { NavLink, useNavigate } from "react-router-dom";

export default function Sidebar() {
  const nav = useNavigate();
  const user = safeUser();
  const isAdmin = user?.role === "admin";

  function sair() {
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("token");
    nav(`/login?role=${isAdmin ? "admin" : "cliente"}`, { replace: true });
  }

  const Item = ({ to, icon, children }) => (
    <NavLink
      to={to}
      className={({ isActive }) => "sb-btn" + (isActive ? " sb-btn--active" : "")}
      end
    >
      <span className="sb-ico">{icon}</span>
      <span className="sb-txt">{children}</span>
      <span className="sb-chevron">›</span>
    </NavLink>
  );

  return (
    <aside className="sidebar">
      <div className="sb-logo">
        <img src="/inovatech-logo.png" alt="InovaTech" />
      </div>

      <nav className="sb-nav">
        <Item to="/" icon="🏠">Início</Item>
        <Item to="/dashboard" icon="📊">Dashboard</Item>
        <Item to="/campanhas" icon="🎯">Campanhas</Item>
        <Item to="/relatorios" icon="📈">Relatórios</Item>
        <Item to="/config" icon="⚙️">Configurações</Item>

        {/* Itens extras (apenas quando for admin) */}
        {isAdmin && (
          <>
            <Item to="/admin/users" icon="👥">Restaurantes</Item>
            {/* Se a whitelist está dentro de /admin/users, mantemos esse link.
               Se tiver página própria, troque o "to" para a rota correta. */}
          </>
        )}
      </nav>

      <div className="sb-footer">
        <div className="sb-user">
          <div className="sb-avatar">{(user?.name || "U?").slice(0,1)}</div>
          <div className="sb-user-info">
            <b>{user?.name || (isAdmin ? "Administrador" : "Cliente")}</b>
            <small>Perfil {isAdmin ? "Administrador" : "Cliente"}</small>
          </div>
        </div>

        <button className="sb-exit" onClick={sair}>Sair</button>
      </div>
    </aside>
  );
}

function safeUser() {
  try { return JSON.parse(sessionStorage.getItem("user") || "{}"); }
  catch { return {}; }
}
