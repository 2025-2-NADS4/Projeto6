// src/pages/ResetBasic.jsx
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function ResetBasic() {
  const nav = useNavigate();
  const role = new URLSearchParams(useLocation().search).get("role") || "cliente";

  const [email, setEmail] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const senhaOk = p1.length >= 6 && p1 === p2;
  const enable = emailOk && senhaOk && !loading;

  async function submit(e) {
    e.preventDefault();
    if (!enable) return;

    setErr("");
    setOk("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/reset-basic", {
        email: email.trim().toLowerCase(),
        password: p1.trim(),
      });
      if (data?.ok) {
        setOk("Senha atualizada com sucesso! Redirecionando…");
        setTimeout(() => nav(`/login?role=${role}`), 1200);
      } else {
        setErr(data?.error || "Não foi possível atualizar a senha.");
      }
    } catch (e) {
      setErr(e?.response?.data?.error || "Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-hero" />
      <div className="login-right">
        <form onSubmit={submit} className="card" style={{ width: 420 }}>
          <div className="center" style={{ marginBottom: 8 }}>
            <img
              src="/inovatech-logo.png"
              alt="InovaTech"
              width="74"
              height="74"
              style={{ borderRadius: 999 }}
            />
            <div className="brand" style={{ marginTop: 6 }}>Redefinir senha</div>
            <div className="subtitle">Perfil {role === "admin" ? "Administrativo" : "Cliente"}</div>
          </div>

          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            <input
              className="input"
              type="email"
              placeholder="Seu e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              aria-label="E-mail"
            />
            <input
              className="input"
              type="password"
              placeholder="Nova senha (mín. 6)"
              value={p1}
              onChange={(e) => setP1(e.target.value)}
              autoComplete="new-password"
              aria-label="Nova senha"
              onKeyDown={(e) => { if (e.key === "Enter" && enable) submit(e); }}
            />
            <input
              className="input"
              type="password"
              placeholder="Confirmar senha"
              value={p2}
              onChange={(e) => setP2(e.target.value)}
              autoComplete="new-password"
              aria-label="Confirmar senha"
              onKeyDown={(e) => { if (e.key === "Enter" && enable) submit(e); }}
            />

            {!emailOk && email && <small style={{ color: "crimson" }}>E-mail inválido.</small>}
            {p1 && p1.length < 6 && <small style={{ color: "crimson" }}>Senha muito curta (mín. 6).</small>}
            {p2 && p1 !== p2 && <small style={{ color: "crimson" }}>As senhas não conferem.</small>}
            {err && <small style={{ color: "crimson" }}>{err}</small>}
            {ok && <small style={{ color: "seagreen" }}>{ok}</small>}

            <button className="btn-pill" disabled={!enable}>
              {loading ? "Salvando..." : "Salvar nova senha"}
            </button>

            <a href={`/login?role=${role}`} className="btn-outline center">Voltar ao login</a>
          </div>
        </form>
      </div>
    </div>
  );
}
