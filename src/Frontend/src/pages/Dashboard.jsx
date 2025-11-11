import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart,
  LineElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

Chart.register(
  LineElement,
  BarElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);

export default function Dashboard() {
  const nav = useNavigate();
  const user = safeUser();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!user?.token) nav(`/login?next=/dashboard`, { replace: true });
  }, [user?.token, nav]);

  // começa em 7d pra garantir dados
  const [period, setPeriod] = useState("7d");
  const [channel, setChannel] = useState("");
  const [location, setLocation] = useState("");
  const [opts, setOpts] = useState({ periods: [], channels: [], locations: [] });

  const [kpis, setKpis] = useState(null);
  const [serie, setSerie] = useState([]);
  const [byChannel, setByChannel] = useState({});
  const [topItems, setTopItems] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);

  const [stackLabels, setStackLabels] = useState([]);
  const [stackSeries, setStackSeries] = useState({});
  const [stackChannels, setStackChannels] = useState([]);
  const [asCnpj, setAsCnpj] = useState("");

  // --- Admin overview ---
  const [adminKpis, setAdminKpis] = useState(null);
  const [topRest, setTopRest] = useState([]);
  const [restSeries, setRestSeries] = useState({ labels: [], valores: [] });

  // carrega filtros + dados iniciais
  useEffect(() => {
    (async () => {
      const { data: f } = await api.get("/filters/options");
      setOpts(f);
      await refreshAll("7d", "", "");
      await refreshStack("7d", "", "", "");
    })();

    const sse = new EventSource("http://127.0.0.1:5001/stream/kpis");
    sse.onmessage = (e) =>
      setKpis((prev) => ({ ...(prev || {}), ...JSON.parse(e.data) }));
    return () => sse.close();
  }, []);

  // recarrega sempre que muda o filtro
  useEffect(() => {
    refreshAll();
    refreshStack();
  }, [period, channel, location]);

  // quando admin muda “ver como CNPJ” na série empilhada
  useEffect(() => {
    if (isAdmin) refreshStack(period, channel, location, asCnpj.trim());
  }, [asCnpj]); // eslint-disable-line

  // atualiza overview admin quando kpis/byChannel/opts mudam
  useEffect(() => {
    if (!isAdmin) return;
    loadAdminOverview();
  }, [isAdmin, kpis, byChannel, opts]); // eslint-disable-line

  // polling de alertas
  useEffect(() => {
    const t = setInterval(async () => {
      const { data } = await api.get("/alerts");
      if (data.length) setAlerts((a) => [...data, ...a].slice(0, 5));
    }, 4000);
    return () => clearInterval(t);
  }, []);

  async function refreshAll(p = period, c = channel, l = location) {
    const { data } = await api.get("/metrics", {
      params: { period: p, channel: c || undefined, location: l || undefined },
    });
    const out = { ...data.kpis };
    if (!isAdmin) delete out.churn;
    setKpis(out);
    setSerie(data.serie);

    const { data: bc } = await api.get("/panel/by-channel", {
      params: { period: p, location: l || undefined },
    });
    setByChannel(bc || {});

    const { data: ti } = await api.get("/panel/top-items", {
      params: { period: p, channel: c || undefined, location: l || undefined },
    });
    setTopItems(ti || []);

    const { data: sug } = await api.get("/suggestions");
    setSuggestions(sug || []);
  }

  async function refreshStack(
    p = period,
    c = channel,
    l = location,
    cnpj = asCnpj
  ) {
    const params = { period: p, location: l || undefined };
    if (isAdmin && cnpj) params.cnpj = cnpj;
    const { data } = await api.get("/series/by-channel", { params });
    setStackLabels(data.labels || []);
    setStackSeries(data.series || {});
    setStackChannels(data.channels || []);
  }

  function loadAdminOverview() {
    if (!isAdmin) return;

    setAdminKpis({
      restaurantesAtivos: opts?.locations?.length || 0,
      vendasTotaisMes:
        kpis?.totalVendas != null
          ? kpis.totalVendas
          : (kpis?.pedidos || 0) * (kpis?.ticketMedio || 0),
      campanhasAtivas: 0,
      clientesFinaisAtivos: kpis?.clientesAtivos ?? 0,
    });

    const locs = opts?.locations || [];
    const bcVals = Object.values(byChannel || {});
    const fakeTop = locs.slice(0, 3).map((nome, i) => ({
      nome,
      valor: Math.round(((bcVals[i] || 1) * 1000) + 20000 - i * 3000),
      campanhasAtivas: 30 - i * 7,
    }));
    setTopRest(fakeTop);

    const labels = locs.slice(0, 5);
    const valores = labels.map((_, i) =>
      Math.round(((bcVals[i] || 1) * 800) + 150000 - i * 12000)
    );
    setRestSeries({ labels, valores });
  }

  // ===== CHART DATA =====
  const lineData = useMemo(
    () => ({
      labels: serie.map((s) => s.hora), // backend já manda HH (24h) ou dd/mm (7d/30d)
      datasets: [
        {
          label: "Pedidos",
          data: serie.map((s) => s.pedidos),
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
        },
      ],
    }),
    [serie]
  );

  // byChannel do backend é RECEITA -> ajusta rótulos e formatação
  const barData = useMemo(() => {
    const labels = Object.keys(byChannel || {});
    const vals = Object.values(byChannel || {});
    return {
      labels,
      datasets: [{ label: "Receita por Canal (R$)", data: vals }],
    };
  }, [byChannel]);

  const stackedData = useMemo(() => {
    const datasets = (stackChannels || []).map((ch) => ({
      label: ch,
      data: stackSeries?.[ch] || [],
      borderWidth: 1,
    }));
    return { labels: stackLabels, datasets };
  }, [stackLabels, stackSeries, stackChannels]);

  const adminBars = useMemo(
    () => ({
      labels: restSeries.labels,
      datasets: [{ label: "Vendas (R$)", data: restSeries.valores, borderWidth: 1 }],
    }),
    [restSeries]
  );

  // ===== CHART OPTS =====
  const currency = (v) =>
    (typeof v === "number" ? v : 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });

  const chartOptsLine = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true }, tooltip: { mode: "index" } },
    scales: {
      y: { grid: { color: "rgba(0,0,0,.06)" } },
      x: { grid: { display: false } },
    },
  };

  const chartOptsBarMoney = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${currency(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      y: {
        grid: { color: "rgba(0,0,0,.06)" },
        ticks: { callback: (v) => currency(v) },
      },
      x: { grid: { display: false } },
    },
  };

  const stackedOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true }, tooltip: { mode: "index" } },
    scales: {
      y: { stacked: true, grid: { color: "rgba(0,0,0,.06)" } },
      x: { stacked: true, grid: { display: false } },
    },
  };

  // ===== EXPORTS =====
  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(serie);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "serie_pedidos");
    XLSX.writeFile(wb, "serie_pedidos.xlsx");
  }
  function exportPDF() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Relatório InovaTech - KPIs", 14, 18);
    let y = 30;
    Object.entries(kpis || {}).forEach(([k, v]) => {
      doc.text(`${k}: ${v}`, 14, y);
      y += 8;
    });
    doc.text("Sugestões:", 14, y + 6);
    y += 14;
    suggestions.forEach((s) => {
      doc.text(`• ${s}`, 14, y);
      y += 8;
    });
    doc.save("relatorio_inovatech.pdf");
  }

  const [simCanal, setSimCanal] = useState("Delivery Próprio");
  const [simInv, setSimInv] = useState(1000);
  const [simDias, setSimDias] = useState(7);
  const [simResp, setSimResp] = useState(null);
  async function simulate() {
    const { data } = await api.post("/simulate/campaign", {
      canal: simCanal,
      investimento: simInv,
      duracaoDias: simDias,
    });
    setSimResp(data);
  }

  const exportCsvHref = useMemo(() => {
    const u = new URL("http://127.0.0.1:5001/export/csv");
    u.searchParams.set("period", period);
    if (channel) u.searchParams.set("channel", channel);
    if (location) u.searchParams.set("location", location);
    return u.toString();
  }, [period, channel, location]);

  const fmtMoeda = (v) =>
    (typeof v === "number" ? v : 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  const totalVendas =
    kpis?.totalVendas != null
      ? kpis.totalVendas
      : kpis?.pedidos && kpis?.ticketMedio
      ? +(kpis.pedidos * kpis.ticketMedio).toFixed(2)
      : 0;

  return (
    <div className="container">
      {/* header com filtros e export */}
      <div className="page-head">
        <h1 className="page-title">{user?.name || "Usuário"}, seja Bem-Vinda(o) 👋</h1>
        <div className="head-actions">
          <select className="input" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 140 }}>
            {opts.periods.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select className="input" value={channel} onChange={(e) => setChannel(e.target.value)} style={{ width: 180 }}>
            <option value="">Todos canais</option>
            {opts.channels.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
          <select className="input" value={location} onChange={(e) => setLocation(e.target.value)} style={{ width: 140 }}>
            <option value="">Todas as lojas</option>
            {opts.locations.map((l) => (<option key={l} value={l}>{l}</option>))}
          </select>
          <a className="card card-tight" href={exportCsvHref}>Exportar CSV</a>
          <button className="btn-outline" onClick={exportExcel}>Excel</button>
          <button className="btn-outline" onClick={exportPDF}>PDF</button>
        </div>
      </div>

      {/* ADMIN OVERVIEW */}
      {isAdmin && adminKpis && (
        <section style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <div>
              <h2 style={{ margin: 0 }}>Bem-vindo, Administrador!</h2>
              <small className="muted">Acompanhe o desempenho dos restaurantes parceiros da Cannoli.</small>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <button
                className="btn-outline"
                onClick={async () => {
                  try {
                    await api.post("/dev/seed-more", { days: 7 });
                    await refreshAll(period, channel, location);
                    await refreshStack(period, channel, location, asCnpj);
                    loadAdminOverview();
                  } catch (e) {
                    console.error(e);
                    alert("Falha ao popular com dados demo.");
                  }
                }}
              >
                Popular com dados demo (7 dias)
              </button>
            </div>
          </div>

          <div className="kpis" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
            <Kpi title="RESTAURANTES ATIVOS" value={adminKpis.restaurantesAtivos} />
            <Kpi title="VENDAS TOTAIS (MÊS)" value={fmtMoeda(adminKpis.vendasTotaisMes || 0)} />
            <Kpi title="CAMPANHAS ATIVAS" value={adminKpis.campanhasAtivas} />
            <Kpi title="CLIENTES FINAIS ATIVOS" value={adminKpis.clientesFinaisAtivos} />
          </div>

          <div className="card admin-top3" style={{ marginBottom: 12 }}>
            <div className="card-head">
              <span className="card-title">
                Top 3 Restaurantes do Mês — {new Date().toLocaleString("pt-BR", { month: "long", year: "numeric" })}
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ minWidth: 680 }}>
                <thead>
                  <tr>
                    <th style={{ width: 36 }}></th>
                    <th>RESTAURANTE</th>
                    <th style={{ textAlign: "right" }}>VALOR (MÊS)</th>
                    <th style={{ textAlign: "center" }}>CAMPANHAS ATIVAS</th>
                  </tr>
                </thead>
                <tbody>
                  {topRest.map((r, i) => (
                    <tr key={i}>
                      <td>{["🥇", "🥈", "🥉"][i] || "⭐"}</td>
                      <td>{r.nome}</td>
                      <td style={{ textAlign: "right" }}>{fmtMoeda(r.valor)}</td>
                      <td style={{ textAlign: "center" }}>{r.campanhasAtivas}</td>
                    </tr>
                  ))}
                  {!topRest.length && (
                    <tr><td colSpan={4} style={{ opacity: 0.7, padding: 8 }}>Sem dados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card chart-box">
            <div className="card-head"><span className="card-title">DESEMPENHO DOS RESTAURANTES — MÊS</span></div>
            <div className="chart-wrap"><Bar data={adminBars} options={chartOptsBarMoney} /></div>
          </div>
        </section>
      )}

      {/* KPIs + GRÁFICOS (qualquer role) */}
      {kpis && (
        <>
          <section className="kpis" style={{ marginBottom: 12, display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
            <Kpi variant="orange" title="Total de Vendas" value={fmtMoeda(totalVendas)} />
            <Kpi variant="green" title="Ticket Médio" value={fmtMoeda(kpis.ticketMedio || 0)} />
            <Kpi variant="purple" title="Campanhas Ativas" value={0} />
            <Kpi variant="ghost" title="Clientes Ativos" value={kpis.clientesAtivos ?? 0} />
            <Kpi variant="ghost" title="Clientes Inativos" value={kpis.clientesInativos ?? 0} />
          </section>

          <section style={{ marginBottom: 16 }}>
            <div className="card chart-box">
              <div className="card-head">
                <span className="card-title">RESUMO DAS VENDAS — MÊS A MÊS</span>
                <small className="muted">Período: {period}</small>
              </div>
              <div className="chart-wrap"><Line data={lineData} options={chartOptsLine} /></div>
            </div>
          </section>

          <section className="grid-charts" style={{ marginBottom: 16 }}>
            <div className="card chart-box">
              <div className="card-head"><span className="card-title">Receita por Canal (total)</span></div>
              <div className="chart-wrap"><Bar data={barData} options={chartOptsBarMoney} /></div>
            </div>
          </section>

          <section className="card chart-box" style={{ marginBottom: 16 }}>
            <div className="card-head" style={{ gap: 12 }}>
              <span className="card-title">Vendas por Canal ao longo do tempo</span>
              {isAdmin && (
                <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                  <small className="muted">Ver como CNPJ:</small>
                  <input
                    className="input"
                    placeholder="ex.: 12345678000190"
                    value={asCnpj}
                    onChange={(e) => setAsCnpj(e.target.value)}
                    style={{ width: 220 }}
                  />
                </div>
              )}
            </div>
            <div className="chart-wrap"><Bar data={stackedData} options={stackedOpts} /></div>
          </section>

          <section className="grid-3" style={{ marginBottom: 16 }}>
            <div className="card">
              <span className="card-title">Top Itens</span>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
                <thead><tr><th style={{ textAlign: "left" }}>Item</th><th>Qtd</th><th>Receita</th></tr></thead>
                <tbody>
                  {topItems.map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--divider)" }}>
                      <td>{r.item}</td>
                      <td style={{ textAlign: "center" }}>{r.qtd}</td>
                      <td style={{ textAlign: "right" }}>R$ {r.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                  {!topItems.length && (<tr><td colSpan={3} style={{ opacity: 0.6, padding: 8 }}>Sem dados.</td></tr>)}
                </tbody>
              </table>
            </div>

            <div className="card">
              <span className="card-title">Alertas</span>
              {alerts.length === 0 ? (
                <p style={{ opacity: 0.7, marginTop: 8 }}>Sem alertas.</p>
              ) : (
                <ul style={{ marginTop: 8 }}>{alerts.map((a, i) => (<li key={i}>{a.msg}</li>))}</ul>
              )}
            </div>

            <div className="card">
              <span className="card-title">Sugestões</span>
              <ul style={{ marginTop: 8 }}>{suggestions.map((s, i) => (<li key={i}>{s}</li>))}</ul>
            </div>
          </section>
        </>
      )}

      {/* atalhos admin */}
      {isAdmin && (
        <section className="quick-actions">
          <div className="card quick-card">
            <div>
              <b>Gestão de Usuários</b>
              <div style={{ opacity: 0.7, fontSize: 14, marginTop: 4 }}>Crie, edite e remova usuários (admin/cliente).</div>
            </div>
            <button className="btn-secondary" onClick={() => nav("/admin/users")}>Abrir</button>
          </div>

          <div className="card quick-card">
            <div>
              <b>Whitelist de CNPJ</b>
              <div style={{ opacity: 0.7, fontSize: 14, marginTop: 4 }}>Aprove/reprove CNPJs e cadastre pedidos.</div>
            </div>
            <button className="btn-secondary" onClick={() => nav("/admin/users")}>Abrir</button>
          </div>
        </section>
      )}

      {/* simulador */}
      {isAdmin && (
        <section className="card" style={{ marginTop: 16 }}>
          <b>Simulador de Campanha</b>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, marginTop: 10 }}>
            <select className="input" value={simCanal} onChange={(e) => setSimCanal(e.target.value)}>
              {["Delivery Próprio", "iFood", "Balcão", "WhatsApp"].map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
            <input className="input" type="number" min="100" step="100" value={simInv}
                   onChange={(e) => setSimInv(e.target.value)} placeholder="Investimento (R$)" />
            <input className="input" type="number" min="1" value={simDias}
                   onChange={(e) => setSimDias(e.target.value)} placeholder="Duração (dias)" />
            <button className="btn-pill" onClick={simulate}>Simular</button>
          </div>
          {simResp && (
            <div style={{ marginTop: 12 }}>
              <small style={{ opacity: 0.7 }}>Canal: {simResp.canal}</small>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 10 }}>
                <Kpi title="Uplift Pedidos" value={simResp.uplift_pedidos} />
                <Kpi title="Proj. Receita" value={`R$ ${simResp.proj_receita}`} />
                <Kpi title="Conversões (proj.)" value={simResp.kpi_esperado.conversoes} />
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Kpi({ title, value, variant }) {
  return (
    <div className={`card kpi ${variant ? `kpi-${variant}` : ""}`}>
      <div className="kpi-sub">{title}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

function safeUser() {
  try { return JSON.parse(sessionStorage.getItem("user") || "{}"); }
  catch { return {}; }
}
