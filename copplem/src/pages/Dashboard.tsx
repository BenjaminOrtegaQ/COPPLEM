import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import {
  Info as IconInfo,
  TrendingUp as IconTrend,
  LayoutDashboard as IconDash,
  NotebookPen as IconAdjust,
  ShoppingCart as IconPOS,
  Package as IconBox,
} from "lucide-react";
import "../styles/dashboard.css";
import React from "react";

type Point = { date: string; total: number };
type CatSlice  = { name: string; total: number; color?: string | null };
type Activity  = {
  when: string;
  type: "SALE"|"ADJUST"|"PRODUCT";
  title: string;
  subtitle?: string|null;
  amount?: number|null;
  qty?: number|null;
};
type TopProduct = {
  id: number;
  nombre: string|null;
  sku: string|null;
  stock_actual: number;
  categoria: string|null;
  categoria_color: string|null;
};

type DashData = {
  currency: string;

  todaySalesCount: number;
  todayIncome: number;
  weekIncome: number;
  monthIncome: number;
  lowStockCount: number;

  dailySeries?: Point[];   // 7 días (Semanal)
  weeklySeries?: Point[];  // 8 semanas (Mensual)
  monthlySeries?: Point[]; // 12 meses (Anual)
  weekSeries?: Point[];

  catBreakdown: CatSlice[];
  grossMarginPct: number|null;

  topProduct: TopProduct | null;

  recent: Activity[];
};

const api = (window as any).api ?? {};
const nfInt = new Intl.NumberFormat("es-CL");
const moneyFmt = (cur: string) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: cur, maximumFractionDigits: 0 });

/* ---------- Segmentados ---------- */
function Segmented({
  value, options, onChange,
}: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="seg">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={`seg-btn ${value === opt ? "active" : ""}`}
          onClick={() => onChange(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

/* ---------- helpers gráfico tendencia---------- */
function buildSmoothPath(series: Point[], maxVal: number) {
  if (!series.length) return { line: "", area: "" };

  const topPad = 6, botPad = 10;
  const span = 100 - topPad - botPad;

  const pts = series.map((p, i) => {
    const x = (i / Math.max(1, series.length - 1)) * 100;
    const y = 100 - (p.total / Math.max(1, maxVal)) * span - botPad;
    return { x, y: Math.max(0, Math.min(100, y)) };
  });

  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i];
    const cx = p0.x + (p1.x - p0.x) / 2;
    d += ` C ${cx},${p0.y} ${cx},${p1.y} ${p1.x},${p1.y}`;
  }
  const area = `${d} L ${pts[pts.length - 1].x},100 L ${pts[0].x},100 Z`;
  return { line: d, area };
}

/* ---------- helpers gráfico semicircular---------- */
function SemiGauge({ pct }: { pct: number }) {
  const target = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);

  const dashArray = 100;
  const dashOffset = mounted ? (100 - target) : 100; 

  return (
    <svg
      viewBox="0 0 100 60"
      className="gauge"
      role="img"
      aria-label={`Margen bruto ${target}%`}
    >
      <path className="g-bg" d="M10,52 A40,40 0 0 1 90,52" />
      <path
        className="g-val"
        d="M10,52 A40,40 0 0 1 90,52"
        pathLength={100}
        style={{
          strokeDasharray: dashArray,
          strokeDashoffset: dashOffset,
        }}
      />
    </svg>
  );
}



/* ---------- helpers fechas para labels ---------- */
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
function fmtWeekRangeLabel(isoMonday: string) {
  const d = new Date(isoMonday + "T00:00:00");
  const end = addDays(d, 6);
  const mon = d.toLocaleDateString(undefined, { month: "short" }).replace(".", "");
  const mon2 = end.toLocaleDateString(undefined, { month: "short" }).replace(".", "");
  const sameMonth = (d.getMonth() === end.getMonth()) && (d.getFullYear() === end.getFullYear());
  return sameMonth
    ? `${d.getDate()}–${end.getDate()} ${mon}`
    : `${d.getDate()} ${mon}–${end.getDate()} ${mon2}`;
}

/* ---------- cat-chip colores ---------- */
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

