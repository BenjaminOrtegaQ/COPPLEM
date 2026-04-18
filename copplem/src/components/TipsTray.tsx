import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Lightbulb as IconTip,
  ChevronLeft as IconPrev,
  ChevronRight as IconNext,
} from "lucide-react";
import mascotUrl from "../assets/circle-copply-2.svg";
import "../styles/tips.css";

type PageId =
  | "dashboard" | "productos" | "pos" | "reportes"
  | "usuarios"  | "datos"     | "ventas"
  | "faq"       | "docs";

function pageFromPath(pathname: string, slug: string): PageId {
  const base = `/app/${slug}`;
  if (pathname === base || pathname === `${base}/`) return "dashboard";
  const seg = pathname.startsWith(base) ? pathname.slice(base.length + 1) : "";
  const first = (seg.split("/")[0] || "").toLowerCase();
  if (first === "productos") return "productos";
  if (first === "pos") return "pos";
  if (first === "reportes") return "reportes";
  if (first === "usuarios") return "usuarios";
  if (first === "datos") return "datos";
  if (first === "ventas") return "ventas";
  if (first === "faq") return "faq";
  if (first === "docs") return "docs";

  return "dashboard";
}

type TipCtx = { slug: string; state: { originPageId: PageId; originHref: string } };
type TipDef = { id: string; render: (ctx: TipCtx) => React.ReactNode };

