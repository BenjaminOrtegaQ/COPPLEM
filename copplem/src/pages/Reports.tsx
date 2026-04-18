// src/pages/Reports.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import {
  Download,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3 as IconReports,
  FileText as IconPDF,
  Sheet as IconXLSX,
  CreditCard as IconCard,
  Banknote as IconCash,
  ArrowLeftRight as IconTransfer,
  RectangleEllipsis as IconOther
} from "lucide-react";
import "../styles/reports.css";
import { ExportModal } from "../components/ExportModal";

/* ======================= Tipos ======================= */
type TrendPoint = { key: string; total: number; label?: string }; 
type Category = { name: string; color: string | null; total: number };
type TopProduct = {
  id: number; nombre: string; sku: string | null;
  categoria: string; categoria_color: string | null;
  units: number; revenue: number;
};
type Pay = { method: string; total: number };

type ReportsData = {
  currency: string;
  period: { from: string; to: string; prevFrom: string; prevTo: string };
  mode?: "total"|"week"|"month"|"year";
  kpis: {
    revenue: number; revenueDeltaPct: number | null;
    grossProfit: number; grossProfitDeltaPct: number | null;
    units: number; unitsDeltaPct: number | null;
    transactions: number; transactionsDeltaPct: number | null;
    avgTicket: number;
  };
  trend: TrendPoint[];
  categories: Category[];
  topProducts: TopProduct[];
  payments: Pay[];
};

const fmtDelta = (v: number | null | undefined) => (v == null ? "—" : `${v.toFixed(1)}%`);
const api = (window as any).api ?? {};
const fmtInt = new Intl.NumberFormat("es-CL");
const fmtMoney = (cur: string) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: cur, maximumFractionDigits: 0 });

/* ======================= Utils ======================= */
function shortLabelFromKey(k: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(k)) {
    return new Date(k + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" }); // lun, mar…
  }
  if (/^\d{4}-\d{2}$/.test(k)) {
    const [y, m] = k.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short" }).replace(".", ""); // ene…
  }
  return k; // año
}

function Delta({ pct }: { pct: number | null | undefined }) {
  if (pct == null) {
    return <div className="kpi-delta na">— sin base de comparación</div>;
  }
  const pos = pct >= 0;
  const Icon = pos ? ArrowUpRight : ArrowDownRight;
  const n = Math.abs(pct);
  return (
    <div className={`kpi-delta ${pos ? "up" : "down"}`}>
      <Icon size={14} /> {n.toFixed(1)}% vs período anterior
    </div>
  );
}


/* ======================= Modo / rango ======================= */
type Mode = "Semanal" | "Mensual" | "Anual" | "Total";
type Group = "day" | "month" | "year";

const modeToApi = (m: Mode): "week" | "month" | "year" | "total" =>
  m === "Semanal" ? "week" :
  m === "Mensual" ? "month" :
  m === "Anual"   ? "year"  : "total";

function modeToParams(mode: Mode): { from?: string; to: string; group: Group; allTime?: boolean } {
  const today = new Date();
  const to = new Date().toISOString().slice(0, 10);
  if (mode === "Semanal") {
    const d = new Date(+today - 6 * 24 * 3600 * 1000);
    return { from: d.toISOString().slice(0, 10), to, group: "day" };
  }
  if (mode === "Anual") {
    const d = new Date(today.getFullYear() - 4, 0, 1);
    return { from: d.toISOString().slice(0, 10), to, group: "year" };
  }
  if (mode === "Total") {
    return { to, group: "month", allTime: true };
  }
  const d = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  return { from: d.toISOString().slice(0, 10), to, group: "month" };
}

