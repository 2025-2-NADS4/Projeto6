import Layout from "../components/Layout";

export default function Configuracoes() {
  const user = JSON.parse(sessionStorage.getItem("user") || "{}");
  return (
    <Layout>
      <h1>Configurações ⚙️</h1>
      <div style={{ marginTop: 12 }}>
        <p><b>Nome:</b> {user?.name}</p>
        <p><b>Email:</b> {user?.email}</p>
        <p><b>Perfil:</b> {user?.role}</p>
      </div>
    </Layout>
  );
}