const TIP_DEFS: Record<string, TipDef> = {
  "backup-before-import": {
    id: "backup-before-import",
    render: ({ slug, state }) => (
      <>
        Antes de <strong>importar datos</strong>, crea un{" "}
        <Link to={`/app/${slug}/docs/datos/respaldo-completo`} state={state}>
          respaldo completo
        </Link>
        . Luego revisa{" "}
        <Link to={`/app/${slug}/faq#respaldo-restaurar`} state={state}>
          cómo restaurar
        </Link>
        .
      </>
    ),
  },
  "csv-contador": {
    id: "csv-contador",
    render: ({ slug, state }) => (
      <>
        ¿Tu contador pidió info? Usa{" "}
        <Link to={`/app/${slug}/faq#exportar-csv`} state={state}>
          Exportar CSV para contabilidad
        </Link>{" "}
        desde <em>Datos → Gestión de Datos</em>.
      </>
    ),
  },
  "edit-business-info": {
    id: "edit-business-info",
    render: ({ slug, state }) => (
      <>
        ¿Cambiar nombre, giro o dirección? Mira{" "}
        <Link to={`/app/${slug}/faq#editar-negocio`} state={state}>
          cómo editar la información del negocio
        </Link>
        .
      </>
    ),
  },
  "ver-ventas": {
    id: "ver-ventas",
    render: ({ slug, state }) => (
      <>
        Después de registar una venta en el Punto de Venta, revisa{" "}
        <Link to={`/app/${slug}/ventas`} state={state}>
          Ventas
        </Link>
        . También puedes{" "}
        <Link to={`/app/${slug}/faq#exportar-csv`} state={state}>
          exportar CSV{" "}
        </Link>
        desde la sección Datos.
      </>
    ),
  },

  "prod-vista-general": {
    id: "prod-vista-general",
    render: ({ slug, state }) => (
      <>
        ¿Nuevo en esta pantalla? Lee la{" "}
        <Link to={`/app/${slug}/docs/productos/vista-general`} state={state}>
          vista general de Productos
        </Link>{" "}
        y ubica rápido cada acción.
      </>
    ),
  },
  "prod-gestionar": {
    id: "prod-gestionar",
    render: ({ slug, state }) => (
      <>
        Crea, edita y elimina productos en minutos. Guía:{" "}
        <Link to={`/app/${slug}/docs/productos/gestionar-productos`} state={state}>
          Gestionar productos
        </Link>
        .
      </>
    ),
  },
  "prod-importar-excel": {
    id: "prod-importar-excel",
    render: ({ slug, state }) => (
      <>
        ¿Muchos productos? Carga una planilla. Paso a paso:{" "}
        <Link to={`/app/${slug}/docs/productos/importacion-excel`} state={state}>
          Importar desde Excel
        </Link>
        .
      </>
    ),
  },
  "prod-categorias": {
    id: "prod-categorias",
    render: ({ slug, state }) => (
      <>
        Ordena tu catálogo y filtra al instante con{" "}
        <Link to={`/app/${slug}/docs/productos/categorias`} state={state}>
          Categorías
        </Link>
        .
      </>
    ),
  },
  "prod-alertas": {
    id: "prod-alertas",
    render: ({ slug, state }) => (
      <>
        Evita quiebres de stock con{" "}
        <Link to={`/app/${slug}/docs/productos/alertas`} state={state}>
          Alertas de stock
        </Link>
        : mínimo, consumo diario y cobertura en días.
      </>
    ),
  },
  "prod-prediccion": {
    id: "prod-prediccion",
    render: ({ slug, state }) => (
      <>
        Usa{" "}
        <Link to={`/app/${slug}/docs/productos/prediccion-stock`} state={state}>
          Predicción de stock {" "}
        </Link>
        para activar alertas, saber hasta cuándo alcanza tu inventario y cuánto comprar.
      </>
    ),
  },
  "prod-ajustes": {
    id: "prod-ajustes",
    render: ({ slug, state }) => (
      <>
        ¿Las cantidades no cuadran? Corrige cantidades con{" "}
        <Link to={`/app/${slug}/docs/productos/ajustes-stock`} state={state}>
          Ajustes de stock
        </Link>
        .
      </>
    ),
  },
  "prod-acciones-masivas": {
    id: "prod-acciones-masivas",
    render: ({ slug, state }) => (
      <>
        Aplica alertas o elimina varios ítems a la vez con{" "}
        <Link to={`/app/${slug}/docs/productos/acciones-masivas`} state={state}>
          Acciones masivas
        </Link>
        .
      </>
    ),
  },
  "intro-dashboard": {
    id: "intro-dashboard",
    render: ({ slug, state }) => (
      <>
        Revisa el Dashboard con frecuencia para ver lo más relevante.{" "}
        <Link to={`/app/${slug}/docs/dashboard/que-es`} state={state}>
          Más información del Dashboard aquí.
        </Link>
      </>
    ),
  },
  "dashboard-grafico": {
    id: "intro-dashboard",
    render: ({ slug, state }) => (
      <>
        Mira la evolución de tus <strong>Ingresos Totales</strong> en su grafico y elige un período con los botones <strong>Semanal, Mensual</strong> o <strong>Anual.</strong>
      </>
    ),
  },
  "dashboard-tabla": {
    id: "intro-dashboard",
    render: ({ slug, state }) => (
      <>
        En la tabla de <strong>Actividad Reciente</strong> verás las 5 últimas acciones de tu negocio. Filtra por <strong>Todas, Productos</strong> o <strong>Ventas.</strong>
      </>
    ),
  },
  "reportes-exportar": {
    id: "reportes-exportar",
    render: ({ slug, state }) => (
      <>
        Usa los botones de arriba para <strong>exportar tus reportes</strong> en formato <strong>PDF</strong> o <strong>Excel</strong>, los <strong>periodos</strong> podrás seleccionarlos a tu gusto.
      </>
    ),
  },
  "reportes-intro": {
    id: "reportes-intro",
    render: ({ slug, state }) => (
      <>
        Revisa la sección Reportes para más información de tu negocio.{" "}
        <Link to={`/app/${slug}/faq#editar-negocio`} state={state}>
          Más información de Reportes aquí.
        </Link>
        .
      </>
    ),
  },
  "usuarios-intro": {
    id: "usuarios-intro",
    render: ({ slug, state }) => (
      <>
        <strong>Administra los usuarios</strong> de esta empresa en la sección Usuarios. <strong>Pulsa ⋮</strong> en cada uno para ver las opciones disponibles.
      </>
    ),
  },
  "usuarios-accesos": {
    id: "usuarios-accesos",
    render: ({ slug, state }) => (
      <>
        Por defecto los usuarios solo pueden acceder al Punto de Venta, <strong>habilítales más secciones en Gestionar Accesos</strong>.
      </>
    ),
  },
};

const TIP_RULES: Record<PageId, string[]> = {
  dashboard: ["intro-dashboard", "dashboard-grafico", "dashboard-tabla"],

  productos: [
    "prod-vista-general",
    "prod-gestionar",
    "prod-importar-excel",
    "prod-categorias",
    "prod-alertas",
    "prod-prediccion",
    "prod-ajustes",
    "prod-acciones-masivas",
  ],

  pos: ["ver-ventas", "csv-contador"],
  reportes: ["reportes-intro","reportes-exportar","csv-contador"],
  usuarios: ["usuarios-intro","usuarios-accesos"],
  datos: ["edit-business-info","backup-before-import", "csv-contador"],
  ventas: ["csv-contador"],
  faq: [],
  docs: [],

};

const kCollapsed = (slug: string) => `copplem:tipsfx:collapsed:${slug}`;
const kDisabled  = (slug: string) => `copplem:tipsfx:disabled:${slug}`;

