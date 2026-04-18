// src/pages/Docs.tsx
import { useEffect, useLayoutEffect, useMemo, useState, type ComponentProps } from "react";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import {
  ChevronDown as IconDown,
  ChevronRight as IconRight,
  Search as IconSearch,
  ArrowLeft as IconBack,
} from "lucide-react";
import "../styles/docs.css";
import cornerSvg from "../assets/copply-up.svg";

/* =======================
   1) Carga de los markdowwn
   ======================= */
const mdFiles = import.meta.glob("../docs/**/*.md", {
  import: "default",
  query: "?raw",
});

type DocMeta = {
  id: string;      // "primeros-pasos/introduccion"
  section: string; // "primeros-pasos"
  page: string;    // "introduccion"
  title: string;   // "Introducción"
  summary?: string;
  file: string;
  tags?: string[];
};

const DOCS: DocMeta[] = [
  { id: "primeros-pasos/introduccion",    section: "primeros-pasos", page: "introduccion",        title: "Introducción",                                 summary: "Qué es COPPLEM y cómo moverte por la app.",                                                                file: "../docs/primeros-pasos/introduccion.md",   tags: ["inicio", "tour", "principiantes"] },
  { id: "pos/registrar-una-venta",        section: "pos",            page: "registrar-una-venta", title: "Registrar una venta",                summary: "Paso a paso para registrar un cobro.",                                                                     file: "../docs/pos/registrar-una-venta.md",        tags: ["pos", "ventas", "caja"] },
  { id: "datos/respaldo-completo",        section: "datos",          page: "respaldo-completo",   title: "Crear un respaldo completo",                   summary: "Cómo generar y guardar un backup.",                                                                        file: "../docs/datos/respaldo-completo.md",       tags: ["backup", "seguridad"] },
  { id: "productos/vista-general",        section: "productos",      page: "vista-general",       title: "Vista general",                                summary: "Cómo se organiza y qué puedes hacer en el módulo Productos.",                                              file: "../docs/productos/vista-general.md",       tags: ["overview", "productos"] },
  { id: "productos/gestionar-productos",  section: "productos",      page: "gestionar-productos", title: "Gestionar productos",                          summary: "Crear, editar, buscar, ordenar y eliminar productos.",                                                     file: "../docs/productos/gestionar-productos.md", tags: ["productos", "basicos"] },
  { id: "productos/alertas",              section: "productos",      page: "alertas",             title: "Alertas por producto",                         summary: "Configurar mínimo, consumo estimado y cobertura por tiempo; cómo se calculan las alertas.",                file: "../docs/productos/alertas.md",             tags: ["alertas", "umbrales"] },
  { id: "productos/prediccion-stock",     section: "productos",      page: "prediccion-stock",    title: "Predicción de stock",                          summary: "Cómo configurar ventana, horizonte, lead time y nivel de servicio para obtener una sugerencia de compra.", file: "../docs/productos/prediccion-stock.md",    tags: ["prediccion", "stock", "planificacion"] },
  { id: "productos/categorias",           section: "productos",      page: "categorias",          title: "Categorías",                                   summary: "Cómo crear, editar y usar categorías para organizar tus productos.",                                       file: "../docs/productos/categorias.md",          tags: ["categorias", "organizacion"] },
  { id: "productos/importacion-excel",    section: "productos",      page: "importacion-excel",   title: "Importación desde Excel",                      summary: "Cómo usar la plantilla, importar y qué hace el post-proceso.",                                             file: "../docs/productos/importacion-excel.md",   tags: ["excel", "importacion"] },
  { id: "productos/ajustes-stock",        section: "productos",      page: "ajustes-stock",       title: "Ajustes de stock",                             summary: "Cómo aplicar ajustes y buenas prácticas de inventario.",                                                   file: "../docs/productos/ajustes-stock.md",       tags: ["stock", "inventario", "ajustes"] },
  { id: "productos/acciones-masivas",     section: "productos",      page: "acciones-masivas",    title: "Acciones masivas",                             summary: "Aplicar alertas o eliminar varios productos a la vez.",                                                    file: "../docs/productos/acciones-masivas.md",    tags: ["masivo", "alertas", "eliminar"] },
  { id: "dashboard/que-es",               section: "dashboard",      page: "que-es",              title: "Dashboard — ¿Qué es?",                         summary: "Resumen general y para qué sirve.",                                                                        file: "../docs/dashboard/que-es.md",              tags: ["inicio", "resumen"] },
  { id: "dashboard/kpis",                 section: "dashboard",      page: "kpis",                title: "Indicadores rápidos",                          summary: "Ventas del día, ingresos y contador de stock bajo.",                                                       file: "../docs/dashboard/kpis.md",                tags: ["ventas", "ingresos", "stock"] },
  { id: "dashboard/ingresos",             section: "dashboard",      page: "ingresos",            title: "Ingresos totales (gráfico)",                   summary: "Cómo leer la línea de ingresos por período.",                                                              file: "../docs/dashboard/ingresos.md",            tags: ["gráfico", "tendencia"] },
  { id: "dashboard/categorias",           section: "dashboard",      page: "categorias",          title: "Categorías (donut)",                           summary: "Participación por categoría y cómo usarla.",                                                               file: "../docs/dashboard/categorias.md",          tags: ["categorías", "mix"] },
  { id: "dashboard/margen-bruto",         section: "dashboard",      page: "margen-bruto",        title: "Margen bruto",                                 summary: "Indicador semicírculo y acciones si cae el margen.",                                                       file: "../docs/dashboard/margen-bruto.md",        tags: ["margen", "rentabilidad"] },
  { id: "dashboard/actividad",            section: "dashboard",      page: "actividad",           title: "Actividad reciente",                           summary: "Ventas, ajustes y cambios recientes con filtro.",                                                          file: "../docs/dashboard/actividad.md",           tags: ["historial", "auditoría"] },
  { id: "dashboard/mas-vendido",          section: "dashboard",      page: "mas-vendido",         title: "Producto más vendido",                         summary: "Cómo aprovechar el top seller y vigilar su stock.",                                                        file: "../docs/dashboard/mas-vendido.md",         tags: ["productos", "top"] },
  { id: "dashboard/stock-bajo-modal",     section: "dashboard",      page: "stock-bajo-modal",    title: "Lista de productos con stock bajo",    summary: "Cómo actuar cuando hay alertas rojas/amarillas.",                                                          file: "../docs/dashboard/stock-bajo-modal.md",    tags: ["stock", "alertas"] },
  { id: "reportes/vista-general",         section: "reportes",       page: "vista-general",       title: "Vista General",                                summary: "Revisa como funciona la información de tu negocio en el modulo de Reportes",                               file: "../docs/reportes/vista-general.md",        tags: ["reportes", "información"] },

];