/* ======================= Charts (SVG) ======================= */
function TrendChart({ points, money }: { points: TrendPoint[]; money: Intl.NumberFormat }) {
  const w = 680, h = 260, pad = 36;
  const max = Math.max(1, ...points.map(p => p.total));
  const xs = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1);
  const ys = (v: number) => pad + (h - pad * 2) * (1 - v / max);
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xs(i)} ${ys(p.total)}`).join(" ");

  return (
    <svg className="chart-svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Tendencia de ventas">
      {/* grid + labels Y */}
      {ticks.map((t, k) => {
        const y = pad + (h - pad * 2) * (1 - t);
        const val = money.format(Math.round(max * t));
        return (
          <g key={k}>
            <line x1={pad} y1={y} x2={w - pad} y2={y} className="grid" />
            <text x={pad - 8} y={y} className="ylabel" textAnchor="end" dominantBaseline="middle">{val}</text>
          </g>
        );
      })}

      {/* línea */}
      <path d={d} className="line" />

      {/* puntos + valor arriba + etiqueta X abajo */}
      {points.map((p, i) => {
        const cx = xs(i), cy = ys(p.total);
        const xlab = p.label ?? shortLabelFromKey(p.key);
        return (
          <g key={p.key}>
            <circle cx={cx} cy={cy} r={4.5} className="dot">
              <title>{`${xlab}: ${money.format(p.total)}`}</title>
            </circle>
            {p.total !== 0 && (
              <text x={cx} y={cy - 8} textAnchor="middle" fontSize="10" fontWeight={700}>
                {money.format(p.total)}
              </text>
            )}
            <text x={cx} y={h - 10} className="xlabel" textAnchor="middle">{xlab}</text>
          </g>
        );
      })}
    </svg>
  );
}

const PALETTE = ["#3c2719ff","#ef4444","#10b981","#3b82f6","#f59e0b","#8b5cf6","#14b8a6","#f97316"];

function CategoryBars({ data, money }: { data: Category[]; money: Intl.NumberFormat }) {
  const w = 680, h = 260, pad = 36;
  const max = Math.max(1, ...data.map(c => c.total));
  const bw = (w - pad * 2) / Math.max(1, data.length);
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg className="chart-svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Ventas por categoría">
      {ticks.map((t, k) => {
        const y = pad + (h - pad * 2) * (1 - t);
        const val = money.format(Math.round(max * t));
        return (
          <g key={k}>
            <line x1={pad} y1={y} x2={w - pad} y2={y} className="grid" />
            <text x={pad - 8} y={y} className="ylabel" textAnchor="end" dominantBaseline="middle">{val}</text>
          </g>
        );
      })}
      {data.map((c, i) => {
        const color = c.color || PALETTE[i % PALETTE.length];
        const bh = ((c.total / max) || 0) * (h - pad * 2);
        const x = pad + i * bw + 8;
        const y = h - pad - bh;
        const barW = Math.max(14, bw - 16);
        return (
          <g key={c.name}>
            <rect x={x} y={y} width={barW} height={bh} rx={6} className="bar" style={{ fill: color }}>
              <title>{`${c.name}: ${money.format(c.total)}`}</title>
            </rect>
            <text x={x + barW / 2} y={h - 10} className="xlabel" textAnchor="middle">{c.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

function YearBars({ points, money }: { points: TrendPoint[]; money: Intl.NumberFormat }) {
  const w = 680, h = 260, pad = 36;
  const max = Math.max(1, ...points.map(p => p.total));
  const bw = (w - pad * 2) / Math.max(1, points.length);
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg className="chart-svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Ingresos por año">
      {ticks.map((t, k) => {
        const y = pad + (h - pad * 2) * (1 - t);
        const val = money.format(Math.round(max * t));
        return (
          <g key={k}>
            <line x1={pad} y1={y} x2={w - pad} y2={y} className="grid" />
            <text x={pad - 8} y={y} className="ylabel" textAnchor="end" dominantBaseline="middle">{val}</text>
          </g>
        );
      })}
      {points.map((p, i) => {
        const bh = ((p.total / max) || 0) * (h - pad * 2);
        const x = pad + i * bw + 8;
        const y = h - pad - bh;
        const barW = Math.max(20, bw - 16);
        const label = p.label ?? p.key; 
        return (
          <g key={p.key}>
            <rect x={x} y={y} width={barW} height={bh} rx={6} className="bar" style={{ fill: "#d04343ff" }}>
              <title>{`${label}: ${money.format(p.total)}`}</title>
            </rect>
            <text x={x + barW / 2} y={h - 10} className="xlabel" textAnchor="middle">{label}</text>
            {p.total !== 0 && (
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="10" fontWeight={700}>
                {money.format(p.total)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// === Helpers de color ===
function hexToRgba(hex?: string | null, alpha = 1) {
  const fb = `rgba(153,153,153,${alpha})`;
  if (!hex) return fb;
  let c = hex.trim();
  if (!c) return fb;
  if (c.startsWith("#")) c = c.slice(1);
  if (c.length === 3) c = c.split("").map(x => x + x).join("");
  if (c.length !== 6) return fb;
  const n = parseInt(c, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function CatChip({ name, color }: { name?: string | null; color?: string | null }) {
  const bg  = hexToRgba(color, 0.14);
  const bdr = hexToRgba(color, 0.35);
  const dot = color ?? "#999";
  return (
    <span
      className="cat-chip"
      style={
        {
          ["--cat-bg"]: bg,
          ["--cat-border"]: bdr,
          ["--cat-dot"]: dot,
        } as React.CSSProperties
      }
      title={name ?? "Sin categoría"}
    >
      <span className="dot" />
      <span className="name">{name ?? "Sin categoría"}</span>
    </span>
  );
}



/* ======================= Página ======================= */
export default function Reports() {
  const { slug = "" } = useParams();
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("Total");

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case "EFECTIVO":
        return <IconCash size={16} className="ict"/>;
      case "TARJETA":
        return <IconCard size={16} className="ict"/>;
      case "TRANSFERENCIA":
        return <IconTransfer size={16} className="ict"/>;
      case "OTRO":
        return <IconOther size={16} className="ict"/>;
      default:
        return null;
    }
  };

  const [showModal, setShowModal] = useState<null | "pdf" | "xlsx">(null);

  const currentGroup: "day" | "month" | "year" | "total" =
    mode === "Semanal" ? "day" :
    mode === "Mensual" ? "month" :
    mode === "Anual"   ? "year"  : "total";

  const currency = data?.currency ?? "CLP";
  const money = useMemo(() => fmtMoney(currency), [currency]);

  const trend = data?.trend ?? [];
  const categories = data?.categories ?? [];
  const payments = data?.payments ?? [];
  const topProducts = data?.topProducts ?? [];

  async function load() {
    try {
      setLoading(true);
      const r = (await api.getReports({ slug, mode: modeToApi(mode) })) as ReportsData;
      setData(r);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al cargar reportes");
    } finally { setLoading(false); }
  }

  // limpiar data al cambiar el período para forzar re-render de todo
  useEffect(() => {
    setData(null);
    load();
  }, [slug, mode]);

  return (
    <div className="reports-wrap">
      <Toaster position="top-right" />

      {/* Head */}
      <header className="page-header">
        <div className="ph-left">
          <div className="ph-icon" aria-hidden="true"><IconReports size={28} aria-hidden="true" color="#D07A43" /></div>
          <div>
            <h1>Reportes</h1>
            <p className="muted">Análisis detallado de ventas y rendimiento</p>
          </div>
        </div>
        <div className="rep-actions">
          <select className="rep-select" value={mode} onChange={(e)=>setMode(e.target.value as Mode)}>
            <option value="Semanal">Semanales: últimos 7 días</option>
            <option value="Mensual">Mensuales</option>
            <option value="Anual">Anuales</option>
            <option value="Total">Total</option>
          </select>
          <button className="btn btn-primary" onClick={() => setShowModal("pdf")}>
            <IconPDF size={22} aria-hidden="true" className="ic"/> Exportar PDF
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal("xlsx")}>
            <IconXLSX size={22} aria-hidden="true" className="ic"/> Exportar Excel
          </button>
        </div>
      </header>
      
      {/* KPIs */}
      <section
        className="rep-kpis"
        key={data ? `${data.period.from}_${data.period.to}` : "loading-kpis"}
      >
        <div className="rep-card kpi">
          <div className="kpi-title">Ventas Totales</div>
          <div className="kpi-value">{money.format(data?.kpis.revenue ?? 0)}</div>
          <Delta pct={data?.kpis.revenueDeltaPct ?? 0} />
        </div>
        <div className="rep-card kpi">
          <div className="kpi-title">Margen de Ganancia</div>
          <div className="kpi-value">{money.format(data?.kpis.grossProfit ?? 0)}</div>
          <Delta pct={data?.kpis.grossProfitDeltaPct ?? 0} />
        </div>
        <div className="rep-card kpi">
          <div className="kpi-title">Productos Vendidos</div>
          <div className="kpi-value">{fmtInt.format(data?.kpis.units ?? 0)}</div>
          <Delta pct={data?.kpis.unitsDeltaPct ?? 0} />
        </div>
        <div className="rep-card kpi">
          <div className="kpi-title">Transacciones</div>
          <div className="kpi-value">{fmtInt.format(data?.kpis.transactions ?? 0)}</div>
          <Delta pct={data?.kpis.transactionsDeltaPct ?? 0} />
        </div>
      </section>

      {/* Charts */}
      <section className="rep-grid">
        <div
          className="rep-card"
          key={data ? `trend_${data.period.from}_${data.period.to}` : "trend_loading"}
        >
          <div className="card-head">
            <div>
              <strong>Tendencia</strong>
              <div className="muted small">
                {mode === "Semanal" && "Ingresos de los últimos 7 días"}
                {mode === "Mensual" && "Ingresos de los últimos 6 meses"}
                {mode === "Anual" && "Ingresos de los últimos 5 años"}
                {mode === "Total" && "Ingresos históricos por año"}
                {data && (
                  <>
                    <br />
                    <span>Período: {data.period.from} → {data.period.to}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          {!data ? (
            <div className="skeleton chart-sk" />
          ) : mode === "Total" ? (
            <YearBars points={trend} money={money} />
          ) : (
            <TrendChart points={trend} money={money} />
          )}
        </div>

        <div
          className="rep-card"
          key={data ? `cats_${data.period.from}_${data.period.to}` : "cats_loading"}
        >
          <div className="card-head">
            <div>
              <strong>Ventas por Categoría</strong>
              <div className="muted small">Distribución del período seleccionado</div>
            </div>
          </div>
          {!data ? (
            <div className="skeleton chart-sk" />
          ) : categories.length === 0 ? (
            <div className="muted empty">Sin datos en el período</div>
          ) : (
            <CategoryBars data={categories} money={money} />
          )}
        </div>
      </section>

      {/* Métodos de pago + Top productos */}
      <section className="rep-grid">
        <div
          className="rep-card"
          key={data ? `pay_${data.period.from}_${data.period.to}` : "pay_loading"}
        >
          <div className="card-head">
            <strong>Métodos de cobro</strong>
            <div className="muted small">Participación por método</div>
          </div>
          {!data ? <div className="skeleton list-sk" /> : (
            <ul className="pay-list">
              {payments.length === 0 && <li className="muted">Sin datos</li>}
              {payments.map(p => (
                <li key={p.method}>
                  <span className="name">
                    {getPaymentIcon(p.method)} {/* Icono dinámico */}
                    {p.method} {/* Nombre del método */}
                  </span>
                  <span className="val">{fmtMoney(currency).format(p.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className="rep-card"
          key={data ? `top_${data.period.from}_${data.period.to}` : "top_loading"}
        >
          <div className="card-head">
            <strong>Productos Más Vendidos</strong>
            <div className="muted small">Top 5 por ingresos</div>
          </div>
          {!data ? <div className="skeleton list-sk" /> : (
            <ol className="top5">
              {topProducts.length === 0 && <li className="muted">Sin datos</li>}
              {topProducts.map((p, i) => (
                <li key={p.id} className="top-row">
                  <span
                    className="rank"
                    style={
                      {
                        ["--rank-bg"]: hexToRgba(p.categoria_color, 0.18),
                        ["--rank-bdr"]: hexToRgba(p.categoria_color, 0.42),
                        ["--rank-fg"]:  p.categoria_color ?? "#374151",
                      } as React.CSSProperties
                    }
                    title={p.categoria ?? "Sin categoría"}
                  >
                    {i + 1}
                  </span>
                  <div className="main">
                    <div className="name">{p.nombre}</div>
                    <div className="sub muted tiny top-sub twoline">
                      <span className="idcol">{p.sku ? `SKU: ${p.sku}` : `ID: ${p.id}`}</span>
                      <span className="unitscol">{fmtInt.format(p.units)} unidades</span>
                      <span className="catcol">
                        {(p.categoria || p.categoria_color)
                          ? <CatChip name={p.categoria} color={p.categoria_color} />
                          : <span className="muted">Sin categoría</span>}
                      </span>
                    </div>
                  </div>
                  <div className="side">{fmtMoney(currency).format(p.revenue)}</div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {loading && <div className="overlay">Cargando…</div>}
      
      <ExportModal
        isOpen={!!showModal}
        onClose={() => setShowModal(null)}
        currentGroup={currentGroup}
        slug={slug}
        kind={showModal || "pdf"}
      />

    </div>
  );
}
