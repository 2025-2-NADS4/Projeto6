import Layout from "../components/Layout";
import { useEffect, useState } from "react";
import { api } from "../api";

export default function Restaurantes() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/admin/restaurantes");
        setRows(data || []);
      } catch {
        setRows([]);
      }
    })();
  }, []);

  return (
    <Layout>
      <h1>Restaurantes 👥</h1>
      {rows.length ? (
        <table style={{ width: "100%", marginTop: 12, borderCollapse: "collapse" }}>
          <thead><tr><th>Nome</th><th>Cidade</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>{r.nome}</td>
                <td style={{ padding: 8, textAlign: "center" }}>{r.cidade}</td>
                <td style={{ padding: 8, textAlign: "center" }}>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p style={{ opacity: .7 }}>Nenhum restaurante cadastrado.</p>}
    </Layout>
  );
}
