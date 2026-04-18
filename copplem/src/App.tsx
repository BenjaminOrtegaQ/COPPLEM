// src/App.tsx
import { Outlet, NavLink, useNavigate, useParams, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard as IconDash,
  Package as IconBox,
  ShoppingCart as IconPOS,
  BarChart3 as IconReports,
  Users as IconUsers,
  Settings as IconData,
  Building as IconBuilding,
  ChevronDown as IconChevron,
  LogOut as IconLogout,
  User as IconUser,
} from "lucide-react";
import appLogoUrl from "../src/assets/logo.svg";
import { Avatar } from "./components/avatar";
import TipsTray from "./components/TipsTray";
import { getAllowedPages, normRole } from "./perm";

type Company = {
  slug: string;
  name: string;
  avatarUrl?: string | null;
  color?: string | null;
};

type PageId =
  | "dashboard"
  | "productos"
  | "pos"
  | "reportes"
  | "usuarios"
  | "datos"
  | "ventas"
  | "faq"
  | "docs";

function roleLabel(rol?: string) {
  const r = String(rol || "").toUpperCase();
  return r === "ADMIN" ? "Admin" : "Vendedor";
}

// === Helpers de “origen de navegación” ===
const lastPageKey  = (slug: string) => `copplem:nav:lastPageId:${slug}`;
const lastHrefKey  = (slug: string) => `copplem:nav:lastHref:${slug}`;
const NAV_TABS: Array<Exclude<PageId, "ventas" | "faq" | "docs">> = [
  "dashboard","productos","pos","reportes","usuarios","datos"
];

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

/* ===== ScrollRestorer: resetea scroll y maneja #anclas ===== */
function ScrollRestorer() {
  const loc = useLocation();

  useEffect(() => {
    const scrollAllToTop = () => {
      // contenedor principal
      const main = document.querySelector<HTMLElement>(".page");
      main?.scrollTo({ top: 0, left: 0, behavior: "auto" });

      // body/document
      const se = document.scrollingElement as HTMLElement | null;
      se?.scrollTo({ top: 0, left: 0, behavior: "auto" });
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    if (loc.hash) {
      setTimeout(() => {
        const id = decodeURIComponent(loc.hash.slice(1));
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: "auto", block: "start" });
        } else {
          scrollAllToTop();
        }
      }, 0);
      return;
    }

    setTimeout(scrollAllToTop, 0);
  }, [loc.pathname, loc.search, loc.hash, loc.key]);

  return null;
}

