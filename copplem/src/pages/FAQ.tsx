// src/pages/FAQ.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import {
  HelpCircle as IconHelp,
  ChevronDown as IconChevron,
  Search as IconSearch,
  ArrowLeft as IconBack,
} from "lucide-react";
import mascotUrl from "../assets/happy-copply-cut.svg";

import "../styles/faq.css";

type FaqItem = {
  id: string;
  category: string;
  q: string;
  a: string;
};

const FAQS: FaqItem[] = [
  { id: "respaldo-restaurar", category: "Datos", q: "¿Cómo restauro un respaldo de la base de datos?", a: "Ve a Datos → Gestión de Datos → Importar Datos. Selecciona un archivo .sqlite" },
  { id: "exportar-csv", category: "Datos", q: "¿Cómo exporto un CSV para el contador?", a: "En Datos → Gestión de Datos → Exportar Datos, usa “Exportar CSV para Contabilidad”. El archivo incluye ventas en un formato estándar (fechas, total y detalle) compatible con herramientas contables." },
  { id: "respaldo-completo", category: "Datos", q: "¿Qué incluye el respaldo completo?", a: "El respaldo completo incluye productos, ventas, inventario y usuarios. Es ideal para migraciones o resguardo periódico." },
  { id: "editar-negocio", category: "Empresa", q: "¿Cómo edito la información de mi negocio?", a: "En Datos y Configuración, presiona el lápiz, realiza los cambios (nombre, RUT, giro, dirección, etc.) y luego “Guardar”. Si intentas navegar con cambios sin guardar, se te pedirá confirmación." },
  { id: "usuarios-permisos", category: "Usuarios", q: "¿Qué permisos necesitan los usuarios?", a: "Depende del rol que definas. De forma predeterminado tienen acceso al Punto de Venta pero desde la seccion de Usuarios puedes habilitarles más secciones." },
];

function useHash() {
  const { hash } = useLocation();
  return hash?.replace(/^#/, "") || "";
}

function highlight(text: string, query: string) {
  if (!query.trim()) return text;
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${safe})`, "ig");
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p) ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>
  );
}

// helpers nav-origen
const lastHrefKey = (slug: string) => `copplem:nav:lastHref:${slug}`;

export default function Faq() {
  const { slug = "" } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const hash = useHash();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("todas");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement | null>(null);

  const categories = useMemo(
    () => ["todas", ...Array.from(new Set(FAQS.map(f => f.category)))],
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQS.filter(f => {
      const byCat = category === "todas" || f.category === category;
      const byText = !q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
      return byCat && byText;
    });
  }, [category, query]);

  useEffect(() => {
    if (!hash) return;
    const target = FAQS.find(f => f.id === hash);
    if (target) {
      setOpen(prev => new Set(prev).add(target.id));
      setTimeout(() => {
        const el = document.getElementById(`qa-${target.id}`);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }
  }, [hash]);

  const toggle = (id: string) => {
    setOpen(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setOpen(new Set(filtered.map(f => f.id)));
  const collapseAll = () => setOpen(new Set());

  const goBack = () => {
    const st = (loc.state as any) || {};
    const originHref: string | null =
      st.originHref ||
      sessionStorage.getItem(lastHrefKey(slug)) ||
      null;
    if (originHref) {
      nav(originHref);
    } else {
      nav(`/app/${slug}`);
    }
  };

  return (
    <div className="faq-wrap">
      <Toaster position="top-right" />

      <header className="page-header">
        <div className="ph-left">
          <div className="ph-icon" aria-hidden="true"><IconHelp size={30} aria-hidden="true" color="#D07A43" /></div>
          <div>
            <h1>Preguntas Frecuentes</h1>
            <p className="muted">Encuentra respuestas rápidas sobre la App</p>
          </div>
        </div>
        <div className="ph-actions">
          <button className="ghost" onClick={goBack} aria-label="Volver">
            <IconBack size={16} style={{ marginRight: 6 }} /> Volver
          </button>
          <Link className="btn small" to={`/app/${slug}/docs`}>Ver Documentación</Link>
        </div>
      </header>

      <section className="card">
        <header className="card-head">
          <div className="ch-left">
            <div className="ch-ic"><IconHelp size={18} /></div>
            <div className="ch-title">Centro de ayuda</div>
          </div>
          <div className="ch-actions">
            <button className="ghost" onClick={expandAll}>Expandir todo</button>
            <button className="ghost" onClick={collapseAll}>Contraer todo</button>
          </div>
        </header>

        {/* Filtros */}
        <div className="faq-filters">
          <div className="faq-search">
            <IconSearch size={16} />
            <input
              placeholder="Buscar preguntas..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar en preguntas frecuentes"
            />
          </div>
          <div className="faq-category">
            <label className="muted tiny">Categoría</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Lista */}
        <div className="faq-list" ref={listRef}>
          {filtered.length === 0 && (
            <p className="muted" style={{ margin: "8px 0" }}>
              No encontramos resultados para “{query}”.
            </p>
          )}

          {filtered.map((f) => {
            const isOpen = open.has(f.id);
            const panelId = `panel-${f.id}`;
            const btnId = `btn-${f.id}`;

            return (
              <article key={f.id} id={`qa-${f.id}`} className={`qa ${isOpen ? "open" : ""}`}>
                <h3 className="qa-q">
                  <button
                    id={btnId}
                    className="qa-toggle"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggle(f.id)}
                  >
                    <IconChevron size={16} className="chev" aria-hidden />
                    <span className="q-text">{highlight(f.q, query)}</span>
                    <span className="badge">{f.category}</span>
                  </button>
                </h3>

                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={btnId}
                  className="qa-a"
                  hidden={!isOpen}
                >
                  <p>{highlight(f.a, query)}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <img className="faq-mascot" src={mascotUrl} alt="" />
    </div>
  );
}
