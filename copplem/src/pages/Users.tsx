// src/pages/Users.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import { z } from "zod";
import {
  Users as IconUsers,
  Search as IconSearch,
  MoreVertical as IconMore,
  UserPlus as IconAdd,
  Shield as IconRole,
  CheckCircle2 as IconOn,
  XCircle as IconOff,
  Pencil as IconEdit,
  Trash2 as IconTrash,
  KeyRound as IconPass,
  RefreshCw as IconReload,
  ShieldCheck as IconAccess,
} from "lucide-react";
import "../styles/users.css";
import { ALL_PAGES, type PageId, ROLE_DEFAULTS, normRole } from "../perm";

/* ===================== Tipos / Constantes ===================== */
type Role = "admin" | "vendedor";

type User = {
  id: number;
  fullName: string;
  username: string;
  email?: string | null;
  role: Role;
  enabled: boolean;
  createdAt?: string | null;
  lastAccessAt?: string | null;
  avatarUrl?: string | null;
};

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "admin",    label: "Administrador" },
  { value: "vendedor", label: "Vendedor" },
];
const ROLE_LABEL: Record<Role, string> = { admin: "Administrador", vendedor: "Vendedor" };

/* ===================== Utils ===================== */
function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join("");
}
function relativeFromNow(iso?: string | null) {
  if (!iso) return "—";
  const ms = Date.now() - Date.parse(iso);
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536e6], ["month", 26298e5], ["week", 6048e5],
    ["day", 864e5], ["hour", 36e5], ["minute", 6e4]
  ];
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  for (const [unit, size] of steps) {
    const v = Math.round(ms / size);
    if (Math.abs(v) >= 1) return rtf.format(-v, unit);
  }
  return "justo ahora";
}

function allowKey(slug: string, userId: number) {
  return `copplem:allow:${slug}:${userId}`;
}

function loadAllow(slug: string, userId: number, role: "ADMIN"|"VENDEDOR"): PageId[] {
  try {
    const raw = localStorage.getItem(allowKey(slug, userId));
    if (raw) {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? (arr as PageId[]) : ROLE_DEFAULTS[role];
    }
  } catch {}
  return ROLE_DEFAULTS[role];
}

function saveAllow(slug: string, userId: number, pages: PageId[]) {
  localStorage.setItem(allowKey(slug, userId), JSON.stringify(pages));
}

/* ===================== Validaciones ===================== */
const createSchema = z.object({
  fullName: z.string().min(1, "Nombre obligatorio").max(120),
  username: z.string().min(3, "Usuario muy corto").max(64),
  password: z.string().min(8, "Mínimo 8 caracteres").max(128),
  role: z.enum(["admin", "vendedor"]),
  enabled: z.boolean().optional(),
});

const editSchema = z.object({
  fullName: z.string().min(1).max(120),
  username: z.string().min(3).max(64),
  password: z.string().optional(),
  role: z.enum(["admin", "vendedor"]),
  enabled: z.boolean().optional(),
});

const passSchema = z.object({
  password: z.string().min(8, "Mínimo 8 caracteres").max(128),
});

