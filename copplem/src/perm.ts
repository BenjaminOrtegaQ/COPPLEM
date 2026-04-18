// src/perm.ts
export type PageId = "dashboard" | "productos" | "pos" | "reportes" | "usuarios" | "datos";

export const ALL_PAGES: PageId[] = ["dashboard","productos","pos","reportes","usuarios","datos"];

export const ROLE_DEFAULTS: Record<"ADMIN" | "VENDEDOR", PageId[]> = {
  ADMIN:    ["dashboard","productos","pos","reportes","usuarios","datos"],
  VENDEDOR: ["pos"], // por defecto sólo POS
};

export function normRole(r: any): "ADMIN" | "VENDEDOR" {
  const s = String(r || "").toUpperCase();
  return s === "ADMIN" ? "ADMIN" : "VENDEDOR";
}

const allowKey = (slug: string, userId: number) => `copplem:allow:${slug}:${userId}`;

/** Devuelve la lista de páginas habilitadas para el usuario actual (según session + localStorage) */
export function getAllowedPages(slug: string): PageId[] {
  let session: any = null;
  try { session = JSON.parse(localStorage.getItem("copplem:session") || "null"); } catch {}
  const role = normRole(session?.user?.rol);
  if (role === "ADMIN") return ROLE_DEFAULTS.ADMIN;

  // vendedor
  const uid = Number(session?.user?.id ?? 0) || 0;
  const key = allowKey(slug, uid);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) {
        return arr.filter((p: any) => ALL_PAGES.includes(p));
      }
    }
  } catch {}
  // Si no hay nada guardado, usa defaults del rol
  return ROLE_DEFAULTS.VENDEDOR;
}

/** Devuelve la 1ra ruta navegable para esa lista de paginas */
export function firstAllowedPath(slug: string, pages: PageId[]): string {
  const order: PageId[] = ["pos","dashboard","productos","reportes","usuarios","datos"];
  const first = order.find(p => pages.includes(p)) ?? "pos";
  const map: Record<PageId, string> = {
    dashboard: `/app/${slug}`,
    productos: `/app/${slug}/productos`,
    pos:       `/app/${slug}/pos`,
    reportes:  `/app/${slug}/reportes`,
    usuarios:  `/app/${slug}/usuarios`,
    datos:     `/app/${slug}/datos`,
  };
  return map[first];
}