const SECTIONS = [
  { key: "primeros-pasos", title: "Primeros pasos" },
  { key: "dashboard",      title: "Dashboard" },
  { key: "productos",      title: "Productos" },
  { key: "pos",            title: "Punto de Venta" },
  { key: "reportes",       title: "Reportes" },
  { key: "datos",          title: "Datos & Respaldos" },

];

const lastHrefKey = (slug: string) => `copplem:nav:lastHref:${slug}`;

/* =========================================
   3) Helper para cargar .md
   ========================================= */
async function loadMd(filePath: string): Promise<string> {
  let loader = mdFiles[filePath] as undefined | (() => Promise<string>);
  if (!loader) {
    const key = Object.keys(mdFiles).find(k => k.toLowerCase() === filePath.toLowerCase());
    if (key) loader = mdFiles[key] as any;
  }
  if (!loader) {
    console.warn("[Docs] No se encontró el MD:", filePath, "Disponibles:", Object.keys(mdFiles));
    return `# Documento no encontrado\n\nNo existe: \`${filePath}\``;
  }
  try {
    return await loader();
  } catch (e) {
    console.error("[Docs] Error cargando MD:", e);
    return `# Error al cargar\n\nOcurrió un problema cargando \`${filePath}\`.`;
  }
}

/* =========================================
   4) Componente principal
   ========================================= */