export default function App() {
  const nav = useNavigate();
  const loc = useLocation();
  const { slug = "" } = useParams();

  // ===== Sesión y permisos =====
  const session = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("copplem:session") || "null"); }
    catch { return null; }
  }, []);
  const userName: string = session?.user?.nombre || session?.user?.username || "";
  const userRoleRaw: string | undefined = session?.user?.rol;
  const userRole: string = roleLabel(userRoleRaw);
  const isAdmin = normRole(userRoleRaw) === "ADMIN";

  // páginas permitidas (para este slug)
  const allowed = useMemo(() => getAllowedPages(slug), [slug]);

  // ===== Persistir “última página/href” en páginas principales =====
  useEffect(() => {
    const page = pageFromPath(loc.pathname, slug);
    if (["dashboard","productos","pos","reportes","usuarios","datos","ventas"].includes(page)) {
      try {
        sessionStorage.setItem(lastPageKey(slug), page);
        const href = `${loc.pathname}${loc.search}${loc.hash}`;
        sessionStorage.setItem(lastHrefKey(slug), href);
      } catch {}
    }
  }, [loc.pathname, loc.search, loc.hash, slug]);

  // ===== Override del tab activo cuando estamos en POS o Ventas =====
  const here = pageFromPath(loc.pathname, slug);
  const originPageId: PageId | null = useMemo(() => {
    const st = (loc.state as any) || {};
    return (st.originPageId as PageId) ||
          (sessionStorage.getItem(lastPageKey(slug)) as PageId | null) ||
          null;
  }, [loc.state, slug]);

  const activeOverride: null | Exclude<typeof NAV_TABS[number], never> = useMemo(() => {
    // En ventas, marcar punto de venta como activo
    if (here === "ventas") return "pos"; 

    // Lógica existente para FAQ/Docs
    if (here !== "faq" && here !== "docs") return null;
    if (!originPageId) return null;
    if (!NAV_TABS.includes(originPageId as any)) return null;
    if (!isAdmin && !allowed.includes(originPageId as any)) return null;

    return originPageId as any;
  }, [here, originPageId, isAdmin, allowed]);



  // ===== Empresa actual =====
  const [company, setCompany] = useState<Company | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const list: Company[] = await window.api.listCompanies();
        setCompany(list.find(x => x.slug === slug) || null);
      } catch { setCompany(null); }
    })();
  }, [slug]);

  const to = (p: string) => `/app/${slug}${p}`;

  const signOut = async () => {
    try { await window.api?.logout?.(); } catch {}
    try { localStorage.removeItem("copplem:session"); } catch {}
    nav(`/login/${slug}`);
  };

  // ===== Desplegable Empresa (solo ADMIN) =====
  const [openCompanyMenu, setOpenCompanyMenu] = useState(false);
  const companyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!openCompanyMenu) return;
      const box = companyRef.current;
      if (box && !box.contains(e.target as Node)) setOpenCompanyMenu(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenCompanyMenu(false); };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [openCompanyMenu]);

  const isActiveTab = (tabId: typeof NAV_TABS[number]) => {
    return activeOverride === tabId;
  };

  return (
    <div className="shell">
      <header className="topbar" style={{ position: "relative", overflow: "visible" }}>
        {/* ===== Lado IZQUIERDO: Marca + separador + conmutador de empresa ===== */}
        <div className="tb-left" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="ah-left" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="app-logo" aria-hidden="true">
              <img src={appLogoUrl} alt="Logo COPPLEM" />
            </div>
            <div className="app-title">COPPLEM</div>
          </div>

          {/* separador vertical */}
          <div
            className="v-sep"
            aria-hidden="true"
            style={{ width: 1, height: 28, background: "var(--border, #e6e1db)" }}
          />

          <div className="company-switcher" ref={companyRef} style={{ position: "relative" }}>
            {isAdmin ? (
              <>
                <button
                  className="chip-viewempresa"
                  aria-haspopup="menu"
                  aria-expanded={openCompanyMenu}
                  onClick={() => setOpenCompanyMenu(s => !s)}
                  title={company?.name ? `Empresa: ${company.name}` : "Empresa actual"}
                >
                  <Avatar
                    className="header-avatar"
                    name={company?.name || slug}
                    avatarUrl={company?.avatarUrl || null}
                    bgColor={company?.color || null}
                  />
                  <span
                    className="text"
                    style={{ maxWidth: 220, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}
                  >
                    {company?.name || slug}
                  </span>
                  <IconChevron className="chev" size={16} aria-hidden="true" style={{ marginLeft: 6, verticalAlign: "middle" }} />
                </button>

                {openCompanyMenu && (
                  <div
                    className="menu company-menu"
                    role="menu"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 8px)",
                      left: 0,
                      zIndex: 1000,
                      minWidth: 260,
                    }}
                    onMouseLeave={() => setOpenCompanyMenu(false)}
                  >
                    <div className="menu-title">Empresa actual</div>
                    <div className="menu-current" title={company?.name || slug}>
                      {company?.name || slug}
                    </div>
                    <hr />
                    <button
                      className="menu-item"
                      role="menuitem"
                      onClick={() => { setOpenCompanyMenu(false); nav("/"); }}
                      style={{ width: "100%", display: "inline-flex", alignItems: "center", gap: 8 }}
                    >
                      <span className="ic" aria-hidden="true" style={{ display: "inline-flex", alignItems: "center" }}>
                        <IconBuilding size={16} />
                      </span>
                      <span>Cambiar de empresa</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div
                className="chip-viewempresa"
                aria-disabled="true"
                title={company?.name || slug}
                style={{ cursor: "default", userSelect: "none" }}
              >
                <Avatar
                  className="header-avatar"
                  name={company?.name || slug}
                  avatarUrl={company?.avatarUrl || null}
                  bgColor={company?.color || null}
                />
                <span
                  className="text"
                  style={{ maxWidth: 220, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}
                >
                  {company?.name || slug}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ===== Tabs (centro) — controlados por permisos ===== */}
        <nav className="tabs" aria-label="Navegación principal" style={{ flex: 1 }}>
          {allowed.includes("dashboard") && (
            <NavLink
              to={to("")}
              end
              className={({ isActive }) => `toplink ${isActive || isActiveTab("dashboard") ? "active" : ""}`}
              state={{ originPageId: "dashboard", originHref: `/app/${slug}` }}
            >
              <IconDash className="ticon" size={18} aria-hidden="true" />
              <span className="tlab">Dashboard</span>
            </NavLink>
          )}
          {allowed.includes("productos") && (
            <NavLink
              to={to("/productos")}
              className={({ isActive }) => `toplink ${isActive || isActiveTab("productos") ? "active" : ""}`}
              state={{ originPageId: "productos", originHref: `/app/${slug}/productos` }}
            >
              <IconBox className="ticon" size={18} aria-hidden="true" />
              <span className="tlab">Productos</span>
            </NavLink>
          )}
          {allowed.includes("pos") && (
            <NavLink
              to={to("/pos")}
              className={({ isActive }) => `toplink ${isActive || isActiveTab("pos") ? "active" : ""}`}
              state={{ originPageId: "pos", originHref: `/app/${slug}/pos` }}
            >
              <IconPOS className="ticon" size={18} aria-hidden="true" />
              <span className="tlab">Punto de Venta</span>
            </NavLink>
          )}
          {allowed.includes("reportes") && (
            <NavLink
              to={to("/reportes")}
              className={({ isActive }) => `toplink ${isActive || isActiveTab("reportes") ? "active" : ""}`}
              state={{ originPageId: "reportes", originHref: `/app/${slug}/reportes` }}
            >
              <IconReports className="ticon" size={18} aria-hidden="true" />
              <span className="tlab">Reportes</span>
            </NavLink>
          )}
          {allowed.includes("usuarios") && (
            <NavLink
              to={to("/usuarios")}
              className={({ isActive }) => `toplink ${isActive || isActiveTab("usuarios") ? "active" : ""}`}
              state={{ originPageId: "usuarios", originHref: `/app/${slug}/usuarios` }}
            >
              <IconUsers className="ticon" size={18} aria-hidden="true" />
              <span className="tlab">Usuarios</span>
            </NavLink>
          )}
          {allowed.includes("datos") && (
            <NavLink
              to={to("/datos")}
              className={({ isActive }) => `toplink ${isActive || isActiveTab("datos") ? "active" : ""}`}
              state={{ originPageId: "datos", originHref: `/app/${slug}/datos` }}
            >
              <IconData className="ticon" size={18} aria-hidden="true" />
              <span className="tlab">Datos</span>
            </NavLink>
          )}
        </nav>

        {/* ===== Lado DERECHO: Usuario + Salir ===== */}
        <div className="tb-right" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="chip-viewuser" title={userName || "Usuario"}>
            <IconUser size={16} style={{ marginRight: 6 }} aria-hidden="true" />
            <span className="u-name" style={{ marginRight: 8 }}>{userName || "—"}</span>
            <span
              className="role-pill"
              style={{
                padding: "2px 8px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                background: "#d19a73",
                color: "white",
              }}
            >
              {userRole}
            </span>
          </div>

          <button className="btn-salir" onClick={signOut} title="Salir" aria-label="Salir">
            <IconLogout size={16} style={{ marginRight: 6 }} aria-hidden="true" />
            <span className="btn-label">Salir</span>
          </button>
        </div>
      </header>

      {/* Restablece scroll en cada navegación y maneja anclas */}
      <ScrollRestorer />

      <main className="page">
          <TipsTray slug={slug} />

          {/* Contenido de cada sección */}
          <Outlet key={pageFromPath(loc.pathname, slug)} />
        </main>

    </div>
  );
}
