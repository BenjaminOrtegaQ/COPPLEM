// src/pages/Data.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import { createPortal } from "react-dom";

import {
  Info as IconInfo,
  Database as IconDb,
  FileUp as IconImport,
  FileDown as IconExport,
  HelpCircle as IconHelp,
  Edit3 as IconEdit,
  Save as IconSave,
  X as IconCancel,
  Building2 as IconBiz,
  MapPin as IconMap,
  Phone as IconPhone,
  Mail as IconMail,
  Settings as IconData,

} from "lucide-react";
import "../styles/data.css";
import pkg from "../../package.json";

// Hook/Tipos compartidos
import { useBusinessInfo } from "../hooks/useBusinessInfo";
import type { Business } from "../shared/business";

/* ----------------- Tipos (para el formulario) ----------------- */
type BusinessInfo = {
  nombre: string;
  rut: string;
  giro: string;
  direccion: string;
  comuna: string;
  ciudad: string;
  region: string;
  telefono: string;
  email: string;
};

const onExportCsv = () => toast("Exportar CSV para contabilidad (placeholder)");


/* ----------------- Helpers de API (para contadores y extras) ----------------- */

const api = (window as any).api ?? {};
function hasFn(name: string) { return typeof api?.[name] === "function"; }

async function callFirst<T = any>(
  candidates: string[],
  payload?: any,
  pick?: (raw: any) => T
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  for (const name of candidates) {
    if (hasFn(name)) {
      try {
        const raw = await api[name](payload);
        const data = pick ? pick(raw) : (raw?.ok ? raw.data : raw);
        if (raw && raw.ok === false) return { ok: false, error: raw.error || "Error" };
        return { ok: true, data };
      } catch (e: any) {
        return { ok: false, error: e?.message || String(e) };
      }
    }
  }
  return { ok: false, error: "Método no disponible en preload" };
}

/** Normaliza objeto del negocio */
function toFormBiz(biz: Business | null): BusinessInfo {
  return {
    nombre: biz?.nombre ?? "",
    rut: biz?.rut ?? "",
    giro: biz?.giro ?? "",
    direccion: biz?.direccion ?? "",
    comuna: biz?.comuna ?? "",
    ciudad: biz?.ciudad ?? "",
    region: biz?.region ?? "",
    telefono: biz?.telefono ?? "",
    email: biz?.email ?? "",
  };
}

const nf = new Intl.NumberFormat("es-CL");

function fmtBytes(n?: number | null) {
  if (n == null) return "—";
  const kb = 1024, mb = kb*1024, gb = mb*1024;
  if (n >= gb) return (n/gb).toFixed(2)+" GB";
  if (n >= mb) return (n/mb).toFixed(2)+" MB";
  if (n >= kb) return (n/kb).toFixed(2)+" KB";
  return n + " B";
}

type BackupRow = {
  id: string; slug: string; createdAt: string; sizeBytes: number;
  productos: number; ventas: number; appVersion: string | null; absPath: string;
};

// --- Normalizadores para respaldos ---
function numOrNull(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function normalizeBackupRow(b: any): BackupRow {
  const createdAtISO =
    typeof b?.createdAt === "number"
      ? new Date(b.createdAt).toISOString()
      : typeof b?.createdAt === "string"
      ? new Date(b.createdAt).toISOString()
      : new Date().toISOString();

  const productos =
    numOrNull(b?.productos) ??
    numOrNull(b?.productosCount) ??
    numOrNull(b?.countProductos) ??
    numOrNull(b?.totalProductos) ??
    0;

  const ventas =
    numOrNull(b?.ventas) ??
    numOrNull(b?.sales) ??
    numOrNull(b?.transacciones) ??
    numOrNull(b?.salesCount) ??
    0;

  const sizeBytes =
    numOrNull(b?.sizeBytes) ??
    numOrNull(b?.bytes) ??
    0;

  return {
    id: String(b?.id ?? b?.filename ?? b?.name ?? createdAtISO),
    slug: String(b?.slug ?? ""),
    createdAt: createdAtISO,
    sizeBytes,
    productos,
    ventas,
    appVersion: b?.appVersion ?? b?.version ?? null,
    absPath: String(b?.absPath ?? b?.path ?? ""),
  };
}


/* ====== Utils mínimos para avatar ====== */
const DEFAULT_AVATAR_BG = "#ffe8da";
function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join("");
}
function hexToRgb(hex: string) {
  let h = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{3,6}$/.test(h)) return { r: 255, g: 255, b: 255 };
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
function textColorForBg(bgHex: string) {
  const { r, g, b } = hexToRgb(bgHex);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6 ? "#1f2937" : "#ffffff";
}
function BizAvatar({ name, avatarUrl, bgColor }:{
  name: string; avatarUrl?: string | null; bgColor?: string | null;
}) {
  const bg = avatarUrl ? null : (bgColor ?? DEFAULT_AVATAR_BG);
  return (
    <div
      className="biz-avatar"
      style={{ background: bg ?? undefined, color: bg ? textColorForBg(bg) : undefined }}
      aria-hidden={!!avatarUrl}
      title={`Icono de ${name}`}
    >
      {avatarUrl ? <img src={avatarUrl} alt={`Logo de ${name}`} /> : initials(name)}
    </div>
  );
}

