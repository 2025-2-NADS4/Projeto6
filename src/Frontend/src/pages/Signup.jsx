// src/pages/Signup.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";

function onlyDigits(s) {
  return (s || "").replace(/\D+/g, "");
}

export default function Signup() {
  const nav = useNavigate();
  const loc = useLocation();
  const qp = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const roleFromURL = (qp.get("role") || "cliente").toLowerCase();

  const [role, setRole] = useState(roleFromURL); // "cliente" | "admin"
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [cnpjStatus, setCnpjStatus] = useState(null); // "pendente" | "aprovado" | null
  const [cnpjMsg, setCnpjMsg] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [senha, setSenha] = useState("");
  const [conf, setConf] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingCnpj, setCheckingCnpj] = useState(false);

  useEffect(() => {
    setRole(roleFromURL);
  }, [roleFromURL]);

  // limpadores ao trocar de perfil
  useEffect(() => {
    setErr(""); setOk("");
    if (role === "cliente") {
      setAdminCode("");
    } else {
      setCnpj(""); setCnpjStatus(null); setCnpjMsg("");
    }
  }, [role]);

  async function checkCnpj() {
    const digits = onlyDigits(cnpj);
    setCnpjStatus(null);
    setCnpjMsg("");

    if (!digits || digits.length < 14) {
      setCnpjMsg("Informe um CNPJ válido (14 dígitos).");
      return;
    }

    try {
      setCheckingCnpj(true);
      const { data } = await api.post("/cnpj/request", {
        cnpj: digits,
        contato_email: (email || "").trim().toLowerCase() || undefined,
      });
      setCnpjStatus(data.status); // "aprovado" | "pendente"
      setCnpjMsg(
        data.status === "aprovado"
          ? "CNPJ aprovado. Você já pode criar a conta."
          : "CNPJ cadastrado e pendente de aprovação pelo admin."
      );
    } catch (e) {
      const msg = e?.response?.data?.error || "Não foi possível verificar o CNPJ. Tente novamente.";
      setCnpjMsg(msg);
      setCnpjStatus(null);
    } finally {
      setCheckingCnpj(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (loading) return;

    setErr(""); setOk("");

    const emailNorm = (email || "").trim().toLowerCase();
    const senhaNorm = (senha || "").trim();

    if (!nome || !emailNorm || !senhaNorm) {
      setErr("Preencha nome, e-mail e senha.");
      return;
    }
    if (senhaNorm.length < 6) {
      setErr("Senha muito curta (mínimo 6).");
      return;
    }
    if (senhaNorm !== conf) {
      setErr("Confirmação de senha não confere.");
      return;
    }

    const body = { role, nome, email: emailNorm, senha: senhaNorm };

    if (role === "cliente") {
      const cnpjDigits = onlyDigits(cnpj);
      if (!cnpjDigits || cnpjDigits.length < 14) {
        setErr("Informe um CNPJ válido (somente números).");
        return;
      }
      if (cnpjStatus !== "aprovado") {
        setErr("CNPJ não aprovado. Clique em 'Verificar CNPJ' e aguarde a aprovação do admin.");
        return;
      }
      body.cnpj = cnpjDigits;
    } else {
      // admin: exige o código
      const code = (adminCode || "").trim();
      if (!code) {
        setErr("Informe o Código do Admin.");
        return;
      }
      body.adminCode = code;
    }

    try {
      setLoading(true);
      await api.post("/auth/signup", body);
      setOk("Conta criada com sucesso! Faça login para entrar.");
      setTimeout(() => nav(`/login?role=${role}`), 800);
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        (e?.response?.status === 409 ? "E-mail já cadastrado." : "Não foi possível criar a conta.");
      setErr(msg); // fica na tela; não redireciona
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    !loading &&
    !!nome &&
    !!email &&
    !!senha &&
    !!conf &&
    (role === "admin" ? !!adminCode.trim() : cnpjStatus === "aprovado");

  return (
    <div className="login-wrap">
      <div className="login-hero" />
      <div className="login-right">
        <form onSubmit={submit} className="card" style={{ width: 460 }}>
          <div className="center" style={{ marginBottom: 8 }}>
            <img src="/inovatech-logo.png" width="74" height="74" style={{ borderRadius: 999 }} alt="InovaTech"/>
            <div className="brand" style={{ marginTop: 6 }}>Crie sua conta</div>
            <div className="subtitle">Perfil {role === "admin" ? "Administrador" : "Cliente"}</div>
          </div>

          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className={role==="cliente" ? "btn-pill" : "btn-outline"} onClick={()=>setRole("cliente")}>Cliente</button>
              <button type="button" className={role==="admin" ? "btn-pill" : "btn-outline"} onClick={()=>setRole("admin")}>Admin</button>
            </div>

            <input className="input" placeholder="Nome" value={nome} onChange={e=>setNome(e.target.value)} />
            <input className="input" type="email" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/>

            {role === "cliente" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                  <input
                    className="input"
                    placeholder="CNPJ (somente números)"
                    value={cnpj}
                    onChange={(e) => {
                      setCnpj(e.target.value);
                      setCnpjStatus(null);
                      setCnpjMsg("");
                    }}
                    onBlur={checkCnpj}
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={checkCnpj}
                    disabled={checkingCnpj}
                    title="Verificar/Cadastrar CNPJ na whitelist"
                  >
                    {checkingCnpj ? "Verificando..." : "Verificar CNPJ"}
                  </button>
                </div>
                {cnpjMsg && (
                  <small style={{ color: cnpjStatus === "aprovado" ? "seagreen" : "#b36b00" }}>
                    {cnpjMsg}
                  </small>
                )}
              </>
            )}

            {role === "admin" && (
              <input
                className="input"
                placeholder="Código do Admin"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
              />
            )}

            <input className="input" type="password" placeholder="Senha (mín. 6)" value={senha} onChange={e=>setSenha(e.target.value)} autoComplete="new-password"/>
            <input className="input" type="password" placeholder="Confirmar senha" value={conf} onChange={e=>setConf(e.target.value)} autoComplete="new-password"/>

            {err && <small style={{ color: "crimson" }}>{err}</small>}
            {ok  && <small style={{ color: "seagreen" }}>{ok}</small>}

            <button className="btn-pill" disabled={!canSubmit}>
              {loading ? "Criando..." : "Criar conta"}
            </button>
            <a className="btn-link center" href={`/login?role=${role}`}>Voltar ao login</a>
          </div>
        </form>
      </div>
    </div>
  );
}
