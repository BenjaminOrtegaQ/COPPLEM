// src/router.tsx
import { createHashRouter, Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import Companies from "./pages/Companies";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import POS from "./pages/POS";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import Data from "./pages/Data";
import App from "./App";
import SetupBusiness from "./pages/setupBusiness";
import SalesList from "./pages/SalesList";
import Faq from "./pages/FAQ";
import Docs from "./pages/Docs";


import { getAllowedPages, firstAllowedPath } from "./perm";

/* ------------ Guard con RBAC ------------- */
function Guard() {
  const { slug = "" } = useParams();
  const loc = useLocation();

  // leer sesión
  let session: any = null;
  try { session = JSON.parse(localStorage.getItem("copplem:session") || "null"); } catch {}

  // si no hay sesión o slug no coincide ir a login de la empresa
  if (!session || session.slug !== slug) {
    return <Navigate to={`/login/${slug}`} replace />;
  }

  const role = String(session?.user?.rol || "").toUpperCase();
  const allowed = getAllowedPages(slug);

  const path = loc.pathname;
  const here: { id: "dashboard"|"productos"|"pos"|"reportes"|"usuarios"|"datos" | null } = { id: null };

  if (path === `/app/${slug}`) here.id = "dashboard";
  else if (path === `/app/${slug}/productos`) here.id = "productos";
  else if (path === `/app/${slug}/pos`) here.id = "pos";
  else if (path === `/app/${slug}/reportes`) here.id = "reportes";
  else if (path === `/app/${slug}/usuarios`) here.id = "usuarios";
  else if (path === `/app/${slug}/datos`) here.id = "datos";

  // ADMIN: full access sin chequeos
  if (role === "ADMIN") return <Outlet />;

  // VENDEDOR: si la ruta actual no está en allowed, redirige a la primera permitida
  if (here.id && !allowed.includes(here.id)) {
    return <Navigate to={firstAllowedPath(slug, allowed)} replace />;
  }

  if (!here.id && path === `/app/${slug}` && !allowed.includes("dashboard")) {
    return <Navigate to={firstAllowedPath(slug, allowed)} replace />;
  }

  return <Outlet />;
}

export const router = createHashRouter([
  { path: "/", element: <Companies /> },
  { path: "/login/:slug", element: <Login /> },
  { path: "/setup/:slug", element: <SetupBusiness /> },

  {
    path: "/app/:slug",
    element: <Guard />,
    children: [
      {
        element: <App />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: "productos", element: <Products /> },
          { path: "pos", element: <POS /> },
          { path: "reportes", element: <Reports /> },
          { path: "usuarios", element: <Users /> },
          { path: "datos", element: <Data /> },
          { path: "ventas", element: <SalesList/> },
          { path: "faq", element: <Faq /> },
          { path: "docs", element: <Docs /> },
          { path: "docs/:section/:page", element: <Docs /> },


        ]
      }
    ]
  }
]);
