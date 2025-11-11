import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();

  const qp = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const roleFromURL = (qp.get("role") || "cliente").toLowerCase();
  const nextPath = qp.get("next") || "/dashboard";

  const [label, setLabel] = useState("Cliente");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // já logado? vai pro dashboard
  useEffect(() => {
    try {
      const u = JSON.parse(sessionStorage.getItem("user") || "{}");
      if (u?.token) nav("/dashboard", { replace: true });
    } catch {}
  }, [nav]);

  useEffect(() => {
    setLabel(roleFromURL === "admin" ? "Administrativo" : "Cliente");
  }, [roleFromURL]);

  async function submit(e) {
    e.preventDefault();
    if (loading) return;

    const emailNorm = (email || "").trim().toLowerCase();
    const passNorm = (pass || "").trim();

    if (!emailNorm || !passNorm) {
      setErr("Preencha e-mail e senha.");
      return;
    }
    setErr("");
    setLoading(true);

    try {
      const { data } = await api.post("/auth/login", {
        email: emailNorm,
        password: passNorm,
      });

      // salva user completo (inclui cnpj para o escopo do cliente)
      const user = {
        token: data.token,
        role: data.role,
        name: data.name,
        email: emailNorm,
        cnpj: data.cnpj || null,
      };
      sessionStorage.setItem("user", JSON.stringify(user));
      sessionStorage.removeItem("token"); // compat antiga

      // Se a tela foi aberta como admin mas o backend disse que é cliente, avisa e segue
      if (roleFromURL === "admin" && String(data.role).toLowerCase() !== "admin") {
        setErr("Você não tem perfil administrativo. Entrando como cliente.");
        nav("/dashboard", { replace: true });
        return;
      }

      // vai pra rota pretendida
      nav(nextPath, { replace: true });
    } catch (e) {
      const msg =
        e?.response?.data?.error || "Falha no login. Verifique e-mail e senha.";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  const disabled = loading || !email || !pass;

  return (
    <div className="login-wrap">
      <div className="login-hero" />
      <div className="login-right">
        <form onSubmit={submit} className="card" style={{ width: 380 }}>
          <div className="center" style={{ marginBottom: 8 }}>
            <img
              src="/inovatech-logo.png"
              width="74"
              height="74"
              style={{ borderRadius: 999 }}
              alt="InovaTech"
            />
            <div className="brand" style={{ marginTop: 6 }}>LOGIN</div>
            <div className="subtitle">Perfil {label}</div>
          </div>

          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            <input
              className="input"
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              aria-label="E-mail"
            />
            <input
              className="input"
              type="password"
              placeholder="Senha"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="current-password"
              aria-label="Senha"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !disabled) submit(e);
              }}
            />

            {err && <small style={{ color: "crimson" }}>{err}</small>}

            <button className="btn-pill" disabled={disabled}>
              {loading ? "Entrando..." : "Entrar"}
            </button>

            <div className="center" style={{ marginTop: 6, opacity: 0.8 }}>
              Ainda não tem conta?
            </div>
            <a className="btn-secondary center" href={`/signup?role=${roleFromURL}`}>
              Crie sua conta
            </a>

            <a className="btn-link center" href={`/forgot?role=${roleFromURL}`}>
              Esqueceu a senha?
            </a>

            <a href="/" className="btn-outline center">Voltar para página inicial</a>
          </div>
        </form>
      </div>
    </div>
  );
}