export default function TipsTray({ slug }: { slug: string }) {
  const loc  = useLocation();
  const page = useMemo(() => pageFromPath(loc.pathname, slug), [loc.pathname, slug]);

  const originState = useMemo(
    () => ({ originPageId: page, originHref: `${loc.pathname}${loc.search}${loc.hash}` }),
    [page, loc.pathname, loc.search, loc.hash]
  );

  const [isDisabled, setIsDisabled] = useState<boolean>(() => {
    try { return localStorage.getItem(kDisabled(slug)) === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { setIsDisabled(localStorage.getItem(kDisabled(slug)) === "1"); } catch {}
  }, [slug]);
  useEffect(() => {
    const onToggle = (e: Event) => {
      const detail = (e as any)?.detail as { slug: string; disabled: boolean } | undefined;
      if (detail?.slug === slug) setIsDisabled(!!detail.disabled);
    };
    window.addEventListener("tipsfx:toggle", onToggle as any);
    return () => window.removeEventListener("tipsfx:toggle", onToggle as any);
  }, [slug]);

  // abierto/cerrado
  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(kCollapsed(slug)) !== "1"; } catch { return true; }
  });
  const setCollapsed = (collapsed: boolean) => {
    setOpen(!collapsed);
    try { localStorage.setItem(kCollapsed(slug), collapsed ? "1" : "0"); } catch {}
  };

  const tips = useMemo(() => {
    const ids = TIP_RULES[page] || [];
    return ids.map(id => TIP_DEFS[id]).filter(Boolean);
  }, [page]);

  const [idx, setIdx] = useState(0);
    useEffect(() => {
    setIdx(0);
  }, [page, (tips?.length ?? 0)]);

  useEffect(() => {
    if (idx >= tips.length) setIdx(0);
  }, [idx, tips.length]);

  const safeIdx = Math.min(Math.max(idx, 0), tips.length - 1);

  // --- Numeros --//
  const visiblePages = useMemo<number[]>(() => {
    const total = tips.length;
    const current = safeIdx;
    const maxBtns = 5;

    if (total <= maxBtns) {
      return Array.from({ length: total }, (_, i) => i);
    }

    const lastIndex = total - 1;
    const cur1 = current + 1;

    let middle: number[] = [];

    if (cur1 <= 3) {
      middle = [2, 3, 4];
    } else if (cur1 >= total - 2) {
      middle = [total - 3, total - 2, total - 1];
    } else {
      middle = [cur1 - 1, cur1, cur1 + 1];
    }

    const out = [0, ...middle.map(n => n - 1), lastIndex];

    const uniqSorted = Array.from(new Set(out)).sort((a, b) => a - b);

    if (uniqSorted.length > maxBtns) {
      const extra = uniqSorted.length - maxBtns;
      uniqSorted.splice(1 + Math.floor((uniqSorted.length - 2 - extra) / 2), extra);
    }

    return uniqSorted;
  }, [tips.length, safeIdx]);

  if (isDisabled || tips.length === 0) return null;

  const tip = tips[safeIdx];

  const prev = () => setIdx(i => (i - 1 + tips.length) % tips.length);
  const next = () => setIdx(i => (i + 1) % tips.length);

  return (
    <div className="tips-tray fx" data-open={open ? "1" : "0"} aria-live="polite">
      <div className="tt-card">
        {/* Solo Copply cuando está cerrado */}
        <button
          className="tt-fab"
          aria-label="Mostrar consejo"
          onClick={() => setCollapsed(false)}
        >
          <img className="tt-mascot" src={mascotUrl} alt="" />
        </button>

        {/* Contenido */}
        <div className="tt-content" aria-hidden={!open}>
          <div className="tt-icon" aria-hidden="true">
            <IconTip size={18} />
          </div>

          <div className="tt-body">
            <div className="tt-title">Consejo</div>
            <p className="tt-text">{tip.render({ slug, state: originState })}</p>
          </div>

          {/* Copply */}
          <button
            className="tt-mascot-btn"
            aria-label="Ocultar consejo"
            onClick={() => setCollapsed(true)}
            title="Ocultar consejo"
          >
            <img className="tt-mascot in-card" src={mascotUrl} alt="" />
          </button>

          {/* Navegación de tips */}
          {tips.length > 1 && (
            <div className="tt-nav" aria-label="Navegación de consejos">
              <button
                className="tt-nav-btn prev"
                onClick={prev}
                aria-label="Consejo anterior"
                disabled={tips.length <= 1}
              >
                <IconPrev size={16} />
              </button>

              <div className="tt-pages" role="navigation" aria-label="Seleccionar consejo">
                {visiblePages.map((p) => (
                  <button
                    key={p}
                    className={`tt-page ${p === safeIdx ? "active" : ""}`}
                    aria-current={p === safeIdx ? "page" : undefined}
                    onClick={() => setIdx(p)}
                  >
                    {p + 1}
                  </button>
                ))}
              </div>

              <button
                className="tt-nav-btn next"
                onClick={next}
                aria-label="Siguiente consejo"
                disabled={tips.length <= 1}
              >
                <IconNext size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
