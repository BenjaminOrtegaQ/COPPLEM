// src/components/RequirePerms.tsx
import { Navigate, useParams } from "react-router-dom";
import { buildPerms } from "../perm";

export default function RequirePerms({
  page,
  children,
}: {
  page: import("../perm").PageId;
  children: React.ReactNode;
}) {
  const { slug = "" } = useParams();

  let session: any = null;
  try { session = JSON.parse(localStorage.getItem("copplem:session") || "null"); } catch {}

  const role  = session?.user?.rol;              // "ADMIN" o "VENDEDOR"
  const allow = session?.user?.allow ?? null; 

  const perms = buildPerms({ role, allow });

  if (!perms.can(page)) return <Navigate to={`/app/${slug}`} replace />;
  return <>{children}</>;
}
