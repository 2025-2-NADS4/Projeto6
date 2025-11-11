// src/pages/Users.jsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useNavigate } from "react-router-dom";

const ADMIN_DOMAINS = ["cannoli.com.br", "inovatech.com.br"];
const ADMIN_CODES = ["CANNOLI", "INOVATECH"];

function onlyDigits(s) {
  return (s || "").replace(/\D+/g, "");
}

export default function Users() {
  const nav = useNavigate();

  // pega user/token de forma resiliente
  const me = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem("user") || "{}"); } catch { return {}; }
  }, []);
  const token = me?.token || sessionStorage.getItem("token") || "";
  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  // guarda de rota (somente admin aqui)
  useEffect(() => {
    if (!token) { nav("/login?role=admin", { replace: true }); return; }
    if (me?.role !== "admin") { nav("/dashboard", { replace: true }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, me?.role]);

  // ---------------- PRE-CADASTRO CNPJ (whitelist) ----------------
  const [cnpjList, setCnpjList] = useState([]);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjErr, setCnpjErr] = useState("");
  const [cnpjQ, setCnpjQ] = useState("");
  const [cnpjForm, setCnpjForm] = useState({
    cnpj: "",
    razao_social: "",
    nome_fantasia: "",
    contato_email: "",
  });

  async function loadCnpjs() {
    try {
      setCnpjLoading(true);
      setCnpjErr("");
      const { data } = await api.get("/cnpj", {
        params: { q: cnpjQ || undefined },
        headers,
      });
      setCnpjList(data);
    } catch (e) {
      if ([401, 403].includes(e?.response?.status)) return nav("/login?role=admin", { replace: true });
      setCnpjErr(e?.response?.data?.error || "Falha ao carregar CNPJs.");
    } finally {
      setCnpjLoading(false);
    }
  }

  async function approveCnpj(id, approved) {
    try {
      await api.put(`/cnpj/${id}/approve`, { approved }, { headers });
      await loadCnpjs();  // atualiza whitelist
      await load();       // e a lista de usuários (pode liberar criação)
    } catch (e) {
      if ([401, 403].includes(e?.response?.status)) return nav("/login?role=admin", { replace: true });
      setCnpjErr(e?.response?.data?.error || "Erro ao atualizar CNPJ.");
    }
  }

  async function requestCnpj(e) {
    e.preventDefault();
    setCnpjErr("");
    const cnpjDigits = onlyDigits(cnpjForm.cnpj);
    if (!cnpjDigits || cnpjDigits.length < 14) {
      setCnpjErr("Informe um CNPJ válido (14 dígitos).");
      return;
    }
    try {
      await api.post("/cnpj/request", {
        cnpj: cnpjDigits,
        razao_social: cnpjForm.razao_social || undefined,
        nome_fantasia: cnpjForm.nome_fantasia || undefined,
        contato_email: cnpjForm.contato_email || undefined,
      });
      setCnpjForm({ cnpj: "", razao_social: "", nome_fantasia: "", contato_email: "" });
      loadCnpjs();
    } catch (e) {
      setCnpjErr(e?.response?.data?.error || "Erro ao cadastrar CNPJ.");
    }
  }

  useEffect(() => { if (token) loadCnpjs(); /* ao abrir */ }, [token]); // eslint-disable-line

  // helper: checar se um CNPJ (digits) está aprovado na whitelist carregada
  function isApprovedCnpj(cnpjDigits) {
    const row = cnpjList.find((r) => onlyDigits(r.cnpj) === cnpjDigits);
    return !!row?.approved;
  }

  // ---------------- USUÁRIOS ----------------
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [form, setForm] = useState({
    id: null,
    nome: "",
    email: "",
    role: "cliente",
    cnpj: "",
    codigoCannoli: "",
    senha: "",
  });

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const { data } = await api.get("/users", { params: { q }, headers });
      setList(data);
    } catch (e) {
      if ([401, 403].includes(e?.response?.status)) return nav("/login?role=admin", { replace: true });
      setErr(e?.response?.data?.error || "Falha ao carregar usuários.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { if (token) load(); /* ao abrir */ }, [token]); // eslint-disable-line

  function edit(u) {
    setErr("");
    setForm({
      id: u.id,
      nome: u.nome,
      email: u.email,
      role: u.role,
      cnpj: u.cnpj || "",
      codigoCannoli: u.codigo_cannoli || "",
      senha: "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clear() {
    setForm({
      id: null,
      nome: "",
      email: "",
      role: "cliente",
      cnpj: "",
      codigoCannoli: "",
      senha: "",
    });
    setErr("");
  }

  function onRoleChange(role) {
    setForm((f) => ({
      ...f,
      role,
      cnpj: role === "cliente" ? f.cnpj : "",
      codigoCannoli: role === "admin" ? f.codigoCannoli : "",
    }));
  }

  function validateBeforeSave(p) {
    if (!p.nome || !p.email) return "Preencha nome e e-mail.";
    if (!p.role) return "Escolha o perfil (cliente/admin).";
    if (!form.id && !p.senha) return "Defina uma senha para novo usuário.";

    if (p.role === "cliente") {
      const digits = onlyDigits(p.cnpj);
      if (!digits || digits.length < 14) return "CNPJ é obrigatório (14 dígitos).";
      if (!isApprovedCnpj(digits)) return "Este CNPJ ainda não está aprovado na whitelist.";
      return null;
    }

    const domain = (p.email.split("@")[1] || "").toLowerCase();
    if (!ADMIN_DOMAINS.includes(domain)) {
      return "Admins só podem usar e-mails @cannoli.com.br ou @inovatech.com.br.";
    }
    const code = String(p.codigoCannoli || "").toUpperCase();
    if (!ADMIN_CODES.includes(code)) {
      return "Código do administrador inválido. Use CANNOLI ou INOVATECH.";
    }
    return null;
  }

  async function save(e) {
    e.preventDefault();
    setErr("");

    const payload = {
      nome: form.nome.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role,
      cnpj: form.role === "cliente" ? onlyDigits(form.cnpj) : undefined,
      codigoCannoli: form.role === "admin" ? (form.codigoCannoli || "").trim() : undefined,
      senha: form.senha || undefined,
    };

    const localErr = validateBeforeSave(payload);
    if (localErr) return setErr(localErr);

    try {
      setSaving(true);
      if (form.id) {
        await api.put(`/users/${form.id}`, payload, { headers });
      } else {
        await api.post("/users", payload, { headers });
      }
      clear();
      await load();
    } catch (e) {
      if ([401, 403].includes(e?.response?.status)) return nav("/login?role=admin", { replace: true });
      setErr(e?.response?.data?.error || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function removeUser(id) {
    if (!window.confirm("Excluir este usuário?")) return;
    try {
      await api.delete(`/users/${id}`, { headers });
      await load();
    } catch (e) {
      if ([401, 403].includes(e?.response?.status)) return nav("/login?role=admin", { replace: true });
      setErr(e?.response?.data?.error || "Erro ao excluir.");
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 12 }}>Usuários</h2>

      {/* ---------- Seção TOP: Whitelist de CNPJ ---------- */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <strong>Pré-cadastro de CNPJ (Whitelist)</strong>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="input"
              placeholder="Buscar CNPJ / Razão / Fant..."
              value={cnpjQ}
              onChange={(e) => setCnpjQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") loadCnpjs(); }}
              style={{ width: 280 }}
            />
            <button className="btn-outline" onClick={loadCnpjs} disabled={cnpjLoading}>
              {cnpjLoading ? "Carregando..." : "Buscar"}
            </button>
          </div>
        </div>

        {/* Form para cadastrar pedido de CNPJ */}
        <form
          onSubmit={requestCnpj}
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 8, marginBottom: 12 }}
        >
          <input
            className="input"
            placeholder="CNPJ (somente números ou com máscara)"
            value={cnpjForm.cnpj}
            onChange={(e) => setCnpjForm({ ...cnpjForm, cnpj: e.target.value })}
          />
          <input
            className="input"
            placeholder="Razão social (opcional)"
            value={cnpjForm.razao_social}
            onChange={(e) => setCnpjForm({ ...cnpjForm, razao_social: e.target.value })}
          />
          <input
            className="input"
            placeholder="Nome fantasia (opcional)"
            value={cnpjForm.nome_fantasia}
            onChange={(e) => setCnpjForm({ ...cnpjForm, nome_fantasia: e.target.value })}
          />
          <input
            className="input"
            placeholder="E-mail de contato (opcional)"
            type="email"
            value={cnpjForm.contato_email}
            onChange={(e) => setCnpjForm({ ...cnpjForm, contato_email: e.target.value })}
          />
          <button className="btn-secondary">Cadastrar/solicitar</button>
        </form>

        {cnpjErr && <small style={{ color: "crimson" }}>{cnpjErr}</small>}

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>CNPJ</th>
                <th>Razão Social</th>
                <th>Nome Fantasia</th>
                <th>Contato</th>
                <th>Status</th>
                <th style={{ width: 200 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {cnpjList.map((r) => (
                <tr key={r.id}>
                  <td>{r.cnpj}</td>
                  <td>{r.razao_social || "-"}</td>
                  <td>{r.nome_fantasia || "-"}</td>
                  <td>{r.contato_email || "-"}</td>
                  <td>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: r.approved ? "var(--green-ghost)" : "var(--yellow-ghost)",
                        border: "1px solid var(--divider)",
                      }}
                    >
                      {r.approved ? "Aprovado" : "Pendente"}
                    </span>
                  </td>
                  <td style={{ display: "flex", gap: 8 }}>
                    {r.approved ? (
                      <button className="btn-outline" type="button" onClick={() => approveCnpj(r.id, false)}>
                        Reprovar
                      </button>
                    ) : (
                      <button className="btn-secondary" type="button" onClick={() => approveCnpj(r.id, true)}>
                        Aprovar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!cnpjList.length && (
                <tr>
                  <td colSpan={6} style={{ opacity: 0.7 }}>
                    Nenhum CNPJ encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- Filtros usuários ---------- */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          className="input"
          placeholder="Buscar por nome, e-mail ou role..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
        />
        <button className="btn-outline" onClick={load} disabled={loading}>
          {loading ? "Carregando..." : "Buscar"}
        </button>
        <button className="btn-secondary" onClick={clear}>Novo</button>
      </div>

      {/* ---------- Form usuário ---------- */}
      <form onSubmit={save} className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr", gap: 8 }}>
          <input
            className="input"
            placeholder="Nome"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
          />
          <input
            className="input"
            placeholder="E-mail"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <select
            className="input"
            value={form.role}
            onChange={(e) => onRoleChange(e.target.value)}
          >
            <option value="cliente">Cliente</option>
            <option value="admin">Admin</option>
          </select>

          {form.role === "cliente" ? (
            <input
              className="input"
              placeholder="CNPJ"
              value={form.cnpj}
              onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
            />
          ) : (
            <input
              className="input"
              placeholder="Código (CANNOLI/INOVATECH)"
              value={form.codigoCannoli}
              onChange={(e) => setForm({ ...form, codigoCannoli: e.target.value })}
            />
          )}

          <input
            className="input"
            placeholder={form.id ? "Nova senha (opcional)" : "Senha"}
            type="password"
            value={form.senha}
            onChange={(e) => setForm({ ...form, senha: e.target.value })}
          />
        </div>

        {(err || cnpjErr) && (
          <small style={{ color: "crimson" }}>
            {err || cnpjErr}
          </small>
        )}

        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <button className="btn-pill" disabled={saving}>
            {saving ? "Salvando..." : form.id ? "Atualizar" : "Criar"}
          </button>
          {form.id && (
            <button className="btn-outline" type="button" onClick={clear}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      {/* ---------- Tabela usuários ---------- */}
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Role</th>
              <th>CNPJ</th>
              <th>Código</th>
              <th style={{ width: 180 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id}>
                <td>{u.nome}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.cnpj || "-"}</td>
                <td>{u.codigo_cannoli || "-"}</td>
                <td style={{ display: "flex", gap: 8 }}>
                  <button className="btn-secondary" type="button" onClick={() => edit(u)}>
                    Editar
                  </button>
                  <button className="btn-outline" type="button" onClick={() => removeUser(u.id)}>
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
            {!list.length && (
              <tr>
                <td colSpan={6} style={{ opacity: 0.7 }}>
                  Nenhum usuário.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
