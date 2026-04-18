import { useEffect, useMemo, useState, useCallback, useDeferredValue, useRef } from "react";
import { useParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { Toaster, toast } from "react-hot-toast";
import {
  Package as IconBox,
  Search as IconSearch,
  Plus as IconPlus,
  Pencil as IconEdit,
  Trash2 as IconTrash,
  Settings as IconSettings,
  CheckCircle2 as IconOk,
  AlertTriangle as IconWarn,
  XCircle as IconCrit,
  Clock as IconClock,
  Save as IconSave,
  Wrench as IconAdjust,
  FolderCog as IconCats,
  Bell as IconBell,
  ArrowUpNarrowWide as IconSortAsc,
  ArrowDownNarrowWide as IconSortDesc,
  Palette as IconPalette,
} from "lucide-react";
import "../styles/products.css";
import {
  getAlertDefaults,
  saveAlertDefaults,
  type AlertDefaults,
} from "../alertDefaults";

/* ================== Tipos ================== */
type UnidadTiempo = "dias" | "semanas" | "meses";
type Category = { id: number; nombre: string; color_hex: string | null };

type Prod = {
  id: number;
  nombre: string;
  precio_venta: number;
  stock_actual: number;
  precio_compra?: number | null;
  categoria?: string | null;
  categoria_id?: number | null;
  sku?: string | null;
  codigo_barras?: string | null;
  // alertas
  stock_minimo?: number | null;
  consumo_diario_estimado?: number | null;
  alerta_tiempo_unidad?: UnidadTiempo | null;
  alerta_tiempo_cantidad?: number | null;
};

const api = (window as any).api ?? {};
const nfInt = new Intl.NumberFormat("es-CL");
const nfMoney = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

// columnas 
const COLS = 9;

// Color por defecto de categorías
const DEFAULT_CAT_COLOR = "#D07A43";



/* ================== API helpers ================== */
async function listProductsAPI(slug: string, q: string): Promise<Prod[]> {
  if (typeof api.listProducts === "function") {
    try {
      const r = await api.listProducts({ slug, q });
      if (Array.isArray(r)) return r;
      if (Array.isArray(r?.data)) return r.data;
    } catch {}
    try {
      const r = await api.listProducts(slug, q);
      if (Array.isArray(r)) return r;
      if (Array.isArray(r?.data)) return r.data;
    } catch {}
  }
  return [];
}

function norm(s?: string | null) {
  return ((s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")).toLowerCase();
}


function readableOn(bg: string) {
  const hex = bg.replace('#','');
  const r = parseInt(hex.slice(0,2),16);
  const g = parseInt(hex.slice(2,4),16);
  const b = parseInt(hex.slice(4,6),16);
  const L = 0.2126*r + 0.7152*g + 0.0722*b; 
  return L > 140 ? '#111' : '#fff';
}

async function listCategoriesAPI(slug: string): Promise<Category[]> {
  try { const r = await api.listCategories({ slug }); if (Array.isArray(r)) return r; } catch {}
  return [];
}

async function createProductAPI(
  slug: string,
  product: { nombre: string; precio_venta: number; stock_inicial: number }
) {
  if (typeof api.createProduct !== "function") throw new Error("createProduct no disponible en preload");
  try {
    const r = await api.createProduct({ slug, product });
    if (r?.ok === false) throw new Error(r.error || "No se pudo crear");
    return r;
  } catch {}
  const r2 = await api.createProduct(slug, product);
  if (r2?.ok === false) throw new Error(r2.error || "No se pudo crear");
  return r2;
}

async function updateProductAPI(slug: string, id: number, patch: Partial<Prod>) {
  if (typeof api.updateProduct !== "function") throw new Error("updateProduct no disponible en preload");
  try {
    const r = await api.updateProduct({ slug, id, patch });
    if (r?.ok === false) throw new Error(r.error || "No se pudo actualizar");
    return r;
  } catch {}
  const r2 = await api.updateProduct(slug, id, patch);
  if (r2?.ok === false) throw new Error(r2.error || "No se pudo actualizar");
  return r2;
}

async function forecastProductAPI(slug: string, producto_id: number, params: {
  windowDays: number; horizonDays: number; leadTimeDays: number; serviceLevel: number;
}) {
  if (typeof api.stockForecast === "function") {
    try {
      const r = await api.stockForecast({ slug, producto_id, ...params });
      if (r?.ok === false) throw new Error(r.error || "No se pudo predecir");
      return r;
    } catch {}
  }
  // fallback
  const r2 = await api.forecastProductStock?.({ slug, producto_id, ...params });
  if (r2?.ok === false) throw new Error(r2.error || "No se pudo predecir");
  return r2;
}

function derivedMin(
  consumo?: number | null,
  unidad?: UnidadTiempo | null,
  cant?: number | null
): number | null {
  const c = Math.max(0, Number(consumo || 0));
  const d = daysFrom(unidad ?? null, cant ?? null);
  if (c > 0 && d > 0) return Math.ceil(c * d);
  return null;
}

async function deleteProductAPI(slug: string, id: number) {
  if (typeof api.deleteProduct !== "function") throw new Error("deleteProduct no disponible en preload");
  try {
    const r = await api.deleteProduct({ slug, id });
    if (r?.ok === false) throw new Error(r.error || "No se pudo eliminar");
    return r;
  } catch {}
  const r2 = await api.deleteProduct(slug, id);
  if (r2?.ok === false) throw new Error(r2.error || "No se pudo eliminar");
  return r2;
}

async function adjustStockAPI(slug: string, producto_id: number, delta: number) {
  if (!delta) return { ok: true };
  return api.adjustProductStock({
    slug,
    producto_id,
    cantidad: delta,
    razon: "INVENTARIO",
    nota: "Ajuste desde Productos",
  });
}

/* ===== color utils ===== */
function hexToRgba(hex?: string | null, alpha = 1) {
  const fallback = `rgba(153,153,153,${alpha})`;
  if (!hex) return fallback;
  let c = hex.trim();
  if (!c) return fallback;
  if (c.startsWith("#")) c = c.slice(1);
  if (c.length === 3) c = c.split("").map(x => x + x).join("");
  if (c.length !== 6) return fallback;
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ========= Post-proceso tras importar: defaults + categoría ========= */
async function normalizeAfterImport(slug: string) {
  const [allProducts, cats0] = await Promise.all([
    listProductsAPI(slug, ""),
    listCategoriesAPI(slug),
  ]);
  const def = getAlertDefaults(slug);
  const cats = [...cats0];

  const findCatId = (name?: string | null) => {
    if (!name) return null;
    const n = name.trim().toLowerCase();
    if (!n || n === "—") return null;
    const hit = cats.find(c => (c.nombre || "").trim().toLowerCase() === n);
    return hit ? hit.id : null;
  };

  const ensureCatId = async (name?: string | null) => {
    const existing = findCatId(name);
    if (existing) return existing;
    if (!name) return null;
    // categoriia gris por defecto
    try {
      await api.createCategory({ slug, data: { nombre: name.trim(), color_hex: "#808080" } });
    } catch {}
    // recargar y devolver el id
    const fresh = await listCategoriesAPI(slug);
    cats.splice(0, cats.length, ...fresh);
    return findCatId(name);
  };

  for (const p of allProducts) {
    const patch: Partial<Prod> = {};

    // Defaults de alertas (sólo si NO tienen nada configurado)
    const missingAllAlerts =
      p.stock_minimo == null &&
      p.consumo_diario_estimado == null &&
      (p.alerta_tiempo_unidad == null || p.alerta_tiempo_unidad === undefined) &&
      (p.alerta_tiempo_cantidad == null || p.alerta_tiempo_cantidad === undefined);

    if (missingAllAlerts) {
      Object.assign(patch, defaultsToPatch(def));
    }

    if ((p.categoria_id == null || Number.isNaN(p.categoria_id)) && p.categoria) {
      const id = await ensureCatId(p.categoria);
      if (id) patch.categoria_id = id;
    }

    if (Object.keys(patch).length > 0) {
      try { await updateProductAPI(slug, p.id, patch); } catch {}
    }
  }
}


/* ===== helper: defaults patch ===== */
function defaultsToPatch(def: AlertDefaults) {
  return {
    stock_minimo: def.stock_minimo ?? null,
    consumo_diario_estimado: null,
    alerta_tiempo_unidad: null,
    alerta_tiempo_cantidad: null,
  };
}


/* ================== Helpers de alertas ================== */
function daysFrom(unit?: UnidadTiempo | null, qty?: number | null) {
  const n = Math.max(0, Number(qty || 0));
  if (unit === "semanas") return n * 7;
  if (unit === "meses") return n * 30;
  return n;
}

type AlertBadges = { crit: boolean; warn: boolean };

function mainThreshold(p: Prod): number | null {
  const base =
    p.stock_minimo != null && Number.isFinite(p.stock_minimo)
      ? Number(p.stock_minimo)
      : null;

  const tiempo = derivedMin(
    p.consumo_diario_estimado ?? null,
    p.alerta_tiempo_unidad ?? null,
    p.alerta_tiempo_cantidad ?? null
  );

  if (base == null && tiempo == null) return null;
  if (base == null) return tiempo!;
  if (tiempo == null) return base;
  return Math.max(base, tiempo);
}

function getAlerts(p: Prod): AlertBadges {
  const stock = Number(p.stock_actual || 0);
  const crit = stock <= 0;
  const th = mainThreshold(p);
  const warn = th != null ? stock < th : false;
  return { crit, warn };
}

/* ===== Paso calculado basado en stock actual ===== */
function stepFromCurrent(n: number): number {
  const cur = Math.max(0, Math.floor(n));
  if (cur < 10) return 0;
  const magnitude = Math.floor(Math.log10(cur));
  if (magnitude === 1) return 10;
  return Math.pow(10, magnitude - 1);
}

/* ===== Promedio diario ===== */
function avgDailyInt(n: any) {
  const x = Math.max(0, Number(n || 0));
  return Math.ceil(x);
}

/* ================== Página ================== */

export default function Products() {
  const { slug = "" } = useParams();

  const [rows, setRows] = useState<Prod[]>([]);
  const [loading, setLoading] = useState(false);
  
  // ======= Settings modal (tabs) =======
  const [openSettings, setOpenSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"alerts" | "categories">("alerts");
  const [forecastTab, setForecastTab] = useState<'basic'|'advanced'>('basic');


  // defaults de alertas (por empresa)
  const [cfg, setCfg] = useState<AlertDefaults>(() => getAlertDefaults(slug));
  useEffect(() => { setCfg(getAlertDefaults(slug)); }, [slug]);

  // categorías (para filtro y formularios)
  const [categories, setCategories] = useState<Category[]>([]);
  const reloadCategories = useCallback(async () => {
    const list = await listCategoriesAPI(slug);
    setCategories(list);
  }, [slug]);
  useEffect(() => { reloadCategories(); }, [reloadCategories]);

  // búsqueda + filtro categoría
  const [q, setQ] = useState("");
  const qDeferred = useDeferredValue(q);
  const [cat, setCat] = useState<string>("__all__");

  // Mostrar umbral (stock_actual/umbral)
  const [showThreshold, setShowThreshold] = useState<boolean>(false);

  // selección múltiple
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const isSelected = useCallback((id: number) => selectedIds.has(id), [selectedIds]);
  const clearSelection = () => setSelectedIds(new Set());
  const toggleOne = (id: number) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // ordenar
  type SortBy = "nombre" | "categoria" | "stock" | "precio" | "margen";
  const [sortBy, setSortBy] = useState<SortBy>("nombre");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // menú por fila
  const [menuId, setMenuId] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const openRowMenuFromButton = (btnEl: HTMLElement, id: number) => {
    const rect = btnEl.getBoundingClientRect();
    const menuWidth = 232;
    const menuHeight = 200;
    const m = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = Math.round(rect.left - menuWidth - m);
    let top = Math.round(rect.top);

    if (left < 8) left = Math.round(rect.right - menuWidth);

    if (top + menuHeight > vh - 8) top = vh - menuHeight - 8;
    if (top < 8) top = 8;

    setMenuPos({ top, left });
    setMenuId(id);
  };

  useEffect(() => {
    const close = () => { setMenuId(null); setMenuPos(null); };
    const clickAway = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest(".row-menu .menu")) return;
      if (target.closest(".row-menu .icon")) return;
      if (target.closest(".menu.portal")) return;
      close();
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("click", clickAway);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("click", clickAway);
    };
  }, []);

  // modal crear
  const [openCreate, setOpenCreate] = useState(false);
  const [pName, setPName] = useState("");
  const [pSKU, setPSKU] = useState("");
  const [pPrecioCompra, setPPrecioCompra] = useState<string>("");
  const [pPrice, setPPrice] = useState<string>("1200");
  const [pStock, setPStock] = useState<string>("0");
  const [pCatId, setPCatId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // modal editar
  const [openEdit, setOpenEdit] = useState(false);
  const [editTarget, setEditTarget] = useState<Prod | null>(null);
  const [eNombre, setENombre] = useState("");
  const [eSKU, setESKU] = useState("");
  const [eCategoriaId, setECategoriaId] = useState<number | null>(null);
  const [ePrecioCompra, setEPrecioCompra] = useState<string>("");
  const [ePrecioVenta, setEPrecioVenta] = useState<string>("");

  // modal alertas por producto
  const [openAlerts, setOpenAlerts] = useState(false);
  const [aStockMin, setAStockMin] = useState<string>("");
  const [aConsumoDia, setAConsumoDia] = useState<string>("");
  const [aUnidad, setAUnidad] = useState<UnidadTiempo>("semanas");
  const [aCant, setACant] = useState<number>(2);

  // modal ajustar stock
  const [openAdjust, setOpenAdjust] = useState(false);
  const [currentStockBase, setCurrentStockBase] = useState<number>(0);
  const [deltaStr, setDeltaStr] = useState<string>("0");               
  const [finalStr, setFinalStr] = useState<string>("0");

  // modal: Predicción de stock
  const [openForecast, setOpenForecast] = useState(false);
  const [forecastTarget, setForecastTarget] = useState<Prod | null>(null);

  // parámetros del cálculo
  const [fWindow, setFWindow] = useState<number>(90);
  const [fHorizon, setFHorizon] = useState<number>(30);
  const [fLeadTime, setFLeadTime] = useState<number>(7);
  const [fService, setFService] = useState<number>(0.90);

  // resultado
  const [forecastRes, setForecastRes] = useState<any | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  // eliminar
  const [openDelete, setOpenDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Prod | null>(null);

  // acciones masivas
  const [openBulkAlerts, setOpenBulkAlerts] = useState(false);
  const [bulkStockMinEn, setBulkStockMinEn] = useState(false);
  const [bulkStockMin, setBulkStockMin] = useState<string>("");

  const [bulkConsumoEn, setBulkConsumoEn] = useState(false);
  const [bulkConsumo, setBulkConsumo] = useState<string>("");

  const [bulkCoberturaEn, setBulkCoberturaEn] = useState(false);
  const [bulkUnidad, setBulkUnidad] = useState<UnidadTiempo>("semanas");
  const [bulkCant, setBulkCant] = useState<number>(2);

  const [openBulkDelete, setOpenBulkDelete] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const list = await listProductsAPI(slug, "");
      setRows(list);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al cargar productos");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { refresh(); }, [refresh]);

  const catColorById = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of categories) if (c.color_hex) m.set(c.id, c.color_hex);
    return m;
  }, [categories]);

  const catNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of categories) m.set(c.id, c.nombre || "");
    return m;
  }, [categories]);


  const filtered = useMemo(() => {
    const qn = norm(qDeferred.trim());

    const byQ = qn
      ? rows.filter(r => {
          const name = norm(r.nombre);
          const sku = norm(r.sku);
          const barcode = norm(r.codigo_barras);
          const catName = r.categoria
            ? norm(r.categoria)
            : (r.categoria_id != null ? norm(catNameById.get(r.categoria_id) || "") : "");
          return (
            name.includes(qn) ||
            sku.includes(qn) ||
            barcode.includes(qn) ||
            catName.includes(qn)
          );
        })
      : rows;

    if (cat === "__all__") return byQ;
    return byQ.filter(r => String(r.categoria_id ?? "") === cat);
  }, [rows, qDeferred, cat, catNameById]);


  // ordenar
  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const val = (r: Prod) => {
      switch (sortBy) {
        case "nombre": return (r.nombre || "").toLowerCase();
        case "categoria": {
          const nm = r.categoria ?? (r.categoria_id != null ? catNameById.get(r.categoria_id) : "");
          return (nm || "").toLowerCase();
        }
        case "stock": return Number(r.stock_actual) || 0;
        case "precio": return Number(r.precio_venta) || 0;
        case "margen": {
          const compra = r.precio_compra ?? null;
          const venta = r.precio_venta ?? 0;
          const m = compra != null ? ((venta - compra) / (venta || 1)) : null;
          return m == null ? (sortDir === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY) : m;
        }
      }
    };
    const isNum = (x: any) => typeof x === "number";
    return [...filtered].sort((a, b) => {
      const A = val(a); const B = val(b);
      if (isNum(A) && isNum(B)) return (A as number - (B as number)) * dir;
      return String(A).localeCompare(String(B)) * dir;
    });
  }, [filtered, sortBy, sortDir]);

  // métricas
  const totalProductos = sorted.length;
  const valorInventarioVenta = useMemo(
    () => sorted.reduce((acc, r) => acc + (Number(r.precio_venta) || 0) * (Number(r.stock_actual) || 0), 0),
    [sorted]
  );
  const valorInventarioCosto = useMemo(() => {
    const haveCost = sorted.some(r => r.precio_compra != null);
    if (!haveCost) return null;
    return sorted.reduce((acc, r) => acc + (Number(r.precio_compra) || 0) * (Number(r.stock_actual) || 0), 0);
  }, [sorted]);



  /* ===== Crear ===== */
  const onOpenCreate = () => {
    setPName("");
    setPSKU("");
    setPPrecioCompra("");
    setPPrice("1200");
    setPStock("0");
    setPCatId(null);
    setOpenCreate(true);
  };

  const onCreate = async () => {
    const nombre = pName.trim();
    const precio = Number(pPrice);
    const stock = Number(pStock);
    const sku = pSKU.trim() || null;
    const precio_compra = pPrecioCompra.trim() ? Number(pPrecioCompra) : null;
    const categoria_id = pCatId ?? null;

    if (!nombre) return toast.error("El nombre es obligatorio");
    if (!Number.isFinite(precio) || precio < 0) return toast.error("Precio de venta inválido");
    if (!Number.isFinite(stock) || stock < 0) return toast.error("Stock inválido");
    if (precio_compra != null && (!Number.isFinite(precio_compra) || precio_compra < 0)) {
      return toast.error("Precio de compra inválido");
    }

    try {
      setSaving(true);
      const res = await createProductAPI(slug, { nombre, precio_venta: precio, stock_inicial: stock });

      // aplica defaults + extras (sku, precio_compra, categoria_id)
      if (res && (res as any).id) {
        const id = (res as any).id as number;
        const def = getAlertDefaults(slug);
        const patch: any = {
          ...defaultsToPatch(def),
          sku,
          categoria_id,
        };
        if (precio_compra != null) patch.precio_compra = precio_compra; 

        await updateProductAPI(slug, id, patch);
      }

      toast.success("Producto creado");
      setOpenCreate(false);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear");
    } finally {
      setSaving(false);
    }
  };

  /* ===== Editar ===== */
  const onOpenEdit = (p: Prod) => {
    setEditTarget(p);
    setENombre(p.nombre || "");
    setESKU(p.sku || "");
    setECategoriaId(p.categoria_id ?? null);
    setEPrecioCompra(p.precio_compra != null ? String(p.precio_compra) : "");
    setEPrecioVenta(p.precio_venta != null ? String(p.precio_venta) : "");
    setOpenEdit(true);
  };

  const onEdit = async () => {
    if (!editTarget) return;
    const patch: any = {
      nombre: eNombre.trim(),
      sku: eSKU.trim() || null,
      categoria_id: eCategoriaId ?? null,
      ...(ePrecioCompra.trim() ? { precio_compra: Number(ePrecioCompra) } : {}),
      precio_venta: ePrecioVenta.trim() ? Number(ePrecioVenta) : editTarget.precio_venta,
    };
    try {
      await toast.promise(
        updateProductAPI(slug, editTarget.id, patch),
        { loading: "Guardando…", success: "Producto actualizado", error: "No se pudo actualizar" }
      );
      setOpenEdit(false);
      setEditTarget(null);
      await refresh();
    } catch {}
  };

  /* ===== Alertas por producto ===== */
  const onOpenAlerts = (p: Prod) => {
    setEditTarget(p);
    setAStockMin(p.stock_minimo != null ? String(p.stock_minimo) : "");
    setAConsumoDia(
      p.consumo_diario_estimado != null
        ? String(Math.ceil(Number(p.consumo_diario_estimado)))
        : ""
    );
    setAUnidad((p.alerta_tiempo_unidad as UnidadTiempo) || "semanas");
    setACant(p.alerta_tiempo_cantidad != null ? Number(p.alerta_tiempo_cantidad) : 2);
    setOpenAlerts(true);
  };

  const onSaveAlerts = async () => {
    if (!editTarget) return;

    const consumo = aConsumoDia.trim()
      ? Math.max(0, Math.ceil(Number(aConsumoDia)))
      : null;

    const unidad: UnidadTiempo | null = aCant > 0 ? aUnidad : null;
    const cant: number | null = aCant > 0 ? Math.max(0, Math.round(aCant)) : null;

    let stock_minimo = aStockMin.trim()
      ? Math.max(0, Math.round(Number(aStockMin)))
      : null;

    const derivado = derivedMin(consumo, unidad, cant);
    if (derivado != null) stock_minimo = derivado;

    try {
      await toast.promise(
        updateProductAPI(slug, editTarget.id, {
          stock_minimo,
          consumo_diario_estimado: consumo,
          alerta_tiempo_unidad: unidad,
          alerta_tiempo_cantidad: cant,
        }),
        { loading: "Guardando configuración…", success: "Alertas actualizadas", error: "No se pudo guardar" }
      );
      setOpenAlerts(false);
      setEditTarget(null);
      await refresh();
    } catch {}
  };


  /* ===== Ajustar stock ===== */
  const onOpenAdjust = (p: Prod) => {
    setEditTarget(p);
    const cur = Number(p.stock_actual ?? 0);
    const base = Math.max(0, Math.round(cur));
    setCurrentStockBase(base);
    setDeltaStr("0");
    setFinalStr(String(base));
    setOpenAdjust(true);
  };



  const onSaveAdjust = async () => {
    if (!editTarget) return;

    const current = Math.max(0, Math.round(currentStockBase));
    let final = Math.max(0, Math.round(Number(finalStr || 0)));
    if (!Number.isFinite(final)) final = current;

    let delta = final - current;
    if (current + delta < 0) delta = -current; 

    if (delta === 0) { setOpenAdjust(false); return; }

    try {
      await toast.promise(
        adjustStockAPI(slug, editTarget.id, delta),
        { loading: "Aplicando ajuste…", success: "Stock ajustado", error: "No se pudo ajustar el stock" }
      );
      setOpenAdjust(false);
      setEditTarget(null);
      await refresh();
    } catch {}
  };


  /* ===== Eliminar ===== */
  const onOpenDelete = (p: Prod) => { setDeleteTarget(p); setOpenDelete(true); };
  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await toast.promise(
        deleteProductAPI(slug, deleteTarget.id),
        { loading: "Eliminando…", success: "Producto eliminado", error: "No se pudo eliminar" }
      );
      setOpenDelete(false);
      setDeleteTarget(null);
      await refresh();
    } catch {}
  };

  /* ===== Categorías: CRUD ===== */
  const [catName, setCatName] = useState("");