/* ----------------- Componente ----------------- */
export default function Data() {
  const { slug = "" } = useParams();
  const nav = useNavigate();
  const loc = useLocation();

  const originState = useMemo(
    () => ({ originPageId: "datos" as const, originHref: `${loc.pathname}${loc.search}${loc.hash}` }),
    [loc.pathname, loc.search, loc.hash]
  );

  // Carga/guardar del negocio con hook (lee del .sqlite de esta empresa)
  const { data: biz, loading: loadingBiz, error, refresh, update } = useBusinessInfo(slug);

  // UI: edición local
  const [info, setInfo] = useState<BusinessInfo>(toFormBiz(null));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // meta para avatar (name/logo/color) desde lista de empresas
  const [meta, setMeta] = useState<{ name: string; avatarUrl?: string | null; color?: string | null } | null>(null);

  // sistema / métricas
  const version = useMemo(() => (pkg as any).version || "0.0.0", []);
  const [usersCount, setUsersCount] = useState<number | null>(null);
  const [productsCount, setProductsCount] = useState<number | null>(null);
  const [transactionsCount, setTransactionsCount] = useState<number | null>(null);
  const [salesAmount, setSalesAmount] = useState<number | null>(null);

  useEffect(() => { setInfo(toFormBiz(biz ?? null)); }, [biz]);

  // Carga meta para avatar
  useEffect(() => {
    (async () => {
      try {
        const list: any[] = await (window as any).api?.listCompanies?.();
        const found = Array.isArray(list) ? list.find((x) => x.slug === slug) : null;
        if (found) setMeta({ name: found.name, avatarUrl: found.avatarUrl ?? null, color: found.color ?? null });
      } catch {}
    })();
  }, [slug]);

  /* --------- Detectar cambios sin guardar --------- */
  const hasChanges = useMemo(() => {
    if (!biz) return false;
    const A = toFormBiz(biz);
    const B = info;
    return (
      A.nombre !== B.nombre ||
      A.rut !== B.rut ||
      A.giro !== B.giro ||
      A.direccion !== B.direccion ||
      A.comuna !== B.comuna ||
      A.ciudad !== B.ciudad ||
      A.region !== B.region ||
      A.telefono !== B.telefono ||
      A.email !== B.email
    );
  }, [biz, info]);

  /* --------- Interceptar navegación (enlaces internos) + beforeunload --------- */
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (editing && hasChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [editing, hasChanges]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!editing || !hasChanges) return;

      let el = e.target as HTMLElement | null;
      while (el && el !== document.body) {
        if (el instanceof HTMLAnchorElement && el.href) {
          const isSameOrigin = el.origin === window.location.origin;
          const isHashOnly = el.getAttribute("href")?.startsWith("#");
          const isBlank = el.target === "_blank" || el.rel.includes("external");
          const isDownload = !!el.download;
          if (isSameOrigin && !isHashOnly && !isBlank && !isDownload) {
            e.preventDefault();
            setPendingHref(el.href);
          }
          return;
        }
        el = el.parentElement;
      }
    };
    document.addEventListener("click", onDocClick, true); // captura
    return () => document.removeEventListener("click", onDocClick, true);
  }, [editing, hasChanges]);

  /* --------- carga de métricas (productos, usuarios, ventas) --------- */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Productos
        if (hasFn("countProducts")) {
          try {
            const r = await api.countProducts({ slug });
            if (!cancelled) setProductsCount(typeof r === "number" ? r : r?.count ?? null);
          } catch { if (!cancelled) setProductsCount(null); }
        } else {
          const res = await callFirst<any[]>(
            ["listProducts", "getProducts"],
            { slug, q: "" },
            (raw) => (Array.isArray(raw) ? raw : raw?.data ?? [])
          );
          if (!cancelled) setProductsCount(res.ok && Array.isArray(res.data) ? res.data.length : null);
        }

        // Usuarios
        if (hasFn("countUsers")) {
          try {
            const r = await api.countUsers({ slug });
            if (!cancelled) setUsersCount(typeof r === "number" ? r : r?.count ?? null);
          } catch { if (!cancelled) setUsersCount(null); }
        } else {
          const res = await callFirst<any[]>(
            ["listUsers", "getUsers"],
            { slug },
            (raw) => (Array.isArray(raw) ? raw : raw?.data ?? [])
          );
          if (!cancelled) setUsersCount(res.ok && Array.isArray(res.data) ? res.data.length : null);
        }

        // Ventas: separando monto (CLP) y número de transacciones
        if (hasFn("getSalesSummary")) {
          try {
            const s = await api.getSalesSummary({ slug });

            const amount =
              typeof s?.total === "number" ? s.total :
              typeof s?.montoTotal === "number" ? s.montoTotal :
              typeof s?.data?.total === "number" ? s.data.total : null;

            const count =
              typeof s?.count === "number" ? s.count :
              typeof s?.ventas === "number" ? s.ventas :
              typeof s?.transacciones === "number" ? s.transacciones :
              typeof s?.data?.count === "number" ? s.data.count : null;

            if (!cancelled) {
              setSalesAmount(amount);
              setTransactionsCount(count);
            }
          } catch {
            if (!cancelled) { setSalesAmount(null); setTransactionsCount(null); }
          }
        } else if (hasFn("getDashboardTotals")) {
          try {
            const s = await api.getDashboardTotals({ slug });

            const amount =
              typeof s?.salesAmount === "number" ? s.salesAmount :
              typeof s?.salesTotal === "number" ? s.salesTotal :
              typeof s?.montoTotal === "number" ? s.montoTotal :
              typeof s?.data?.salesAmount === "number" ? s.data.salesAmount : null;

            const count =
              typeof s?.transactions === "number" ? s.transactions :
              typeof s?.salesCount === "number" ? s.salesCount :
              typeof s?.transacciones === "number" ? s.transacciones :
              typeof s?.data?.transactions === "number" ? s.data.transactions : null;

            if (!cancelled) {
              setSalesAmount(amount);
              setTransactionsCount(count);
            }
          } catch {
            if (!cancelled) { setSalesAmount(null); setTransactionsCount(null); }
          }
        } else if (hasFn("getReports")) {
          try {
            const r = await api.getReports({ slug, mode: "total" });
            const amount = (r?.kpis && typeof r.kpis.revenue === "number") ? r.kpis.revenue : null;
            const count  = (r?.kpis && typeof r.kpis.transactions === "number") ? r.kpis.transactions : null;
            if (!cancelled) {
              setSalesAmount(amount);
              setTransactionsCount(count);
            }
          } catch {
            if (!cancelled) { setSalesAmount(null); setTransactionsCount(null); }
          }
        } else {
          if (!cancelled) { setSalesAmount(null); setTransactionsCount(null); }
        }
      } catch {
      }
    })();

    return () => { cancelled = true; };
  }, [slug]);

  // === Backups ===