// --- Formato compacto de valores sobre los puntos (4.8k, 1.2M, etc)
const fmtPoint = (n: number) => {
  const s = new Intl.NumberFormat("es-CL", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);

  return s
    .replace(/\u00A0/g, " ")
    .replace(",", ".")
    .replace(/\s*mil/i, "k")
    .replace(/\s*M/i, "M")
    .replace(/\s*B/i, "B");
};


export default function Dashboard() {
  const { slug = "" } = useParams();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(false);

  const currency = data?.currency ?? "CLP";
  const money = useMemo(() => moneyFmt(currency), [currency]);

  // Tabs
  const [incomeTab, setIncomeTab] = useState<"Semanal"|"Mensual"|"Anual">("Semanal");
  const [activityTab, setActivityTab] = useState<"Todas"|"Productos"|"Ventas">("Todas");

  // Modal de stock bajo
  const [lowOpen, setLowOpen] = useState(false);
  const [lowItems, setLowItems] = useState<any[]>([]);
  const [loadingLow, setLoadingLow] = useState(false);

  useEffect(() => {
    (async () => {
      if (typeof api.getDashboard !== "function") {
        toast.error("API de dashboard no disponible");
        return;
      }
      try {
        setLoading(true);
        const r = await api.getDashboard(slug);
        setData(r);
      } catch (e: any) {
        toast.error(e?.message ?? "Error al cargar dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  /* ---------- series según tab (con fallbacks) ---------- */
  const series: Point[] = useMemo(() => {
    if (!data) return [];
    if (incomeTab === "Semanal") return data.dailySeries   ?? data.weeklySeries ?? data.weekSeries ?? [];
    if (incomeTab === "Mensual") return data.weeklySeries  ?? data.dailySeries  ?? data.weekSeries ?? [];
    return data.monthlySeries ?? data.weeklySeries ?? data.weekSeries ?? [];
  }, [data, incomeTab]);

  const maxVal = useMemo(() => Math.max(1, ...series.map(s => s.total), 1), [series]);
  const { line: linePath, area: areaPath } = useMemo(
    () => buildSmoothPath(series, maxVal),
    [series, maxVal]
  );

  const xLabels = useMemo(() => {
    const fmt = (iso: string) => {
      const d = new Date(iso + "T00:00:00");
      if (incomeTab === "Semanal")  return d.toLocaleDateString(undefined, { weekday: "short" });
      if (incomeTab === "Mensual")  return fmtWeekRangeLabel(iso); // Lun–Dom
      return d.toLocaleDateString(undefined, { month: "short" }).replace(".", "");
    };
    return series.map(s => fmt(s.date));
  }, [series, incomeTab]);

  /* ---------- donut ---------- */
  const catTotal = (data?.catBreakdown ?? []).reduce((a, c) => a + c.total, 0) || 1;
  const catPercs = (data?.catBreakdown ?? []).map((c) => ({ ...c, pct: c.total / catTotal }));
  const topCatPct = catPercs.length ? Math.round(Math.max(...catPercs.map(c => c.pct)) * 100) : 0;

  /* ---------- actividad 5 filas ---------- */
  const recentFiltered = useMemo(() => {
    const arr = data?.recent ?? [];
    if (activityTab === "Ventas")    return arr.filter(a => a.type === "SALE").slice(0,5);
    if (activityTab === "Productos") return arr.filter(a => a.type === "PRODUCT" || a.type === "ADJUST").slice(0,5);
    return arr.slice(0,5);
  }, [data, activityTab]);

  /* ---------- abrir modal de low stock ---------- */
  async function openLowModal() {
    try {
      setLowOpen(true);
      setLoadingLow(true);
      const res = await api.listProducts?.({ slug, q: "" });
      const all: any[] = Array.isArray(res) ? res : [];
      const lows = all.filter((p) => {
        const stock = Number(p.stock_actual || 0);
        const byMin = p.stock_minimo != null ? stock < Number(p.stock_minimo) : false;
        const unidad = String(p.alerta_tiempo_unidad || "");
        const cant   = Number(p.alerta_tiempo_cantidad || 0);
        const consumo= Number(p.consumo_diario_estimado || 0);
        let days = 0;
        if (unidad === "dias") days = cant;
        else if (unidad === "semanas") days = cant * 7;
        else if (unidad === "meses") days = cant * 30;
        const need = (days > 0 && consumo > 0) ? days * consumo : 0;
        const byTime = need > 0 ? stock < need : false;
        return stock <= 0 || byMin || byTime;
      });
      setLowItems(lows);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo cargar productos");
    } finally {
      setLoadingLow(false);
    }
  }

  const lowCount = data?.lowStockCount ?? 0;
  const lowLabel = lowCount === 1 ? "Producto" : "Productos";

  // Texto de período bajo el título
  const periodText = incomeTab.toLowerCase();

  return (
    <div className="dash-wrap">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="page-header">
        <div className="ph-left">
          <div className="ph-icon" aria-hidden="true"><IconDash size={30} aria-hidden="true" color="#D07A43" /></div>
          <div>
            <h1>Dashboard</h1>
            <p className="muted">Resumen general de tu negocio</p>
          </div>
        </div>
        <div className="ph-actions">
          <Link className="btn primary" to={`/app/${slug}/pos`}>Nueva venta</Link>
        </div>
      </header>

      {/* KPIs compactos */}
      <section className="kpi-row kpi-compact">
        <div className="kpi">
          <div className="kpi-title">Ventas hoy</div>
          <div className="kpi-value">{data?.todaySalesCount ?? 0}</div>
          <div className="kpi-sub">Transacciones</div>
        </div>
        <div className="kpi">
          <div className="kpi-title">Ingresos diarios</div>
          <div className="kpi-value">{money.format(data?.todayIncome ?? 0)}</div>
          <div className="kpi-sub">Hoy</div>
        </div>
        <div className="kpi">
          <div className="kpi-title">Ingresos semanales</div>
          <div className="kpi-value">{money.format(data?.weekIncome ?? 0)}</div>
          <div className="kpi-sub">Semana</div>
        </div>
        <div className="kpi">
          <div className="kpi-title">Ingresos mensuales</div>
          <div className="kpi-value">{money.format(data?.monthIncome ?? 0)}</div>
          <div className="kpi-sub">Mes</div>
        </div>
        <div className="kpi kpi-stock">
          <div className="kpi-title">
            Stock bajo
            <button
              className="kpi-info abs"
              onClick={openLowModal}
              title="Ver productos con stock bajo"
              aria-label="Ver productos con stock bajo"
            >
              <IconInfo size={14} />
            </button>
          </div>
          <div className="kpi-value">{lowCount}</div>
          <div className="kpi-sub">{lowLabel}</div>
        </div>
      </section>

      {/* ====== FILA 1 ====== */}
      <section className="grid-3 tight">
        {/* Ingresos + gráfico */}
        <div className="card">
          <div className="card-head">
            <div className="title-wrap">
              <strong>Ingresos totales</strong>
              <div className="muted small">({periodText})</div>
            </div>
            <Segmented
              value={incomeTab}
              options={["Semanal","Mensual","Anual"]}
              onChange={(v)=>setIncomeTab(v as any)}
            />
          </div>

          <div className={`line2 ${incomeTab === "Mensual" ? "rot" : ""}`}>
            {!series.length ? (
              <div className="muted">Sin datos</div>
            ) : (
              <>
                <div className={`line2 ${incomeTab === "Mensual" ? "rot" : ""}`}>
                  {!series.length ? (
                    <div className="muted">Sin datos</div>
                  ) : (
                    <>
                      {/* wrapper relativo para superponer etiquetas HTML */}
                      <div className="line2-stage">
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="line2-svg" role="img" aria-label="Ingresos">
                          <defs>
                            <linearGradient id="lc-grad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.35"/>
                              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.03"/>
                            </linearGradient>
                          </defs>
                          {[20,40,60,80].map(y => <line key={y} x1="0" y1={y} x2="100" y2={y} className="line2-grid"/>)}
                          <path d={areaPath} className="line2-area" />
                          <path d={linePath} className="line2-path" />
                          {series.map((p, i) => {
                            const x = (i / Math.max(1, series.length - 1)) * 100;
                            const topPad = 6, botPad = 10, span = 100 - topPad - botPad;
                            const y = 100 - (p.total / Math.max(1, maxVal)) * span - botPad;
                            return <circle key={p.date} cx={x} cy={y} r="0.9" className="line2-dot" />;
                          })}
                        </svg>

                        {/* etiquetas HTML*/}
                        <div className="line2-tags">
                          {series.map((p, i) => {
                            const x = (i / Math.max(1, series.length - 1)) * 100;
                            const xClamped = Math.min(97, Math.max(3, x));      // evita recortes extremos
                            const topPad = 6, botPad = 10, span = 100 - topPad - botPad;
                            const y = 100 - (p.total / Math.max(1, maxVal)) * span - botPad;

                            // Descomentar para no mostrar lso 0
                            // if (p.total === 0) return null;

                            return (
                              <span
                                key={p.date}
                                className="line2-tag"
                                style={{
                                  left: `${xClamped}%`,
                                  top: `max(-1px, calc(${y}% - 15px))`,
                                }}
                              >
                                {fmtPoint(p.total)}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <div
                        className={`line2-xlabels ${incomeTab === "Mensual" ? "tilt" : ""}`}
                        style={{ ['--ticks' as any]: series.length }}
                      >
                        {xLabels.map((lbl, i) => <span key={i}>{lbl}</span>)}
                      </div>
                    </>
                  )}
                </div>


                <div
                  className={`line2-xlabels ${incomeTab === "Mensual" ? "tilt" : ""}`}
                  style={{ ['--ticks' as any]: series.length }}
                >
                  {xLabels.map((lbl, i) => <span key={i}>{lbl}</span>)}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Donut (participación por categorías) */}
        <div className="card">
          <div className="card-head">
            <strong>Categorías</strong>
          </div>

          <div className="donut-wrap">
            {!catPercs.length ? (
              <div className="muted">Sin datos</div>
            ) : (
              <>
                {(() => {
                  const R = 15.91549430918954;
                  const PALETTE = ["#e28c54","#f0b583","#c97b48","#eed1b8","#b96533","#9d5a2e"];

                  return (
                    <>
                      <svg viewBox="0 0 42 42" className="donut" aria-label="Participación por categorías">
                        <circle className="donut-ring" cx="21" cy="21" r={R} />
                        {catPercs.reduce<{ acc: number; nodes: JSX.Element[] }>((st, c, idx) => {
                          const dash = c.pct * 100;
                          const color = c.color || PALETTE[idx % PALETTE.length];
                          const seg = (
                            <circle
                              key={c.name}
                              cx="21" cy="21" r={R}
                              fill="transparent"
                              stroke={color}
                              strokeWidth={3}
                              strokeDasharray={`${dash} ${100 - dash}`}
                              strokeDashoffset={100 - st.acc}
                            />
                          );
                          return { acc: st.acc + dash, nodes: [...st.nodes, seg] };
                        }, { acc: 0, nodes: [] }).nodes}
                        <text x="21" y="21" className="donut-center" textAnchor="middle" dominantBaseline="central">
                          {topCatPct}%
                        </text>
                      </svg>

                      <ul className="donut-legend">
                        {catPercs.map((c, i) => {
                          const color = c.color || PALETTE[i % PALETTE.length];
                          return (
                            <li key={c.name}>
                              <span className="dot" style={{ background: color }} />
                              <span className="name">{c.name}</span>
                              <span className="val">{money.format(c.total)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </div>

        <div className="card center">
          <div className="card-head">
            <strong>Margen bruto</strong>
          </div>

          {/* Semicirculo */}
          <SemiGauge pct={data?.grossMarginPct ?? 0} />

          <div className="big-number">
            {data?.grossMarginPct == null ? "—" : `${Math.round(data.grossMarginPct)}%`}
          </div>
          <div className="muted">Últimos 30 días</div>
        </div>
      </section>
      
      {/* ====== FILA 2 ====== */}
      <section className="grid-3 tight">
        <div className="card span-2">
          <div className="card-head">
            <strong>Actividad reciente</strong>
            <Segmented value={activityTab} options={["Todas","Productos","Ventas"]} onChange={(v)=>setActivityTab(v as any)} />
          </div>

        <div className="activity">
            {recentFiltered.length === 0 ? (
              <div className="muted">Sin actividad</div>
            ) : recentFiltered.map((a, i) => (
              <div className="act-row" key={i}>
                <div className={`act-icon ${a.type.toLowerCase()}`}>
                  {a.type === "SALE" ? <IconPOS size={18} aria-hidden="true" color="#D07A43" /> : a.type === "ADJUST" ? <IconAdjust size={18} aria-hidden="true" color="#d04343ff" /> : <IconBox size={18} aria-hidden="true" color="#43a8d0ff" />}
                </div>

                <div className="act-main">
                  <div className="title">{a.title}</div>
                  <div className="sub muted small">
                    {a.subtitle ?? ""}
                    {a.qty != null && <>{" · "}{a.qty > 0 ? "+" : ""}{a.qty}</>}
                  </div>
                </div>

                <div className="act-side">
                  {a.amount != null && <div className="amount">{money.format(a.amount)}</div>}
                  <div className="when muted small">{new Date(a.when).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card center">
          <div className="card-head"><strong>Más vendido</strong></div>
          <div className="most-sold">{data?.topProduct?.nombre ?? "—"}</div>

          <div className="top-meta">
            <div className="tiny muted">
              {data?.topProduct?.sku ? `SKU: ${data.topProduct.sku}` : (data?.topProduct?.id ? `ID: ${data.topProduct.id}` : "—")}
            </div>

            {data?.topProduct?.categoria ? (() => {
              const hex = data.topProduct!.categoria_color;
              const bg  = hexToRgba(hex, 0.14);
              const bdr = hexToRgba(hex, 0.35);
              const dot = hex ?? "#999";
              return (
                <span
                  className="cat-chip"
                  style={{
                    "--cat-bg": bg, "--cat-border": bdr, "--cat-dot": dot
                  } as React.CSSProperties}
                >
                  <span className="dot" />
                  <span className="name">{data.topProduct!.categoria}</span>
                </span>
              );
            })() : <span className="tiny muted">Sin categoría</span>}

            <div className="tiny">Stock: {nfInt.format(data?.topProduct?.stock_actual ?? 0)}</div>
          </div>

          <Link className="btn ghost" to={`/app/${slug}/productos`} style={{marginTop:10}}>Ver productos</Link>
        </div>
      </section>

      {/* Modal: productos con stock bajo */}
      {lowOpen && (
        <div className="dashmodal" onClick={() => setLowOpen(false)}>
          <div className="dashmodal-card" onClick={(e) => e.stopPropagation()}>
            <div className="dashmodal-head">
              <h3>Productos con stock bajo ({lowItems.length})</h3>
              <button className="icon ghost" onClick={() => setLowOpen(false)}>✕</button>
            </div>

            {loadingLow ? (
              <div className="muted">Cargando…</div>
            ) : lowItems.length === 0 ? (
              <div className="muted">No hay productos en alerta.</div>
            ) : (
              <div className="low-list">
                {lowItems.map((p) => (
                  <div key={p.id} className="low-row">
                    {(() => {
                      const hex = p.categoria_color;
                      const fill = hex || "#999999";
                      const ring = p.stock_actual <= 0 ? "#ef4444" : "#f59e0b"; // crit/aviso
                      return (
                        <div
                          className="low-badge"
                          title={p.categoria ?? "Sin categoría"}
                          style={
                            {
                              ["--badge-bg"]: fill,
                              ["--badge-ring"]: ring,
                            } as React.CSSProperties
                          }
                        />
                      );
                    })()}
                    <div className="low-main">
                      <div className="low-name">{p.nombre}</div>

                      <div className="low-sub muted tiny">
                        {p.sku ? `SKU: ${p.sku}` : `ID: ${p.id}`} ·
                        &nbsp;Stock: {nfInt.format(p.stock_actual)}
                      </div>

                      {p.categoria ? (() => {
                        const hex = p.categoria_color;
                        const bg  = hexToRgba(hex, 0.14);
                        const bdr = hexToRgba(hex, 0.35);
                        const dot = hex ?? "#999";
                        return (
                          <span
                            className="cat-chip"
                            style={{
                              "--cat-bg": bg, "--cat-border": bdr, "--cat-dot": dot
                            } as React.CSSProperties}
                          >
                            <span className="dot" />
                            <span className="name">{p.categoria}</span>
                          </span>
                        );
                      })() : <span className="tiny muted">Sin categoría</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="dashmodal-actions">
              <Link className="btn" to={`/app/${slug}/productos`} onClick={() => setLowOpen(false)}>Ir a productos</Link>
              <button className="btn ghost" onClick={() => setLowOpen(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="overlay">Cargando…</div>}
    </div>
  );
}