const [catColor, setCatColor] = useState<string>(DEFAULT_CAT_COLOR);
  const [editingCatId, setEditingCatId] = useState<number | null>(null);

  const onCatEdit = (c: Category) => {
    setEditingCatId(c.id);
    setCatName(c.nombre);
    setCatColor(c.color_hex || DEFAULT_CAT_COLOR);
  };
  const resetCatForm = () => { setEditingCatId(null); setCatName(""); setCatColor(DEFAULT_CAT_COLOR); };

  const onCatSave = async () => {
    if (!catName.trim()) return toast.error("Nombre de categoría requerido");
    try {
      if (editingCatId) {
        await api.updateCategory({ slug, id: editingCatId, patch: { nombre: catName.trim(), color_hex: catColor } });
        toast.success("Categoría actualizada");
      } else {
        await api.createCategory({ slug, data: { nombre: catName.trim(), color_hex: catColor } });
        toast.success("Categoría creada");
      }
      resetCatForm();
      await reloadCategories();
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Error guardando categoría");
    }
  };

  const onCatDelete = async (id: number) => {
    try {
      await api.deleteCategory({ slug, id });
      toast.success("Categoría eliminada");
      if (editingCatId === id) resetCatForm();
      await reloadCategories();
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo eliminar");
    }
  };

  // handler: descargar
  const onDownloadTemplate = async () => {
    try {
      const defaultName = `Plantilla_Productos_${new Date().toISOString().slice(0,10)}.xlsx`;
      const filePath = await api.pickSaveFile?.({
        defaultPath: defaultName,
        filters: [{ name: "Excel", extensions: ["xlsx"] }],
      });
      if (!filePath) return; // usuario canceló

      const r = await api.downloadProductsTemplate({ destPath: filePath });
      if (r?.ok && r.dest) {
        toast((t) => (
          <div style={{ display: "grid", gap: 8 }}>
            <b>Plantilla guardada</b>
            <small style={{ opacity: 0.8 }}>{r.dest}</small>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                className="btn btn-sm"
                onClick={() => { api.revealInFolder?.(r.dest); toast.dismiss(t.id); }}
              >
                Abrir carpeta
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => toast.dismiss(t.id)}>
                Cerrar
              </button>
            </div>
          </div>
        ), { duration: 6000 });
      } else {
        toast.error(r?.error ?? "No se pudo copiar la plantilla");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo descargar la plantilla");
    }
  };

  // handler: importar
  const onImportXlsx = async () => {
    const pick = await api.pickXlsx();
    if (!pick?.ok) return;

    const res = await api.importProductsXlsx({ slug, filePath: pick.filePath });
    if (res?.ok) {
      const msg = `Importados: ${res.added}. Duplicados: ${res.skipped}.`;
      toast.success(res.errors?.length ? `${msg} Errores: ${res.errors.length}` : msg);

      //  Post-proceso: defaults + categorías
      await toast.promise(
        normalizeAfterImport(slug),
        { loading: "Aplicando defaults y categorías…", success: "Productos normalizados", error: "No se pudo normalizar" }
      );

      // recargar listas
      await reloadCategories();
      await refresh();
    } else {
      toast.error(res?.error ?? "Error al importar");
    }
  };

  // selección visible
  const visibleIds = useMemo(() => sorted.map(r => r.id), [sorted]);
  const allVisibleSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id)),
    [visibleIds, selectedIds]
  );
  const toggleAllVisible = () => {
    setSelectedIds(prev => {
      if (visibleIds.length === 0) return prev;
      const next = new Set(prev);
      const all = visibleIds.every(id => next.has(id));
      if (all) {
        visibleIds.forEach(id => next.delete(id));
      } else {
        visibleIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // productos stock bajo
  const bajoStockCount = useMemo(() => {
    return sorted.reduce((acc, p) => {
      const { crit, warn } = getAlerts(p);
      return acc + (crit || warn ? 1 : 0);
    }, 0);
  }, [sorted]);

  // acciones masivas
  const doBulkAlerts = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const patchBase: any = {
      consumo_diario_estimado: null,
      alerta_tiempo_unidad: null,
      alerta_tiempo_cantidad: null,
    };

    patchBase.stock_minimo = bulkStockMin.trim()
    ? Math.max(0, Math.round(Number(bulkStockMin)))
    : null; 

    setOpenBulkAlerts(false);
    try {
      const jobs = ids.map(id => updateProductAPI(slug, id, patchBase));
      const results = await Promise.allSettled(jobs);
      const ok = results.filter(r => r.status === "fulfilled").length;
      const fail = results.length - ok;
      if (fail === 0) toast.success(`Se aplicó configuración a ${ok} producto(s).`);
      else toast.error(`Aplicado a ${ok}, errores en ${fail}.`);
      clearSelection();
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudieron aplicar cambios");
    }
  };

  const doBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setOpenBulkDelete(false);
    try {
      const jobs = ids.map(id => deleteProductAPI(slug, id));
      const results = await Promise.allSettled(jobs);
      const ok = results.filter(r => r.status === "fulfilled").length;
      const fail = results.length - ok;
      if (fail === 0) toast.success(`Eliminados ${ok} producto(s).`);
      else toast.error(`Eliminados ${ok}, errores en ${fail}.`);
      clearSelection();
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudieron eliminar");
    }
  };

  return (
    <div className="products-wrap">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="page-header">
        <div className="ph-left">
          <div className="ph-icon" aria-hidden="true"><IconBox size={30} aria-hidden="true" color="#D07A43" /></div>
          <div>
            <h1>Gestión de Productos</h1>
            <p className="muted">Administra tu inventario de productos</p>
          </div>
        </div>
        <div className="ph-actions">
          <button className="btn" onClick={onDownloadTemplate}>Descargar plantilla Excel</button>
          <button className="btn" onClick={onImportXlsx} style={{ marginLeft: 8 }}>Importar desde Excel</button>

          {/* Modal de Configuración */}
          <button
            className="btn icon"
            title="Configuración"
            onClick={() => { setCfg(getAlertDefaults(slug)); setOpenSettings(true); setSettingsTab("alerts"); }}
            style={{ marginLeft: 6, marginRight: 6 }}
          >
            <IconSettings size={18} />
          </button>

          <button className="primary" onClick={onOpenCreate}>
            <IconPlus size={16} style={{ marginRight: 6 }} /> Nuevo Producto
          </button>
        </div>
      </header>

      {/* Métricas */}
      <div className="metric-row">
        <div className="metric">
          <div className="label">Total de Productos</div>
          <div className="value">{nfInt.format(totalProductos)}</div>
        </div>
        <div className="metric">
          <div className="label">Valor total (venta)</div>
          <div className="value">{nfMoney.format(valorInventarioVenta)}</div>
        </div>
        <div className="metric">
          <div className="label">Valor total (costo)</div>
          <div className="value">
            {valorInventarioCosto == null
              ? nfMoney.format(valorInventarioVenta)
              : nfMoney.format(valorInventarioCosto)}
          </div>
        </div>
        <div className="metric">
          <div className="label">Productos con bajo stock</div>
          <div className="value">{nfInt.format(bajoStockCount)}</div>
        </div>
      </div>

      {/* Caja principal */}
      <section className="card products-card">
        <header className="card-head">
          <div className="ch-left">
            <div className="ch-ic"><IconBox size={18} /></div>
            <div>
              <div className="ch-title">Productos</div>
              <div className="ch-sub muted">Gestiona el inventario de cada producto</div>
            </div>
          </div>
        </header>

        {/* Filtros */}
        <div className="toolbar">
          <div className="search">
            <IconSearch className="ic" size={16} />
            <input
              placeholder="Busca por nombre, SKU o categoría…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Buscar producto"
            />
          </div>

          <select
            className="select"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            aria-label="Filtrar por categoría"
          >
            <option value="__all__">Todas las Categorías</option>
            {categories.map(c => <option key={c.id} value={String(c.id)}>{c.nombre}</option>)}
          </select>

          <div className="sort-wrap">
            <label className="muted tiny">Ordenar por</label>
            <select
              className="select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              aria-label="Ordenar por"
            >
              <option value="nombre">Nombre</option>
              <option value="categoria">Categoría</option>
              <option value="stock">Stock</option>
              <option value="precio">Precio venta</option>
              <option value="margen">Margen</option>
            </select>
            <button className="btn icon" onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")} title={sortDir === "asc" ? "Ascendente" : "Descendente"} aria-label="Cambiar dirección de orden">
              {sortDir === "asc" ? <IconSortAsc size={16} /> : <IconSortDesc size={16} />}
            </button>
          </div>

          <label className="switch" htmlFor="toggle-threshold" style={{ marginLeft: 8 }}>
            <input
              id="toggle-threshold"
              className="switch-input"
              type="checkbox"
              checked={showThreshold}
              onChange={(e) => setShowThreshold(e.target.checked)}
            />
            <span className="switch-label">Mostrar umbral</span>
          </label>
        </div>

        {/* Barra de acciones masivas */}
        {selectedIds.size > 0 && (
          <div className="bulkbar">
            <span className="count">{selectedIds.size} seleccionado(s)</span>
            <button className="btn" onClick={() => setOpenBulkAlerts(true)}><IconBell size={16} style={{marginRight:6}}/> Establecer alertas</button>
            <button className="btn danger" onClick={() => setOpenBulkDelete(true)}><IconTrash size={16} style={{marginRight:6}}/> Eliminar seleccionados</button>
            <div className="spacer" />
            <button className="btn" onClick={clearSelection}>Limpiar selección</button>
          </div>
        )}

        {/* Tabla */}
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th style={{ width: 36, textAlign: "center" }}>
                  <input type="checkbox" aria-label="Seleccionar visibles" checked={allVisibleSelected} onChange={toggleAllVisible} />
                </th>
                <th style={{ textAlign: "left" }}>Producto</th>
                <th>Categoría</th>
                <th>Stock</th>
                <th>Precio Compra</th>
                <th>Precio Venta</th>
                <th>Margen</th>
                <th>Alertas</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={COLS} className="muted">Cargando…</td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={COLS} className="muted">Sin resultados</td></tr>
              ) : (
                sorted.map((r) => {
                  const compra = r.precio_compra ?? null;
                  const venta = r.precio_venta ?? null;
                  const margen = (compra != null && venta)
                    ? ((venta - compra) / (venta || 1)) * 100
                    : null;

                  const alerts = getAlerts(r);
                  const hasAny = alerts.crit || alerts.warn;

                  const th = mainThreshold(r);
                  const stockTxt = showThreshold && th != null
                    ? `${nfInt.format(r.stock_actual)}/${nfInt.format(th)} u`
                    : `${nfInt.format(r.stock_actual)} u`;

                  let stockClass = (() => {
                    const stock = Number(r.stock_actual || 0);
                    if (stock <= 0) return "stock-crit";                   // sin stock
                    if (alerts.warn) return "stock-warn";
                    if (th != null) return "stock-ok";
                    return "stock-ok";
                  })();

                  return (
                    <tr key={r.id} className={isSelected(r.id) ? "row-selected" : ""}>
                      <td style={{ textAlign: "center" }}>
                        <input type="checkbox" checked={isSelected(r.id)} onChange={() => toggleOne(r.id)} aria-label={`Seleccionar ${r.nombre}`} />
                      </td>
                      <td>
                        <div className="prod-name">
                          <strong title={r.nombre}>{r.nombre}</strong>
                          <span className="muted tiny">{r.sku ? `SKU: ${r.sku}` : `ID: ${r.id}`}</span>
                        </div>
                      </td>
                      <td className="cat-cell">
                        {(() => {
                          const name = r.categoria ?? (r.categoria_id != null ? catNameById.get(r.categoria_id) ?? null : null);
                          if (!name) return "—";
                          const hex = r.categoria_id != null ? catColorById.get(r.categoria_id) : null;
                          const bg   = hexToRgba(hex, 0.14);
                          const bdr  = hexToRgba(hex, 0.35);
                          const dot  = hex ?? "#999";
                          return (
                            <span
                              className="cat-chip"
                              style={{ 
                                "--cat-bg": bg, "--cat-border": bdr, "--cat-dot": dot
                              } as React.CSSProperties}
                              title={name}
                            >
                              <span className="dot" />
                              <span className="name">{name}</span>
                            </span>
                          );
                        })()}
                      </td>
                      <td className={stockClass}>{stockTxt}</td>
                      <td>{compra == null ? "—" : nfMoney.format(compra)}</td>
                      <td>{nfMoney.format(venta)}</td>
                      <td>{margen == null ? "—" : `${margen.toFixed(1)}%`}</td>

                      {/* Alertas */}
                      <td>
                        <div className="alert-badges" title="Estado de alertas">
                          {alerts.crit && (
                            <span className="alert-dot crit" title="Sin stock"><IconCrit size={14} /></span>
                          )}
                          {!alerts.crit && alerts.warn && (
                            <span className="alert-dot min" title="Bajo el objetivo (mínimo/cobertura)"><IconWarn size={14} /></span>
                          )}
                          {!hasAny && (
                            <span className="alert-dot ok" title="Sin alertas"><IconOk size={14} /></span>
                          )}
                        </div>
                      </td>

                      {/* Acciones por fila */}
                      <td className="tr-actions">
                        <div className="row-menu">
                          <button
                            className="icon ghost"
                            title="Opciones"
                            aria-haspopup="menu"
                            aria-expanded={menuId === r.id}
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                              if (menuId === r.id) {
                                setMenuId(null);
                                setMenuPos(null);
                              } else {
                                openRowMenuFromButton(e.currentTarget, r.id);
                              }
                            }}
                          >
                            ⋮
                          </button>
                        </div>

                        {/* Menú en portal (sobre el contenedor, a la izquierda del botón) */}
                        <RowMenuPortal
                          open={menuId === r.id}
                          pos={menuPos}
                          onClose={() => { setMenuId(null); setMenuPos(null); }}
                        >
                          <button role="menuitem" onClick={() => { setMenuId(null); setMenuPos(null); onOpenEdit(r); }}>
                            <IconEdit size={16} /> Editar
                          </button>
                          <button role="menuitem" onClick={() => { setMenuId(null); setMenuPos(null); onOpenAdjust(r); }}>
                            <IconAdjust size={16} /> Ajustar stock
                          </button>
                          <button role="menuitem" onClick={() => { setMenuId(null); setMenuPos(null); onOpenAlerts(r); }}>
                            <IconBell size={16} /> Configurar alertas
                          </button>
                          <button
                            role="menuitem"
                            onClick={() => {
                              setMenuId(null); setMenuPos(null);
                              setForecastTarget(r);
                              setOpenForecast(true);
                              setForecastRes(null);
                            }}
                          >
                            <IconClock size={16} /> Predicción de stock
                          </button>
                          <button role="menuitem" className="dangera" onClick={() => { setMenuId(null); setMenuPos(null); onOpenDelete(r); }}>
                            <IconTrash size={16} /> Eliminar
                          </button>
                        </RowMenuPortal>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal crear */}
      <Modal open={openCreate} title="Nuevo Producto" onClose={() => setOpenCreate(false)}>
        <div className="form-grid">
          <div className="field">
            <label>Nombre *</label>
            <div className="input">
              <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Ej. Coca-Cola 500ml" />
            </div>
          </div>

          <div className="form-grid grid-2">
            <div className="field">
              <label>Precio venta *</label>
              <div className="input">
                <input
                  inputMode="numeric"
                  value={pPrice}
                  onChange={(e) => setPPrice(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="1200"
                />
              </div>
            </div>
            <div className="field">
              <label>Stock inicial *</label>
              <div className="input">
                <input
                  inputMode="numeric"
                  value={pStock}
                  onChange={(e) => setPStock(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div className="form-grid grid-2">
            <div className="field">
              <label>Precio compra (opcional)</label>
              <div className="input">
                <input
                  inputMode="numeric"
                  value={pPrecioCompra}
                  onChange={(e) => setPPrecioCompra(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="Ej. 900"
                />
              </div>
            </div>
            <div className="field">
              <label>SKU / Código</label>
              <div className="input">
                <input value={pSKU} onChange={e => setPSKU(e.target.value)} placeholder="Ej. CC500" />
              </div>
            </div>
          </div>

          <div className="field">
            <label>Categoría</label>
            <div className="input" style={{ display: "flex", gap: 8 }}>
              <select
                value={String(pCatId ?? "")}
                onChange={(e) => setPCatId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">(sin categoría)</option>
                {categories.map(c => (
                  <option key={c.id} value={String(c.id)}>{c.nombre}</option>
                ))}
              </select>
              <button className="btn" onClick={() => { setOpenSettings(true); setSettingsTab("categories"); }}>
                <IconCats size={16} /> Gestionar
              </button>
            </div>
          </div>

          <div className="note tiny muted">
            Agrega tus productos al Sistema. Luego puedes editar más detalles y alertas.
          </div>
        </div>

        <div className="modal-actions">
          <button onClick={() => setOpenCreate(false)} disabled={saving}>Cancelar</button>
          <button className="primary" onClick={onCreate} disabled={saving}>
            {saving ? "Creando…" : "Crear"}
          </button>
        </div>
      </Modal>

      {/* Modal editar */}
      <Modal open={openEdit} title={`Editar producto${editTarget ? ` — ${editTarget.nombre}` : ""}`} onClose={() => setOpenEdit(false)}>
        <div className="form-grid">
          <div className="field">
            <label>Nombre</label>
            <div className="input"><input value={eNombre} onChange={e => setENombre(e.target.value)} /></div>
          </div>

          <div className="form-grid grid-2">
            <div className="field">
              <label>SKU / Código</label>
              <div className="input"><input value={eSKU} onChange={e => setESKU(e.target.value)} /></div>
            </div>
            <div className="field">
              <label>Categoría</label>
              <div className="input" style={{ display: "flex", gap: 8 }}>
                <select
                  value={String(eCategoriaId ?? "")}
                  onChange={(e) => setECategoriaId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">(sin categoría)</option>
                  {categories.map(c => (
                    <option key={c.id} value={String(c.id)}>{c.nombre}</option>
                  ))}
                </select>
                <button className="btn" onClick={() => { setOpenSettings(true); setSettingsTab("categories"); }}>
                  <IconCats size={16} /> Gestionar
                </button>
              </div>
            </div>
          </div>

          <div className="form-grid grid-2">
            <div className="field">
              <label>Precio compra</label>
              <div className="input">
                <input inputMode="numeric" value={ePrecioCompra} onChange={e => setEPrecioCompra(e.target.value.replace(/[^\d.]/g, ""))} />
              </div>
            </div>
            <div className="field">
              <label>Precio venta</label>
              <div className="input">
                <input inputMode="numeric" value={ePrecioVenta} onChange={e => setEPrecioVenta(e.target.value.replace(/[^\d.]/g, ""))} />
              </div>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button onClick={() => setOpenEdit(false)}>Cancelar</button>
          <button className="primary" onClick={onEdit}>Guardar</button>
        </div>
      </Modal>

      {/* Modal Ajustar stock */}
      <Modal
        open={openAdjust}
        title={`Ajustar stock${editTarget ? ` — ${editTarget.nombre}` : ""}`}
        onClose={() => setOpenAdjust(false)}
      >
        <div className="form-grid stock-adjust-modal">
          {/* Stock ACTUAL (no editable) */}
          <div className="field">
            <label>Stock actual</label>
            <div className="sam-actual">{nfInt.format(currentStockBase)} u</div>
          </div>

          {/* Una sola fila: [−STEP] [−1] [input] [+1] [+STEP] */}
          <div className="field">
            <label>Sumar / restar</label>
            {(() => {
              const cur  = Math.max(0, Math.round(currentStockBase));
              const step = stepFromCurrent(cur);

              const deltaNum = Math.round(Number(deltaStr || 0)) || 0;
              const applyStep = (n: number) => {
                const nextDelta = deltaNum + n;
                setDeltaStr(String(nextDelta));
                setFinalStr(String(Math.max(0, cur + nextDelta)));
              };

              return (
                <div className="sam-row">
                  {/* −STEP */}
                  {step > 0 ? (
                    <button className="btn sam-pct-btn" onClick={() => applyStep(-step)} title={`Restar ${step}`}>
                      −{step}
                    </button>
                  ) : <span className="sam-sp" />}

                  {/* −1 */}
                  <button className="btn sam-step" onClick={() => applyStep(-1)} aria-label="Restar 1">−</button>

                  {/* INPUT (permite negativos) */}
                  <div className="input sam-input">
                    <input
                      inputMode="numeric"
                      value={deltaStr}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const clean = raw.replace(/[^-\d]/g, "");
                        setDeltaStr(clean);
                        const d = Math.round(Number(clean || 0)) || 0;
                        setFinalStr(String(Math.max(0, cur + d)));
                      }}
                      placeholder="0 (ej: -50, 100)"
                      aria-label="Delta a aplicar"
                    />
                  </div>

                  {/* +1 */}
                  <button className="btn sam-step" onClick={() => applyStep(+1)} aria-label="Sumar 1">+</button>

                  {/* +STEP */}
                  {step > 0 ? (
                    <button className="btn sam-pct-btn" onClick={() => applyStep(+step)} title={`Sumar ${step}`}>
                      +{step}
                    </button>
                  ) : <span className="sam-sp" />}
                </div>
              );
            })()}
          </div>

          {/* Stock final (quedará) — editable y sincronizado */}
          <div className="field">
            <label>Stock final</label>
            <div className="input">
              <input
                inputMode="numeric"
                value={finalStr}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d]/g, "");
                  const final = Math.max(0, Math.round(Number(v || 0)));
                  setFinalStr(String(final));
                  const cur = Math.max(0, Math.round(currentStockBase));
                  setDeltaStr(String(final - cur));
                }}
                placeholder="0"
                aria-label="Stock final"
              />
            </div>
          </div>

          {/* Preview */}
          {(() => {
            const cur = Math.max(0, Math.round(currentStockBase));
            const fin = Math.max(0, Math.round(Number(finalStr || 0)));
            const d   = fin - cur;
            return (
              <div className="sam-preview">
                <span className="muted tiny">Cambio</span>
                <strong className={d === 0 ? "" : (d > 0 ? "pos" : "neg")}>
                  {d > 0 ? `+${nfInt.format(d)}` : nfInt.format(d)} u
                </strong>
                <span className="muted tiny">Quedará</span>
                <strong>{nfInt.format(fin)} u</strong>
              </div>
            );
          })()}
        </div>

        <div className="modal-actions">
          <button onClick={() => setOpenAdjust(false)}>Cancelar</button>
          <button className="primary" onClick={onSaveAdjust}>Aplicar</button>
        </div>
      </Modal>



      {/* Modal Configuración (alertas/categorías) */}
      <Modal open={openSettings} title="Configuración" onClose={() => setOpenSettings(false)}>
        <div className="producttabs">
          <button className={settingsTab === "alerts" ? "tab active" : "tab"} onClick={() => setSettingsTab("alerts")}>
            <IconBell size={16} /> Alertas
          </button>
          <button className={settingsTab === "categories" ? "tab active" : "tab"} onClick={() => setSettingsTab("categories")}>
            <IconCats size={16} /> Categorías
          </button>
        </div>

        {settingsTab === "alerts" ? (
          <div className="form-grid" style={{ marginTop: 12 }}>
            <div className="cfg-grid">
              <div>
                <label>Stock mínimo (por defecto)</label>
                <div className="input">
                  <input
                    inputMode="numeric"
                    value={cfg.stock_minimo ?? ""}
                    onChange={e => setCfg(s => ({ ...s, stock_minimo: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="Ej. 5"
                  />
                </div>
              </div>
            </div>

            <p className="tiny muted" style={{ marginTop: 6 }}>
              Este mínimo por defecto se aplica al crear productos nuevos. Puedes ajustarlo por producto.
            </p>

            <div className="modal-actions" style={{ marginTop: 8 }}>
              <button onClick={() => setOpenSettings(false)}>Cerrar</button>
              <button
                className="primary"
                onClick={() => {
                  saveAlertDefaults(slug, { stock_minimo: cfg.stock_minimo ?? null } as any);
                  toast.success("Defaults guardados");
                }}
              >
                  <IconSave size={16} style={{ marginRight: 6 }} />
                Guardar
              </button>
            </div>
          </div>
        ) : (
          <div className="form-grid" style={{ marginTop: 12 }}>
            <div className="field">
              <label>{editingCatId ? "Editar categoría" : "Nueva categoría"}</label>

              {/* fila con input nombre + picker con icono + botón */}
              <div className="cat-new-row">
                <div className="input">
                  <input
                    value={catName}
                    onChange={e => setCatName(e.target.value)}
                    placeholder="Nombre…"
                  />
                </div>

                <label className="colorpicker" title="Elegir color">
                  <input type="color" value={catColor} onChange={e => setCatColor(e.target.value)} />
                  <span className="chip" style={{ background: catColor, color: readableOn(catColor) }}>
                    <IconPalette size={16} />
                  </span>
                </label>

                <button className="btn" onClick={onCatSave}>
                  {editingCatId ? "Actualizar" : "Agregar"}
                </button>
              </div>


              {editingCatId && (
                <div className="tiny" style={{ marginTop: 6 }}>
                  <button className="link" onClick={resetCatForm}>Cancelar edición</button>
                </div>
              )}
            </div>


            <div className="field">
              <label>Lista de categorías</label>
              <div className="cat-list">
                {categories.length === 0 ? (
                  <div className="muted tiny">Aún no hay categorías</div>
                ) : (
                  categories.map(c => (
                    <div key={c.id} className="cat-row">
                    {(() => {
                      const bg  = hexToRgba(c.color_hex ?? "#999", 0.14);
                      const bdr = hexToRgba(c.color_hex ?? "#999", 0.35);
                      const dot = c.color_hex ?? "#999";
                      return (
                        <span
                          className="cat-chip"
                          style={{
                            "--cat-bg": bg, "--cat-border": bdr, "--cat-dot": dot
                          } as React.CSSProperties}
                      >
                          <span className="dot" />
                          <span className="name">{c.nombre}</span>
                        </span>
                      );
                    })()}
                    <div className="spacer" />
                    <button className="btn tiny" onClick={() => onCatEdit(c)}>Editar</button>
                    <button className="btn dangera" onClick={() => onCatDelete(c.id)}>Eliminar</button>
                  </div>
                  ))
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={() => setOpenSettings(false)}>Cerrar</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Alertas por producto */}
      <Modal open={openAlerts} title={`Alertas — ${editTarget?.nombre ?? ""}`} onClose={() => setOpenAlerts(false)}>
        <details className="help-box" style={{ marginBottom: 10 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>¿Cómo quieres definir el umbral?</summary>
          <div className="tiny" style={{ marginTop: 8, lineHeight: 1.5 }}>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li><strong>A mano:</strong> escribes el mínimo de unidades a mantener.</li>
              <li><strong>Según ventas (promedio):</strong> calculamos el consumo diario con un histórico y definimos el umbral ≈ <em>consumo promedio de 1 día</em>.</li>
              <li><strong>Según ventas para cubrir periodo:</strong> calculamos consumo diario y definimos el umbral = <em>consumo × días objetivo</em>. Además guardamos la cobertura por tiempo.</li>
            </ul>
            <p style={{ marginTop: 6, opacity: .85 }}>
              Tip: siempre puedes volver a “A mano” si quieres fijar un número sin depender del histórico.
            </p>
          </div>
        </details>

        {(() => {
          // Modo local del modal
          type AlertMode = 'manual' | 'avg' | 'cover';
          const [alertMode, setAlertMode] = useState<AlertMode>('manual');

          // Entradas de UI
          const [winDays, setWinDays] = useState<number>(60);      
          const [targetDays, setTargetDays] = useState<number>(14); 

          // Valores calculados
          const stockNow = Math.max(0, Math.round(Number(editTarget?.stock_actual ?? 0)));
          const [calcDaily, setCalcDaily] = useState<number | null>(null);
          const [calcMin, setCalcMin] = useState<number | null>(null);     

          useEffect(() => {
            if (!openAlerts) return;
            const hadCoverage = (aCant ?? 0) > 0;
            setAlertMode('manual');
            setCalcDaily(null);
            setCalcMin(null);
          }, [openAlerts]);

          const doCalcFromSales = useCallback(async (days: number, coverDays?: number | null) => {
            if (!editTarget) return { daily: null, min: null };

            try {
              if (typeof api.autoAlertsSuggest === 'function') {
                const r = await api.autoAlertsSuggest({
                  slug,
                  producto_id: editTarget.id,
                  windowDays: Math.max(7, days),
                  targetCoverageDays: Math.max(0, Number(coverDays || 0)),
                });
                if (r?.ok) {
                  const daily = Math.max(0, Math.ceil(Number(r.consumo_diario_estimado ?? 0)));
                  const min = coverDays && coverDays > 0
                    ? Math.ceil(daily * coverDays)
                    : (daily > 0 ? daily : 0);
                  return { daily, min };
                }
              }
            } catch {}

            try {
              const fr = await forecastProductAPI(slug, editTarget.id, {
                windowDays: Math.max(7, days),
                horizonDays: Math.max(7, days),
                leadTimeDays: 0,
                serviceLevel: 0.9,
              });
              const daily = Math.max(0, Math.ceil(Number(fr?.history?.avgDaily ?? 0)));
              const min = coverDays && coverDays > 0
                ? Math.ceil(daily * coverDays)
                : (daily > 0 ? daily : 0);
              return { daily, min };
            } catch (e:any) {
              toast.error(e?.message ?? "No se pudo calcular desde ventas");
            }

            return { daily: null, min: null };
          }, [editTarget, slug]);

          // Guardar según modo
          const save = useCallback(async () => {
            if (!editTarget) return;

            if (alertMode === 'manual') {
              const stock_minimo = aStockMin.trim() ? Math.max(0, Math.round(Number(aStockMin))) : null;
              await toast.promise(
                updateProductAPI(slug, editTarget.id, {
                  stock_minimo,
                  consumo_diario_estimado: null,
                  alerta_tiempo_unidad: null,
                  alerta_tiempo_cantidad: null,
                }),
                { loading: "Guardando…", success: "Alertas actualizadas", error: "No se pudo guardar" }
              );
            }

            if (alertMode === 'avg') {
              let daily = calcDaily;
              let min = calcMin;
              if (daily == null || min == null) {
                const r = await doCalcFromSales(winDays, null);
                daily = r.daily; min = r.min;
              }
              await toast.promise(
                updateProductAPI(slug, editTarget.id, {
                  stock_minimo: min ?? null,
                  consumo_diario_estimado: daily ?? null,
                  alerta_tiempo_unidad: null,
                  alerta_tiempo_cantidad: null,
                }),
                { loading: "Guardando…", success: "Alertas actualizadas", error: "No se pudo guardar" }
              );
            }

            if (alertMode === 'cover') {
              let daily = calcDaily;
              let min = calcMin;
              if (daily == null || min == null) {
                const r = await doCalcFromSales(winDays, targetDays);
                daily = r.daily; min = r.min;
              }
              await toast.promise(
                updateProductAPI(slug, editTarget.id, {
                  stock_minimo: min ?? null,
                  consumo_diario_estimado: daily ?? null,
                  alerta_tiempo_unidad: 'dias',
                  alerta_tiempo_cantidad: Math.max(0, Math.round(targetDays)),
                }),
                { loading: "Guardando…", success: "Alertas actualizadas", error: "No se pudo guardar" }
              );
            }

            setOpenAlerts(false);
            setEditTarget(null);
            await refresh();
          }, [alertMode, aStockMin, calcDaily, calcMin, doCalcFromSales, editTarget, refresh, slug, targetDays, winDays]);

          // Preview de cobertura
          const dailyPreview = calcDaily ?? (aConsumoDia ? Math.max(0, Math.ceil(Number(aConsumoDia))) : null);
          const coverageDays = dailyPreview && dailyPreview > 0 ? Math.floor(stockNow / dailyPreview) : null;

          return (
            <div className="form-grid">
              {/* Selector de modo */}
              <div className="producttabs" style={{ marginBottom: 10 }}>
                <button className={alertMode === "manual" ? "tab active" : "tab"} onClick={() => setAlertMode("manual")}>
                  A mano
                </button>
                <button className={alertMode === "avg" ? "tab active" : "tab"} onClick={() => setAlertMode("avg")}>
                  Según ventas (promedio)
                </button>
                <button className={alertMode === "cover" ? "tab active" : "tab"} onClick={() => setAlertMode("cover")}>
                  Según ventas para cubrir periodo
                </button>
              </div>

              {/* === A MANO === */}
              {alertMode === 'manual' && (
                <div className="form-grid">
                  <div className="field">
                    <label>Umbral de seguridad (u)</label>
                    <div className="input">
                      <input
                        inputMode="numeric"
                        value={aStockMin}
                        onChange={(e) => setAStockMin(e.target.value.replace(/[^\d]/g, ""))}
                        placeholder="Ej. 20"
                      />
                    </div>
                    <div className="tiny muted">Te avisaremos cuando el stock baje de este número.</div>
                  </div>
                </div>
              )}

              {/* === SEGÚN VENTAS (PROMEDIO) === */}
              {alertMode === 'avg' && (
                <div className="form-grid">
                  <div className="field">
                    <label>Histórico a considerar</label>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <div className="input" style={{ width: 100 }}>
                        <input
                          inputMode="numeric"
                          value={String(winDays)}
                          onChange={e => setWinDays(Math.max(7, Math.min(365, Number((e.target.value||"0").replace(/[^\d]/g,"")))))}
                          placeholder="60"
                        />
                      </div>
                      <span className="tiny muted">Rápido:</span>
                      {[30, 60, 90].map(d => (
                        <button key={d} className="btn tiny" type="button" onClick={() => setWinDays(d)}>{d}d</button>
                      ))}
                      <button
                        className="btn"
                        type="button"
                        onClick={async () => {
                          const r = await doCalcFromSales(winDays, null);
                          setCalcDaily(r.daily);
                          setCalcMin(r.min);
                        }}
                      >
                        Calcular
                      </button>
                    </div>
                    <div className="tiny muted" style={{ marginTop: 6 }}>
                      Umbral sugerido = consumo promedio de 1 día.
                    </div>
                  </div>

                  <div className="card" style={{ padding: 10 }}>
                    <div className="metric-row">
                      <div className="metric">
                        <div className="label">Consumo diario (prom)</div>
                        <div className="value">{calcDaily != null ? `${calcDaily} u/día` : "—"}</div>
                      </div>
                      <div className="metric">
                        <div className="label">Umbral sugerido</div>
                        <div className="value">{calcMin != null ? `${calcMin} u` : "—"}</div>
                      </div>
                      <div className="metric">
                        <div className="label">Cobertura actual (aprox.)</div>
                        <div className="value">
                          {coverageDays != null ? `${coverageDays} día${coverageDays === 1 ? "" : "s"}` : "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* === SEGÚN VENTAS PARA CUBRIR PERIODO === */}
              {alertMode === 'cover' && (
                <div className="form-grid">
                  <div className="form-grid grid-2">
                    <div className="field">
                      <label>Histórico a considerar (días)</label>
                      <div className="input">
                        <input
                          inputMode="numeric"
                          value={String(winDays)}
                          onChange={e => setWinDays(Math.max(7, Math.min(365, Number((e.target.value||"0").replace(/[^\d]/g,"")))))}
                          placeholder="60"
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label>Días a cubrir (objetivo)</label>
                      <div className="input">
                        <input
                          inputMode="numeric"
                          value={String(targetDays)}
                          onChange={e => setTargetDays(Math.max(0, Math.min(180, Number((e.target.value||"0").replace(/[^\d]/g,"")))))}
                          placeholder="14"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <button
                      className="btn"
                      type="button"
                      onClick={async () => {
                        const r = await doCalcFromSales(winDays, targetDays);
                        setCalcDaily(r.daily);
                        setCalcMin(r.min);
                      }}
                    >
                      Calcular
                    </button>
                  </div>

                  <div className="card" style={{ padding: 10 }}>
                    <div className="metric-row">
                      <div className="metric">
                        <div className="label">Consumo diario (prom)</div>
                        <div className="value">{calcDaily != null ? `${calcDaily} u/día` : "—"}</div>
                      </div>
                      <div className="metric">
                        <div className="label">Umbral sugerido</div>
                        <div className="value">{calcMin != null ? `${calcMin} u` : "—"}</div>
                      </div>
                      <div className="metric">
                        <div className="label">Cobertura objetivo</div>
                        <div className="value">{targetDays} días</div>
                      </div>
                    </div>
                    <div className="tiny muted" style={{ marginTop: 6 }}>
                      Guardaremos también la cobertura por tiempo ({targetDays} días) para que el semáforo avise por cobertura.
                    </div>
                  </div>
                </div>
              )}

              {/* Resumen NL + acciones */}
              <div className="tiny" style={{ marginTop: 10, background: "rgba(0,0,0,.03)", padding: 10, borderRadius: 8 }}>
                <strong>Resumen:</strong>{" "}
                {alertMode === 'manual' && (
                  <>Te avisaremos cuando el stock baje de <strong>{aStockMin ? `${aStockMin} u` : "—"}</strong>.</>
                )}
                {alertMode === 'avg' && (
                  <>Umbral ≈ <strong>{calcMin ?? "—"} u</strong> (consumo promedio: <strong>{calcDaily ?? "—"} u/día</strong>). Sin cobertura por tiempo.</>
                )}
                {alertMode === 'cover' && (
                  <>Umbral ≈ <strong>{calcMin ?? "—"} u</strong> (consumo: <strong>{calcDaily ?? "—"} u/día</strong> × <strong>{targetDays} días</strong>). Además alertaremos si la cobertura baja de {targetDays} días.</>
                )}
                {" "}Hoy tienes <strong>{nfInt.format(stockNow)} u</strong>.
              </div>

              <div className="modal-actions" style={{ marginTop: 10 }}>
                <button onClick={() => setOpenAlerts(false)}>Cancelar</button>
                <button className="primary" onClick={save}>Guardar</button>
              </div>
            </div>
          );
        })()}
      </Modal>


      {/* Modal: Predicción de stock */}
      <Modal
        open={openForecast}
        title={`Predicción de stock${forecastTarget ? ` — ${forecastTarget.nombre}` : ""}`}
        onClose={() => setOpenForecast(false)}
        cardClass="forecast-modal-card"
      >
        {/* Tabs */}
        <div className="producttabs" style={{ marginBottom: 10 }}>
          <button
            className={forecastTab === 'basic' ? 'tab active' : 'tab'}
            onClick={() => setForecastTab('basic')}
          >
            Básico
          </button>
          <button
            className={forecastTab === 'advanced' ? 'tab active' : 'tab'}
            onClick={() => setForecastTab('advanced')}
          >
            Avanzado
          </button>
        </div>

        {/* Cómo funciona */}
        <div className="help-box" style={{ padding: 10, border: "1px solid rgba(0,0,0,.08)", borderRadius: 8, marginBottom: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>¿Cómo funciona?</div>
          <ol className="tiny" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
            <li><strong>Elige el histórico</strong> para estimar consumo.</li>
            <li><strong>Calcular</strong> te muestra hasta cuándo te alcanza y la compra sugerida.</li>
            <li><strong>Avanzado</strong> te deja ajustar “próxima compra”, reposición y colchón.</li>
          </ol>
          <div className="tiny muted" style={{ marginTop: 6 }}>
            Esto no mueve inventario; sólo te ayuda a decidir y, si quieres, actualizar alertas.
          </div>
        </div>

        {/* Explicación de parámetros */}
        <details className="help-box" style={{ marginBottom: 10 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>¿Qué significan los parámetros?</summary>
          <ul className="tiny" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
            <li><strong>Histórico a considerar (días):</strong> días de ventas hacia atrás para estimar consumo.</li>
            <li><strong>Próxima compra en (días):</strong> período que quieres cubrir hasta tu siguiente compra.</li>
            <li><strong>Tiempo de reposición (días):</strong> lo que demora tu proveedor en entregar.</li>
            <li>
              <strong>Colchón de seguridad:</strong> extra para cubrir variaciones y atrasos durante la reposición.
              Más colchón ⇒ menos riesgo de quiebre (pero más capital inmovilizado).
            </li>
          </ul>
        </details>

        <div className="form-grid">
          {forecastTab === 'basic' ? (
            /* ====== BÁSICO: sólo histórico ====== */
            <div className="field">
              <label>Histórico a considerar (días)</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div className="input" style={{ width: 100 }}>
                  <input
                    inputMode="numeric"
                    value={String(fWindow)}
                    onChange={e =>
                      setFWindow(Math.max(14, Math.min(365, Number((e.target.value || "0").replace(/[^\d]/g, "")))))
                    }
                    placeholder="60"
                  />
                </div>
                <span className="tiny muted">Rápido:</span>
                {[30, 60, 90].map(d => (
                  <button key={d} className="btn tiny" type="button" onClick={() => setFWindow(d)}>
                    {d}d
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ====== AVANZADO: horizonte, reposición, colchón ====== */
            <div className="form-grid" style={{ marginTop: 0 }}>
              <div className="form-grid grid-2">
                <div className="field">
                  <label>Histórico a considerar (días)</label>
                  <div className="input">
                    <input
                      inputMode="numeric"
                      value={String(fWindow)}
                      onChange={e =>
                        setFWindow(Math.max(14, Math.min(365, Number((e.target.value || "0").replace(/[^\d]/g, "")))))
                      }
                      placeholder="90"
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Próxima compra en (días)</label>
                  <div className="input">
                    <input
                      inputMode="numeric"
                      value={String(fHorizon)}
                      onChange={e =>
                        setFHorizon(Math.max(7, Math.min(120, Number((e.target.value || "0").replace(/[^\d]/g, "")))))
                      }
                      placeholder="30"
                    />
                  </div>
                  <div className="tiny muted">Cubrimos hasta tu próxima compra (más colchón).</div>
                </div>
              </div>

              <div className="form-grid grid-2">
                <div className="field">
                  <label>Tiempo de reposición (días)</label>
                  <div className="input">
                    <input
                      inputMode="numeric"
                      value={String(fLeadTime)}
                      onChange={e =>
                        setFLeadTime(Math.max(0, Math.min(60, Number((e.target.value || "0").replace(/[^\d]/g, "")))))
                      }
                      placeholder="7"
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Colchón de seguridad (nivel de servicio)</label>
                  <div className="input">
                    <select value={String(fService)} onChange={e => setFService(Number(e.target.value))}>
                      <option value="0.8">Bajo (80%)</option>
                      <option value="0.9">Medio (90%)</option>
                      <option value="0.95">Alto (95%)</option>
                      <option value="0.975">Muy alto (97.5%)</option>
                      <option value="0.99">Máximo (99%)</option>
                    </select>
                  </div>
                  <div className="tiny muted">Más alto = menos quiebres esperados (más stock inmovilizado).</div>
                </div>
              </div>
            </div>
          )}

          {/* Calcular */}
          <div>
            <button
              id="btn-forecast-calc"
              className="btn"
              disabled={!forecastTarget || forecastLoading}
              onClick={async () => {
                if (!forecastTarget) return;
                setForecastLoading(true);
                try {
                  const r = await forecastProductAPI(slug, forecastTarget.id, {
                    windowDays: fWindow,
                    horizonDays: fHorizon,
                    leadTimeDays: fLeadTime,
                    serviceLevel: fService,
                  });
                  setForecastRes(r);
                } catch (e:any) {
                  toast.error(e?.message ?? "No se pudo calcular la predicción");
                  setForecastRes(null);
                } finally {
                  setForecastLoading(false);
                }
              }}
            >
              {forecastLoading ? "Calculando…" : "Calcular"}
            </button>
          </div>

          {/* Resultados */}
          {forecastLoading ? (
            <div className="muted" style={{ marginTop: 10 }}>Calculando…</div>
          ) : forecastRes ? (
            <div className="forecast-result" style={{ marginTop: 12, display: "grid", gap: 12 }}>
              {(Array.isArray(forecastRes?.history?.daily) && forecastRes.history.daily.length === 0) && (
                <div className="tiny muted">
                  No hubo ventas en el histórico seleccionado. La proyección será 0 (salvo colchón por reposición).
                </div>
              )}

              <section className="card" style={{ padding: 10 }}>
                <div className="metric-row">
                  <div className="metric">
                    <div className="label">Consumo diario (prom)</div>
                    <div className="value">{avgDailyInt(forecastRes.history?.avgDaily)} u/día</div>
                  </div>
                  <div className="metric">
                    <div className="label">Alcance con stock actual</div>
                    <div className="value">
                      {(() => {
                        const daily = avgDailyInt(forecastRes.history?.avgDaily);
                        const stk = Number(forecastTarget?.stock_actual ?? 0);
                        if (daily <= 0) return "—";
                        const days = Math.max(0, Math.floor(stk / daily));
                        const breakDate = forecastRes.risk?.breakDate ? ` (≈ ${forecastRes.risk.breakDate})` : "";
                        return `${nfInt.format(days)} días${breakDate}`;
                      })()}
                    </div>
                  </div>
                  <div className="metric">
                    <div className="label">Compra sugerida</div>
                    <div className="value">
                      {nfInt.format(Math.max(0, Math.round(forecastRes.policy?.buySuggestion ?? 0)))} u
                    </div>
                  </div>
                </div>
                <div className="tiny muted" style={{ marginTop: 6 }}>
                  Sugerimos comprar lo necesario para un stock objetivo sano considerando tu próxima compra y el colchón.
                </div>
              </section>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {forecastTab === 'basic' ? (
                  <button
                    className="btn"
                    type="button"
                    title="Cargar consumo promedio como umbral (1 día)."
                    onClick={() => {
                      const consumo = avgDailyInt(forecastRes.history?.avgDaily);
                      if (consumo <= 0) { toast.error("No hay ventas en el histórico seleccionado"); return; }

                      // Modo: “según ventas (promedio)”
                      setAConsumoDia(String(consumo));
                      setAUnidad("dias");
                      setACant(0); 
                      setAStockMin(String(consumo));

                      setOpenAlerts(true);
                      toast.success("Cargado: consumo promedio y umbral (1 día)");
                    }}
                  >
                    Usar en alertas — promedio
                  </button>
                ) : (
                  <button
                    className="btn"
                    type="button"
                    title="Cargar consumo y cobertura = horizonte. Activa 'cubrir periodo'."
                    onClick={() => {
                      const consumo = avgDailyInt(forecastRes.history?.avgDaily);
                      const covDias = Math.max(0, Number(fHorizon || 0));
                      if (consumo <= 0) { toast.error("No hay ventas en el histórico seleccionado"); return; }

                      // Modo: “según ventas para cubrir periodo”
                      const umbralCalc = Math.ceil(consumo * covDias);

                      setAConsumoDia(String(consumo));
                      setAUnidad("dias");
                      setACant(covDias); 
                      setAStockMin(String(umbralCalc));

                      setOpenAlerts(true);
                      toast.success(`Cargado: consumo ${consumo}/día y cobertura ${covDias}d`);
                    }}
                  >
                    Usar en alertas — cubrir periodo
                  </button>
                )}

                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => setOpenAlerts(true)}
                  title="Abrir sin pre-cargar valores"
                >
                  Abrir alertas sin cambios
                </button>
              </div>


              <details style={{ marginTop: 4 }}>
                <summary className="tiny" style={{ cursor: "pointer", fontWeight: 600 }}>Ver detalles</summary>
                <div className="metric-row" style={{ marginTop: 8 }}>
                  <div className="metric">
                    <div className="label">Demanda proyectada</div>
                    <div className="value">
                      {nfInt.format(Math.ceil(Number(forecastRes.forecast?.total ?? 0)))} u ({fHorizon}d)
                    </div>
                  </div>
                  <div className="metric">
                    <div className="label">Stock de seguridad (colchón)</div>
                    <div className="value">{nfInt.format(Math.max(0, Math.round(forecastRes.policy?.safetyStock ?? 0)))} u</div>
                  </div>
                  <div className="metric">
                    <div className="label">Stock objetivo</div>
                    <div className="value">{nfInt.format(Math.max(0, Math.round(forecastRes.policy?.targetStock ?? 0)))} u</div>
                  </div>
                </div>
                <div className="tiny muted" style={{ marginTop: 6 }}>
                  Objetivo ≈ demanda proyectada + colchón − stock actual.
                </div>
              </details>
            </div>
          ) : null}
        </div>

        <div className="modal-actions">
          <button onClick={() => setOpenForecast(false)}>Cerrar</button>
        </div>
      </Modal>


      {/* Confirm eliminar */}
      <Modal open={openDelete} title="Eliminar producto" onClose={() => setOpenDelete(false)}>
        <p style={{ margin: "6px 0 12px" }}>
          ¿Eliminar el producto <strong>{deleteTarget?.nombre}</strong>? Esta acción no se puede deshacer.
        </p>
        <div className="modal-actions">
          <button className= "btn" onClick={() => setOpenDelete(false)}>Cancelar</button>
          <button className="btn dangera" onClick={onDelete}>Eliminar</button>
        </div>
      </Modal>

      {/* Bulk: Alertas */}
      <Modal open={openBulkAlerts} title="Aplicar alertas a seleccionados" onClose={() => setOpenBulkAlerts(false)}>
        <div className="form-grid">
          <div className="field">
            <label>Stock mínimo (manual)</label>
            <div className="input">
              <input
                inputMode="numeric"
                value={bulkStockMin}
                onChange={(e) => setBulkStockMin(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="Ej. 10"
              />
            </div>
            <div className="btn-alertbox">
              <button
                className="btn"
                type="button"
                onClick={() => setBulkStockMin(
                  cfg.stock_minimo != null ? String(cfg.stock_minimo) : ""
                )}
                disabled={cfg.stock_minimo == null}
                title={cfg.stock_minimo == null ? "No hay valor preestablecido" : `Usar ${nfInt.format(cfg.stock_minimo)} u`}
              >
                Usar preestablecido ({cfg.stock_minimo != null ? `${nfInt.format(cfg.stock_minimo)} u` : "—"})
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setBulkStockMin("")}
                title="Dejar en NULL"
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button onClick={() => setOpenBulkAlerts(false)}>Cancelar</button>
          <button className="primary" onClick={doBulkAlerts}>Aplicar</button>
        </div>
      </Modal>


      {/* Bulk: Eliminar */}
      <Modal open={openBulkDelete} title="Eliminar productos seleccionados" onClose={() => setOpenBulkDelete(false)}>
        <p style={{ margin: "6px 0 12px" }}>
          Vas a eliminar <strong>{selectedIds.size}</strong> producto(s). Esta acción no se puede deshacer.
        </p>
        <div className="modal-actions">
          <button onClick={() => setOpenBulkDelete(false)}>Cancelar</button>
          <button className="primary danger" onClick={doBulkDelete}>Eliminar</button>
        </div>
      </Modal>
    </div>
  );
}

/* ================== UI: Modal ================== */

function QtyStepper({
  value,
  onChange,
  onStep,
  allowNegative = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onStep: (delta: number) => void;
  allowNegative?: boolean;
}) {
  const sanitize = (s: string) =>
    allowNegative ? s.replace(/[^-\d]/g, "") : s.replace(/[^\d]/g, "");

  return (
    <div className="qty-stepper">
      <button className="btn icon" onClick={() => onStep(-1)} aria-label="Restar 1">−</button>
      <div className="input">
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(sanitize(e.target.value))}
          placeholder={allowNegative ? "0 (ej: -3, +12)" : "0"}
          aria-label="Cantidad"
        />
      </div>
      <button className="btn icon" onClick={() => onStep(+1)} aria-label="Sumar 1">+</button>
    </div>
  );
}

function Modal({
  open, title, onClose, children, cardClass,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  cardClass?: string;
}) {
  if (!open) return null;

  const target = document.getElementById('portal-root') ?? document.body;

  return createPortal(
    <div className="modal products-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className={`modal-card products-modal-card ${cardClass ?? ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div style={{ marginTop: 10 }}>{children}</div>
      </div>
    </div>,
    target
  );
}



/* ================== UI: Menú en portal ================== */
function RowMenuPortal({
  open,
  pos,
  onClose,
  children,
}: {
  open: boolean;
  pos: { top: number; left: number } | null;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open || !pos) return null;
  return createPortal(
    <>
      <div className="rm-overlay" onClick={onClose} />
      <div className="menu portal" role="menu" style={{ top: pos.top, left: pos.left }}>
        {children}
      </div>
    </>,
    document.body
  );
}
