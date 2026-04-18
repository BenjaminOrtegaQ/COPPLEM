// src/main/reportsExport.ts
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { app, BrowserWindow } from "electron";
import {
  dbPathForSlug,
  logoPngPathForSlug,
} from "./paths";

/* ========= Utils DB ========= */
const openDB = (file: string) => { const db = new Database(file); db.pragma("foreign_keys = ON"); return db; };

// === Resolución de carpeta de salida ===
function resolveOutDir(p: {
  outDir?: string | null;
  createSubfolder?: boolean;
  slug: string;
}) {
  const base = (p.outDir && p.outDir.trim()) ? p.outDir.trim() : app.getPath("desktop");
  if (!p.createSubfolder) return base;

  const dir = path.join(base, `Reportes_${p.slug}`);
  try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); } catch {}
  return dir;
}

function uniquePath(dir: string, fname: string) {
  const ext  = path.extname(fname);
  const base = path.basename(fname, ext);
  let candidate = path.join(dir, fname);
  let i = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${base} (${i})${ext}`);
    i++;
  }
  return candidate;
}



function getExistingColumns(db: any, table: string): string[] {
  try {
    const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    return rows.map(r => r.name);
  } catch { return []; }
}

/* ========= Datos base de reportes ========= */
type TrendPoint = { key: string; label: string; total: number };
type CategoryRow = { name: string; color: string | null; total: number };
type TopRow = { id:number; nombre:string; sku:string|null; categoria:string; categoria_color:string|null; units:number; revenue:number; };
type PayRow = { method:string; total:number };

type ReportsData = {
  currency: string;
  period: { from: string; to: string; prevFrom: string; prevTo: string };
  mode: "total"|"week"|"month"|"year";
  kpis: {
    revenue: number; revenueDeltaPct: number;
    grossProfit: number; grossProfitDeltaPct: number;
    units: number; unitsDeltaPct: number;
    transactions: number; transactionsDeltaPct: number;
    avgTicket: number;
  };
  trend: TrendPoint[];
  categories: CategoryRow[];
  topProducts: TopRow[];
  payments: PayRow[];
};

function getReportsStandalone(slug: string, p?: { mode?: "total"|"week"|"month"|"year"; from?: string; to?: string }): ReportsData {
  const db = openDB(dbPathForSlug(slug));
  try {
    const biz = db.prepare(`SELECT moneda FROM negocio ORDER BY id LIMIT 1`).get() as any;
    const currency = String(biz?.moneda || "CLP");

    const oneDay = 24 * 3600 * 1000;
    const now = new Date();
    const toDate = p?.to ? new Date(p.to + "T23:59:59") : now;

    let mode: "total"|"week"|"month"|"year" = p?.mode ?? "total";
    let fromDate: Date;

    if (mode === "week") {
      fromDate = new Date(toDate.getTime() - 6 * oneDay);
    } else if (mode === "month") {
      const d = new Date(toDate); d.setMonth(d.getMonth() - 11, 1); d.setHours(0,0,0,0);
      fromDate = d;
    } else if (mode === "year") {
      const d = new Date(toDate.getFullYear() - 4, 0, 1); d.setHours(0,0,0,0);
      fromDate = d;
    } else {
      const minRow = db.prepare(`SELECT MIN(date(fecha,'localtime')) AS d FROM ventas`).get() as any;
      fromDate = minRow?.d ? new Date(minRow.d + "T00:00:00") : new Date(toDate.getFullYear(), toDate.getMonth(), 1);
      mode = "total";
    }

    const toISO   = toDate.toISOString().slice(0,10);
    const fromISO = fromDate.toISOString().slice(0,10);

    const lenDays = Math.max(1, Math.round((new Date(toISO).getTime() - new Date(fromISO).getTime()) / oneDay) + 1);
    const prevTo   = new Date(new Date(fromISO + "T00:00:00").getTime() - oneDay);
    const prevFrom = new Date(prevTo.getTime() - (lenDays - 1) * oneDay);
    const prevToISO   = prevTo.toISOString().slice(0,10);
    const prevFromISO = prevFrom.toISOString().slice(0,10);

    const vNow = db.prepare(`
      SELECT COALESCE(SUM(total),0) AS revenue, COUNT(*) AS tx
      FROM ventas
      WHERE date(fecha,'localtime') BETWEEN date(@from) AND date(@to)
    `).get({ from: fromISO, to: toISO }) as any;
    const viNow = db.prepare(`
      SELECT COALESCE(SUM(vi.subtotal),0) AS revenue_items,
             COALESCE(SUM(COALESCE(vi.costo_unit_ref,0) * vi.cantidad),0) AS cost_items,
             COALESCE(SUM(vi.cantidad),0) AS units
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id
      WHERE date(v.fecha,'localtime') BETWEEN date(@from) AND date(@to)
    `).get({ from: fromISO, to: toISO }) as any;

    const vPrev = db.prepare(`
      SELECT COALESCE(SUM(total),0) AS revenue, COUNT(*) AS tx
      FROM ventas
      WHERE date(fecha,'localtime') BETWEEN date(@from) AND date(@to)
    `).get({ from: prevFromISO, to: prevToISO }) as any;
    const viPrev = db.prepare(`
      SELECT COALESCE(SUM(vi.subtotal),0) AS revenue_items,
             COALESCE(SUM(COALESCE(vi.costo_unit_ref,0) * vi.cantidad),0) AS cost_items,
             COALESCE(SUM(vi.cantidad),0) AS units
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id
      WHERE date(v.fecha,'localtime') BETWEEN date(@from) AND date(@to)
    `).get({ from: prevFromISO, to: prevToISO }) as any;

    const revenueNow = Number(vNow?.revenue || 0);
    const txNow      = Number(vNow?.tx || 0);
    const unitsNow   = Number(viNow?.units || 0);
    const gpNow      = Number(viNow?.revenue_items || 0) - Number(viNow?.cost_items || 0);
    const avgTicket  = txNow > 0 ? revenueNow / txNow : 0;

    const revenuePrev = Number(vPrev?.revenue || 0);
    const txPrev      = Number(vPrev?.tx || 0);
    const unitsPrev   = Number(viPrev?.units || 0);
    const gpPrev      = Number(viPrev?.revenue_items || 0) - Number(viPrev?.cost_items || 0);

    const pct = (nowV: number, prevV: number) => (prevV > 0 ? ((nowV - prevV) / prevV) * 100 : 0);

    // Tendencia
    const trend: TrendPoint[] = [];
    const wd = ["dom","lun","mar","mié","jue","vie","sáb"];

    if (mode === "week") {
      const rows = db.prepare(`
        SELECT date(fecha,'localtime') AS d, COALESCE(SUM(total),0) AS t
        FROM ventas
        WHERE date(fecha,'localtime') BETWEEN date(@from) AND date(@to)
        GROUP BY d
      `).all({ from: fromISO, to: toISO }) as { d:string; t:number }[];
      const map = new Map(rows.map(r => [r.d, Number(r.t||0)]));
      for (let i = 6; i >= 0; i--) {
        const d = new Date(toDate.getTime() - i*oneDay);
        const key = d.toISOString().slice(0,10);
        trend.push({ key, label: wd[d.getDay()], total: map.get(key) ?? 0 });
      }
    } else if (mode === "month") {
      const rows = db.prepare(`
        SELECT strftime('%Y-%m', fecha, 'localtime') AS ym, COALESCE(SUM(total),0) AS t
        FROM ventas
        WHERE date(fecha,'localtime') BETWEEN date(@from) AND date(@to)
        GROUP BY ym
      `).all({ from: fromISO, to: toISO }) as { ym:string; t:number }[];
      const map = new Map(rows.map(r => [r.ym, Number(r.t||0)]));
      for (let i = 11; i >= 0; i--) {
        const d = new Date(toDate.getFullYear(), toDate.getMonth() - i, 1);
        const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
        const mlabel = d.toLocaleDateString(undefined, { month: "short" }).replace(".", "");
        trend.push({ key: ym, label: mlabel, total: map.get(ym) ?? 0 });
      }
    } else {
      const rows = db.prepare(`
        SELECT strftime('%Y', fecha, 'localtime') AS y, COALESCE(SUM(total),0) AS t
        FROM ventas
        ${mode==="total" ? "" : "WHERE date(fecha,'localtime') BETWEEN date(@from) AND date(@to)"}
        GROUP BY y ORDER BY y
      `).all(mode==="total" ? {} : { from: fromISO, to: toISO }) as { y:string; t:number }[];
      const map = new Map(rows.map(r => [r.y, Number(r.t||0)]));
      const startY = mode==="total" ? (rows.length ? Number(rows[0].y) : toDate.getFullYear()) : toDate.getFullYear() - 4;
      const endY = toDate.getFullYear();
      for (let y = startY; y <= endY; y++) {
        const ys = String(y);
        trend.push({ key: ys, label: ys, total: map.get(ys) ?? 0 });
      }
    }

    const categories = (db.prepare(`
      SELECT COALESCE(c.nombre,'Sin categoría') AS name,
             c.color_hex AS color,
             COALESCE(SUM(vi.subtotal),0) AS total
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id
      LEFT JOIN productos p ON p.id = vi.producto_id
      LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE date(v.fecha,'localtime') BETWEEN date(@from) AND date(@to)
      GROUP BY name, color
      HAVING total > 0
      ORDER BY total DESC
      LIMIT 8
    `).all({ from: fromISO, to: toISO }) as any[]).map(r => ({
      name: r.name ?? "Sin categoría",
      color: r.color ?? null,
      total: Number(r.total||0)
    }));

    const topProducts = (db.prepare(`
      SELECT p.id, p.nombre, p.sku,
             COALESCE(c.nombre,'Sin categoría') AS categoria,
             c.color_hex AS categoria_color,
             COALESCE(SUM(vi.cantidad),0) AS units,
             COALESCE(SUM(vi.subtotal),0) AS revenue
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id
      JOIN productos p ON p.id = vi.producto_id
      LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE date(v.fecha,'localtime') BETWEEN date(@from) AND date(@to)
      GROUP BY p.id
      HAVING revenue > 0
      ORDER BY revenue DESC
      LIMIT 5
    `).all({ from: fromISO, to: toISO }) as any[]).map(r => ({
      id: r.id,
      nombre: r.nombre ?? "",
      sku: r.sku ?? null,
      categoria: r.categoria ?? "Sin categoría",
      categoria_color: r.categoria_color ?? null,
      units: Number(r.units||0),
      revenue: Number(r.revenue||0),
    }));

    const payments = (db.prepare(`
      SELECT v.metodo_cobro AS method, COALESCE(SUM(v.total),0) AS total
      FROM ventas v
      WHERE date(v.fecha,'localtime') BETWEEN date(@from) AND date(@to)
      GROUP BY v.metodo_cobro
      ORDER BY total DESC
    `).all({ from: fromISO, to: toISO }) as PayRow[]).map(r => ({ method: r.method, total: Number(r.total||0) }));

    return {
      currency,
      period: { from: fromISO, to: toISO, prevFrom: prevFromISO, prevTo: prevToISO },
      mode,
      kpis: {
        revenue: revenueNow,
        revenueDeltaPct: pct(revenueNow, revenuePrev),
        grossProfit: gpNow,
        grossProfitDeltaPct: pct(gpNow, gpPrev),
        units: unitsNow,
        unitsDeltaPct: pct(unitsNow, unitsPrev),
        transactions: txNow,
        transactionsDeltaPct: pct(txNow, txPrev),
        avgTicket: avgTicket,
      },
      trend, categories, topProducts, payments,
    };
  } finally { db.close(); }
}

/* ========= Marca: logo de la app (SVG) o logo de empresa (PNG) ========= */
function loadBrandLogoSvgDataUrl(): string | null {
  const devPath = path.join(process.cwd(), "src", "assets", "logo.svg");
  const prodPath = path.join(process.resourcesPath || process.cwd(), "assets", "logo.svg");
  const p = fs.existsSync(devPath) ? devPath : (fs.existsSync(prodPath) ? prodPath : null);
  if (!p) return null;
  try {
    const svg = fs.readFileSync(p, "utf8");
    const b64 = Buffer.from(svg, "utf8").toString("base64");
    return `data:image/svg+xml;base64,${b64}`;
  } catch { return null; }
}

/* ========= Gráficos (SVG inline) ========= */
function svgLineTrend(points: TrendPoint[], money: Intl.NumberFormat) {
  const w = 680, h = 260, pad = 36;
  const max = Math.max(1, ...points.map(p => p.total));
  const xs = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1);
  const ys = (v: number) => pad + (h - pad * 2) * (1 - v / max);
  const ticks = [0, .25, .5, .75, 1];
  const pathD = points.map((p,i)=>`${i===0?"M":"L"} ${xs(i)} ${ys(p.total)}`).join(" ");
  const xlabels = points.map((p,i)=>({ x: xs(i), lab: p.label || p.key, v: p.total, y: ys(p.total) }));

  return `
<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .grid{stroke:#eee;}
    .ylabel{font:10px Inter,Arial; fill:#6b7280}
    .xlabel{font:10px Inter,Arial; fill:#6b7280}
    .line{fill:none; stroke:#D07A43; stroke-width:2.5}
    .dot{fill:#D07A43}
    .val{font:bold 10px Inter,Arial; fill:#111827}
  </style>
  ${ticks.map(t=>{
    const y = pad + (h - pad*2) * (1 - t);
    return `<g><line x1="${pad}" y1="${y}" x2="${w-pad}" y2="${y}" class="grid" />
      <text x="${pad-8}" y="${y}" class="ylabel" text-anchor="end" dominant-baseline="middle">${money.format(Math.round(max*t))}</text></g>`;
  }).join("")}
  <path d="${pathD}" class="line"/>
  ${xlabels.map(({x,lab,v,y})=>`
    <circle cx="${x}" cy="${y}" r="4.5" class="dot"/>
    ${v!==0 ? `<text x="${x}" y="${y-8}" class="val" text-anchor="middle">${money.format(v)}</text>` : ""}
    <text x="${x}" y="${h-10}" class="xlabel" text-anchor="middle">${lab}</text>
  `).join("")}
</svg>`;
}

function svgBars(categories: {name:string; color:string|null; total:number}[], money: Intl.NumberFormat) {
  const w = 680, h = 260, pad = 36;
  const max = Math.max(1, ...categories.map(c => c.total));
  const bw = (w - pad * 2) / Math.max(1, categories.length);
  const ticks = [0, .25, .5, .75, 1];
  const palette = ["#3c2719","#ef4444","#10b981","#3b82f6","#f59e0b","#8b5cf6","#14b8a6","#f97316"];

  return `
<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .grid{stroke:#eee;}
    .ylabel{font:10px Inter,Arial; fill:#6b7280}
    .xlabel{font:10px Inter,Arial; fill:#6b7280}
    .val{font:bold 10px Inter,Arial; fill:#111827}
  </style>
  ${ticks.map(t=>{
    const y = pad + (h - pad*2) * (1 - t);
    return `<g><line x1="${pad}" y1="${y}" x2="${w-pad}" y2="${y}" class="grid" />
      <text x="${pad-8}" y="${y}" class="ylabel" text-anchor="end" dominant-baseline="middle">${money.format(Math.round(max*t))}</text></g>`;
  }).join("")}
  ${categories.map((c,i)=>{
    const bh = ((c.total / max) || 0) * (h - pad*2);
    const x = pad + i*bw + 8;
    const y = h - pad - bh;
    const barW = Math.max(14, bw - 16);
    const fill = c.color || palette[i % palette.length];
    return `
      <g>
        <rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="6" fill="${fill}" />
        ${c.total!==0 ? `<text x="${x+barW/2}" y="${y-6}" class="val" text-anchor="middle">${money.format(c.total)}</text>` : ""}
        <text x="${x+barW/2}" y="${h-10}" class="xlabel" text-anchor="middle">${escapeHtml(c.name)}</text>
      </g>`;
  }).join("")}
</svg>`;
}

function svgBarsYears(points: TrendPoint[], money: Intl.NumberFormat) {
  const w = 680, h = 260, pad = 36;
  const max = Math.max(1, ...points.map(p => p.total));
  const bw = (w - pad * 2) / Math.max(1, points.length);
  const ticks = [0, .25, .5, .75, 1];

  return `
<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .grid{stroke:#eee;}
    .ylabel{font:10px Inter,Arial; fill:#6b7280}
    .xlabel{font:10px Inter,Arial; fill:#6b7280}
    .val{font:bold 10px Inter,Arial; fill:#111827}
  </style>
  ${ticks.map(t=>{
    const y = pad + (h - pad*2) * (1 - t);
    return `<g><line x1="${pad}" y1="${y}" x2="${w-pad}" y2="${y}" class="grid" />
      <text x="${pad-8}" y="${y}" class="ylabel" text-anchor="end" dominant-baseline="middle">${money.format(Math.round(max*t))}</text></g>`;
  }).join("")}
  ${points.map((p,i)=>{
    const bh = ((p.total / max) || 0) * (h - pad*2);
    const x = pad + i*bw + 8;
    const y = h - pad - bh;
    const barW = Math.max(20, bw - 16);
    const label = p.label || p.key;
    return `
      <g>
        <rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="6" fill="#d04343" />
        ${p.total!==0 ? `<text x="${x+barW/2}" y="${y-6}" class="val" text-anchor="middle">${money.format(p.total)}</text>` : ""}
        <text x="${x+barW/2}" y="${h-10}" class="xlabel" text-anchor="middle">${escapeHtml(label)}</text>
      </g>`;
  }).join("")}
</svg>`;
}

/* ========= Helpers de formato ========= */
function escapeHtml(s: any) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" } as any)[m]);
}

function formatDeltaSmart(now: number, prev: number): string {
  if (prev === 0 && now === 0) return "0.0%";
  if (prev === 0 && now > 0) return "↑ nuevo";
  if (prev > 0 && now === 0) return "↓ -100.0%";
  const pct = ((now - prev) / prev) * 100;
  const sign = pct > 0 ? "↑" : (pct < 0 ? "↓" : "");
  return `${sign} ${Math.abs(pct).toFixed(1)}%`;
}

/* ========= PDF ========= */
export async function exportReportsPdf(
  slug: string,
  p?: { from?: string; to?: string; group?: 'day'|'month'|'year'; allTime?: boolean; outDir?: string; createSubfolder?: boolean }
) {
  const mode =
    p?.allTime ? "total" :
    p?.group === "day" ? "week" :
    p?.group === "month" ? "month" : "year";

  const data = getReportsStandalone(slug, { mode, from: p?.from, to: p?.to });

  const db = openDB(dbPathForSlug(slug));
  const prev = (() => {
    const vPrev = db.prepare(`
      SELECT COALESCE(SUM(total),0) AS revenue, COUNT(*) AS tx
      FROM ventas
      WHERE date(fecha,'localtime') BETWEEN date(@from) AND date(@to)
    `).get({ from: data.period.prevFrom, to: data.period.prevTo }) as any;
    const viPrev = db.prepare(`
      SELECT COALESCE(SUM(vi.subtotal),0) AS revenue_items,
             COALESCE(SUM(COALESCE(vi.costo_unit_ref,0) * vi.cantidad),0) AS cost_items,
             COALESCE(SUM(vi.cantidad),0) AS units
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id
      WHERE date(v.fecha,'localtime') BETWEEN date(@from) AND date(@to)
    `).get({ from: data.period.prevFrom, to: data.period.prevTo }) as any;
    const gpPrev = Number(viPrev?.revenue_items || 0) - Number(viPrev?.cost_items || 0);
    return {
      revenue: Number(vPrev?.revenue || 0),
      transactions: Number(vPrev?.tx || 0),
      units: Number(viPrev?.units || 0),
      grossProfit: gpPrev,
    };
  })();
  db.close();

  const brandSvg = loadBrandLogoSvgDataUrl();
  let logoHtml = "";
  if (brandSvg) {
    logoHtml = `<img src="${brandSvg}" alt="Logo" style="max-width:100%;max-height:100%;display:block;" />`;
  } else {
    const png = logoPngPathForSlug(slug);
    if (fs.existsSync(png)) {
      const buf = fs.readFileSync(png);
      logoHtml = `<img src="data:image/png;base64,${buf.toString("base64")}" alt="Logo" style="max-width:100%;max-height:100%;display:block;" />`;
    } else {
      logoHtml = `<div style="font-weight:800;color:#D07A43">C</div>`;
    }
  }

  const money = new Intl.NumberFormat("es-CL", { style: "currency", currency: data.currency, maximumFractionDigits: 0 });
  const num   = new Intl.NumberFormat("es-CL");

  const trendSvg = data.mode === "total" ? svgBarsYears(data.trend, money) : svgLineTrend(data.trend, money);
  const catsSvg  = data.categories.length ? svgBars(data.categories, money) : `<div class="muted">Sin datos</div>`;

  const subtitle =
    data.mode === "week"  ? "Semanales · últimos 7 días" :
    data.mode === "month" ? "Mensuales · últimos 12 meses" :
    data.mode === "year"  ? "Anuales · últimos 5 años" :
                             "Histórico (agregado anual)";

  const kpis = [
    ["Ingresos", money.format(data.kpis.revenue),     formatDeltaSmart(data.kpis.revenue, prev.revenue)],
    ["Margen de ganancia", money.format(data.kpis.grossProfit), formatDeltaSmart(data.kpis.grossProfit, prev.grossProfit)],
    ["Unidades", num.format(data.kpis.units),          formatDeltaSmart(data.kpis.units, prev.units)],
    ["Transacciones", num.format(data.kpis.transactions), formatDeltaSmart(data.kpis.transactions, prev.transactions)],
    ["Ticket promedio", money.format(data.kpis.avgTicket), "—"],
  ];

  const payRows = data.payments.map(p => [escapeHtml(p.method), money.format(p.total)]);
  const topRows = data.topProducts.map(p => [
    escapeHtml(p.nombre), escapeHtml(p.sku ?? "—"), escapeHtml(p.categoria ?? "Sin categoría"),
    num.format(p.units), money.format(p.revenue)
  ]);

  const glossaryHtml = `
    <div class="section">
      <h2>Indicadores comparativos</h2>
      <table class="gloss">
        <thead><tr><th>Término</th><th>Qué significa</th></tr></thead>
        <tbody>
          <tr><td>Ingresos</td><td>Dinero total cobrado por ventas en el período.</td></tr>
          <tr><td>Margen de ganancia</td><td>Ganancia bruta: lo que queda después de descontar el costo de los productos vendidos.</td></tr>
          <tr><td>Unidades</td><td>Total de productos vendidos.</td></tr>
          <tr><td>Transacciones</td><td>Número de ventas realizadas.</td></tr>
          <tr><td>Ticket promedio</td><td>Promedio por compra: Ingresos ÷ Transacciones.</td></tr>
        </tbody>
      </table>
      <h3 style="margin-top:10px;">Lectura de variación</h3>
      <ul class="legend">
        <li><b>↑</b> Aumentó respecto del período anterior equivalente.</li>
        <li><b>↓</b> Disminuyó respecto del período anterior equivalente.</li>
        <li><b>—</b> No hay datos comparables.</li>
      </ul>
      <div class="muted tiny">
        <b>Período anterior</b><br/>
        • <b>Semanales</b> → los 7 días anteriores<br/>
        • <b>Mensuales</b> → los 12 meses anteriores<br/>
        • <b>Anuales</b> → los 5 años anteriores
      </div>
    </div>`;

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Reporte — ${escapeHtml(slug)}</title>
  <style>
    :root{ --brand:#D07A43; --ink:#111827; --muted:#6b7280; --bd:#ece7e2; --bg:#fff; }
    *{ box-sizing:border-box; }
    body{ margin:0; font:12px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color:var(--ink); background:#fff; }
    .page{ padding: 28px 40px 36px; }
    .head{ display:flex; align-items:center; gap:16px; margin-bottom: 8px; }
    .logo{ width:48px; height:48px; border-radius:10px; display:grid; place-items:center; overflow:hidden; }
    .title h1{ margin:0; font-size:18px; line-height:1.1; }
    .title .sub{ color:var(--muted); font-size:12px; }
    .range{ margin: 4px 0 18px; color: var(--muted); }
    .brandbar{ height:4px; background:var(--brand); margin: 8px 0 16px; border-radius: 99px; }

    .kpis{ display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin: 8px 0 18px; }
    .kpi{ border:1px solid var(--bd); border-radius:10px; padding:10px 12px; }
    .kpi .k{ color:var(--muted); font-size:11px; margin-bottom:2px; }
    .kpi .v{ font-weight:700; font-size:16px; }
    .kpi .d{ color:var(--muted); font-size:10px; margin-top:2px; }

    h2{ margin: 14px 0 6px; font-size:14px; }
    .muted{ color:var(--muted); }
    table{ width:100%; border-collapse: collapse; margin-top:6px; }
    th, td{ text-align:left; padding: 8px 10px; border-bottom: 1px solid #f1ece7; vertical-align: top; }
    th{ background: #f6f2ee; font-weight:700; }
    .right{ text-align:right; }
    .section{ margin-top: 14px; }
    .chart{ margin-top: 6px; }

    .gloss td:first-child{ white-space:nowrap; font-weight:600; }
    .gloss td{ vertical-align:top; }
    .legend{ margin:6px 0 0 18px; }
    .legend li{ margin:2px 0; }
    .tiny{ font-size:10px; }
  </style>
</head>
<body>
  <div class="page">
    <div class="head">
      <div class="logo">${logoHtml}</div>
      <div class="title">
        <h1>COPPLEM — Reporte de Ventas</h1>
        <div class="sub">${escapeHtml(slug)}</div>
      </div>
    </div>
    <div class="brandbar"></div>
    <div class="range">Periodo: <b>${data.period.from}</b> a <b>${data.period.to}</b> · <span class="muted">${subtitle}</span></div>

    <div class="kpis">
      ${kpis.map(([k,v,d]) => `
        <div class="kpi">
          <div class="k">${k}</div>
          <div class="v">${v}</div>
          <div class="d">${d}</div>
        </div>`).join("")}
    </div>

    <div class="section">
      <h2>Tendencia</h2>
      <div class="muted" style="font-size:11px">Periodo / Total</div>
      <div class="chart">${trendSvg}</div>
    </div>

    <div class="section">
      <h2>Ventas por categoría</h2>
      <div class="chart">${catsSvg}</div>
    </div>

    <div class="section">
      <h2>Métodos de cobro</h2>
      ${data.payments.length===0 ? `<div class="muted">Sin datos</div>` : `
      <table>
        <thead><tr><th>Método</th><th class="right">Total</th></tr></thead>
        <tbody>${data.payments.map(p=>`<tr><td>${escapeHtml(p.method)}</td><td class="right">${money.format(p.total)}</td></tr>`).join("")}</tbody>
      </table>`}
    </div>

    <div class="section">
      <h2>Top productos (por ingresos)</h2>
      ${data.topProducts.length===0 ? `<div class="muted">Sin datos</div>` : `
      <table>
        <thead>
          <tr>
            <th style="width:38%;">Producto</th>
            <th style="width:16%;">SKU</th>
            <th style="width:24%;">Categoría</th>
            <th class="right" style="width:10%;">Unidades</th>
            <th class="right" style="width:12%;">Ingresos</th>
          </tr>
        </thead>
        <tbody>
          ${data.topProducts.map(p => `
            <tr>
              <td>${escapeHtml(p.nombre)}</td>
              <td>${escapeHtml(p.sku ?? "—")}</td>
              <td>${escapeHtml(p.categoria ?? "Sin categoría")}</td>
              <td class="right">${num.format(p.units)}</td>
              <td class="right">${money.format(p.revenue)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>`}
    </div>

    ${glossaryHtml}

    <div class="section muted" style="font-size:10px;margin-top:10px;">
      Generado: ${escapeHtml(new Date().toLocaleString())} · Moneda: ${escapeHtml(data.currency)}
    </div>
  </div>
</body>
</html>`;

  // === carpeta de salida (PDF) ===
  const outFolder = resolveOutDir({ outDir: p?.outDir, createSubfolder: !!p?.createSubfolder, slug });
  const fname = `Reporte_${mode}_${data.period.from}_${data.period.to}.pdf`;
  const absPath = uniquePath(outFolder, fname);


  // Render oculto → PDF
  const win = new BrowserWindow({
    show: false,
    width: 900, height: 1240,
    webPreferences: { sandbox: true }
  });

  try {
    await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    const pdf = await win.webContents.printToPDF({
      pageSize: "A4",
      printBackground: true,
      landscape: false,
      margins: { marginType: "default" }
    });
    fs.writeFileSync(absPath, pdf);
  } finally {
    try { win.destroy(); } catch {}
  }

  try {
    const db2 = openDB(dbPathForSlug(slug));
    const cols = getExistingColumns(db2, "logs_exportaciones");
    if (cols.length) {
      db2.prepare(`
        INSERT INTO logs_exportaciones (tipo, modulo, rango_desde, rango_hasta, ruta_archivo, creado_por)
        VALUES ('PDF','reportes', @from, @to, @ruta, NULL)
      `).run({ from: data.period.from, to: data.period.to, ruta: absPath });
    }
    db2.close();
  } catch {}

  return { ok: true as const, path: absPath };
}


/* ======================== WARM-UP EXCEL ======================== */
/** Precarga exceljs para evitar lag en la primera exportación */
let ExcelWarmupPromise: Promise<typeof import("exceljs")> | null = null;

export function warmupReportsExports() {
  if (!ExcelWarmupPromise) {
    ExcelWarmupPromise = import("exceljs");
  }
}

/* ====================== EXPORTAR A EXCEL ======================= */
export async function exportReportsXlsx(
  slug: string,
  p?: { from?: string; to?: string; group?: "day"|"month"|"year"; allTime?: boolean; outDir?: string; createSubfolder?: boolean }
) {
  const mode =
    p?.allTime ? "total" :
    p?.group === "day" ? "week" :
    p?.group === "month" ? "month" : "year";

  // usamos la misma fuente de datos del PDF
  const data = getReportsStandalone(slug, { mode, from: p?.from, to: p?.to });

  // Carga excel
  if (!ExcelWarmupPromise) ExcelWarmupPromise = import("exceljs");
  const ExcelJS = await ExcelWarmupPromise;

  const wb = new ExcelJS.Workbook();

  // estilos sencillos
  const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "F4B084" } };
  const headerFont = { bold: true } as import("exceljs").Font;
  const borderThin = {
    top: { style: "thin" }, left: { style: "thin" },
    bottom: { style: "thin" }, right: { style: "thin" }
  } as import("exceljs").Borders;

  function addSheet(name: string, rows: (string|number|null)[][]) {
    const ws = wb.addWorksheet(name);
    if (rows.length) ws.addRows(rows);

    if (rows.length) {
      const headerRow = ws.getRow(1);
      headerRow.eachCell((cell) => {
        cell.fill = headerFill as any;
        cell.font = headerFont;
        cell.border = borderThin;
      });
    }

    ws.eachRow((row) => {
      row.eachCell((cell, col) => {
        cell.border = borderThin;
        const v = String(cell.value ?? "");
        const w = Math.min(40, Math.max(10, v.length + 2));
        const c = ws.getColumn(col);
        if (!c.width || (c.width ?? 0) < w) c.width = w;
      });
    });

    ws.views = [{ state: "frozen", ySplit: 1 }];
    return ws;
  }

  // Hojas
  addSheet("KPIs", [
    ["KPI", "Valor"],
    ["Ingresos", data.kpis.revenue],
    ["Margen de ganancia", data.kpis.grossProfit],
    ["Unidades", data.kpis.units],
    ["Transacciones", data.kpis.transactions],
    ["Ticket promedio", data.kpis.avgTicket],
  ]);

  addSheet("Tendencia", [
    ["Periodo", "Total"],
    ...data.trend.map(t => [t.label ?? t.key, t.total]),
  ]);

  addSheet("Categorías", [
    ["Categoría", "Total"],
    ...data.categories.map(c => [c.name, c.total]),
  ]);

  addSheet("Métodos de cobro", [
    ["Método", "Total"],
    ...data.payments.map(p => [p.method, p.total]),
  ]);

  addSheet("Top productos", [
    ["Producto","SKU","Categoría","Unidades","Ingresos"],
    ...data.topProducts.map(p => [p.nombre, p.sku ?? "", p.categoria, p.units, p.revenue]),
  ]);

  // === carpeta de salida (XLSX) ===
  const outFolder = resolveOutDir({ outDir: p?.outDir, createSubfolder: !!p?.createSubfolder, slug });
  const fname = `Report_${mode}_${data.period.from}_${data.period.to}.xlsx`;
  const absPath = uniquePath(outFolder, fname);



  await wb.xlsx.writeFile(absPath);

  // log
  try {
    const db = openDB(dbPathForSlug(slug));
    const cols = getExistingColumns(db, "logs_exportaciones");
    if (cols.length) {
      db.prepare(`
        INSERT INTO logs_exportaciones (tipo, modulo, rango_desde, rango_hasta, ruta_archivo, creado_por)
        VALUES ('XLSX','reportes', @from, @to, @ruta, NULL)
      `).run({ from: data.period.from, to: data.period.to, ruta: absPath });
    }
    db.close();
  } catch {}

  return { ok: true as const, path: absPath };
}