export default function Docs() {
  const { slug = "", section, page } = useParams();
  const loc = useLocation();
  const nav = useNavigate();

  useLayoutEffect(() => {
    try { (window.history as any).scrollRestoration = 'auto'; } catch {}

    const se = document.scrollingElement as HTMLElement | null;
    if (se) se.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);

    document.documentElement.classList.add("no-scroll");
    document.body.classList.add("no-scroll");

    const main = document.querySelector<HTMLElement>(".page");
    const prevOverflow = main ? main.style.overflow : "";
    if (main) main.style.overflow = "hidden";

    return () => {
      document.documentElement.classList.remove("no-scroll");
      document.body.classList.remove("no-scroll");
      if (main) main.style.overflow = prevOverflow;
    };
  }, []);


  const current: DocMeta = useMemo(() => {
    const wantedId = section && page ? `${section}/${page}` : "";
    return (
      DOCS.find(d => d.id === wantedId) ||
      DOCS.find(d => d.section === "primeros-pasos") ||
      DOCS[0]
    )!;
  }, [section, page]);

  const [md, setMd] = useState<string>("");
  const [allMd, setAllMd] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");

  const [openSecs, setOpenSecs] = useState<Record<string, boolean>>({
    "primeros-pasos": true,
    [current.section]: true,
  });
  const [allOpen, setAllOpen] = useState<null | boolean>(null);

  useEffect(() => { (async () => setMd(await loadMd(current.file)))(); }, [current.file]);

  useEffect(() => {
    (async () => {
      const entries = await Promise.all(DOCS.map(async d => [d.id, await loadMd(d.file)] as const));
      setAllMd(Object.fromEntries(entries));
    })();
  }, []);

  useEffect(() => {
    if (loc.hash) {
      const id = decodeURIComponent(loc.hash.replace("#", ""));
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loc, md]);

  const filteredDocs = useMemo(() => {
    if (!q.trim()) return DOCS;
    const needle = q.trim().toLowerCase();
    return DOCS.filter(d => {
      const haystack = (d.title + " " + (d.tags || []).join(" ") + " " + (allMd[d.id] || "")).toLowerCase();
      return haystack.includes(needle);
    });
  }, [q, allMd]);

  const toDoc = (d: DocMeta) => `/app/${slug}/docs/${d.section}/${d.page}`;

  // ===== Botón Volver =====
  const goBack = () => {
    const st = (loc.state as any) || {};
    const originHref: string | null =
      st.originHref ||
      sessionStorage.getItem(lastHrefKey(slug)) ||
      null;
    if (originHref) nav(originHref);
    else nav(`/app/${slug}`);
  };

  const baseState = (loc.state as any) || {};

  const MdLink = ({ href = "", children, ...props }: ComponentProps<"a">) => {
  if (href.startsWith("#")) {
    return (
      <a
        href={href}
        {...props}
        onClick={(e) => {
          e.preventDefault();
          const targetId = href.replace("#", ""); 
          const targetElement = document.getElementById(targetId);
          if (targetElement) {
            targetElement.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }
        }}
      >
        {children}
      </a>
    );
  }

  return <Link to={href} {...props}>{children}</Link>;
};

  const hasQuery = q.trim().length > 0;

  const toc = useMemo(() => {
    const out: { level: 2 | 3; text: string; slug: string }[] = [];
    if (!md) return out;
    for (const line of md.split("\n")) {
      const m = /^(#{2,3})\s+(.+)$/.exec(line);
      if (!m) continue;
      const level = m[1].length === 2 ? 2 : 3;
      const text = m[2].trim();
      const slug = text
        .toLowerCase()
        .normalize("NFD").replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim().replace(/\s+/g, "-");
      out.push({ level, text, slug });
    }
    return out;
  }, [md]);

  const setSectionOpen = (key: string, val: boolean) =>
    setOpenSecs(s => ({ ...s, [key]: val }));
  const toggleSection = (key: string) =>
    setOpenSecs(s => ({ ...s, [key]: !s[key] }));

  useEffect(() => {
    if (allOpen === null) return;
    const next: Record<string, boolean> = {};
    for (const s of SECTIONS) next[s.key] = allOpen;
    setOpenSecs(next);
  }, [allOpen]);

  useEffect(() => {
    const content = document.querySelector<HTMLElement>(".docs-content");
    requestAnimationFrame(() => {
      if (content) content.scrollTop = 0;
    });
  }, [section, page]);

  useEffect(() => {
    if (loc.hash) return;
    const content = document.querySelector<HTMLElement>(".docs-content");
    requestAnimationFrame(() => {
      if (content) content.scrollTop = 0;
    });
  }, [md, loc.hash]);

  return (
    <div className="docs-wrap">
      {/* --------- SIDEBAR --------- */}
      <aside className="docs-sidebar">
        <div className="docs-search">
          <IconSearch size={16} className="ic" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar documentación…"
            aria-label="Buscar"
          />
        </div>

        {!hasQuery && (
          <div className="docs-controls">
            <button className="linklike" onClick={() => setAllOpen(true)}>Expandir todo</button>
            <button className="linklike" onClick={() => setAllOpen(false)}>Colapsar todo</button>
          </div>
        )}

        {hasQuery ? (
          <div className="docs-results-title">
            Resultados ({filteredDocs.length})
          </div>
        ) : null}

        <div className="docs-sections">
          {hasQuery ? (
            <nav className="docs-list flat">
              {filteredDocs.map(d => (
                <Link
                  key={d.id}
                  className={`docs-item ${d.id === current.id ? "active" : ""}`}
                  to={toDoc(d)}
                  state={baseState}
                >
                  <div className="docs-item-title">{d.title}</div>
                  {d.summary && <div className="docs-item-summary clamp-2">{d.summary}</div>}
                </Link>
              ))}
            </nav>
          ) : (
            SECTIONS.map(sec => {
              const items = filteredDocs.filter(d => d.section === sec.key);
              if (!items.length) return null;
              const open = !!openSecs[sec.key];
              if (current.section === sec.key && openSecs[sec.key] === undefined) {
                setSectionOpen(sec.key, true);
              }
              return (
                <div className="docs-sec" key={sec.key}>
                  <button
                    className="docs-sec-title btnfold"
                    aria-expanded={open}
                    onClick={() => toggleSection(sec.key)}
                  >
                    {open ? <IconDown size={16} className="fold-arrow" /> : <IconRight size={16} className="fold-arrow" />}
                    <span>{sec.title}</span>
                    <span className="count">{items.length}</span>
                  </button>

                  {open && (
                    <nav className="docs-list">
                      {items.map(d => (
                        <Link
                          key={d.id}
                          className={`docs-item ${d.id === current.id ? "active" : ""}`}
                          to={toDoc(d)}
                          state={baseState}
                        >
                          <div className="docs-item-title">{d.title}</div>
                          {d.summary && <div className="docs-item-summary clamp-2">{d.summary}</div>}
                        </Link>
                      ))}
                    </nav>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* --------- CONTENIDO --------- */}
      <article className="docs-content">
        <header className="docs-head">
          <div className="docs-head-main">
            <h1>{current.title}</h1>
            {!!toc.length && (
              <nav className="docs-toc" aria-label="Índice de esta página">
                {toc.map((t, i) => (
                  <a key={i} href={`#${t.slug}`} className={`toc-item lvl-${t.level}`}>
                    {t.text}
                  </a>
                ))}
              </nav>
            )}
          </div>
          <div className="docs-actions">
            <button className="ghost center" onClick={goBack} aria-label="Volver">
              <IconBack size={16} />
              <span>Volver</span>
            </button>
            <Link className="btn small" to={`/app/${slug}/faq`} state={baseState}>Ver FAQ</Link>
          </div>
        </header>

        <div className="md-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[
              rehypeSlug,
              [rehypeAutolinkHeadings, { behavior: "wrap", properties: { className: "heading-anchor" } }],
            ]}
            components={{
              a: MdLink,
              img: (props) => <img {...props} loading="lazy" />,
            }}
          >
            {md}
          </ReactMarkdown>
        </div>
      </article>
      <div className="floating-svg" aria-hidden="true">
        <img src={cornerSvg} />
      </div>
    </div>
  
  );
}
