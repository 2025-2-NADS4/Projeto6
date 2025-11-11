import Layout from "../components/Layout";
import { useEffect, useState } from "react";
import { api } from "../api";

export default function Campanhas() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    (async () => {
      // Se ainda não tiver endpoint real, isso evita crash
      try {
        const { data } = await api.get("/panel/campaigns");
        setRows(data || []);
      } catch {
        setRows([]);
      }
    })();
  }, []);

  return (
    <Layout>
      <h1>Campanhas 🎯</h1>
      {rows.length ? (
        <table style={{ width: "100%", marginTop: 12, borderCollapse: "collapse" }}>
          <thead><tr><th>Nome</th><th>Período</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((c, i) => (
              <tr key={i} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>{c.nome}</td>
                <td style={{ padding: 8 }}>{c.inicio} — {c.fim}</td>
                <td style={{ padding: 8 }}>{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p style={{ opacity: .7 }}>Nenhuma campanha por aqui ainda.</p>}
    </Layout>
  );
}