/* ===================== Subcomponentes ===================== */
function Modal({
  open, title, onClose, children
}: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  const titleId = "modal-title-" + title.replace(/\s+/g, "-").toLowerCase();
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3 id={titleId}>{title}</h3>
          <button className="icon" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div style={{ marginTop: 10 }}>{children}</div>
      </div>
    </div>
  );
}
function Confirm({
  open, text, onCancel, onConfirm, confirmLabel = "Confirmar"
}: { open: boolean; text: string; onCancel: () => void; onConfirm: () => void; confirmLabel?: string }) {
  return (
    <Modal open={open} title="Confirmar" onClose={onCancel}>
      <p style={{ marginTop: 0 }}>{text}</p>
      <div className="modal-actions">
        <button onClick={onCancel}>Cancelar</button>
        <button className="primary danger" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
function UserAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  return (
    <div className="u-avatar" aria-hidden={!!avatarUrl} title={`Usuario: ${name}`}>
      {avatarUrl ? <img src={avatarUrl} alt="" /> : initials(name)}
    </div>
  );
}

/* ===================== Página ===================== */
export default function Users() {
  const { slug = "" } = useParams();

  // ====== estado local para gestión de accesos (MOVIDO AQUÍ) ======
  const [openPerms, setOpenPerms] = useState(false);
  const [permsPages, setPermsPages] = useState<PageId[]>([]);

  // quién está logueado (MOVIDO AQUÍ)
  const session = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("copplem:session") || "null"); }
    catch { return null; }
  }, []);
  const currentRoleIsAdmin = String(session?.user?.rol || "").toUpperCase() === "ADMIN";

  // listado/estado UI
  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "az" | "za">("recent");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");

  // menús / modales
  const [menuId, setMenuId] = useState<string | null>(null);
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!menuId) return;
      const box = menuRefs.current[menuId];
      if (box && !box.contains(e.target as Node)) setMenuId(null);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [menuId]);

  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openPass, setOpenPass] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  // forms
  const [cName, setCName] = useState("");
  const [cUser, setCUser] = useState("");
  const [cPass, setCPass] = useState("");
  const [cRole, setCRole] = useState<Role>("vendedor");
  const [cEnabled, setCEnabled] = useState(true);

  const [target, setTarget] = useState<User | null>(null);
  const [eName, setEName] = useState("");
  const [eUser, setEUser] = useState("");
  const [ePass, setEPass] = useState("");
  const [eRole, setERole] = useState<Role>("vendedor");
  const [eEnabled, setEEnabled] = useState(true);

  const [pPass, setPPass] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  /* -------- cargar listado -------- */
  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await window.api.listUsers({ slug });
      const norm = rows.map(r => ({
        ...r,
        enabled: Boolean((r as any).enabled),
      })) as User[];
      setItems(norm);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo listar usuarios");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [slug]);

  /* -------- filtros / orden -------- */
  const filtered = useMemo(() => {
    const qn = q.trim().toLowerCase();
    const byQ = qn
      ? items.filter(u =>
          (u.fullName || "").toLowerCase().includes(qn) ||
          (u.username || "").toLowerCase().includes(qn) ||
          (ROLE_LABEL[u.role] || "").toLowerCase().includes(qn))
      : items;

    const byRole = roleFilter === "all" ? byQ : byQ.filter(u => u.role === roleFilter);

    if (sortBy === "az") return [...byRole].sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));
    if (sortBy === "za") return [...byRole].sort((a, b) => (b.fullName || "").localeCompare(a.fullName || ""));

    const parseISO = (s?: string | null) => (s ? Date.parse(s) : NaN);
    return [...byRole].sort((a, b) => {
      const da = parseISO(a.lastAccessAt) || parseISO(a.createdAt) || 0;
      const db = parseISO(b.lastAccessAt) || parseISO(b.createdAt) || 0;
      return db - da;
    });
  }, [items, q, roleFilter, sortBy]);

  /* -------- acciones -------- */
  const onOpenCreate = () => {
    setCName(""); setCUser(""); setCPass("");
    setCRole("vendedor"); setCEnabled(true);
    setOpenCreate(true);
  };
  const onCreate = async () => {
    const parsed = createSchema.safeParse({
      fullName: cName.trim(), username: cUser.trim(), password: cPass, role: cRole, enabled: cEnabled,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Revisa los campos.");
    await toast.promise(
      window.api.createUser({ slug, user: parsed.data }),
      { loading: "Creando usuario…", success: "Usuario creado", error: (e) => e?.message ?? "No se pudo crear" }
    );
    setOpenCreate(false);
    await refresh();
  };

  const onOpenEdit = (u: User) => {
    setTarget(u);
    setEName(u.fullName || "");
    setEUser(u.username || "");
    setEPass("");
    setERole(u.role || "vendedor");
    setEEnabled(Boolean(u.enabled));
    setOpenEdit(true);
  };
  const onEdit = async () => {
    if (!target) return;
    const parsed = editSchema.safeParse({
      fullName: eName.trim(), username: eUser.trim(), password: ePass ? ePass : undefined, role: eRole, enabled: eEnabled,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Revisa los campos.");
    await toast.promise(
      window.api.updateUser({ slug, id: target.id, patch: parsed.data }),
      { loading: "Guardando cambios…", success: "Cambios guardados", error: (e) => e?.message ?? "No se pudo guardar" }
    );
    setOpenEdit(false);
    setTarget(null);
    await refresh();
  };

  const onToggleEnabled = async (u: User) => {
    await toast.promise(
      window.api.updateUser({ slug, id: u.id, patch: { enabled: !u.enabled } }),
      { loading: (!u.enabled ? "Habilitando…" : "Deshabilitando…"), success: "Listo", error: (e) => e?.message ?? "Error" }
    );
    await refresh();
  };

  const onOpenPass = (u: User) => { setTarget(u); setPPass(""); setOpenPass(true); };
  const onChangePass = async () => {
    const parsed = passSchema.safeParse({ password: pPass });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Contraseña inválida");
    if (!target) return;
    await toast.promise(
      window.api.changeUserPassword({ slug, id: target.id, password: parsed.data.password }),
      { loading: "Actualizando contraseña…", success: "Contraseña actualizada", error: (e) => e?.message ?? "No se pudo actualizar" }
    );
    setOpenPass(false);
    setTarget(null);
  };

  const onOpenDelete = (u: User) => { setDeleteTarget(u); setOpenDelete(true); };
  const onDelete = async () => {
    if (!deleteTarget) return;
    await toast.promise(
      window.api.deleteUser({ slug, id: deleteTarget.id }),
      { loading: "Eliminando…", success: "Usuario eliminado", error: (e) => e?.message ?? "No se pudo eliminar" }
    );
    setOpenDelete(false);
    setDeleteTarget(null);
    await refresh();
  };

  /* ===================== UI ===================== */
  return (
    <div className="users-wrap">
      <Toaster position="top-right" />
      {/* Header */}
      <div className="page-header">
        <div className="ph-left">
          <div className="ph-icon" aria-hidden="true"><IconUsers size={30} aria-hidden="true" color="#D07A43" /></div>
          <div>
            <h1>Usuarios</h1>
            <p className="muted">Gestiona los usuarios de esta empresa</p>
          </div>
        </div>
        <div className="ph-actions">
          <button className="primary" onClick={onOpenCreate}>
            <IconAdd size={16} style={{ marginRight: 6 }} /> Nuevo Usuario
          </button>
          <button className="icon ghost" title="Recargar" aria-label="Recargar" onClick={refresh}>
            <IconReload size={18} />
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="toolbar">
        <div className="search">
          <IconSearch className="ic" size={16} strokeWidth={2} aria-hidden="true" />
          <input
            placeholder="Buscar por nombre, usuario o rol…"
            value={q}
            onChange={e => setQ(e.target.value)}
            aria-label="Buscar usuario"
          />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as any)} aria-label="Filtrar por rol">
          <option value="all">Todos los roles</option>
          {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} aria-label="Ordenar por">
          <option value="recent">Más recientes</option>
          <option value="az">Nombre A → Z</option>
          <option value="za">Nombre Z → A</option>
        </select>
      </div>

      {/* Lista */}
      <section className="card">
        <div className="u-head-row">
          <div>Usuario</div>
          <div className="hide-sm">Rol</div>
          <div className="hide-sm">Estado</div>
          <div className="hide-sm">Último acceso</div>
          <div className="col-actions">Acciones</div>
        </div>

        {loading ? (
          <div className="u-list">
            {Array.from({ length: 6 }).map((_, i) => (
              <div className="u-row skeleton" key={i}>
                <div className="user">
                  <div className="u-avatar skeleton-box" />
                  <div className="meta">
                    <div className="name skeleton-box" style={{ width: 170, height: 14 }} />
                    <div className="uname skeleton-box" style={{ width: 120, height: 12 }} />
                  </div>
                </div>
                <div className="hide-sm"><span className="tag skeleton-box" style={{ width: 60, height: 18 }} /></div>
                <div className="hide-sm"><span className="status skeleton-box" style={{ width: 80, height: 14 }} /></div>
                <div className="hide-sm"><span className="muted skeleton-box" style={{ width: 90, height: 12 }} /></div>
                <div className="actions"><button className="icon ghost" disabled><IconMore /></button></div>
              </div>
            ))}
          </div>
        ) : filtered.length ? (
          <div className="u-list">
            {filtered.map(u => {
              const idKey = String(u.id);
              return (
                <div className="u-row" key={idKey}>
                  <div className="user">
                    <UserAvatar name={u.fullName || u.username} avatarUrl={u.avatarUrl} />
                    <div className="meta">
                      <div className="name" title={u.fullName || u.username}>{u.fullName || "—"}</div>
                      <div className="uname">@{u.username}</div>
                    </div>
                  </div>

                  <div className="hide-sm">
                    <span className="tag"><IconRole size={14} /> {ROLE_LABEL[u.role]}</span>
                  </div>

                  <div className="hide-sm">
                    {u.enabled ? (
                      <span className="status ok"><IconOn size={14} /> Habilitado</span>
                    ) : (
                      <span className="status off"><IconOff size={14} /> Deshabilitado</span>
                    )}
                  </div>

                  <div className="hide-sm">
                    <span className="muted">{relativeFromNow(u.lastAccessAt || u.createdAt)}</span>
                  </div>

                  <div className="actions" ref={el => { menuRefs.current[idKey] = el; }}>
                    <button
                      className="icon ghost"
                      aria-haspopup="menu"
                      aria-expanded={menuId === idKey}
                      onClick={() => setMenuId(s => s === idKey ? null : idKey)}
                      aria-label={`Opciones de ${u.fullName || u.username}`}
                    >
                      <IconMore />
                    </button>

                    {menuId === idKey && (
                      <div className="menu" role="menu" onMouseLeave={() => setMenuId(null)}>
                        <button role="menuitem" onClick={() => { setMenuId(null); onOpenEdit(u); }}>
                          <IconEdit size={16} /> Editar
                        </button>
                        <button role="menuitem" onClick={() => { setMenuId(null); onOpenPass(u); }}>
                          <IconPass size={16} /> Cambiar contraseña
                        </button>
                        {currentRoleIsAdmin && normRole(u.role) !== "ADMIN" && (
                          <button role="menuitem" onClick={() => {
                            setMenuId(null);
                            const r = normRole(u.role);
                            const pages = loadAllow(slug, u.id, r);
                            setTarget(u);
                            setPermsPages(pages);
                            setOpenPerms(true);
                          }}>
                            <IconAccess size={16} /> Gestionar accesos
                          </button>
                        )}
                        <button role="menuitem" onClick={() => { setMenuId(null); onToggleEnabled(u); }}>
                          {u.enabled ? (<><IconOff size={16} /> Deshabilitar</>) : (<><IconOn size={16} /> Habilitar</>)}
                        </button>
                        <button role="menuitem" className="dangera" onClick={() => { setMenuId(null); onOpenDelete(u); }}>
                          <IconTrash size={16} /> Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty">
            <h3>No hay usuarios</h3>
            <p className="muted">Crea tu primer usuario para comenzar.</p>
            <button className="primary" onClick={onOpenCreate}><IconAdd size={16} style={{ marginRight: 6 }} /> Nuevo Usuario</button>
          </div>
        )}
      </section>

      {/* ===== Modales ===== */}

      {/* Crear */}
      <Modal open={openCreate} title="Nuevo usuario" onClose={() => setOpenCreate(false)}>
        <div className="form-grid">
          <div>
            <label>Nombre completo</label>
            <input value={cName} onChange={e => setCName(e.target.value)} placeholder="Ej. Pepe Tapia" />
          </div>
          <div className="form-grid grid-2">
            <div>
              <label>Usuario</label>
              <input value={cUser} onChange={e => setCUser(e.target.value)} placeholder="Ptapia" />
            </div>
            <div>
              <label>Contraseña</label>
              <input type="password" value={cPass} onChange={e => setCPass(e.target.value)} placeholder="••••••••" />
            </div>
          </div>
          <div className="form-grid grid-2">
            <div>
              <label>Rol</label>
              <select value={cRole} onChange={e => setCRole(e.target.value as Role)}>
                {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button onClick={() => setOpenCreate(false)}>Cancelar</button>
          <button className="primary" onClick={onCreate}>Crear</button>
        </div>
      </Modal>

      {/* Editar */}
      <Modal open={openEdit} title="Editar usuario" onClose={() => setOpenEdit(false)}>
        <div className="form-grid">
          <div>
            <label>Nombre completo *</label>
            <input value={eName} onChange={e => setEName(e.target.value)} />
          </div>
          <div className="form-grid grid-2">
            <div>
              <label>Usuario *</label>
              <input value={eUser} onChange={e => setEUser(e.target.value)} />
            </div>
            <div>
              <label>Contraseña (opcional)</label>
              <input type="password" value={ePass} onChange={e => setEPass(e.target.value)} placeholder="Dejar en blanco para no cambiar" />
            </div>
          </div>
          <div className="form-grid grid-2">
            <div>
              <label>Rol *</label>
              <select value={eRole} onChange={e => setERole(e.target.value as Role)}>
                {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <label className="inline-check" style={{ alignSelf: "end" }}>
              <input type="checkbox" checked={eEnabled} onChange={e => setEEnabled(e.target.checked)} />
              Habilitado
            </label>
          </div>
        </div>
        <div className="modal-actions">
          <button onClick={() => setOpenEdit(false)}>Cancelar</button>
          <button className="primary" onClick={onEdit}>Guardar</button>
        </div>
      </Modal>

      {/* Cambiar contraseña */}
      <Modal open={openPass} title={`Cambiar contraseña${target ? ` — ${target.fullName || target.username}` : ""}`} onClose={() => setOpenPass(false)}>
        <label>Nueva contraseña *</label>
        <input type="password" value={pPass} onChange={e => setPPass(e.target.value)} placeholder="••••••••" />
        <div className="modal-actions">
          <button onClick={() => setOpenPass(false)}>Cancelar</button>
          <button className="primary" onClick={onChangePass}>Actualizar</button>
        </div>
      </Modal>

      {/* Eliminar */}
      <Confirm
        open={openDelete}
        text={deleteTarget ? `¿Eliminar al usuario "${deleteTarget.fullName || deleteTarget.username}"?` : ""}
        onCancel={() => { setOpenDelete(false); setDeleteTarget(null); }}
        onConfirm={onDelete}
        confirmLabel="Eliminar"
      />

      {/* Gestionar Accesos */}
      <Modal
        open={openPerms}
        title={`Gestionar accesos${target ? ` — ${target.fullName || target.username}` : ""}`}
        onClose={() => setOpenPerms(false)}
      >
        {target ? (
          <>
            {normRole(target.role) === "ADMIN" ? (
              <div className="muted" style={{ marginBottom: 10 }}>
                Este usuario es <strong>ADMIN</strong> y tiene acceso a todas las páginas.
              </div>
            ) : (
              <>
                <div className="muted" style={{ marginBottom: 10 }}>
                  Selecciona las páginas a las que <strong>podrá acceder</strong>. (El Punto de Venta está habilitado por defecto.)
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  {ALL_PAGES.map(p => {
                    const label =
                      p === "dashboard" ? "Dashboard" :
                      p === "productos" ? "Productos" :
                      p === "pos" ? "Punto de Venta" :
                      p === "reportes" ? "Reportes" :
                      p === "usuarios" ? "Usuarios" :
                      p === "datos" ? "Datos" : p;

                    const checked = permsPages.includes(p);
                    const disabled = p === "pos"; // POS siempre activo para vendedores

                    return (
                      <label key={p} className="inline-check" style={{ userSelect: "none" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={(e) => {
                            const on = e.target.checked;
                            setPermsPages(prev => {
                              const set = new Set(prev);
                              if (on) set.add(p); else set.delete(p);
                              set.add("pos"); // fuerza POS
                              return Array.from(set);
                            });
                          }}
                        />
                        {label}
                        {disabled && <span className="muted" style={{ marginLeft: 6, fontSize: 12 }}>(siempre habilitado)</span>}
                      </label>
                    );
                  })}
                </div>

                <div className="modal-actions" style={{ marginTop: 12 }}>
                  <button onClick={() => setOpenPerms(false)}>Cancelar</button>
                  <button
                    className="primary"
                    onClick={() => {
                      if (!target) return;
                      saveAllow(slug, target.id, Array.from(new Set([...permsPages, "pos"])));
                      setOpenPerms(false);
                      toast.success("Accesos actualizados");
                    }}
                  >
                    Guardar
                  </button>
                </div>
              </>
            )}
          </>
        ) : null}
      </Modal>

    </div>
  );
}
