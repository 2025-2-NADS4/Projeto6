import Layout from "../components/Layout";
import { Bar } from "react-chartjs-2";
import { Chart, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from "chart.js";
Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function Relatorios() {
  const data = {
    labels: ["Jan","Fev","Mar","Abr","Mai","Jun"],
    datasets: [{ label: "Vendas (R$)", data: [1200,1500,900,2100,2500,2700], borderWidth: 1 }]
  };
  const opts = { responsive: true, maintainAspectRatio: false };

  return (
    <Layout>
      <h1>Relatórios 📈</h1>
      <div style={{ height: 320, maxWidth: 720 }}><Bar data={data} options={opts} /></div>
    </Layout>
  );
}
