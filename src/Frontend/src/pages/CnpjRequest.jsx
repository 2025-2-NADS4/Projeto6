// src/pages/CnpjRequest.jsx
import { useMemo, useState } from "react";
import { api } from "../api";

function onlyDigits(v = "") {
  return v.replace(/\D/g, "");
}
function formatCNPJ(v = "") {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return d.replace(/^(\d{2})(\d+)/, "$1.$2");
  if (d.length <= 8) return d.replace(/^(\d{2})(\d{3})(\d+)/, "$1.$2.$3");
  if (d.length <= 12) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d+)/, "$1.$2.$3/$4");
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2}).*/, "$1.$2.$3/$4-$5");
}

export default function CnpjRequest() {
  const [form, setForm] = useState({
    cnpj: "",
    razao_social: "",
    nome_fantasia: "",
    contato_email: "",
  });
  const [status, setStatus] = useState({ ok: false, msg: "" });
  const [loading, setLoading] = useState(false);

  const cnpjDigits = useMemo(() => onlyDigits(form.cnpj), [form.cnpj]);
  const canSend = !loading && cnpjDigits.length === 14;

  async function submit(e) {
    e.preventDefault();
    setStatus({ ok: false, msg: "" });

    if (cnpjDigits.length !== 14) {
      return setStatus({ ok: false, msg: "Informe um CNPJ válido com 14 dígitos." });
    }

    try {
      setLoading(true);
      const { data } = await api.post("/cnpj/request", {
        cnpj: cnpjDigits,
        razao_social: form.razao_social || undefined,
        nome_fantasia: form.nome_fantasia || undefined,
        contato_email: (form.contato_email || "").trim().toLowerCase() || undefined,
      });

      if (data?.status === "aprovado") {
        setStatus({
          ok: true,
          msg: "CNPJ já aprovado ✅ Você já pode criar sua conta como Cliente.",
        });
      } else {
        setStatus({
          ok: true,
          msg: "Solicitação enviada ✅ Aguarde um admin aprovar seu CNPJ para finalizar o cadastro.",
        });
      }

      setForm({ cnpj: "", razao_social: "", nome_fantasia: "", contato_email: "" });
    } catch (e) {
      setStatus({
        ok: false,
        msg: e?.response?.data?.error || "Não foi possível enviar. Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap" style={{ alignItems: "center", justifyContent: "center" }}>
      <form onSubmit={submit} className="card" style={{ width: 520, padding: 24 }}>
        <div className="center" style={{ marginBottom: 10 }}>
          <img src="/inovatech-logo.png" width="64" height="64" style={{ borderRadius: 999 }} alt="InovaTech" />
          <div className="brand" style={{ marginTop: 6 }}>Pré-cadastro de CNPJ</div>
          <div className="subtitle" style={{ opacity: .8 }}>
            Envie seu CNPJ para aprovação e depois finalize o cadastro como <b>Cliente</b>.
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <input
            className="input"
            placeholder="CNPJ (somente números)"
            value={formatCNPJ(form.cnpj)}
            onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
            inputMode="numeric"
            maxLength={18} // 18 com máscara (##.###.###/####-##)
            aria-label="CNPJ"
          />
          <input
            className="input"
            placeholder="Razão social (opcional)"
            value={form.razao_social}
            onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
            aria-label="Razão social"
          />
          <input
            className="input"
            placeholder="Nome fantasia (opcional)"
            value={form.nome_fantasia}
            onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })}
            aria-label="Nome fantasia"
          />
          <input
            className="input"
            placeholder="E-mail de contato (opcional)"
            type="email"
            value={form.contato_email}
            onChange={(e) => setForm({ ...form, contato_email: e.target.value })}
            aria-label="E-mail de contato"
          />

          {status.msg && (
            <small style={{ color: status.ok ? "var(--accent)" : "crimson" }}>
              {status.msg}
            </small>
          )}

          <button className="btn-pill" disabled={!canSend}>
            {loading ? "Enviando..." : "Enviar solicitação"}
          </button>

          <a href="/signup?role=cliente" className="btn-outline center">Ir para cadastro de cliente</a>
          <a href="/login?role=cliente" className="btn-outline center">Voltar ao login</a>
        </div>
      </form>
    </div>
  );
}
