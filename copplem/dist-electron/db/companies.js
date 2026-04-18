"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportReportsPdf = exports.exportReportsXlsx = void 0;
exports.listSales = listSales;
exports.getDashboard = getDashboard;
exports.getSale = getSale;
exports.createSale = createSale;
exports.importProductsFromXlsx = importProductsFromXlsx;
exports.copyProductsXlsxTemplate = copyProductsXlsxTemplate;
exports.getBusinessInfo = getBusinessInfo;
exports.updateBusinessInfo = updateBusinessInfo;
exports.listCompanies = listCompanies;
exports.createCompany = createCompany;
exports.editCompany = editCompany;
exports.deleteCompany = deleteCompany;
exports.login = login;
exports.listProducts = listProducts;
exports.suggestProductAlerts = suggestProductAlerts;
exports.forecastProductStock = forecastProductStock;
exports.createProduct = createProduct;
exports.updateProduct = updateProduct;
exports.deleteProduct = deleteProduct;
exports.adjustProductStock = adjustProductStock;
exports.listUsers = listUsers;
exports.countUsers = countUsers;
exports.createUser = createUser;
exports.updateUser = updateUser;
exports.changeUserPassword = changeUserPassword;
exports.deleteUser = deleteUser;
exports.listCategories = listCategories;
exports.createCategory = createCategory;
exports.updateCategory = updateCategory;
exports.deleteCategory = deleteCategory;
exports.closeCompanyDb = closeCompanyDb;
exports.getReports = getReports;
exports.exportAccountingXlsx = exportAccountingXlsx;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_url_1 = require("node:url");
const schemaLoader_1 = require("./schemaLoader");
const paths_1 = require("./paths");
const crypto_1 = require("./crypto");
const electron_1 = require("electron");
const XLSX = __importStar(require("xlsx"));
const reportsExport_1 = require("./reportsExport");
Object.defineProperty(exports, "exportReportsPdf", { enumerable: true, get: function () { return reportsExport_1.exportReportsPdf; } });
var reportsExport_2 = require("./reportsExport");
Object.defineProperty(exports, "exportReportsXlsx", { enumerable: true, get: function () { return reportsExport_2.exportReportsXlsx; } });
/** ====== Información del Negocio ====== */
/** Lee lista de columnas reales de una tabla */
function getExistingColumns(db, table) {
    try {
        const rows = db.prepare(`PRAGMA table_info(${table})`).all();
        return rows.map(r => r.name);
    }
    catch {
        return [];
    }
}
// Lista de ventas con filtros y paginación
function listSales(slug, p) {
    const db = openDB((0, paths_1.dbPathForSlug)(slug));
    try {
        const from = p?.from ?? new Date(Date.now() - 29 * 24 * 3600 * 1000).toISOString().slice(0, 10);
        const to = p?.to ?? new Date().toISOString().slice(0, 10);
        const like = p?.q?.trim() ? `%${p.q.trim()}%` : null;
        const limit = Math.max(1, Math.min(200, p?.limit ?? 50));
        const offset = Math.max(0, p?.offset ?? 0);
        const baseWhere = `
      WHERE date(v.fecha, 'localtime') BETWEEN date(@from) AND date(@to)
      ${like ? "AND (v.cliente_nombre LIKE @like OR v.correlativo_interno LIKE @like)" : ""}
    `;
        const rows = db.prepare(`
      SELECT v.id, datetime(v.fecha,'localtime') AS fecha, v.correlativo_interno, v.cliente_nombre, v.metodo_cobro,
             v.subtotal, v.descuento_total, v.total,
             (SELECT COUNT(*) FROM venta_items vi WHERE vi.venta_id = v.id) AS items_count
        FROM ventas v
        ${baseWhere}
       ORDER BY v.fecha DESC, v.id DESC
       LIMIT @limit OFFSET @offset
    `).all({ from, to, like, limit, offset });
        const totalRow = db.prepare(`
      SELECT COUNT(*) AS n
        FROM ventas v
        ${baseWhere}
    `).get({ from, to, like });
        return { rows: rows.map(r => ({
                id: r.id,
                fecha: r.fecha,
                correlativo_interno: r.correlativo_interno,
                cliente_nombre: r.cliente_nombre ?? null,
                metodo_cobro: r.metodo_cobro,
                subtotal: Number(r.subtotal) || 0,
                descuento_total: Number(r.descuento_total) || 0,
                total: Number(r.total) || 0,
                items_count: Number(r.items_count) || 0,
            })), total: Number(totalRow?.n ?? 0) };
    }
    finally {
        db.close();
    }
}
//dashboard
function getDashboard(slug) {
    const db = openDB((0, paths_1.dbPathForSlug)(slug));
    try {
        // --- moneda:
        const biz = db.prepare(`SELECT moneda FROM negocio ORDER BY id LIMIT 1`).get();
        const currency = String(biz?.moneda || "CLP");
        // ===== Helper fechas =====
        const iso = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            return `${y}-${m}-${dd}`;
        };
        const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
        const startOfWeekMon = (d) => {
            const x = new Date(d);
            const wd = (x.getDay() + 6) % 7;
            x.setDate(x.getDate() - wd);
            x.setHours(0, 0, 0, 0);
            return x;
        };
        const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
        // ===== HOY =====
        const today = db.prepare(`
      SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS total
      FROM ventas
      WHERE date(fecha,'localtime') = date('now','localtime')
    `).get();
        const todaySalesCount = Number(today?.n || 0);
        const todayIncome = Number(today?.total || 0);
        // ===== SERIE SEMANAL (últimos 7 días =====
        const dailyRows = db.prepare(`
      SELECT date(fecha,'localtime') AS d, COALESCE(SUM(total),0) AS t
      FROM ventas
      WHERE date(fecha,'localtime') >= date('now','localtime','-6 days')
      GROUP BY d
    `).all();
        const dailyMap = new Map(dailyRows.map(r => [r.d, Number(r.t || 0)]));
        const dailySeries = Array.from({ length: 7 }).map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            const s = iso(d);
            return { date: s, total: dailyMap.get(s) ?? 0 };
        });
        const weekIncome = dailySeries.reduce((a, p) => a + p.total, 0);
        // ===== SERIE MENSUAL (últimas 8 semanas, acumulado por semana Lun–Dom) =====
        // Traemos los últimos 56 días agrupados por inicio de semana (lunes)
        const d56 = db.prepare(`
      SELECT date(fecha,'localtime') AS d, COALESCE(SUM(total),0) AS t
      FROM ventas
      WHERE date(fecha,'localtime') >= date('now','localtime','-55 days')
      GROUP BY d
    `).all();
        const d56Map = new Map(d56.map(r => [r.d, Number(r.t || 0)]));
        const weeklySeries = Array.from({ length: 8 }).map((_, i) => {
            // i=0 → hace 7 semanas, … i=7 → semana actual
            const ref = startOfWeekMon(addDays(new Date(), -7 * (7 - i)));
            let sum = 0;
            for (let k = 0; k < 7; k++) {
                const day = iso(addDays(ref, k));
                sum += d56Map.get(day) ?? 0;
            }
            return { date: iso(ref), total: sum };
        });
        // ===== SERIE ANUAL (últimos 12 meses, acumulado por mes) =====
        const mRows = db.prepare(`
      SELECT strftime('%Y-%m', fecha, 'localtime') AS ym, COALESCE(SUM(total),0) AS t
      FROM ventas
      WHERE date(fecha,'localtime') >= date('now','localtime','-365 days')
      GROUP BY ym
    `).all();
        const mMap = new Map(mRows.map(r => [r.ym, Number(r.t || 0)]));
        const monthlySeries = Array.from({ length: 12 }).map((_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - (11 - i), 1);
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            return { date: iso(startOfMonth(d)), total: mMap.get(ym) ?? 0 };
        });
        // ===== Ingresos del mes actual =====
        const month = db.prepare(`
      SELECT COALESCE(SUM(total),0) AS total
      FROM ventas
      WHERE strftime('%Y-%m', fecha, 'localtime') = strftime('%Y-%m','now','localtime')
    `).get();
        const monthIncome = Number(month?.total || 0);
        // ===== Top producto (últimos 30 días) - con detalle =====
        const top = db.prepare(`
      SELECT
        p.id,
        p.nombre,
        p.sku,
        p.stock_actual,
        c.nombre AS categoria,
        c.color_hex AS categoria_color,
        SUM(vi.cantidad) AS q
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id
      LEFT JOIN productos p ON p.id = vi.producto_id
      LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE date(v.fecha,'localtime') >= date('now','localtime','-30 days')
      GROUP BY vi.producto_id
      ORDER BY q DESC
      LIMIT 1
    `).get();
        const topProduct = top ? {
            id: top.id,
            nombre: top.nombre ?? null,
            sku: top.sku ?? null,
            stock_actual: Number(top.stock_actual ?? 0),
            categoria: top.categoria ?? null,
            categoria_color: top.categoria_color ?? null,
        } : null;
        // ===== Margen bruto (últimos 30 días) =====
        const mg = db.prepare(`
      SELECT
        COALESCE(SUM(vi.subtotal),0) AS revenue,
        COALESCE(SUM(COALESCE(vi.costo_unit_ref,0) * vi.cantidad),0) AS cost
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id
      WHERE date(v.fecha,'localtime') >= date('now','localtime','-30 days')
    `).get();
        const rev = Number(mg?.revenue || 0);
        const cost = Number(mg?.cost || 0);
        const grossMarginPct = rev > 0 ? ((rev - cost) / rev) * 100 : null;
        // ===== Categorías (donut - últimos 30 días) =====
        const cats = db.prepare(`
      SELECT
        COALESCE(c.nombre, 'Sin categoría') AS name,
        c.color_hex AS color,
        COALESCE(SUM(vi.subtotal), 0)       AS total
      FROM venta_items vi
      JOIN ventas v     ON v.id = vi.venta_id
      LEFT JOIN productos p ON p.id = vi.producto_id
      LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE date(v.fecha,'localtime') >= date('now','localtime','-30 days')
      GROUP BY name, color
      ORDER BY total DESC
      LIMIT 5
    `).all();
        const catBreakdown = cats.map(c => ({
            name: c.name,
            color: c.color ?? null,
            total: Number(c.total || 0),
        }));
        // ===== Stock bajo (conteo) =====
        const prows = db.prepare(`
      SELECT id, nombre, stock_actual,
             stock_minimo, consumo_diario_estimado,
             alerta_tiempo_unidad, alerta_tiempo_cantidad
      FROM productos
      WHERE activo = 1
    `).all();
        const lowStockCount = prows.reduce((acc, p) => {
            const stock = Number(p.stock_actual || 0);
            const byMin = (p.stock_minimo != null) ? stock < Number(p.stock_minimo) : false;
            const unidad = String(p.alerta_tiempo_unidad || "");
            const cant = Number(p.alerta_tiempo_cantidad || 0);
            const consumo = Number(p.consumo_diario_estimado || 0);
            let days = 0;
            if (unidad === "dias")
                days = cant;
            else if (unidad === "semanas")
                days = cant * 7;
            else if (unidad === "meses")
                days = cant * 30;
            const need = (days > 0 && consumo > 0) ? days * consumo : 0;
            const byTime = need > 0 ? stock < need : false;
            return acc + ((byMin || byTime) ? 1 : 0);
        }, 0);
        // ===== Actividad reciente =====
        const lastSales = db.prepare(`
      SELECT v.id, datetime(v.fecha,'localtime') AS fecha, v.total, v.correlativo_interno
      FROM ventas v
      ORDER BY v.fecha DESC
      LIMIT 8
    `).all();
        const lastAdj = db.prepare(`
      SELECT a.id, a.fecha, a.cantidad, p.nombre AS prod, a.razon
      FROM ajustes_stock a
      LEFT JOIN productos p ON p.id = a.producto_id
      ORDER BY a.fecha DESC
      LIMIT 8
    `).all();
        const lastProds = db.prepare(`
      SELECT id, nombre, creado_en
      FROM productos
      ORDER BY creado_en DESC
      LIMIT 5
    `).all();
        const recent = [
            ...lastSales.map(s => ({
                when: s.fecha, type: "SALE",
                title: "Venta realizada",
                subtitle: `Correlativo ${s.correlativo_interno}`,
                amount: Number(s.total || 0)
            })),
            ...lastAdj.map(a => ({
                when: a.fecha, type: "ADJUST",
                title: "Ajuste de stock",
                subtitle: a.prod ?? "Producto",
                qty: Number(a.cantidad || 0), amount: null
            })),
            ...lastProds.map(p => ({
                when: p.creado_en, type: "PRODUCT",
                title: "Producto agregado",
                subtitle: p.nombre, amount: null
            })),
        ].sort((a, b) => (a.when < b.when ? 1 : -1)).slice(0, 12);
        return {
            currency,
            todaySalesCount, todayIncome, weekIncome, monthIncome,
            lowStockCount,
            dailySeries, weeklySeries, monthlySeries,
            catBreakdown, grossMarginPct,
            topProduct,
            recent,
            weekSeries: dailySeries,
        };
    }
    finally {
        db.close();
    }
}
// Cabecera + ítems de una venta
function getSale(slug, id) {
    const db = openDB((0, paths_1.dbPathForSlug)(slug));
    try {
        const h = db.prepare(`
      SELECT id, datetime(fecha,'localtime') AS fecha, correlativo_interno, cliente_nombre, metodo_cobro,
             subtotal, descuento_total, total, observacion
        FROM ventas
       WHERE id = ?
    `).get(id);
        if (!h)
            return { ok: false, error: "Venta no encontrada" };
        const items = db.prepare(`
      SELECT vi.id, vi.producto_id, p.nombre,
             vi.cantidad, vi.precio_unit, vi.descuento, vi.subtotal
        FROM venta_items vi
        LEFT JOIN productos p ON p.id = vi.producto_id
       WHERE vi.venta_id = ?
       ORDER BY vi.id ASC
    `).all(id);
        return {
            ok: true,
            header: {
                id: h.id, fecha: h.fecha, correlativo_interno: h.correlativo_interno,
                cliente_nombre: h.cliente_nombre ?? null, metodo_cobro: h.metodo_cobro,
                subtotal: Number(h.subtotal) || 0,
                descuento_total: Number(h.descuento_total) || 0,
                total: Number(h.total) || 0,
                observacion: h.observacion ?? null,
            },
            items: items.map(i => ({
                id: i.id, producto_id: i.producto_id, nombre: i.nombre ?? "",
                cantidad: Number(i.cantidad) || 0,
                precio_unit: Number(i.precio_unit) || 0,
                descuento: Number(i.descuento) || 0,
                subtotal: Number(i.subtotal) || 0,
            })),
        };
    }
    finally {
        db.close();
    }
}
/** Crea venta + items */
// === VENTAS ===
function createSale(slug, data) {
    const db = openDB((0, paths_1.dbPathForSlug)(slug));
    try {
        if (!Array.isArray(data.items) || data.items.length === 0) {
            throw new Error("La venta no tiene ítems.");
        }
        // Normaliza ítems aceptando múltiples alias
        const normItems = data.items.map((it, idx) => {
            const product_id = it.product_id ?? it.producto_id ?? it.id ?? it.product?.id ?? null;
            const qty = it.qty ?? it.cantidad ?? it.quantity ?? it.q ?? null;
            const price_unit = it.price_unit ?? it.precio_unit ?? it.precio ?? it.price ?? null;
            if (!Number.isFinite(Number(product_id))) {
                throw new Error(`Ítem #${idx + 1}: product_id inválido`);
            }
            if (!Number.isFinite(Number(qty)) || Number(qty) <= 0) {
                throw new Error(`Ítem #${idx + 1}: cantidad inválida`);
            }
            if (!Number.isFinite(Number(price_unit)) || Number(price_unit) < 0) {
                throw new Error(`Ítem #${idx + 1}: precio unitario inválido`);
            }
            return {
                product_id: Number(product_id),
                qty: Math.round(Number(qty)),
                price_unit: Number(price_unit),
            };
        });
        // Valida existencia y stock
        for (const it of normItems) {
            const row = db
                .prepare(`SELECT id, nombre, stock_actual FROM productos WHERE id = ? AND activo = 1`)
                .get(it.product_id);
            if (!row)
                throw new Error(`Producto ${it.product_id} no existe`);
            if (row.stock_actual < it.qty) {
                throw new Error(`Stock insuficiente para "${row.nombre}" (${row.stock_actual} disponibles)`);
            }
        }
        // Totales
        const subtotal = normItems.reduce((a, it) => a + it.qty * it.price_unit, 0);
        const descuento_total = Math.max(0, Number(data.descuento_total || 0));
        const total = Math.max(0, subtotal - descuento_total);
        // correlativo interno simple
        const corr = `V-${Date.now().toString(36).toUpperCase()}`;
        const tx = db.transaction(() => {
            const insVenta = db.prepare(`
        INSERT INTO ventas
          (fecha, correlativo_interno, cliente_nombre, subtotal, descuento_total, total, metodo_cobro, observacion, usuario_id)
        VALUES
          (CURRENT_TIMESTAMP, @corr, @cliente, @subtotal, @descuento, @total, @metodo, @obs, @uid)
      `);
            const info = insVenta.run({
                corr,
                cliente: (data.cliente_nombre?.trim() || null),
                subtotal,
                descuento: descuento_total,
                total,
                metodo: data.metodo_cobro,
                obs: data.observacion ?? null,
                uid: data.usuario_id ?? null,
            });
            const ventaId = Number(info.lastInsertRowid);
            const getCosto = db.prepare(`SELECT costo_ultimo FROM productos WHERE id = ?`);
            const insItem = db.prepare(`
        INSERT INTO venta_items
          (venta_id, producto_id, cantidad, precio_unit, descuento, subtotal, costo_unit_ref)
        VALUES
          (@venta_id, @producto_id, @cantidad, @precio_unit, 0, @subtotal, @costo_ref)
      `);
            for (const it of normItems) {
                const costoRow = getCosto.get(it.product_id);
                const costo_ref = Number(costoRow?.costo_ultimo ?? 0);
                insItem.run({
                    venta_id: ventaId,
                    producto_id: it.product_id,
                    cantidad: it.qty,
                    precio_unit: it.price_unit,
                    subtotal: it.qty * it.price_unit,
                    costo_ref,
                });
            }
            return { ventaId, corr };
        });
        const { ventaId, corr: correlativo } = tx();
        return { ok: true, id: ventaId, correlativo };
    }
    catch (e) {
        return { ok: false, error: e?.message ?? String(e) };
    }
    finally {
        db.close();
    }
}
function importProductsFromXlsx(slug, filePath, opts) {
    const db = openDB((0, paths_1.dbPathForSlug)(slug));
    try {
        if (!node_fs_1.default.existsSync(filePath)) {
            return { ok: false, error: "Archivo no encontrado" };
        }
        const wb = XLSX.readFile(filePath, { cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!ws)
            return { ok: false, error: "Hoja vacía o inválida" };
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false });
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
            const r = (rows[i] || []).map((v) => String(v ?? "").trim().toLowerCase());
            if (r.includes("nombre")) {
                headerRowIdx = i;
                break;
            }
        }
        if (headerRowIdx === -1)
            headerRowIdx = 1;
        const header = (rows[headerRowIdx] || []).map((v) => String(v ?? "").trim().toLowerCase());
        const idx = (name, alts = []) => {
            const all = [name, ...alts].map((s) => s.toLowerCase());
            for (const a of all) {
                const i = header.findIndex((h) => h === a);
                if (i !== -1)
                    return i;
            }
            return -1;
        };
        const COL = {
            nombre: idx("nombre"),
            sku: idx("sku"),
            codbar: idx("código de barras", ["codigo de barras", "barcode", "codebar"]),
            categoria: idx("categoría", ["categoria"]),
            costo: idx("precio compra", ["costo", "precio de compra"]),
            venta: idx("precio venta", ["precio de venta"]),
            stock: idx("stock inicial", ["stock", "stock_inicial"]),
        };
        const faltan = ["nombre", "venta", "stock"].filter((k) => COL[k] === -1);
        if (faltan.length) {
            return { ok: false, error: `Plantilla inválida: faltan columnas obligatorias ${faltan.join(", ")}` };
        }
        const toNum = (v) => {
            if (v === null || v === undefined || v === "")
                return NaN;
            if (typeof v === "number")
                return v;
            const s = String(v).trim().replace(/\./g, "").replace(",", ".");
            const n = Number(s);
            return Number.isFinite(n) ? n : NaN;
        };
        let added = 0, skipped = 0;
        const errors = [];
        const start = headerRowIdx + 1;
        const tx = db.transaction((rws) => {
            for (let r = start; r < rws.length; r++) {
                const row = rws[r];
                if (!row)
                    continue;
                const get = (i) => (i >= 0 ? row[i] : undefined);
                const nombre = String(get(COL.nombre) ?? "").trim();
                if (!nombre) {
                    skipped++;
                    continue;
                }
                const sku = (() => {
                    const raw = get(COL.sku);
                    const s = raw == null ? "" : String(raw).trim();
                    return s ? s : null;
                })();
                const codbar = (() => {
                    const raw = get(COL.codbar);
                    const s = raw == null ? "" : String(raw).trim();
                    return s ? s : null;
                })();
                const categoriaNombre = (() => {
                    const raw = get(COL.categoria);
                    return raw == null ? "" : String(raw).trim();
                })();
                const venta = toNum(get(COL.venta));
                const stock = toNum(get(COL.stock));
                const costo = get(COL.costo) === undefined ? NaN : toNum(get(COL.costo));
                if (!Number.isFinite(venta) || venta < 0) {
                    errors.push({ row: r + 1, error: "Precio Venta inválido", nombre });
                    continue;
                }
                if (!Number.isFinite(stock) || stock < 0) {
                    errors.push({ row: r + 1, error: "Stock Inicial inválido", nombre });
                    continue;
                }
                if (!Number.isNaN(costo) && (costo < 0)) {
                    errors.push({ row: r + 1, error: "Precio Compra inválido", nombre });
                    continue;
                }
                const existing = db.prepare(`
          SELECT id FROM productos
           WHERE (sku = @sku AND @sku IS NOT NULL)
              OR (codigo_barras = @codbar AND @codbar IS NOT NULL)
              OR (LOWER(nombre) = LOWER(@nombre))
           LIMIT 1
        `).get({ sku, codbar, nombre });
                if (existing) {
                    skipped++;
                    continue;
                }
                // categoría
                let categoria_id = null;
                if (categoriaNombre) {
                    const ex = db.prepare(`SELECT id FROM categorias WHERE LOWER(nombre) = LOWER(?)`).get(categoriaNombre);
                    if (ex?.id) {
                        categoria_id = ex.id;
                    }
                    else {
                        const ins = db.prepare(`INSERT INTO categorias (nombre) VALUES (?)`).run(categoriaNombre);
                        categoria_id = Number(ins.lastInsertRowid);
                    }
                }
                // Insert
                db.prepare(`
          INSERT INTO productos (nombre, sku, codigo_barras, categoria_id, costo_ultimo, precio_venta, stock_inicial, stock_actual, activo)
          VALUES (@nombre, @sku, @codbar, @categoria_id, @costo, @venta, @stock, @stock, 1)
        `).run({
                    nombre,
                    sku,
                    codbar,
                    categoria_id,
                    costo: Number.isNaN(costo) ? 0 : costo,
                    venta,
                    stock,
                });
                added++;
            }
        });
        tx(rows);
        return { ok: true, added, skipped, errors };
    }
    catch (e) {
        return { ok: false, error: e?.message ?? String(e) };
    }
    finally {
        db.close();
    }
}
function copyProductsXlsxTemplate(destPath) {
    try {
        const src = (0, paths_1.productTemplateXlsxPath)();
        if (!node_fs_1.default.existsSync(src)) {
            return { ok: false, error: "No se encontró Plantilla_Productos.xlsx en resources." };
        }
        const desktop = electron_1.app.getPath("desktop");
        let dest = destPath || node_path_1.default.join(desktop, "Plantilla_Productos.xlsx");
        if (!destPath) {
            let i = 1;
            while (node_fs_1.default.existsSync(dest)) {
                dest = node_path_1.default.join(desktop, `Plantilla_Productos (${i++}).xlsx`);
            }
        }
        else {
            // asegurar carpeta si el usuario eligió un path custom
            const dir = node_path_1.default.dirname(dest);
            if (!node_fs_1.default.existsSync(dir))
                node_fs_1.default.mkdirSync(dir, { recursive: true });
        }
        node_fs_1.default.copyFileSync(src, dest);
        return { ok: true, dest };
    }
    catch (e) {
        return { ok: false, error: e?.message ?? String(e) };
    }
}
function getBusinessInfo(slug) {
    const db = openDB((0, paths_1.dbPathForSlug)(slug));
    try {
        const table = "negocio";
        const cols = getExistingColumns(db, table);
        if (cols.length === 0) {
            return { ok: false, error: "La tabla 'negocio' no existe en esta empresa." };
        }
        const wanted = [
            "id", "nombre", "rut", "giro", "direccion", "comuna", "ciudad", "region",
            "telefono", "email", "moneda", "iva_por_defecto", "creado_en", "actualizado_en"
        ];
        const selectCols = wanted.filter(c => cols.includes(c));
        const sql = `SELECT ${selectCols.join(", ")} FROM ${table} ORDER BY id ASC LIMIT 1`;
        const row = db.prepare(sql).get();
        return { ok: true, data: row ?? {} };
    }
    catch (e) {
        return { ok: false, error: e?.message ?? String(e) };
    }
    finally {
        db.close();
    }
}
function updateBusinessInfo(slug, data) {
    const db = openDB((0, paths_1.dbPathForSlug)(slug));
    try {
        const table = "negocio";
        const cols = getExistingColumns(db, table);
        if (cols.length === 0) {
            return { ok: false, error: "La tabla 'negocio' no existe en esta empresa." };
        }
        // Aseguramos que exista al menos una fila para actualizar
        const row = db.prepare(`SELECT id FROM ${table} ORDER BY id ASC LIMIT 1`).get();
        if (!row) {
            const baseCols = [];
            const baseVals = [];
            const baseParams = {};
            if (cols.includes("nombre")) {
                baseCols.push("nombre");
                baseVals.push("@nombre");
                baseParams.nombre = data.nombre ?? "Mi Negocio";
            }
            if (cols.includes("moneda")) {
                baseCols.push("moneda");
                baseVals.push("@moneda");
                baseParams.moneda = data.moneda ?? "CLP";
            }
            const insSQL = baseCols.length
                ? `INSERT INTO ${table} (${baseCols.join(",")}) VALUES (${baseVals.join(",")})`
                : `INSERT INTO ${table} DEFAULT VALUES`;
            db.prepare(insSQL).run(baseParams);
        }
        // Campos editables permitidos
        const editable = [
            "nombre", "rut", "giro", "direccion", "comuna", "ciudad", "region", "telefono", "email", "moneda", "iva_por_defecto"
        ];
        const keys = editable.filter(k => data[k] !== undefined && cols.includes(String(k)));
        if (keys.length === 0)
            return { ok: true }; // nada que actualizar
        const sets = keys.map(k => `${String(k)} = @${String(k)}`);
        if (cols.includes("actualizado_en"))
            sets.push(`actualizado_en = CURRENT_TIMESTAMP`);
        const params = {};
        for (const k of keys)
            params[String(k)] = data[k];
        const updSQL = `
      UPDATE ${table}
         SET ${sets.join(", ")}
       WHERE id = (SELECT id FROM ${table} ORDER BY id ASC LIMIT 1)
    `;
        db.prepare(updSQL).run(params);
        return { ok: true };
    }
    catch (e) {
        console.error("[updateBusinessInfo]", e);
        return { ok: false, error: e?.message ?? String(e) };
    }
    finally {
        db.close();
    }
}
const IS_DEV = !!process.env.VITE_DEV_SERVER_URL;
function filePathToImgSrc(p) {
    if (!p || !node_fs_1.default.existsSync(p))
        return null;
    if (IS_DEV) {
        const buf = node_fs_1.default.readFileSync(p);
        const ext = node_path_1.default.extname(p).toLowerCase();
        let mime = "image/png";
        if (ext === ".jpg" || ext === ".jpeg")
            mime = "image/jpeg";
        else if (ext === ".webp")
            mime = "image/webp";
        return `data:${mime};base64,${buf.toString("base64")}`;
    }
    return (0, node_url_1.pathToFileURL)(p).href;
}
const openDB = (file) => { const db = new better_sqlite3_1.default(file); db.pragma("foreign_keys = ON"); return db; };
/** ====== color por empresa  ====== */
const META_FILE = node_path_1.default.join((0, paths_1.userDataRoot)(), "company-meta.json");
function readMeta() {
    try {
        return JSON.parse(node_fs_1.default.readFileSync(META_FILE, "utf8"));
    }
    catch {
        return {};
    }
}
function writeMeta(meta) {
    try {
        node_fs_1.default.writeFileSync(META_FILE, JSON.stringify(meta, null, 2), "utf8");
    }
    catch { }
}
function parseDataUrl(dataUrl) {
    const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || "");
    if (!m)
        throw new Error("DataURL inválida");
    return { mime: m[1], buf: Buffer.from(m[2], "base64") };
}
/** Guarda un dataURL en el path del logo */
function saveLogoDataUrlToPngPath(slug, dataUrl) {
    const { buf } = parseDataUrl(dataUrl);
    const out = (0, paths_1.logoPngPathForSlug)(slug);
    node_fs_1.default.writeFileSync(out, buf);
    return out;
}
function listCompanies() {
    (0, paths_1.ensureDirs)();
    const meta = readMeta();
    const dir = (0, paths_1.getCompaniesDir)();
    const files = node_fs_1.default.readdirSync(dir).filter(f => f.endsWith(".sqlite")).sort();
    return files.map(f => {
        const slug = node_path_1.default.basename(f, ".sqlite");
        try {
            const db = openDB(node_path_1.default.join(dir, f));
            const row = db.prepare("SELECT nombre FROM negocio ORDER BY id LIMIT 1").get();
            // métricas
            const prodCnt = db.prepare("SELECT COUNT(*) AS n FROM productos WHERE activo = 1").get();
            const todaySales = db.prepare(`
        SELECT COUNT(*) AS n
        FROM ventas
        WHERE date(fecha, 'localtime') = date('now','localtime')
      `).get();
            db.close();
            const logoPath = (0, paths_1.logoPngPathForSlug)(slug);
            const avatarUrl = filePathToImgSrc(node_fs_1.default.existsSync(logoPath) ? logoPath : null);
            const color = meta[slug]?.colorHex ?? null;
            const lastAccessAt = meta[slug]?.lastAccessAt ?? null;
            return {
                slug,
                name: row?.nombre ?? slug,
                avatarUrl,
                color,
                productCount: Number(prodCnt?.n ?? 0),
                todaySalesCount: Number(todaySales?.n ?? 0),
                lastAccessAt
            };
        }
        catch {
            const logoPath = (0, paths_1.logoPngPathForSlug)(slug);
            const avatarUrl = filePathToImgSrc(node_fs_1.default.existsSync(logoPath) ? logoPath : null);
            const color = meta[slug]?.colorHex ?? null;
            const lastAccessAt = meta[slug]?.lastAccessAt ?? null;
            return { slug, name: slug, avatarUrl, color, productCount: 0, todaySalesCount: 0, lastAccessAt };
        }
    });
}
function createCompany(data) {
    try {
        (0, paths_1.ensureDirs)();
        const slug = (0, paths_1.slugify)(data.name);
        const dbFile = (0, paths_1.dbPathForSlug)(slug);
        if (node_fs_1.default.existsSync(dbFile))
            return { ok: false, error: "Ya existe una empresa con ese nombre." };
        // crea DB desde template
        const db = openDB(dbFile);
        db.exec((0, schemaLoader_1.readTemplateSQL)());
        db.prepare("INSERT INTO negocio (nombre) VALUES (?)").run(data.name);
        const hash = (0, crypto_1.hashPassword)(data.admin.password);
        db.prepare("INSERT INTO usuarios (nombre, username, email, rol, password_hash, activo) VALUES (?, ?, ?, 'ADMIN', ?, 1)").run(data.admin.fullName, data.admin.username, data.admin.email ?? null, hash);
        db.close();
        // === LOGO ===
        if (data.logoDataUrl) {
            saveLogoDataUrlToPngPath(slug, data.logoDataUrl);
        }
        else if (data.logoPath && node_fs_1.default.existsSync(data.logoPath)) {
            node_fs_1.default.copyFileSync(data.logoPath, (0, paths_1.logoPngPathForSlug)(slug));
        }
        // === COLOR ===
        const meta = readMeta();
        meta[slug] = { colorHex: (data.color ?? data.colorHex ?? null) };
        writeMeta(meta);
        return { ok: true };
    }
    catch (e) {
        return { ok: false, error: String(e?.message ?? e) };
    }
}
function editCompany(data) {
    try {
        (0, paths_1.ensureDirs)();
        const oldDb = (0, paths_1.dbPathForSlug)(data.oldSlug);
        if (!node_fs_1.default.existsSync(oldDb))
            return { ok: false, error: "No existe la empresa." };
        const newSlug = (0, paths_1.slugify)(data.newName);
        const newDb = (0, paths_1.dbPathForSlug)(newSlug);
        // Actualiza nombre en la DB
        const db = openDB(oldDb);
        db.prepare("UPDATE negocio SET nombre = ? WHERE id = (SELECT id FROM negocio ORDER BY id LIMIT 1)")
            .run(data.newName);
        db.close();
        // Renombra archivo .sqlite y assets si cambió slug
        if (newSlug !== data.oldSlug) {
            if (node_fs_1.default.existsSync(newDb))
                return { ok: false, error: "Conflicto: ya existe ese nombre." };
            node_fs_1.default.renameSync(oldDb, newDb);
            const oldLogo = (0, paths_1.logoPngPathForSlug)(data.oldSlug), newLogo = (0, paths_1.logoPngPathForSlug)(newSlug);
            if (node_fs_1.default.existsSync(oldLogo)) {
                try {
                    node_fs_1.default.rmSync(newLogo, { force: true });
                }
                catch { }
                node_fs_1.default.renameSync(oldLogo, newLogo);
            }
            const oldIco = (0, paths_1.iconPathForSlug)(data.oldSlug), newIco = (0, paths_1.iconPathForSlug)(newSlug);
            if (node_fs_1.default.existsSync(oldIco)) {
                try {
                    node_fs_1.default.rmSync(newIco, { force: true });
                }
                catch { }
                node_fs_1.default.renameSync(oldIco, newIco);
            }
            // mover meta (color)
            const meta = readMeta();
            if (meta[data.oldSlug]) {
                meta[newSlug] = meta[data.oldSlug];
                delete meta[data.oldSlug];
                writeMeta(meta);
            }
        }
        // === LOGO (nuevo / quitar) ===
        const logoDst = (0, paths_1.logoPngPathForSlug)(newSlug);
        if (data.removeLogo) {
            try {
                if (node_fs_1.default.existsSync(logoDst))
                    node_fs_1.default.unlinkSync(logoDst);
            }
            catch { }
        }
        if (data.newLogoDataUrl) {
            node_fs_1.default.writeFileSync(logoDst, parseDataUrl(data.newLogoDataUrl).buf);
        }
        else if (data.logoPath && node_fs_1.default.existsSync(data.logoPath)) {
            node_fs_1.default.copyFileSync(data.logoPath, logoDst);
        }
        // === COLOR ===
        const meta = readMeta();
        const colorValue = (data.color ?? data.colorHex ?? null);
        meta[newSlug] = { colorHex: colorValue ?? meta[newSlug]?.colorHex ?? null };
        writeMeta(meta);
        return { ok: true };
    }
    catch (e) {
        return { ok: false, error: String(e?.message ?? e) };
    }
}
function deleteCompany(slug) {
    try {
        const p = (0, paths_1.dbPathForSlug)(slug);
        if (!node_fs_1.default.existsSync(p))
            return { ok: false, error: "No existe la empresa." };
        node_fs_1.default.unlinkSync(p);
        // borrar logo + ico
        [(0, paths_1.logoPngPathForSlug)(slug), (0, paths_1.iconPathForSlug)(slug)].forEach(f => {
            try {
                if (node_fs_1.default.existsSync(f))
                    node_fs_1.default.unlinkSync(f);
            }
            catch { }
        });
        // borrar meta
        const meta = readMeta();
        if (meta[slug]) {
            delete meta[slug];
            writeMeta(meta);
        }
        return { ok: true };
    }
    catch (e) {
        return { ok: false, error: String(e?.message ?? e) };
    }
}
function login(slug, username, password) {
    try {
        // 1) buscar usuario
        const db = openDB((0, paths_1.dbPathForSlug)(slug));
        const row = db.prepare("SELECT id, nombre, username, email, rol, password_hash, activo FROM usuarios WHERE username = ?").get(username);
        db.close();
        if (!row)
            return { ok: false, error: "Usuario no encontrado" };
        if (row.activo !== 1)
            return { ok: false, error: "Usuario inactivo" };
        if (!(0, crypto_1.verifyPassword)(password, row.password_hash))
            return { ok: false, error: "Contraseña incorrecta" };
        // 2) dejar registro de acceso
        try {
            const db2 = openDB((0, paths_1.dbPathForSlug)(slug));
            db2.prepare(`
        INSERT INTO logs_actividad (usuario_id, accion, entidad, entidad_id, detalle)
        VALUES (?, 'LOGIN', 'USUARIO', ?, 'Ingreso al sistema')
      `).run(row.id, row.id);
            db2.close();
        }
        catch {
        }
        // 3) actualizar meta: último acceso (preservando color)
        const meta = readMeta();
        meta[slug] = {
            colorHex: meta[slug]?.colorHex ?? null,
            lastAccessAt: new Date().toISOString(),
        };
        writeMeta(meta);
        // 4) respuesta
        return {
            ok: true,
            user: { id: row.id, nombre: row.nombre, username: row.username, rol: row.rol }
        };
    }
    catch (e) {
        return { ok: false, error: String(e?.message ?? e) };
    }
}
function listProducts(slug, q) {
    const db = openDB((0, paths_1.dbPathForSlug)(slug));
    const like = q?.trim() ? `%${q.trim()}%` : null;
    const sql = `
    SELECT p.id, p.nombre,
          p.precio_venta,
          p.costo_ultimo AS precio_compra,   -- 
          p.stock_actual,
          p.stock_minimo, p.consumo_diario_estimado,
          p.alerta_tiempo_unidad, p.alerta_tiempo_cantidad,
          p.sku, p.codigo_barras,
          c.id AS categoria_id, c.nombre AS categoria_nombre, c.color_hex AS categoria_color
      FROM productos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE p.activo = 1
      ${like ? "AND (p.nombre LIKE @like OR p.sku LIKE @like OR p.codigo_barras LIKE @like)" : ""}
    ORDER BY p.nombre COLLATE NOCASE
  `;
    const rows = db.prepare(sql).all(like ? { like } : {});
    db.close();
    return rows.map(r => ({
        id: r.id,
        nombre: r.nombre,
        precio_venta: Number(r.precio_venta) || 0,
        precio_compra: r.precio_compra != null ? Number(r.precio_compra) : null,
        stock_actual: Number(r.stock_actual) || 0,
        categoria: r.categoria_nombre ?? null,
        categoria_id: r.categoria_id ?? null,
        categoria_color: r.categoria_color ?? null,
        sku: r.sku ?? null,
        codigo_barras: r.codigo_barras ?? null,
        stock_minimo: r.stock_minimo ?? null,
        consumo_diario_estimado: r.consumo_diario_estimado ?? null,
        alerta_tiempo_unidad: r.alerta_tiempo_unidad ?? null,
        alerta_tiempo_cantidad: r.alerta_tiempo_cantidad ?? null,
    }));
}
// ===== Sugerencia automática de alertas (por producto) =====
function suggestProductAlerts(slug, p) {
    const db = openDB((0, paths_1.dbPathForSlug)(slug));
    try {
        const productId = Number(p.producto_id);
        if (!Number.isFinite(productId))
            return { ok: false, error: "producto_id inválido" };
        const windowDays = Math.max(7, Math.min(180, Math.round(Number(p.windowDays ?? 60))));
        const targetCoverageDays = Math.max(0, Math.min(90, Math.round(Number(p.targetCoverageDays ?? 14))));
        const toISO = new Date().toISOString().slice(0, 10);
        const fromD = new Date();
        fromD.setDate(fromD.getDate() - (windowDays - 1));
        const fromISO = fromD.toISOString().slice(0, 10);
        const row = db.prepare(`
      SELECT COALESCE(SUM(vi.cantidad), 0) AS units
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id
      WHERE vi.producto_id = @pid
        AND date(v.fecha,'localtime') BETWEEN date(@from) AND date(@to)
    `).get({ pid: productId, from: fromISO, to: toISO });
        const units = Number(row?.units || 0);
        const raw = windowDays > 0 ? (units / windowDays) : 0;
        const consumo_diario_estimado = raw > 0 ? Math.ceil(raw) : 0;
        const cobertura_dias = targetCoverageDays || 0;
        const stock_minimo = consumo_diario_estimado > 0 ? Math.ceil(consumo_diario_estimado * 7) : null;
        return {
            ok: true,
            windowDays,
            desde: fromISO,
            hasta: toISO,
            consumo_diario_estimado,
            cobertura_dias,
            stock_minimo,
        };
    }
    catch (e) {
        return { ok: false, error: e?.message ?? String(e) };
    }
    finally {
        db.close();
    }
}
// ===== Predicción de stock (por producto) =====
function forecastProductStock(slug, p) {
    const db = openDB((0, paths_1.dbPathForSlug)(slug));
    try {
        const pid = Number(p.producto_id);
        if (!Number.isFinite(pid))
            return { ok: false, error: "producto_id inválido" };
        const windowDays = Math.max(14, Math.min(365, Math.round(Number(p.windowDays ?? 90))));
        const horizonDays = Math.max(7, Math.min(120, Math.round(Number(p.horizonDays ?? 30))));
        const leadTimeDays = Math.max(0, Math.min(60, Math.round(Number(p.leadTimeDays ?? 7))));
        const service = Number(p.serviceLevel ?? 0.90);
        const zTable = { "0.8": 0.84, "0.9": 1.28, "0.95": 1.64, "0.975": 1.96, "0.99": 2.33 };
        const z = zTable[String(service)] ?? 1.28;
        const toISO = (d) => d.toISOString().slice(0, 10);
        const end = new Date();
        end.setHours(0, 0, 0, 0);
        const start = new Date(end);
        start.setDate(end.getDate() - (windowDays - 1));
        const fromISO = toISO(start);
        const toISO_ = toISO(end);
        // Traemos ventas por día del producto
        const rows = db.prepare(`
      SELECT date(v.fecha,'localtime') AS d, COALESCE(SUM(vi.cantidad),0) AS units
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id
      WHERE vi.producto_id = @pid
        AND date(v.fecha,'localtime') BETWEEN date(@from) AND date(@to)
      GROUP BY d
    `).all({ pid, from: fromISO, to: toISO_ });
        const days = [];
        for (let i = 0; i < windowDays; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const key = toISO(d);
            const hit = rows.find(r => r.d === key);
            days.push({ date: key, units: Number(hit?.units || 0) });
        }
        // Estadísticos básicos
        const total = days.reduce((a, x) => a + x.units, 0);
        const avgDaily = windowDays > 0 ? total / windowDays : 0;
        const mean = avgDaily;
        const variance = windowDays > 1
            ? days.reduce((a, x) => a + Math.pow(x.units - mean, 2), 0) / (windowDays - 1)
            : 0;
        const stdDevDaily = Math.sqrt(Math.max(0, variance));
        const n = days.length;
        let sumT = 0, sumY = 0, sumTT = 0, sumTY = 0;
        for (let t = 0; t < n; t++) {
            const y = days[t].units;
            sumT += t;
            sumY += y;
            sumTT += t * t;
            sumTY += t * y;
        }
        const denom = (n * sumTT - sumT * sumT) || 1;
        const b = (n * sumTY - sumT * sumY) / denom;
        const a = (sumY - b * sumT) / n;
        // Pronóstico diario
        const forecastDaily = [];
        const lastT = n - 1;
        for (let h = 1; h <= horizonDays; h++) {
            const tFuture = lastT + h;
            let yhat = a + b * tFuture;
            if (!Number.isFinite(yhat) || yhat < 0)
                yhat = 0; // no negativos
            forecastDaily.push({
                date: toISO(new Date(end.getFullYear(), end.getMonth(), end.getDate() + h)),
                units: Number(yhat.toFixed(3))
            });
        }
        const totalForecast = forecastDaily.reduce((s, x) => s + x.units, 0);
        // Stock actual del producto
        const prow = db.prepare(`SELECT stock_actual FROM productos WHERE id = ?`).get(pid);
        const stock_actual = Number(prow?.stock_actual || 0);
        // Fecha estimada de quiebre 
        const recentRate = Math.max(0, avgDaily);
        const daysToZero = recentRate > 0 ? stock_actual / recentRate : Infinity;
        const breakDate = Number.isFinite(daysToZero)
            ? toISO(new Date(end.getFullYear(), end.getMonth(), end.getDate() + Math.ceil(daysToZero)))
            : null;
        // Stock de seguridad 
        const safetyStock = Math.ceil(stdDevDaily * z * Math.sqrt(Math.max(0, leadTimeDays)));
        // Stock objetivo: cubrir horizonte + seguridad
        const targetStock = Math.ceil(totalForecast + safetyStock);
        const buySuggestion = Math.max(0, targetStock - stock_actual);
        return {
            ok: true,
            params: { windowDays, horizonDays, leadTimeDays, serviceLevel: service },
            history: { from: fromISO, to: toISO_, daily: days, total, avgDaily, slope: b },
            forecast: { horizonDays, daily: forecastDaily, total: totalForecast },
            risk: { stock_actual, daysToZero: Number.isFinite(daysToZero) ? daysToZero : null, breakDate },
            policy: { stdDevDaily, z, safetyStock, targetStock, buySuggestion }
        };
    }
    catch (e) {
        return { ok: false, error: e?.message ?? String(e) };
    }
    finally {
        db.close();
    }
}
function createProduct(slug, p) {
    try {
        const db = openDB((0, paths_1.dbPathForSlug)(slug));
        const tx = db.transaction((prod) => {
            const info = db.prepare(`
        INSERT INTO productos (nombre, precio_venta, stock_inicial, stock_actual, activo)
        VALUES (?, ?, ?, ?, 1)
      `).run(prod.nombre, prod.precio_venta, prod.stock_inicial, prod.stock_inicial);
            return info.lastInsertRowid;
        });
        const id = tx(p);
        db.close();
        return { ok: true, id };
    }
    catch (e) {
        return { ok: false, error: String(e?.message ?? e) };
    }
}
// Actualiza campos del producto
function updateProduct(slug, id, patch) {
    const db = openDB((0, paths_1.dbPathForSlug)(slug));
    try {
        const cols = getExistingColumns(db, "productos");
        const sets = [];
        const p = { id };
        const map = {
            nombre: "nombre",
            precio_venta: "precio_venta",
            precio_compra: "costo_ultimo",
            stock_minimo: "stock_minimo",
            consumo_diario_estimado: "consumo_diario_estimado",
            alerta_tiempo_unidad: "alerta_tiempo_unidad",
            alerta_tiempo_cantidad: "alerta_tiempo_cantidad",
            codigo: "sku",
            sku: "sku",
            codigo_barras: "codigo_barras",
            categoria_id: "categoria_id",
        };
        for (const k of Object.keys(map)) {
            const col = map[k];
            if (patch[k] !== undefined && cols.includes(col)) {
                sets.push(`${col} = @${col}`);
                p[col] = patch[k];
            }
        }
        if (cols.includes("actualizado_en"))
            sets.push("actualizado_en = CURRENT_TIMESTAMP");
        if (!sets.length)
            return { ok: true };
        // Normaliza consumo a entero hacia arriba si viene definido
        if (Object.prototype.hasOwnProperty.call(p, "consumo_diario_estimado")) {
            const raw = p.consumo_diario_estimado;
            if (raw == null) {
                p.consumo_diario_estimado = null;
            }
            else {
                const n = Math.max(0, Math.ceil(Number(raw)));
                p.consumo_diario_estimado = n;
            }
        }
        db.prepare(`UPDATE productos SET ${sets.join(", ")} WHERE id = @id`).run(p);
        return { ok: true };
    }
    catch (e) {
        return { ok: false, error: e?.message ?? String(e) };
    }
    finally {
        db.close();
    }
}
function deleteProduct(slug, id) {
    try {
        const db = openDB((0, paths_1.dbPathForSlug)(slug));
        db.prepare(`UPDATE productos SET activo = 0 WHERE id = ?`).run(id);
        db.close();
        return { ok: true };
    }
    catch (e) {
        return { ok: false, error: e?.message ?? String(e) };
    }
}
function adjustProductStock(slug, p) {
    try {
        const db = openDB((0, paths_1.dbPathForSlug)(slug));
        db.prepare(`
      INSERT INTO ajustes_stock (producto_id, cantidad, razon, nota, usuario_id)
      VALUES (@producto_id, @cantidad, @razon, @nota, @usuario_id)
    `).run({
            producto_id: p.producto_id,
            cantidad: p.cantidad,
            razon: p.razon,
            nota: p.nota ?? null,
            usuario_id: p.usuario_id ?? null,
        });
        db.close();
        return { ok: true };
    }
    catch (e) {
        return { ok: false, error: e?.message ?? String(e) };
    }
}
/* =============== Usuarios =============== */
function listUsers(slug) {
    const db = openDB((0, paths_1.dbPathForSlug)(slug));
    try {
        const ucols = getExistingColumns(db, "usuarios");
        if (ucols.length === 0)
            return [];
        const hasLogs = getExistingColumns(db, "logs_actividad").length > 0;
        const baseCols = [
            "id", "nombre", "username", "email", "rol", "activo",
            ...(ucols.includes("creado_en") ? ["creado_en"] : []),
        ].filter(c => ucols.includes(c));
        const sql = `
      SELECT ${baseCols.map(c => "u." + c).join(", ")}
      ${hasLogs
            ? `,
            (SELECT strftime('%Y-%m-%dT%H:%M:%SZ', MAX(l.fecha))
              FROM logs_actividad l
              WHERE l.usuario_id = u.id AND l.accion = 'LOGIN'
            ) AS last_access_at
          `
            : ", NULL AS last_access_at"}
      FROM usuarios u
      ORDER BY u.nombre COLLATE NOCASE
    `;
        const rows = db.prepare(sql).all();
        return rows.map(r => ({
            id: r.id,
            fullName: r.nombre ?? "",
            username: r.username ?? "",
            email: r.email ?? null,
            role: String(r.rol ?? "").toLowerCase(), // 'admin' | 'vendedor'
            enabled: Number(r.activo ?? 1) === 1,
            createdAt: r.creado_en ?? null,
            lastAccessAt: r.last_access_at ?? null,
        }));
    }
    finally {
        db.close();
    }
}
function countUsers(slug) {
    const db = openDB((0, paths_1.dbPathForSlug)(slug));
    try {
        const row = db.prepare("SELECT COUNT(*) AS n FROM usuarios").get();
        return Number(row?.n ?? 0);
    }
    finally {
        db.close();
    }
}
function createUser(slug, u) {
    try {
        const db = openDB((0, paths_1.dbPathForSlug)(slug));
        const roleDB = (u.role || "vendedor").toUpperCase(); // ADMIN | VENDEDOR
        const hash = (0, crypto_1.hashPassword)(u.password);
        db.prepare(`
      INSERT INTO usuarios (nombre, username, email, rol, password_hash, activo)
      VALUES (@nombre, @username, @email, @rol, @hash, @activo)
    `).run({
            nombre: u.fullName,
            username: u.username,
            email: u.email ?? null,
            rol: roleDB,
            hash,
            activo: u.enabled === false ? 0 : 1,
        });
        db.close();
        return { ok: true };
    }
    catch (e) {
        return { ok: false, error: e?.message ?? String(e) };
    }
}
function updateUser(slug, id, patch) {
    const db = openDB((0, paths_1.dbPathForSlug)(slug));
    try {
        const cols = getExistingColumns(db, "usuarios");
        if (cols.length === 0)
            return { ok: false, error: "Tabla 'usuarios' no existe" };
        const sets = [];
        const params = { id };
        if (patch.fullName !== undefined && cols.includes("nombre")) {
            sets.push("nombre = @nombre");
            params.nombre = patch.fullName;
        }
        if (patch.username !== undefined && cols.includes("username")) {
            sets.push("username = @username");
            params.username = patch.username;
        }
        if (patch.email !== undefined && cols.includes("email")) {
            sets.push("email = @email");
            params.email = patch.email;
        }
        if (patch.role !== undefined && cols.includes("rol")) {
            sets.push("rol = @rol");
            params.rol = String(patch.role).toUpperCase();
        }
        if (patch.enabled !== undefined && cols.includes("activo")) {
            sets.push("activo = @activo");
            params.activo = patch.enabled ? 1 : 0;
        }
        if (patch.password !== undefined && cols.includes("password_hash")) {
            sets.push("password_hash = @hash");
            params.hash = (0, crypto_1.hashPassword)(patch.password);
        }
        if (cols.includes("actualizado_en"))
            sets.push("actualizado_en = CURRENT_TIMESTAMP");
        if (!sets.length)
            return { ok: true };
        db.prepare(`UPDATE usuarios SET ${sets.join(", ")} WHERE id = @id`).run(params);
        return { ok: true };
    }
    catch (e) {
        return { ok: false, error: e?.message ?? String(e) };
    }
    finally {
        db.close();
    }
}
function changeUserPassword(slug, id, newPassword) {
    try {
        const db = openDB((0, paths_1.dbPathForSlug)(slug));
        const hash = (0, crypto_1.hashPassword)(newPassword);
        db.prepare(`UPDATE usuarios SET password_hash = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?`)
            .run(hash, id);
        db.close();
        return { ok: true };
    }
    catch (e) {
        return { ok: false, error: e?.message ?? String(e) };
    }
}
function deleteUser(slug, id) {
    try {
        const db = openDB((0, paths_1.dbPathForSlug)(slug));
        db.prepare("DELETE FROM usuarios WHERE id = ?").run(id);
        db.close();
        return { ok: true };
    }
    catch (e) {
        return { ok: false, error: e?.message ?? String(e) };
    }
}
function listCategories(slug) {
    const db = openDB((0, paths_1.dbPathForSlug)(slug));
    const rows = db.prepare(`SELECT id, nombre, color_hex FROM categorias ORDER BY nombre COLLATE NOCASE`).all();
    db.close();
    return rows.map(r => ({ id: r.id, nombre: r.nombre, color_hex: r.color_hex ?? null }));
}
function createCategory(slug, p) {
    try {
        const db = openDB((0, paths_1.dbPathForSlug)(slug));
        const info = db.prepare(`INSERT INTO categorias (nombre, color_hex) VALUES (?, ?)`).run(p.nombre, p.color_hex ?? null);
        db.close();
        return { ok: true, id: info.lastInsertRowid };
    }
    catch (e) {
        return { ok: false, error: e?.message ?? String(e) };
    }
}
function updateCategory(slug, id, patch) {
    try {
        const db = openDB((0, paths_1.dbPathForSlug)(slug));
        const sets = [];
        const p = { id };
        if (patch.nombre !== undefined) {
            sets.push("nombre = @nombre");
            p.nombre = patch.nombre;
        }
        if (patch.color_hex !== undefined) {
            sets.push("color_hex = @color_hex");
            p.color_hex = patch.color_hex;
        }
        if (!sets.length) {
            db.close();
            return { ok: true };
        }
        db.prepare(`UPDATE categorias SET ${sets.join(", ")} WHERE id = @id`).run(p);
        db.close();
        return { ok: true };
    }
    catch (e) {
        return { ok: false, error: e?.message ?? String(e) };
    }
}
function deleteCategory(slug, id) {
    try {
        const db = openDB((0, paths_1.dbPathForSlug)(slug));
        db.prepare(`DELETE FROM categorias WHERE id = ?`).run(id);
        db.close();
        return { ok: true };
    }
    catch (e) {
        return { ok: false, error: e?.message ?? String(e) };
    }
}
function closeCompanyDb(_slug) { }
// ========= REPORTES =========
function getReports(slug, p) {
    const db = openDB((0, paths_1.dbPathForSlug)(slug));
    try {
        const biz = db.prepare(`SELECT moneda FROM negocio ORDER BY id LIMIT 1`).get();
        const currency = String(biz?.moneda || "CLP");
        const oneDay = 24 * 3600 * 1000;
        const now = new Date();
        const toDate = p?.to ? new Date(p.to + "T23:59:59") : now;
        // ------- rango según modo -------
        let mode = p?.mode ?? "total";
        let fromDate;
        if (mode === "week") {
            fromDate = new Date(toDate.getTime() - 6 * oneDay); // últimos 7 días
        }
        else if (mode === "month") {
            const d = new Date(toDate);
            d.setMonth(d.getMonth() - 11, 1);
            d.setHours(0, 0, 0, 0);
            fromDate = d; // ~12 meses
        }
        else if (mode === "year") {
            const d = new Date(toDate.getFullYear() - 4, 0, 1);
            d.setHours(0, 0, 0, 0);
            fromDate = d; // 5 años
        }
        else { // total
            const minRow = db.prepare(`SELECT MIN(date(fecha,'localtime')) AS d FROM ventas`).get();
            fromDate = minRow?.d ? new Date(minRow.d + "T00:00:00") : new Date(toDate.getFullYear(), toDate.getMonth(), 1);
            mode = "total";
        }
        const toISO = toDate.toISOString().slice(0, 10);
        const fromISO = fromDate.toISOString().slice(0, 10);
        // rango anterior (para %)
        const lenDays = Math.max(1, Math.round((new Date(toISO).getTime() - new Date(fromISO).getTime()) / oneDay) + 1);
        const prevTo = new Date(new Date(fromISO + "T00:00:00").getTime() - oneDay);
        const prevFrom = new Date(prevTo.getTime() - (lenDays - 1) * oneDay);
        const prevToISO = prevTo.toISOString().slice(0, 10);
        const prevFromISO = prevFrom.toISOString().slice(0, 10);
        // ===== KPIs =====
        const vNow = db.prepare(`
      SELECT COALESCE(SUM(total),0) AS revenue, COUNT(*) AS tx
      FROM ventas
      WHERE date(fecha,'localtime') BETWEEN date(@from) AND date(@to)
    `).get({ from: fromISO, to: toISO });
        const viNow = db.prepare(`
      SELECT
        COALESCE(SUM(vi.subtotal),0)                                  AS revenue_items,
        COALESCE(SUM(COALESCE(vi.costo_unit_ref,0) * vi.cantidad),0)  AS cost_items,
        COALESCE(SUM(vi.cantidad),0)                                  AS units
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id
      WHERE date(v.fecha,'localtime') BETWEEN date(@from) AND date(@to)
    `).get({ from: fromISO, to: toISO });
        const vPrev = db.prepare(`
      SELECT COALESCE(SUM(total),0) AS revenue, COUNT(*) AS tx
      FROM ventas
      WHERE date(fecha,'localtime') BETWEEN date(@from) AND date(@to)
    `).get({ from: prevFromISO, to: prevToISO });
        const viPrev = db.prepare(`
      SELECT
        COALESCE(SUM(vi.subtotal),0)                                  AS revenue_items,
        COALESCE(SUM(COALESCE(vi.costo_unit_ref,0) * vi.cantidad),0)  AS cost_items,
        COALESCE(SUM(vi.cantidad),0)                                  AS units
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id
      WHERE date(v.fecha,'localtime') BETWEEN date(@from) AND date(@to)
    `).get({ from: prevFromISO, to: prevToISO });
        const revenueNow = Number(vNow?.revenue || 0);
        const txNow = Number(vNow?.tx || 0);
        const unitsNow = Number(viNow?.units || 0);
        const gpNow = Number(viNow?.revenue_items || 0) - Number(viNow?.cost_items || 0);
        const avgTicket = txNow > 0 ? revenueNow / txNow : 0;
        const revenuePrev = Number(vPrev?.revenue || 0);
        const txPrev = Number(vPrev?.tx || 0);
        const unitsPrev = Number(viPrev?.units || 0);
        const gpPrev = Number(viPrev?.revenue_items || 0) - Number(viPrev?.cost_items || 0);
        const pct = (nowV, prevV) => prevV > 0 ? ((nowV - prevV) / prevV) * 100
            : (nowV > 0 ? null : 0);
        const trend = [];
        const wd = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
        if (mode === "week") {
            const rows = db.prepare(`
        SELECT date(fecha,'localtime') AS d, COALESCE(SUM(total),0) AS t
        FROM ventas
        WHERE date(fecha,'localtime') BETWEEN date(@from) AND date(@to)
        GROUP BY d
      `).all({ from: fromISO, to: toISO });
            const map = new Map(rows.map(r => [r.d, Number(r.t || 0)]));
            for (let i = 6; i >= 0; i--) {
                const d = new Date(toDate.getTime() - i * oneDay);
                const key = d.toISOString().slice(0, 10);
                trend.push({ key, label: wd[d.getDay()], total: map.get(key) ?? 0 });
            }
        }
        else if (mode === "month") {
            const rows = db.prepare(`
        SELECT strftime('%Y-%m', fecha, 'localtime') AS ym, COALESCE(SUM(total),0) AS t
        FROM ventas
        WHERE date(fecha,'localtime') BETWEEN date(@from) AND date(@to)
        GROUP BY ym
      `).all({ from: fromISO, to: toISO });
            const map = new Map(rows.map(r => [r.ym, Number(r.t || 0)]));
            for (let i = 11; i >= 0; i--) {
                const d = new Date(toDate.getFullYear(), toDate.getMonth() - i, 1);
                const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                const mlabel = d.toLocaleDateString(undefined, { month: "short" }).replace(".", "");
                trend.push({ key: ym, label: mlabel, total: map.get(ym) ?? 0 });
            }
        }
        else { // "year" o "total": por año
            const rows = db.prepare(`
        SELECT strftime('%Y', fecha, 'localtime') AS y, COALESCE(SUM(total),0) AS t
        FROM ventas
        ${mode === "total" ? "" : "WHERE date(fecha,'localtime') BETWEEN date(@from) AND date(@to)"}
        GROUP BY y ORDER BY y
      `).all(mode === "total" ? {} : { from: fromISO, to: toISO });
            const map = new Map(rows.map(r => [r.y, Number(r.t || 0)]));
            const startY = mode === "total"
                ? (rows.length ? Number(rows[0].y) : toDate.getFullYear())
                : toDate.getFullYear() - 4;
            const endY = toDate.getFullYear();
            for (let y = startY; y <= endY; y++) {
                const ys = String(y);
                trend.push({ key: ys, label: ys, total: map.get(ys) ?? 0 });
            }
        }
        // ===== Categorías / Top / Pagos en el rango =====
        const categories = db.prepare(`
      SELECT COALESCE(c.nombre,'Sin categoría') AS name,
             c.color_hex AS color,
             COALESCE(SUM(vi.subtotal),0)      AS total
      FROM venta_items vi
      JOIN ventas v    ON v.id = vi.venta_id
      LEFT JOIN productos p ON p.id = vi.producto_id
      LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE date(v.fecha,'localtime') BETWEEN date(@from) AND date(@to)
      GROUP BY name, color
      HAVING total > 0
      ORDER BY total DESC
      LIMIT 8
    `).all({ from: fromISO, to: toISO }).map(r => ({
            name: r.name ?? "Sin categoría",
            color: r.color ?? null,
            total: Number(r.total || 0)
        }));
        const topProducts = db.prepare(`
      SELECT p.id, p.nombre, p.sku,
             COALESCE(c.nombre,'Sin categoría') AS categoria,
             c.color_hex                         AS categoria_color,
             COALESCE(SUM(vi.cantidad),0)        AS units,
             COALESCE(SUM(vi.subtotal),0)        AS revenue
      FROM venta_items vi
      JOIN ventas v     ON v.id = vi.venta_id
      JOIN productos p  ON p.id = vi.producto_id
      LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE date(v.fecha,'localtime') BETWEEN date(@from) AND date(@to)
      GROUP BY p.id
      HAVING revenue > 0
      ORDER BY revenue DESC
      LIMIT 5
    `).all({ from: fromISO, to: toISO }).map(r => ({
            id: r.id,
            nombre: r.nombre ?? "",
            sku: r.sku ?? null,
            categoria: r.categoria ?? "Sin categoría",
            categoria_color: r.categoria_color ?? null,
            units: Number(r.units || 0),
            revenue: Number(r.revenue || 0),
        }));
        const payments = db.prepare(`
      SELECT v.metodo_cobro AS method, COALESCE(SUM(v.total),0) AS total
      FROM ventas v
      WHERE date(v.fecha,'localtime') BETWEEN date(@from) AND date(@to)
      GROUP BY v.metodo_cobro
      ORDER BY total DESC
    `).all({ from: fromISO, to: toISO }).map(r => ({ method: r.method, total: Number(r.total || 0) }));
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
            trend,
            categories,
            topProducts,
            payments,
        };
    }
    finally {
        db.close();
    }
}
function exportAccountingXlsx(slug, p) {
    const db = openDB((0, paths_1.dbPathForSlug)(slug));
    try {
        if (!p?.periods?.length)
            return { ok: false, error: "Sin periodos a exportar" };
        if (!p.filePath)
            return { ok: false, error: "Ruta de salida inválida" };
        // IVA por defecto 
        let ivaPct = 19;
        try {
            const row = db.prepare(`SELECT iva_por_defecto FROM negocio ORDER BY id LIMIT 1`).get();
            const n = Number(row?.iva_por_defecto);
            if (Number.isFinite(n) && n >= 0 && n <= 100)
                ivaPct = n;
        }
        catch { }
        // Helpers
        const docType = "BOLETA/FACTURA";
        const round0 = (n) => Math.round(n);
        const calcNetoIVA = (total) => {
            if (ivaPct <= 0)
                return { neto: total, iva: 0 };
            const neto = Math.round(total / (1 + ivaPct / 100));
            const iva = total - neto;
            return { neto, iva };
        };
        const toLocalDate = (s) => {
            const d = new Date(s);
            return isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
        };
        // Workbook
        const wb = XLSX.utils.book_new();
        for (const sel of p.periods) {
            const from = String(sel.from);
            const to = String(sel.to);
            const label = (sel.label || `${from}→${to}`).slice(0, 28); // 31 max en Excel; dejamos margen
            // === Ventas (cabecera) ===
            const ventas = db.prepare(`
        SELECT
          date(v.fecha,'localtime') AS f,
          v.correlativo_interno     AS corr,
          v.cliente_nombre          AS cliente,
          v.metodo_cobro            AS metodo,
          v.subtotal                AS subtotal,
          v.descuento_total         AS descuento,
          v.total                   AS total,
          v.observacion             AS obs
        FROM ventas v
        WHERE date(v.fecha,'localtime') BETWEEN date(@from) AND date(@to)
        ORDER BY v.fecha ASC, v.id ASC
      `).all({ from, to });
            const rowsVentas = [
                [
                    "Fecha",
                    "Tipo Doc",
                    "Folio/Correlativo",
                    "RUT Cliente",
                    "Razón Social / Cliente",
                    "Exento",
                    "Neto",
                    `IVA (${ivaPct}%)`,
                    "Total",
                    "Método de Cobro",
                    "Observación",
                ],
            ];
            let sumExento = 0, sumNeto = 0, sumIVA = 0, sumTotal = 0;
            for (const v of ventas) {
                const total = Number(v.total || 0);
                const { neto, iva } = calcNetoIVA(total);
                const exento = 0;
                rowsVentas.push([
                    toLocalDate(v.f),
                    docType,
                    v.corr ?? "",
                    "",
                    v.cliente ?? "",
                    round0(exento),
                    round0(neto),
                    round0(iva),
                    round0(total),
                    v.metodo ?? "",
                    v.obs ?? "",
                ]);
                sumExento += exento;
                sumNeto += neto;
                sumIVA += iva;
                sumTotal += total;
            }
            // Fila total
            rowsVentas.push([]);
            rowsVentas.push([
                "", "", "", "", "TOTALES",
                round0(sumExento),
                round0(sumNeto),
                round0(sumIVA),
                round0(sumTotal),
                "", "",
            ]);
            const wsVentas = XLSX.utils.aoa_to_sheet(rowsVentas);
            XLSX.utils.book_append_sheet(wb, wsVentas, `Ventas ${label}`.slice(0, 31));
            // === Detalle de ítems ===
            if (p.includeItems) {
                // detalle “auditable” para el contador: fecha, folio, producto, cant, p.unit, dcto, subtotal, costo ref, margen
                const items = db.prepare(`
          SELECT
            date(v.fecha,'localtime')                  AS f,
            v.correlativo_interno                      AS corr,
            p.id                                       AS producto_id,
            p.nombre                                   AS producto_nombre,
            vi.cantidad                                AS qty,
            vi.precio_unit                             AS precio_unit,
            vi.descuento                               AS descuento,
            vi.subtotal                                AS subtotal,
            vi.costo_unit_ref                          AS costo_unit_ref
          FROM venta_items vi
          JOIN ventas v ON v.id = vi.venta_id
          LEFT JOIN productos p ON p.id = vi.producto_id
          WHERE date(v.fecha,'localtime') BETWEEN date(@from) AND date(@to)
          ORDER BY v.fecha ASC, v.id ASC, vi.id ASC
        `).all({ from, to });
                const rowsItems = [
                    ["Fecha", "Folio", "Producto ID", "Producto", "Cantidad", "P.Unit", "Descuento", "Subtotal", "Costo Ref", "Margen $", "Margen %"],
                ];
                for (const it of items) {
                    const sub = Number(it.subtotal || 0);
                    const costo = Number(it.costo_unit_ref || 0) * Number(it.qty || 0);
                    const margen = sub - costo;
                    const mpct = sub > 0 ? (margen / sub) * 100 : null;
                    rowsItems.push([
                        toLocalDate(it.f),
                        it.corr ?? "",
                        it.producto_id ?? "",
                        it.producto_nombre ?? "",
                        Number(it.qty || 0),
                        Number(it.precio_unit || 0),
                        Number(it.descuento || 0),
                        Number(sub),
                        Number(it.costo_unit_ref || 0),
                        Math.round(margen),
                        mpct != null ? Number(mpct.toFixed(2)) : null,
                    ]);
                }
                const wsItems = XLSX.utils.aoa_to_sheet(rowsItems);
                XLSX.utils.book_append_sheet(wb, wsItems, `Items ${label}`.slice(0, 31));
            }
        }
        // Guardar
        try {
            node_fs_1.default.mkdirSync(node_path_1.default.dirname(p.filePath), { recursive: true });
        }
        catch { }
        XLSX.writeFile(wb, p.filePath);
        return { ok: true, dest: p.filePath };
    }
    catch (e) {
        return { ok: false, error: e?.message ?? String(e) };
    }
    finally {
        db.close();
    }
}