const [backups, setBackups] = useState<BackupRow[]>([]);
const [loadingBackups, setLoadingBackups] = useState(false);
const [restoring, setRestoring] = useState<BackupRow | null>(null);
const [deleting, setDeleting] = useState<BackupRow | null>(null);
const [deletingBusy, setDeletingBusy] = useState(false);

// === Modal de respaldos ===
const [showBackupsModal, setShowBackupsModal] = useState(false);

// === Preferencia de auto-backup (días) por empresa ===
const [autoDays, setAutoDays] = useState<number>(7);
const [savingAutoDays, setSavingAutoDays] = useState(false);

useEffect(() => {
  (async () => {
    try {
      const res = await (window as any).api?.getAutoBackupDays?.({ slug });
      const d = Number(res?.days);
      if (Number.isFinite(d) && d > 0) setAutoDays(d);
    } catch {}
  })();
}, [slug]);


async function openBackupsModal() {
  await loadBackups();
  setShowBackupsModal(true);
}


async function loadBackups() {
  if (!hasFn("listBackups")) return;
  setLoadingBackups(true);
  try {
    const raw: any[] = await api.listBackups({ slug });
    const arr: BackupRow[] = (Array.isArray(raw) ? raw : []).map(normalizeBackupRow);
    setBackups(arr);
  } catch {
    setBackups([]);
  } finally {
    setLoadingBackups(false);
  }
}


// Modal eliminar respaldo
function onDeleteBackup(row: BackupRow) {
  setDeleting(row);
}

// Confirma eliminación desde el modal
async function confirmDeleteBackup(row: BackupRow) {
  try {
    setDeletingBusy(true);
    await api.deleteBackup({ slug, filename: row.id });
    toast.success("Respaldo eliminado");
    await loadBackups();
  } catch (e:any) {
    toast.error(e?.message ?? "No se pudo eliminar el respaldo");
  } finally {
    setDeletingBusy(false);
    setDeleting(null);
  }
}

// Restaurar arrastrando
const onImportPickedFile = async (file: File | null) => {
  if (!file) return;
  const abs = (file as any).path;
  if (!abs) {
    toast.error("No pude leer la ruta del archivo en este entorno. Usa el botón “Seleccionar archivo…”.");
    return;
  }
  try {
    await api.restoreBackupFromPath({ slug, absPath: abs });
    toast.success("Restaurado desde archivo. Reiniciando…");
    await new Promise(r => setTimeout(r, 600));
    await api.restartApp({ slug });
  } catch (e:any) {
    toast.error(e?.message ?? "Falló la restauración");
  }
};


useEffect(() => {
  (async () => {
    try { await api.ensureAutoBackup?.({ slug, maxAgeDays: autoDays }); } catch {}
    await loadBackups();
  })();
}, [slug, autoDays]);

async function onCreateBackupNow() {
  try {
    await api.createBackup({ slug });
    toast.success("Respaldo creado");
    await loadBackups();
  } catch (e:any) {
    toast.error(e?.message ?? "No se pudo crear el respaldo");
  }
}

async function onOpenBackupsFolder() {
  try { await api.openBackupsFolder({ slug }); } catch {}
}

function onRestoreFromList(row: BackupRow) {
  setRestoring(row);
}

async function confirmRestore(row: BackupRow) {
  try {
    await api.restoreBackup({ slug, filename: row.id });
    toast.success("Base restaurada. Reiniciando…");
    await new Promise(r => setTimeout(r, 600));
    await api.restartApp({ slug });
  } catch (e:any) {
    toast.error(e?.message ?? "No se pudo restaurar");
  } finally {
    setRestoring(null);
  }
}


  /* --------- acciones --------- */
  const onEditToggle = () => setEditing((e) => !e);
  const onCancel = () => setEditing(false);

  const onSave = async () => {
    if (!info.nombre.trim()) {
      toast.error("El nombre del negocio es obligatorio.");
      return false;
    }
    try {
      setSaving(true);
      await update({
        nombre: info.nombre,
        rut: info.rut || null,
        giro: info.giro || null,
        direccion: info.direccion || null,
        comuna: info.comuna || null,
        ciudad: info.ciudad || null,
        region: info.region || null,
        telefono: info.telefono || null,
        email: info.email || null,
      });
      toast.success("Datos guardados");
      setEditing(false);
      await refresh();
      return true;
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Gestión de datos
  const onImportFile = async () => {
    try {
      const res = await api.pickSqlite?.();
      if (!res?.ok) return;
      await api.restoreBackupFromPath({ slug, absPath: res.filePath });
      toast.success("Restaurado desde archivo. Reiniciando…");
      await new Promise(r => setTimeout(r, 600));
      await api.restartApp({ slug });
    } catch (e:any) {
      toast.error(e?.message ?? "Falló la restauración");
    }
  };

  const loading = loadingBiz;

    // ======== Exportar contabilidad ========
    const [showAccModal, setShowAccModal] = useState(false);

    // helper para construir periodos mensuales
    function monthsBack(n: number) {
      const out: Array<{ from: string; to: string; label: string }> = [];
      const today = new Date();
      for (let i = 0; i < n; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const from = new Date(d.getFullYear(), d.getMonth(), 1);
        const to   = new Date(d.getFullYear(), d.getMonth()+1, 0);
        const y = from.getFullYear(), m = String(from.getMonth()+1).padStart(2,"0");
        out.push({ from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10), label: `${y}-${m}` });
      }
      return out;
    }

    // acción del modal
    async function doExportAccounting(
      periods: Array<{from:string;to:string;label:string}>,
      includeItems: boolean
    ) {
      try {
        // Guardar como…
        const defaultName = periods.length === 1
          ? `Libro_Ventas_${periods[0].label}.xlsx`
          : `Libro_Ventas_${new Date().toISOString().slice(0,10)}.xlsx`;

        const filePath = await api.pickSaveFile?.({
          defaultPath: defaultName,
          filters: [{ name: "Excel", extensions: ["xlsx"] }],
        });
        if (!filePath) return;

        const res = await api.accountingExportXlsx({
          slug,
          periods,
          filePath,
          includeItems,
        });

        if (res?.ok && res.dest) {
          toast((t) => (
            <div style={{ display: "grid", gap: 8 }}>
              <b>Excel contable generado</b>
              <small style={{ opacity: 0.8 }}>{res.dest}</small>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  className="btn btn-sm"
                  onClick={() => { api.revealInFolder?.(res.dest); toast.dismiss(t.id); }}
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
          toast.error(res?.error ?? "No se pudo exportar");
        }
      } catch (e:any) {
        toast.error(e?.message ?? "Error al exportar");
      }
    }


  /* --------- UI --------- */
  return (
    <div className="data-wrap">
      <Toaster position="top-right" />

      <header className="page-header">
        <div className="ph-left">
          <div className="ph-icon" aria-hidden="true"><IconData size={28} aria-hidden="true" color="#D07A43" /></div>
          <div>
            <h1>Datos y Configuración</h1>
            <p className="muted">Gestiona la información de tu negocio y base de datos</p>
          </div>
        </div>
      </header>


      <div className="data-grid">
        {/* Información del Negocio */}
        <section className="card">
          <header className="card-head">
            <div className="ch-left">
              <BizAvatar
                name={(meta?.name ?? info.nombre) || "Empresa"}
                avatarUrl={meta?.avatarUrl}
                bgColor={meta?.color}
              />
              <div>
                <div className="ch-title">Información del Negocio</div>
                <div className="ch-sub muted">Datos generales de tu negocio</div>
              </div>
            </div>
            <div className="ch-actions">
              {!editing ? (
                <button className="icon ghost" onClick={onEditToggle} aria-label="Editar" disabled={loading}>
                  <IconEdit size={18} />
                </button>
              ) : (
                <>
                  <button className="icon ghost" onClick={onCancel} aria-label="Cancelar" disabled={saving}>
                    <IconCancel size={18} />
                  </button>
                  <button className="primary" onClick={onSave} disabled={saving || loading}>
                    <IconSave size={16} style={{ marginRight: 6 }} />
                    {saving ? "Guardando…" : "Guardar"}
                  </button>
                </>
              )}
            </div>
          </header>

          <div className="biz-form">
            {/* nombre / rut */}
            <div className="row two">
              <Field
                label="Nombre del Negocio"
                icon={<IconBiz size={16} />}
                value={info.nombre}
                onChange={(v) => setInfo({ ...info, nombre: v })}
                editing={editing}
                loading={loading}
              />
              <Field
                label="RUT"
                value={info.rut}
                onChange={(v) => setInfo({ ...info, rut: v })}
                editing={editing}
                loading={loading}
              />
            </div>

            {/* giro */}
            <div className="row one">
              <Field
                label="Giro Comercial"
                value={info.giro}
                onChange={(v) => setInfo({ ...info, giro: v })}
                editing={editing}
                loading={loading}
              />
            </div>

            {/* dirección */}
            <div className="row one">
              <Field
                label="Dirección"
                icon={<IconMap size={16} />}
                value={info.direccion}
                onChange={(v) => setInfo({ ...info, direccion: v })}
                editing={editing}
                loading={loading}
              />
            </div>

            {/* comuna / ciudad / región */}
            <div className="row three">
              <Field label="Comuna"  value={info.comuna}  onChange={(v)=>setInfo({...info, comuna:v})}  editing={editing} loading={loading}/>
              <Field label="Ciudad"  value={info.ciudad}  onChange={(v)=>setInfo({...info, ciudad:v})}  editing={editing} loading={loading}/>
              <Field label="Región"  value={info.region}  onChange={(v)=>setInfo({...info, region:v})}  editing={editing} loading={loading}/>
            </div>

            {/* teléfono / email */}
            <div className="row two">
              <Field
                label="Teléfono"
                icon={<IconPhone size={16} />}
                value={info.telefono}
                onChange={(v) => setInfo({ ...info, telefono: v })}
                editing={editing}
                loading={loading}
              />
              <Field
                label="Email"
                icon={<IconMail size={16} />}
                value={info.email}
                onChange={(v) => setInfo({ ...info, email: v })}
                editing={editing}
                loading={loading}
              />
            </div>
          </div>
        </section>

        {/* Columna derecha */}
        <aside className="right-col">
          {/* Sistema */}
          <section className="card">
            <header className="card-head">
              <div className="ch-left">
                <div className="ch-ic"><IconDb size={18} /></div>
                <div className="ch-title">Información del Sistema</div>
              </div>
            </header>

            <div className="sys-list">
              <SysRow label="Versión" value={version} />
              <SysRow label="Usuarios" value={usersCount == null ? "—" : nf.format(usersCount)} />
              <SysRow label="Productos" value={productsCount == null ? "—" : nf.format(productsCount)} />
              <SysRow label="Transacciones" value={transactionsCount == null ? "—" : nf.format(transactionsCount)} />
              <SysRow label="Ventas (CLP)" value={salesAmount == null ? "—" : `$${nf.format(salesAmount)}`} />
            </div>
          </section>

          {/* Soporte */}
          <section className="card">
            <header className="card-head">
              <div className="ch-left">
                <div className="ch-ic"><IconHelp size={18} /></div>
                <div className="ch-title">Soporte</div>
              </div>
            </header>

            <p className="muted" style={{ margin: "0 0 10px 0" }}>
              ¿Necesitas ayuda? Revisa la documentación y las preguntas frecuentes de la App.
            </p>

            {/* Documentación */}
            <Link
              className="btn primary wfull"
              style={{ marginTop: 8 }}
              to={`/app/${slug}/docs`}
              state={originState}
            >
              Documentación
            </Link>

            {/* Preguntas Frecuentes */}
            <Link
              className="btn primary wfull"
              style={{ marginTop: 8 }}
              to={`/app/${slug}/faq`}
              state={originState}
            >
              Preguntas Frecuentes
            </Link>
          </section>
        </aside>
      </div>

      {/* Gestión de datos */}
      <section className="card mg-top">
        <header className="card-head">
          <div className="ch-left">
            <div className="ch-ic"><IconDb size={18} /></div>
            <div>
              <div className="ch-title">Gestión de Datos</div>
              <div className="ch-sub muted">Respaldos y restauración</div>
            </div>
          </div>
          <div className="ch-actions" />
        </header>

        <div className="data-manage">
          {/* Restaurar desde archivo externo */}
          <div className="dm-box">
            <div className="dm-head">
              <IconImport size={16} />
              <strong>Restaurar desde archivo</strong>
            </div>
            <p className="muted small">Usa un .sqlite local (de otra máquina o copia manual).</p>

            {/* Zona de arrastrar/soltar + elegir archivo */}
            <label className="drop">
              <input
                type="file"
                accept=".sqlite,.db"
                onChange={(e) => onImportPickedFile(e.target.files?.[0] || null)}
              />
              <div className="drop-inner">
                <IconImport size={20} />
                <div>Arrastra y suelta aquí</div>
                <div className="muted tiny">o haz clic para seleccionar un archivo .sqlite</div>
              </div>
            </label>

            <button className="btn primary wfull" style={{ marginTop: 8 }} onClick={onImportFile}>
              Seleccionar archivo .sqlite
            </button>

            <div className="note warning" style={{ marginTop: 10 }}>
              <strong>Advertencia:</strong> Restaurar reemplaza todos los datos actuales.
              Crearemos un respaldo automático antes de continuar y la app se reiniciará.
            </div>
          </div>

          {/* Respaldos existentes */}
          <div className="dm-box">
            <div className="dm-head">
              <IconExport size={16} />
              <strong>Respaldos existentes</strong>
            </div>
            <p className="muted small">Administra, revisa y restaura tus respaldos.</p>

            <div className="dm-actions">
              <button className="btn wfull" onClick={onOpenBackupsFolder}>
                Abrir carpeta de respaldos
              </button>
              <button className="btn wfull" onClick={openBackupsModal}>
                Ver respaldos
              </button>
              <button className="primary wfull" onClick={onCreateBackupNow} disabled={loadingBackups}>
                Crear respaldo ahora
              </button>
            </div>

            {/* Preferencia: auto-backup cada N días */}
            <div className="autobackup-row" style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  id="autodays"
                  type="number"
                  min={1}
                  max={90}
                  value={autoDays}
                  onChange={(e) => setAutoDays(Math.min(90, Math.max(1, Math.round(Number(e.target.value || 1)))))}
                  style={{ width: 90 }}
                />
                <button
                  className="btn"
                  onClick={async () => {
                    try {
                      setSavingAutoDays(true);
                      const res = await (window as any).api?.setAutoBackupDays?.({ slug, days: autoDays });
                      const d = Number(res?.days);
                      if (Number.isFinite(d) && d > 0) {
                        setAutoDays(d);
                        toast.success(`Se ajustó auto-backup a cada ${d} día(s).`);
                        try { await api.ensureAutoBackup?.({ slug, maxAgeDays: d }); } catch {}
                      } else {
                        toast.error("No se pudo guardar el valor.");
                      }
                    } catch (e:any) {
                      toast.error(e?.message ?? "No se pudo guardar el valor.");
                    } finally {
                      setSavingAutoDays(false);
                    }
                  }}
                  disabled={savingAutoDays}
                >
                  {savingAutoDays ? "Guardando…" : "Guardar intervalo"}
                </button>
              </div>
            </div>

            <p className="muted tiny" style={{ marginTop: 10 }}>
              Creamos una copia segura y completa de tu base de datos{" "}
              <span title="Usamos un método de copia consistente de SQLite (VACUUM INTO).">
                (método seguro)
              </span>. Además se hará un respaldo según el intervalo de días que selecciones.
            </p>

          </div>
        </div>

        {/* Exportar contabilidad (XLSX) */}
        <div className="dm-box">
          <div className="dm-head">
            <IconExport size={16} />
            <strong>Exportar para Contabilidad</strong>
          </div>
          <p className="muted small">Genera un Excel listo para tu contador (Libro de Ventas y, opcionalmente, detalle de ítems).</p>
          <button className="btn primary wfull" onClick={() => setShowAccModal(true)}>
            Exportar a Excel (XLSX)
          </button>
          <p className="muted tiny" style={{ marginTop: 10 }}>
            Puedes exportar varios periodos a la vez (una hoja por periodo).
          </p>
        </div>
        </section>

        

      {/* Modal de confirmación de restauración */}
      {restoring && (
        <div className="modal" role="dialog" aria-modal="true" onClick={() => setRestoring(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 style={{ margin: 0 }}>Confirmar restauración</h3>
              <button className="icon" onClick={() => setRestoring(null)} aria-label="Cerrar">✕</button>
            </div>
            <p style={{ marginTop: 10 }}>
              Vas a restaurar <strong>{restoring.id}</strong><br />
              Fecha: {new Date(restoring.createdAt).toLocaleString()}<br />
              Tamaño: {fmtBytes(restoring.sizeBytes)} · Productos: {nf.format(restoring.productos)} · Ventas: {nf.format(restoring.ventas)}
            </p>
            <div className="note warning">
              Se hará un respaldo automático del estado actual antes de reemplazar la base de datos.
              La aplicación se reiniciará para aplicar los cambios.
            </div>
            <div className="modal-actions">
              <button onClick={() => setRestoring(null)}>Cancelar</button>
              <button className="primary" onClick={() => confirmRestore(restoring)}>
                Restaurar y reiniciar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: confirmar eliminación de respaldo */}
      {deleting && createPortal(
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          onClick={() => setDeleting(null)}
          style={{ zIndex: 1001 }} // ← más alto que el modal de lista
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 style={{ margin: 0 }}>Eliminar respaldo</h3>
              <button className="icon" onClick={() => setDeleting(null)} aria-label="Cerrar">✕</button>
            </div>

            <p style={{ marginTop: 10 }}>
              Vas a eliminar el respaldo <strong>{deleting.id}</strong><br />
              Fecha: {new Date(deleting.createdAt).toLocaleString()}<br />
              Tamaño: {fmtBytes(deleting.sizeBytes)} · Productos: {nf.format(deleting.productos)} · Ventas: {nf.format(deleting.ventas)}
            </p>

            <div className="note warning">
              Esta acción <b>no se puede deshacer</b>. El archivo y su metadato serán eliminados.
            </div>

            <div className="modal-actions">
              <button onClick={() => setDeleting(null)} disabled={deletingBusy}>Cancelar</button>
              <button
                className="danger"
                onClick={() => confirmDeleteBackup(deleting)}
                disabled={deletingBusy}
              >
                {deletingBusy ? "Eliminando…" : "Eliminar respaldo"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}



      {/* Modal: listado de respaldos */}
      {showBackupsModal && (
        <div className="modal" role="dialog" aria-modal="true" onClick={() => setShowBackupsModal(false)}>
          <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 style={{ margin: 0 }}>Respaldos de {slug}</h3>
              <button className="icon" onClick={() => setShowBackupsModal(false)} aria-label="Cerrar">✕</button>
            </div>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Fecha</th>
                    <th>Tamaño</th>
                    <th>Productos</th>
                    <th>Transacciones</th>
                    <th>Versión</th>
                    <th style={{ width: 200 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {loadingBackups ? (
                    <tr><td colSpan={7} className="muted">Cargando…</td></tr>
                  ) : backups.length === 0 ? (
                    <tr><td colSpan={7} className="muted">Aún no hay respaldos</td></tr>
                  ) : (
                    backups.map((b, i) => (
                      <tr key={b.id}>
                        <td>{backups.length - i}</td>
                        <td>{new Date(b.createdAt).toLocaleString()}</td>
                        <td>{fmtBytes(b.sizeBytes)}</td>
                        <td>{nf.format(b.productos)}</td>
                        <td>{nf.format(b.ventas)}</td>
                        <td>{b.appVersion ?? "—"}</td>
                        <td style={{ textAlign: "right", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button
                            className="primary"
                            onClick={() => {
                              setShowBackupsModal(false);
                              onRestoreFromList(b);
                            }}
                          >
                            Restaurar
                          </button>
                          <button
                            className="danger"
                            onClick={() => onDeleteBackup(b)}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="modal-foot">
              <div className="left">
                <button className="btn" onClick={loadBackups} disabled={loadingBackups}>
                  Actualizar lista
                </button>
                <button
                  className="primary"
                  onClick={async () => { await onCreateBackupNow(); await loadBackups(); }}
                  disabled={loadingBackups}
                >
                  Crear respaldo ahora
                </button>
              </div>
              <div className="right">
                <button className="btn" onClick={() => setShowBackupsModal(false)}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Exportar para Contabilidad */}
      {showAccModal && (
        <div className="modal" role="dialog" aria-modal="true" onClick={() => setShowAccModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 style={{ margin: 0 }}>Exportar para Contabilidad</h3>
              <button className="icon" onClick={() => setShowAccModal(false)} aria-label="Cerrar">✕</button>
            </div>

            <AccExportForm
              onCancel={() => setShowAccModal(false)}
              onConfirm={async (periods, includeItems) => {
                setShowAccModal(false);
                await doExportAccounting(periods, includeItems);
              }}
            />
          </div>
        </div>
      )}



      {/* ===== Confirmación de navegación si hay cambios ===== */}
      {pendingHref && (
        <div className="modal" role="dialog" aria-modal="true" onClick={() => setPendingHref(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 style={{ margin: 0 }}>Cambios sin guardar</h3>
              <button className="icon" onClick={() => setPendingHref(null)} aria-label="Cerrar">✕</button>
            </div>
            <p style={{ marginTop: 10 }}>
              Tienes cambios en el formulario. ¿Quieres guardar antes de salir?
            </p>
            <div className="modal-actions">
              {/* Salir sin guardar */}
              <button
                onClick={() => {
                  const href = pendingHref;
                  setPendingHref(null);
                  if (href) {
                    const url = new URL(href, window.location.href);
                    nav(url.pathname + url.search + url.hash, { state: originState });
                  }
                }}
              >
                Salir sin guardar
              </button>

              {/* Guardar y continuar */}
              <button
                className="primary"
                onClick={async () => {
                  const href = pendingHref;
                  const ok = await onSave();
                  if (ok && href) {
                    const url = new URL(href, window.location.href);
                    setPendingHref(null);
                    nav(url.pathname + url.search + url.hash, { state: originState });
                  } else {
                    setPendingHref(null);
                  }
                }}
                disabled={saving}
              >
                {saving ? "Guardando…" : "Guardar y continuar"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
      );
      }

      /* ------- Subcomponentes ------- */

      function Field({
        label,
        value,
        onChange,
        editing,
        loading,
        icon,
      }: {
        label: string;
        value: string;
        onChange: (v: string) => void;
        editing?: boolean;
        loading?: boolean;
        icon?: React.ReactNode;
      }) {
        if (!editing) {
          return (
            <div className="field">
              <label>{label}</label>
              <div className="readbox">
                {icon ? <span className="ic">{icon}</span> : null}
                <span className="readtext">{value || "—"}</span>
              </div>
            </div>
          );
        }
        return (
          <div className="field">
            <label>{label}</label>
            <div className="input">
              {icon ? <span className="ic">{icon}</span> : null}
              <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="—"
                disabled={loading}
              />
            </div>
          </div>
        );
      }

      function SysRow({ label, value }: { label: string; value: React.ReactNode }) {
        return (
          <div className="sys-row">
            <span className="lbl">{label}</span>
            <span className="val">{value}</span>
          </div>
        );
      }

      function AccExportForm({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (periods: Array<{from:string;to:string;label:string}>, includeItems: boolean) => void;
}) {
  const [preset, setPreset] = useState<"lastMonth"|"last3"|"last6"|"ytd"|"custom">("lastMonth");
  const [from, setFrom] = useState<string>("");
  const [to, setTo]     = useState<string>("");
  const [includeItems, setIncludeItems] = useState<boolean>(true);

  const buildPeriods = () => {
    const localMonthsBack = (n: number) => {
      const out: Array<{ from: string; to: string; label: string }> = [];
      const today = new Date();
      for (let i = 0; i < n; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const from = new Date(d.getFullYear(), d.getMonth(), 1);
        const to   = new Date(d.getFullYear(), d.getMonth()+1, 0);
        const y = from.getFullYear(), m = String(from.getMonth()+1).padStart(2,"0");
        out.push({ from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10), label: `${y}-${m}` });
      }
      return out;
    };

    if (preset === "lastMonth") return localMonthsBack(1);
    if (preset === "last3")     return localMonthsBack(3).reverse();
    if (preset === "last6")     return localMonthsBack(6).reverse();
    if (preset === "ytd") {
      const today = new Date();
      const n = today.getMonth() + 1;
      return localMonthsBack(n).reverse();
    }
    if (from && to) {
      return [{ from, to, label: `${from} a ${to}` }];
    }
    return [];
  };

  return (
    <div>
      <p className="muted small" style={{ marginTop: 6 }}>
        El archivo tendrá <b>una hoja por periodo</b> con el Libro de Ventas. Puedes además incluir una hoja de <b>ítems</b> por periodo.
      </p>

      <div className="form-grid" style={{ marginTop: 12 }}>
        <div className="field">
          <label>Periodo</label>
          <div className="input">
            <select value={preset} onChange={(e)=>setPreset(e.target.value as any)}>
              <option value="lastMonth">Mes anterior</option>
              <option value="last3">Últimos 3 meses</option>
              <option value="last6">Últimos 6 meses</option>
              <option value="ytd">Año en curso (YTD)</option>
              <option value="custom">Rango personalizado</option>
            </select>
          </div>
        </div>

        {preset === "custom" && (
          <div className="form-grid grid-2">
            <div className="field">
              <label>Desde</label>
              <div className="input"><input type="date" value={from} onChange={e=>setFrom(e.target.value)} /></div>
            </div>
            <div className="field">
              <label>Hasta</label>
              <div className="input"><input type="date" value={to} onChange={e=>setTo(e.target.value)} /></div>
            </div>
          </div>
        )}

        <label className="checkrow" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={includeItems} onChange={() => setIncludeItems(!includeItems)} />
          <span>Incluir hoja de detalle de ítems</span>
        </label>
      </div>

      <div className="modal-actions">
        <button onClick={onCancel}>Cancelar</button>
        <button
          className="primary"
          onClick={() => {
            const periods = buildPeriods();
            if (!periods.length) return toast.error("Selecciona un periodo válido");
            onConfirm(periods, includeItems);
          }}
        >
          Exportar
        </button>
      </div>
    </div>
  );
}
