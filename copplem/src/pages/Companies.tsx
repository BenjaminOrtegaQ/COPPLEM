  import {
    useEffect, useMemo, useState, useCallback, useRef, useDeferredValue,
  } from "react";
  import { useNavigate, useSearchParams } from "react-router-dom";
  import FocusTrap from "focus-trap-react";
  import { Toaster, toast } from "react-hot-toast";
  import { z } from "zod";
  import {
    Search as IconSearch,
    MoreVertical as IconMore,
    ExternalLink as IconOpen,
    Settings as IconGear,
    LogOut as IconLogout,
    Package as IconBox,
    Clock3 as IconClock,
    TrendingUp as IconTrend,
    Lightbulb as IconTip,
    Building as IconBuilding,
    HardHat as IconHardHat,
    Eye as IconEye,
    EyeOff as IconEyeOff,
    Lock as IconLock,
    User as IconUser,

  } from "lucide-react";
  import "../styles/companies.css";
  import appLogoUrl from "../assets/logo.svg";
  import mascotUrl from "../assets/circle-copply-2.svg";
  import AuthConfirmModal from "../components/AuthModal";
  import CompanyLoginModal from "../components/LoginModal";
  import SetupBusinessModal from "../components/setupBusinessModal";




  /** ================== Tipos y contratosa ================== */

  type Company = {
    slug: string;
    name: string;
    avatarUrl?: string | null;
    color?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    productCount?: number;
    todaySalesCount?: number;
    lastAccessAt?: string | null;
  };

  type ApiOk = { ok: true };
  type ApiErr = { ok: false; error: string };
  type ApiRes = ApiOk | ApiErr;

  /** ================== Utils ================== */

  const DEFAULT_AVATAR_BG = "#ffe8da";
  function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

  /** Slugify local (front) para predecir la ruta del nuevo slug */
  function slugify(s: string) {
    return s
      .normalize("NFD").replace(/\p{Diacritic}/gu, "")
      .toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /** Valida, reescala y devuelve dataURL (o null si no hay file) */
  async function fileToOptimizedDataURL(file: File | null): Promise<string | null> {
    if (!file) return null;
    if (!file.type.startsWith("image/")) throw new Error("El archivo debe ser una imagen.");
    if (file.size > 10 * 1024 * 1024) throw new Error("La imagen supera los 10MB.");
    if (file.size <= 300 * 1024) return readAsDataUrl(file);

    const bmp = await createImageBitmap(file);
    const maxSide = 384;
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const tw = Math.max(1, Math.round(bmp.width * scale));
    const th = Math.max(1, Math.round(bmp.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = tw; canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo crear contexto de canvas.");
    ctx.drawImage(bmp, 0, 0, tw, th);

    const mime = file.type.includes("png") ? "image/png" : "image/jpeg";
    const blob: Blob | null = await new Promise(res => canvas.toBlob(b => res(b), mime, 0.85));
    if (!blob) throw new Error("No se pudo procesar la imagen.");
    return blobToDataURL(blob);
  }

  function readAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
  function blobToDataURL(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  function initials(name: string) {
    return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join("");
  }

  // --- helpers de color (TS-safe) ---
  function hexToRgb(hex: string): { r: number; g: number; b: number } {
    let h = hex.replace("#", "").trim();
    if (!/^[0-9a-fA-F]{3,6}$/.test(h)) return { r: 255, g: 255, b: 255 };
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    const num = parseInt(h, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }
  function rgbToHex(r: number, g: number, b: number) {
    return "#" + [r, g, b].map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, "0")).join("");
  }
  function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h, s, l };
  }
  function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    let r: number, g: number, b: number;
    if (s === 0) { r = g = b = l; }
    else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }
  function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }) {
    const f = (v: number) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const R = f(r), G = f(g), B = f(b);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  }
  function contrastRatio(bgHex: string, fgHex: string) {
    const L1 = relativeLuminance(hexToRgb(bgHex));
    const L2 = relativeLuminance(hexToRgb(fgHex));
    const [a, b] = L1 > L2 ? [L1, L2] : [L2, L1];
    return (a + 0.05) / (b + 0.05);
  }
  /** Texto “armonizado” con el fondo (mismo hue, buen contraste) */
  function textColorForBg(bgHex: string) {
    const { r, g, b } = hexToRgb(bgHex);
    const { h, s, l } = rgbToHsl(r, g, b);
    const targetL = l > 0.6 ? 0.18 : 0.9;
    const targetS = Math.min(Math.max(s, 0.45), 0.85);
    const { r: rr, g: gg, b: bb } = hslToRgb(h, targetS, targetL);
    const cand = rgbToHex(rr, gg, bb);
    return contrastRatio(bgHex, cand) >= 4.5 ? cand : (l > 0.6 ? "#1f2937" : "#ffffff");
  }

  /** tiempo relativo */
  function relativeFromNow(iso?: string | null) {
    if (!iso) return "—";
    const ms = Date.now() - Date.parse(iso);
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
      ["year", 31536e6], ["month", 26298e5], ["week", 6048e5],
      ["day", 864e5], ["hour", 36e5], ["minute", 6e4]
    ];
    const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
    for (const [unit, size] of units) {
      const v = Math.round(ms / size);
      if (Math.abs(v) >= 1) return rtf.format(-v, unit);
    }
    return "justo ahora";
  }


  async function ensureDataUrl(src?: string | null): Promise<string | null> {
    if (!src) return null;
    if (src.startsWith("data:image/")) return src;
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    } catch {
      return null; // si falla, mejor seguimos sin imagen (se usará color + iniciales)
    }
  }


  /** ================== UI auxiliares ================== */

  function Modal({
    open,
    title,
    onClose,
    children,
    onConfirm,
    confirmDisabled = false,
    confirmOnEnter = true,
    cancelOnEscape = true,
    className = '',  // Agregar className como propiedad
  }: {
    open: boolean;
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    onConfirm?: () => void;
    confirmDisabled?: boolean;
    confirmOnEnter?: boolean;
    cancelOnEscape?: boolean;
    className?: string;  // Definir el tipo de la propiedad className
  }) {
    if (!open) return null;

    const titleId = "modal-title-" + title.replace(/\s+/g, "-").toLowerCase();

    useEffect(() => {
      if (!open) return;

      const onKey = (e: KeyboardEvent) => {
        // Cerrar con Esc
        if (cancelOnEscape && e.key === "Escape") {
          e.preventDefault();
          onClose();
          return;
        }

        // Confirmar con Enter
        if (
          confirmOnEnter &&
          onConfirm &&
          !confirmDisabled &&
          e.key === "Enter" &&
          !e.shiftKey &&
          !e.ctrlKey &&
          !e.altKey &&
          !e.metaKey
        ) {
          const target = e.target as HTMLElement | null;
          const tag = (target?.tagName || "").toUpperCase();
          const role = (target?.getAttribute("role") || "").toLowerCase();

          if (tag === "TEXTAREA") return;

          if (tag === "BUTTON" && (target as HTMLButtonElement).disabled) return;

          if (tag === "INPUT") {
            const type = (target as HTMLInputElement).type;
            if (type === "color" || type === "file") return;
          }

          e.preventDefault();
          onConfirm();
        }
      };

      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose, onConfirm, confirmDisabled, confirmOnEnter, cancelOnEscape]);

    return (
      <div className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={onClose}>
        <FocusTrap active={open}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 id={titleId}>{title}</h3>
              <button className="icon" onClick={onClose} aria-label="Cerrar">✕</button>
            </div>
            <div style={{ marginTop: 10 }}>{children}</div>
          </div>
        </FocusTrap>
      </div>
    );
  }


  function Confirm({
    open, text, onCancel, onConfirm, confirmLabel = "Confirmar", children
  }: {
    open: boolean;
    text: string;
    onCancel: () => void;
    onConfirm: () => void;
    confirmLabel?: string;
    children?: React.ReactNode;
  }) {
    return (
      <Modal open={open} title="Confirmar" onClose={onCancel}>
        <p style={{ marginTop: 0 }}>{text}</p>

        {children}

        <div className="modal-actions">
          <button onClick={onCancel}>Cancelar</button>
          <button className="primary danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </Modal>
    );
  }


  function Avatar({ name, avatarUrl, bgColor }: { name: string; avatarUrl?: string | null; bgColor?: string | null; }) {
    const bg = avatarUrl ? null : (bgColor ?? DEFAULT_AVATAR_BG);
    return (
      <div
        className="avatar"
        style={{ background: bg ?? undefined, color: bg ? textColorForBg(bg) : undefined }}
        aria-hidden={!!avatarUrl}
        title={`Icono de ${name}`}
      >
        {avatarUrl ? <img src={avatarUrl} alt={`Logo de ${name}`} /> : initials(name)}
      </div>
    );
  }

  /** ================== Validaciones (Zod) ================== */

  const createSchema = z.object({
    name: z.string().min(1, "El nombre es obligatorio").max(120),
    adminUser: z.string().min(1, "Usuario ADMIN es obligatorio").max(64),
    adminPass: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(128),
    adminPassConfirm: z.string().min(8, "La confirmación debe tener al menos 8 caracteres").max(128),
    color: z.string().nullable(),
  }).refine((d) => d.adminPass === d.adminPassConfirm, {
    message: "Las contraseñas no coinciden",
    path: ["adminPassConfirm"],
  });

  const editSchema = z.object({
    newName: z.string().min(1, "El nuevo nombre es obligatorio").max(120),
    color: z.string().nullable(),
    removeLogo: z.boolean(),
  });

  /** ================== Componente principal ================== */

  export default function Companies() {
    const nav = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // listado / búsqueda / orden
    const [items, setItems] = useState<Company[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [q, setQ] = useState(searchParams.get("q") ?? "");
    const [sortBy, setSortBy] = useState<"recent" | "az" | "za">(
      (searchParams.get("sortBy") as any) || "recent"
    );
    const qDeferred = useDeferredValue(q);

    // crear
    const [openCreate, setOpenCreate] = useState(false);
    const [cName, setCName] = useState("");
    const [adminUser, setAdminUser] = useState("");
    const [adminPass, setAdminPass] = useState("");
    const [adminPassVisible, setAdminPassVisible] = useState(false);
    const [adminPassConfirm, setAdminPassConfirm] = useState("");
    const [savingCreate, setSavingCreate] = useState(false);
    const [cColor, setCColor] = useState<string>(DEFAULT_AVATAR_BG);
    const [cLogoFile, setCLogoFile] = useState<File | null>(null);
    const [cLogoPreview, setCLogoPreview] = useState<string | null>(null);
    const [openDataAfterCreate, setOpenDataAfterCreate] = useState(false); // checkbox off por defecto para editar datos
    const [createDesktopShortcut, setCreateDesktopShortcut] = useState(true);


    // editar
    const [openEdit, setOpenEdit] = useState(false);
    const [editTarget, setEditTarget] = useState<Company | null>(null);
    const [newName, setNewName] = useState("");
    const [savingEdit, setSavingEdit] = useState(false);
    const [editColor, setEditColor] = useState<string>(DEFAULT_AVATAR_BG);
    const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
    const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null);
    const [removeLogo, setRemoveLogo] = useState(false);

    const hasEditChanges = useMemo(() => {
      if (!editTarget) return false;

      // nombre
      const nameChanged =
        newName.trim() !== (editTarget.name ?? "").trim();

      // color
      const origColor = editTarget.color ?? DEFAULT_AVATAR_BG;
      const colorChanged = (editColor ?? DEFAULT_AVATAR_BG) !== origColor;

      // logo
      const origLogo = editTarget.avatarUrl ?? null;
      const logoChanged =
        !!editLogoFile || removeLogo || (editLogoPreview ?? null) !== origLogo;

      return nameChanged || colorChanged || logoChanged;
    }, [editTarget, newName, editColor, editLogoFile, editLogoPreview, removeLogo]);


    // borrar
    const [openDelete, setOpenDelete] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
    const [deleteAlsoBackups, setDeleteAlsoBackups] = useState(false);

    // menú por tarjeta
    const [menuSlug, setMenuSlug] = useState<string | null>(null);

    const [openSetupModal, setOpenSetupModal] = useState(false);
    const [setupSlug, setSetupSlug] = useState<string | null>(null);


    // Confirmación: guardar antes de ir a Setup
    const [confirmGoSetup, setConfirmGoSetup] = useState(false);

    const [openLoginModal, setOpenLoginModal] = useState(false);
    const [afterLoginPath, setAfterLoginPath] = useState<string | null>(null);
    const [loginCompany, setLoginCompany] = useState<Company | null>(null);

    // Modal de verificación
    const [authOpen, setAuthOpen] = useState(false);
    type AuthAction = "edit" | "delete" | "setup";
    const [authFor, setAuthFor] = useState<null | { action: AuthAction; company: Company }>(null);

    const requireAuth = useCallback((action: AuthAction, company: Company) => {
      setAuthFor({ action, company });
      setAuthOpen(true);
    }, []);

    // refs por tarjeta (clave = slug)
    const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});

    // refs para filas grid
    const gridRef = useRef<HTMLDivElement | null>(null);


    // cierra el menú activo con click fuera del contenedor
    useEffect(() => {
      const onDocClick = (e: MouseEvent) => {
        if (!menuSlug) return;
        const box = menuRefs.current[menuSlug];
        if (box && !box.contains(e.target as Node)) setMenuSlug(null);
      };
      document.addEventListener("click", onDocClick);
      return () => document.removeEventListener("click", onDocClick);
    }, [menuSlug]);

    // ESC para cerrar menús/modales
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuSlug(null); };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, []);

    // Sincroniza query params
    useEffect(() => {
      const sp = new URLSearchParams(searchParams);
      q ? sp.set("q", q) : sp.delete("q");
      sortBy ? sp.set("sortBy", sortBy) : sp.delete("sortBy");
      setSearchParams(sp, { replace: true });
    }, [q, sortBy]);

    const refresh = useCallback(async () => {
      try {
        setLoading(true);
        const list = await window.api.listCompanies();
        setItems(list);
      } catch (e: any) {
        toast.error("Error al listar empresas: " + (e?.message ?? e));
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    // ---------- efecto acceso directo -------------
    useEffect(() => {
      const usp = new URLSearchParams(window.location.search);
      const slugFromQuery = usp.get("loginSlug");

      const openLogin = (slug: string) => {
        const c = items.find(x => x.slug === slug);
        if (!c) return;
        setLoginCompany(c);
        setAfterLoginPath(null);
        setOpenLoginModal(true);
      };

      if (slugFromQuery) {
        if (items.length) openLogin(slugFromQuery);
        else refresh().then(() => openLogin(slugFromQuery));
      }

      const off = window.api.onOpenLoginFromMain?.((slug) => {
        if (items.length) openLogin(slug);
        else refresh().then(() => openLogin(slug));
      });

      return () => { if (typeof off === "function") off(); };
    }, [items.length]);


    // ---------- Header (settings / salir) ----------
    const [openSettings, setOpenSettings] = useState(false);
    const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
    const [confirmUninstall, setConfirmUninstall] = useState(false);
    const settingsRef = useRef<HTMLDivElement | null>(null);

    // Tip (Consejo) — colapsable
    const [tipCollapsed, setTipCollapsed] = useState<boolean>(() => {
      try { return localStorage.getItem("companiesTipCollapsed") === "1"; }
      catch { return false; }
    });

    const collapseTip = useCallback(() => {
      setTipCollapsed(true);
      try { localStorage.setItem("companiesTipCollapsed", "1"); } catch {}
    }, []);

    const toggleTipCollapsed = useCallback(() => {
      setTipCollapsed(prev => {
        const next = !prev;
        try { localStorage.setItem("companiesTipCollapsed", next ? "1" : "0"); } catch {}
        return next;
      });
    }, []);

    useEffect(() => {
      const onDocClick = (e: MouseEvent) => {
        if (!openSettings) return;
        const box = settingsRef.current;
        if (box && !box.contains(e.target as Node)) setOpenSettings(false);
      };
      document.addEventListener("click", onDocClick);
      return () => document.removeEventListener("click", onDocClick);
    }, [openSettings]);

    const canUninstall = Boolean((window as any).api?.uninstallApp);

    const onSignOut = async () => {
      try {
        await window.api?.logout?.(); 
        
        window.close();  
        
      } catch (error) {
        console.error("Error al cerrar sesión:", error);
      }
    };

    const onDeleteAllConfirmed = async () => {
      setConfirmDeleteAll(false);
      if ((window as any).api?.deleteAllCompanies) {
        await toast.promise(window.api.deleteAllCompanies!(), {
          loading: "Eliminando todas las empresas…",
          success: "Empresas eliminadas",
          error: (e) => e?.message ?? "No se pudo eliminar todo",
        });
        await refresh();
        return;
      }
      await toast.promise(
        (async () => {
          for (const c of items) {
            const res = await window.api.deleteCompany(c.slug);
            if (!res.ok) throw new Error(res.error);
          }
        })(),
        { loading: "Eliminando…", success: "Empresas eliminadas", error: (e) => e?.message ?? "Error eliminando" }
      );
      await refresh();
    };

    // Modificar la función de desinstalación
    const onUninstallConfirmed = async () => {
      setConfirmUninstall(false);

      if (!canUninstall) {
        toast("La desinstalación no está disponible en modo dev.", { icon: "ℹ️" });
        return;
      }

      try {
        await toast.promise(window.api.uninstallApp!(), {
          loading: "Iniciando desinstalación…",
          success: "Se inició el desinstalador. Sigue las instrucciones.",
          error: (e: any) => e?.message ?? "No se pudo iniciar el desinstalador",
        });
      } catch (e: unknown) {
        if (e instanceof Error) {
          toast.error("Error al desinstalar la aplicación: " + e.message);
        } else {
          toast.error("Error desconocido al desinstalar la aplicación");
        }
      }
    };

    // Confirmación para desinstalar
    <Confirm
      open={confirmUninstall}
      text={
        canUninstall
          ? "Se abrirá el desinstalador del sistema para COPPLEM. ¿Continuar?"
          : "La desinstalación no está disponible en modo dev."
      }
      onCancel={() => setConfirmUninstall(false)}  // Cuando se cancela, cierra el modal
      onConfirm={onUninstallConfirmed}             // Ejecuta la función de desinstalación si se confirma
      confirmLabel={canUninstall ? "Desinstalar" : "Entendido"}  // Botón de confirmación
    />



    const handleSuccessNav = useCallback((slug: string) => {
      const dest = afterLoginPath ?? `/app/${slug}`;
      setOpenLoginModal(false);
      setLoginCompany(null);
      setAfterLoginPath(null);
      nav(dest);
    }, [afterLoginPath, nav]);


    // Crear
    const onOpenCreate = () => {
      setCName("");
      setAdminUser("");
      setAdminPass("");
      setAdminPassConfirm("");
      setAdminPassVisible(false);
      setCColor(DEFAULT_AVATAR_BG);
      setCLogoFile(null);
      setCLogoPreview(null);
      setOpenDataAfterCreate(true);
      setOpenCreate(true);
    };

    const onCreate = async () => {
      const parsed = createSchema.safeParse({
        name: cName.trim(),
        adminUser: adminUser.trim(),
        adminPass,
        adminPassConfirm,
        color: cColor,
      });

      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Revisa los campos requeridos.");
        return;
      }

      try {
        setSavingCreate(true);
        const logoDataUrl = await fileToOptimizedDataURL(cLogoFile);

        const res = await toast.promise(
          window.api.createCompany({
            name: cName.trim(),
            admin: { fullName: "Administrador", username: adminUser.trim(), password: adminPass },
            color: cColor,
            logoDataUrl
          }),
          {
            loading: "Creando empresa…",
            success: (r) => {
              if (!r.ok) throw new Error(r.error);
              return "Empresa creada";
            },
            error: (e) => e?.message ?? "No se pudo crear",
          }
        );

        setOpenCreate(false);
        await refresh();

        if (res.ok && createDesktopShortcut) {
          try {
            await window.api.createCompanyShortcut({
              slug: res.slug,
              name: cName.trim(),
              avatarDataUrl: logoDataUrl,
              colorHex: logoDataUrl ? null : cColor
            });
          } catch (e: any) {
            console.warn("shortcut (create) error:", e?.message ?? e);
          }
        }

        if (openDataAfterCreate && res.ok) {
          const realSlug = res.slug || slugify(cName.trim());
          setSetupSlug(realSlug);
          setOpenSetupModal(true);
          return;
        }
      } finally {
        setSavingCreate(false);
      }
    };

    // Editar
    const onOpenEdit = (c: Company) => {
      setEditTarget(c);
      setNewName(c.name);
      setEditColor(c.color ?? DEFAULT_AVATAR_BG);
      setEditLogoPreview(c.avatarUrl ?? null);
      setEditLogoFile(null);
      setRemoveLogo(false);
      setOpenEdit(true);
    };

  const onEdit = async () => {
    const parsed = editSchema.safeParse({
      newName: newName.trim(), color: editColor, removeLogo,
    });
    if (!parsed.success || !editTarget) {
      toast.error(parsed.error?.issues?.[0]?.message ?? "Revisa los campos requeridos.");
      return;
    }

    try {
      setSavingEdit(true);
      const newLogoDataUrl = await fileToOptimizedDataURL(editLogoFile);

      await toast.promise(
        window.api.editCompany({
          oldSlug: editTarget.slug,
          newName: newName.trim(),
          color: editColor,
          newLogoDataUrl,
          removeLogo
        }),
        {
          loading: "Guardando cambios…",
          success: (res) => {
            if (!res.ok) throw new Error(res.error);
            return "Cambios guardados";
          },
          error: (e) => e?.message ?? "No se pudo guardar",
        }
      );

      const targetSlug = newName.trim() ? slugify(newName.trim()) : editTarget.slug;

      const avatarDataUrl =
        !removeLogo && editLogoPreview && editLogoPreview.startsWith("data:")
          ? editLogoPreview
          : null;

      try {
        await window.api.createCompanyShortcut({
          slug: targetSlug,
          name: newName.trim() || editTarget.name,
          avatarDataUrl,
          colorHex: avatarDataUrl ? null : editColor,
        });
      } catch (e: any) {
        console.warn("shortcut (edit) error:", e?.message ?? e);
      }

      setOpenEdit(false);
      setEditTarget(null);
      await refresh();
    } finally {
      setSavingEdit(false);
    }
  };

    // Eliminar
    const onOpenDelete = (c: Company) => {
    setDeleteTarget(c);
    setDeleteAlsoBackups(false); 
    setOpenDelete(true);
  };

  const onDelete = async () => {
    if (!deleteTarget) return;

    await toast.promise(
      (async () => {
        if (deleteAlsoBackups) {
          const r = await window.api.deleteAllBackupsForSlug({ slug: deleteTarget.slug });
          if (!r?.ok) throw new Error("No se pudieron eliminar los backups");
        }

        const res = await window.api.deleteCompany(deleteTarget.slug);
        if (!res?.ok) throw new Error(res?.error ?? "No se pudo eliminar la empresa");
      })(),
      {
        loading: "Eliminando…",
        success: "Empresa eliminada",
        error: (e) => e?.message ?? "No se pudo eliminar",
      }
    );

    setOpenDelete(false);
    setDeleteTarget(null);
    await refresh();
  };

    // Filtro + orden
    const filtered = useMemo(() => {
      const qn = qDeferred.trim().toLowerCase();
      const byQ = qn
        ? items.filter(x => x.name.toLowerCase().includes(qn) || x.slug.toLowerCase().includes(qn))
        : items;

      if (sortBy === "az") return [...byQ].sort((a, b) => a.name.localeCompare(b.name));
      if (sortBy === "za") return [...byQ].sort((a, b) => b.name.localeCompare(a.name));

      // "recent": ordenar por último acceso -> updatedAt -> createdAt
      const parseISO = (s?: string | null) => (s ? Date.parse(s) : NaN);

      return [...byQ].sort((a, b) => {
        const aLast = parseISO(a.lastAccessAt);
        const bLast = parseISO(b.lastAccessAt);

        const aDate = isNaN(aLast)
          ? (parseISO(a.updatedAt) || parseISO(a.createdAt) || 0)
          : aLast;
        const bDate = isNaN(bLast)
          ? (parseISO(b.updatedAt) || parseISO(b.createdAt) || 0)
          : bLast;

        return bDate - aDate;
      });
    }, [items, qDeferred, sortBy]);

    useEffect(() => {
      window.api?.setCompanyOverlay?.({ slug: null });
    }, []);

    useEffect(() => {
    const el = gridRef.current;
    if (!el) {
      document.documentElement.style.setProperty("--tip-gap", `25px`);
      return;
    }

    // Config: 1 fila => 100px, 2+ filas => 25px
    const GAP_ONE_ROW = 150;
    const GAP_MULTI   = 25;

    const compute = () => {
      const items = Array.from(el.children) as HTMLElement[];
      if (!items.length) {
        document.documentElement.style.setProperty("--tip-gap", `${GAP_MULTI}px`);
        return;
      }
      // Contamos filas por offsetTop distinto
      const tops = new Set(items.map(it => it.offsetTop));
      const rows = tops.size;
      const gap = rows <= 1 ? GAP_ONE_ROW : GAP_MULTI;
      document.documentElement.style.setProperty("--tip-gap", `${gap}px`);
    };

    // Observa tamaño del grid 
    const ro = new ResizeObserver(compute);
    ro.observe(el);

    // Observa cambios de hijos 
    const mo = new MutationObserver(compute);
    mo.observe(el, { childList: true });

    // También por si hay resize de ventana
    window.addEventListener("resize", compute);

    // Primer cálculo
    compute();

    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [gridRef, filtered.length, loading]);


    return (
      <>
        <Toaster position="top-right" />

        {/* ---------- App Header ---------- */}
        <header className="app-header">
          <div className="app-header-inner">
            <div className="ah-left">
              <div className="app-logo" aria-hidden="true">
                <img src={appLogoUrl} alt="" />
              </div>
              <div className="app-title">COPPLEM</div>
            </div>

            <div className="ah-actions">
              <div className="settings" ref={settingsRef}>
                <button
                  className="icon ghost"
                  aria-haspopup="menu"
                  aria-expanded={openSettings}
                  aria-label="Configuración"
                  onClick={() => setOpenSettings(s => !s)}
                >
                  <IconGear size={20} strokeWidth={2} color="black" aria-hidden="true" />
                </button>
                {openSettings && (
                  <div className="menu" role="menu">
                    <button role="menuitem" onClick={() => { setOpenSettings(false); setConfirmDeleteAll(true); }}>
                      Eliminar todas las empresas
                    </button>
                    {/* <button
                      role="menuitem"
                      className="dangerac"
                      onClick={() => { 
                        setOpenSettings(false);
                        setConfirmUninstall(true); 
                      }}
                      disabled={!canUninstall}
                      title={canUninstall ? "" : "No disponible en modo dev"}
                    >
                      Desinstalar la aplicación
                    </button> */}
                  </div>
                )}
              </div>

              <button className="primary outline with-icon" onClick={onSignOut}>
                <IconLogout size={18} strokeWidth={2} aria-hidden="true" />
                Salir
              </button>
            </div>
          </div>
        </header>

        {/* ---------- Contenido principal ---------- */}
        <div className="companies-wrap">
          {/* Header grande */}
          <div className="page-header">
            <div className="ph-left">
                <div className="ph-icon" aria-hidden="true">
                  <IconBuilding size={22} strokeWidth={2.2} />
                </div>
              <div>
                <h1>Mis Empresas</h1>
                <p>Selecciona una empresa para comenzar</p>
              </div>
            </div>
            <div className="ph-actions">
              <button className="primary" onClick={onOpenCreate}>+ Nueva Empresa</button>
            </div>
          </div>

          {/* Filtros */}
          <div className="toolbar">
            <div className="search">
              <IconSearch className="ic" size={16} strokeWidth={2} aria-hidden="true" />
              <input
                placeholder="Buscar empresa…"
                value={q}
                onChange={e => setQ(e.target.value)}
                aria-label="Buscar empresa"
              />
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              aria-label="Ordenar por"
            >
              <option value="recent">Último Acceso</option>
              <option value="az">Nombre A → Z</option>
              <option value="za">Nombre Z → A</option>
            </select>
          </div>

          {/* Grid de tarjetas */}
          {loading ? (
            <div className="company-grid" ref={gridRef}>
              {Array.from({ length: 6 }).map((_, i) => (
                <article className="company-card skeleton" key={i}>
                  <header className="cc-head">
                    <div className="cc-meta">
                      <div className="avatar skeleton-box" />
                      <div className="cc-title">
                        <div className="name skeleton-box" style={{ width: 160, height: 16 }} />
                        <div className="slug skeleton-box" style={{ width: 110, height: 12 }} />
                      </div>
                    </div>
                  </header>

                  <div className="cc-stats">
                    <div className="stat">
                      <IconBox size={18} strokeWidth={2} aria-hidden="true" />
                      <span className="label">Total de productos:</span>
                      <span className="value skeleton-box" style={{ width: 30, height: 12 }} />
                    </div>
                    <div className="stat">
                      <IconClock size={18} strokeWidth={2} aria-hidden="true" />
                      <span className="label">Último acceso:</span>
                      <span className="value skeleton-box" style={{ width: 80, height: 12 }} />
                    </div>
                    <div className="stat">
                      <IconTrend size={18} strokeWidth={2} aria-hidden="true" />
                      <span className="label">Ventas hoy:</span>
                      <span className="value skeleton-box" style={{ width: 30, height: 12 }} />
                    </div>
                  </div>

                  <footer className="cc-actions">
                    <button className="primary wfull" disabled />
                  </footer>
                </article>
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <div className="company-grid" ref={gridRef}>
              {filtered.map(c => (
                <article className="company-card" key={c.slug}>
                  <header className="cc-head">
                    <div className="cc-meta">
                      <Avatar
                        name={c.name}
                        avatarUrl={c.avatarUrl ?? undefined}
                        bgColor={c.color ?? undefined}
                      />
                      <div className="cc-title">
                        <div className="name" title={c.name}>{c.name}</div>
                        <div className="slug">{c.slug}</div>
                      </div>
                    </div>

                    <div
                      className="cc-menu"
                      ref={el => { menuRefs.current[c.slug] = el; }}
                    >
                      <button
                        className="icon ghost"
                        onClick={() => setMenuSlug(s => s === c.slug ? null : c.slug)}
                        aria-label={`Opciones de ${c.name}`}
                        aria-haspopup="menu"
                        aria-expanded={menuSlug === c.slug}
                        aria-controls={menuSlug === c.slug ? `menu-${c.slug}` : undefined}
                      >
                        <IconMore aria-hidden="true" />
                      </button>

                      {menuSlug === c.slug && (
                        <div
                          id={`menu-${c.slug}`}
                          className="menu"
                          role="menu"
                          onMouseLeave={() => setMenuSlug(null)}
                        >
                          <button role="menuitem" onClick={() => { setMenuSlug(null); requireAuth("edit", c); }}>
                            Editar
                          </button>
                          <button
                            role="menuitem"
                            onClick={() => {
                              setMenuSlug(null);
                              requireAuth("setup", c); 
                            }}
                          >
                            Editar datos
                          </button>
                          <button
                            role="menuitem"
                            onClick={async () => {
                              setMenuSlug(null);

                              const avatarDataUrl = await ensureDataUrl(c.avatarUrl ?? null);

                              const res = await window.api.createCompanyShortcut({
                                slug: c.slug,
                                name: c.name,
                                avatarDataUrl, 
                                colorHex: c.color ?? "#ffe8da",
                              });

                              if (res.ok) toast.success("Acceso directo creado en el Escritorio");
                              else toast.error(res.error || "No se pudo crear el acceso directo");
                            }}
                          >
                            Crear acceso directo
                          </button>
                          <button role="menuitem" className="dangerac" onClick={() => { setMenuSlug(null); requireAuth("delete", c); }}>
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </header>

                  <div className="cc-stats">
                    <div className="stat">
                      <IconBox size={18} strokeWidth={2} aria-hidden="true" />
                      <span className="label">Total de productos:</span>
                      <span className="value">{c.productCount ?? 0}</span>
                    </div>

                    <div className="stat">
                      <IconClock size={18} strokeWidth={2} aria-hidden="true" />
                      <span className="label">Último acceso:</span>
                      <span className="value">{relativeFromNow(c.lastAccessAt)}</span>
                    </div>

                    <div className="stat">
                      <IconTrend size={18} strokeWidth={2} aria-hidden="true" />
                      <span className="label">Ventas hoy:</span>
                      <span className="value">{c.todaySalesCount ?? "—"}</span>
                    </div>
                  </div>

                  <footer className="cc-actions">
                    <button
                      className="primary wfull"
                      onClick={() => {
                        setLoginCompany(c);
                        setAfterLoginPath(null);
                        setOpenLoginModal(true);
                      }}
                    >
                      <IconOpen size={16} strokeWidth={2} style={{ marginRight: 6 }} aria-hidden="true" />
                      Abrir Empresa
                    </button>
                  </footer>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty">
              <div className="empty-icon" aria-hidden="true">
                <IconHardHat size={36} strokeWidth={2} />
              </div>
              <h3>{q ? "No se encontraron empresas" : "Aún no hay empresas"}</h3>
              <p className="muted">{q ? "Prueba con otro término" : "Crea tu primera empresa para empezar"}</p>
              {!q && <button className="primary" onClick={onOpenCreate}>Crear primera empresa</button>}
            </div>
          )}



          <div className="tip-wrap">
            <div
              className={`tip-panel ${tipCollapsed ? "collapsed" : ""}`}
              role="note"
              aria-label="Consejo"
            >
              <div className="tip-content" aria-hidden={tipCollapsed}>
                <div className="tip-icon" aria-hidden="true">
                  <IconTip size={18} strokeWidth={2.2} />
                </div>
                <div className="tip-body">
                  <div className="tip-title">Consejo:</div>
                  <p>
                    Haz clic en <strong>&quot;Abrir Empresa&quot;</strong> para acceder al sistema de gestión.
                    Puedes crear accesos directos para tus empresas más utilizadas desde el menú de opciones.
                  </p>
                </div>
              </div>

              <img
                className={`tip-mascot ${tipCollapsed ? "pop" : ""}`}
                src={mascotUrl}
                alt=""
                role="button"
                tabIndex={0}
                aria-expanded={!tipCollapsed}
                title={tipCollapsed ? "Mostrar consejo" : "Ocultar consejo (dejar solo la mascota)"}
                onClick={toggleTipCollapsed}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleTipCollapsed(); }}
              />
            </div>
          </div>
        </div>

        {/* ---------- Modales / Confirmaciones ---------- */}

        {/* Modal Crear */}
        <Modal open={openCreate} title="Crear nueva empresa" onClose={() => setOpenCreate(false)} className="create-company">
          {/* Nombre */}
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="cName">Nombre de la empresa *</label>
            <div className="input">
              <IconBuilding className="ic" size={16} aria-hidden="true" />
              <input
                id="cName"
                value={cName}
                onChange={e => setCName(e.target.value)}
                placeholder="Mi Empresa Ltda."
              />
            </div>
          </div>

          {/* Logo/Color + preview */}
          <div className="avatar-row" style={{ marginTop: 4, marginBottom: 16 }}>
            <Avatar
              name={cName || "Empresa"}
              avatarUrl={cLogoPreview}
              bgColor={cLogoPreview ? null : cColor}
            />
            <div className="upload-actions">
              <label className="btn-file">
                {cLogoPreview ? "Cambiar imagen" : "Subir imagen"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const f = e.target.files?.[0] || null;
                    if (!f) {
                      setCLogoFile(null);
                      setCLogoPreview(null);
                      return;
                    }
                    try {
                      setCLogoFile(f);
                      setCLogoPreview(await readAsDataUrl(f));
                    } catch (err: any) {
                      toast.error(err?.message ?? "No se pudo leer la imagen.");
                    }
                  }}
                />
              </label>

              {cLogoPreview ? (
                <button
                  type="button"
                  onClick={() => { setCLogoFile(null); setCLogoPreview(null); }}
                >
                  Quitar imagen
                </button>
              ) : (
                <div className="color-picker">
                  <span>Color:</span>
                  <input
                    type="color"
                    value={cColor}
                    onChange={e => setCColor(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Credenciales ADMIN */}
          <div className="form-grid grid-2">
            <div>
              <label htmlFor="adminUser">Usuario ADMIN *</label>
              <div className="input">
                <IconUser className="ic" size={16} aria-hidden="true" />
                <input
                  id="adminUser"
                  value={adminUser}
                  onChange={e => setAdminUser(e.target.value)}
                  placeholder="admin"
                />
              </div>
            </div>

            <div>
              <label htmlFor="adminPass">Contraseña ADMIN *</label>
              <div className="input input-password">
                <IconLock className="ic" size={16} aria-hidden="true" />
                <input
                  id="adminPass"
                  type={adminPassVisible ? "text" : "password"}
                  value={adminPass}
                  onChange={e => setAdminPass(e.target.value)}
                  placeholder="••••••••"
                  aria-describedby="adminPassHelp"
                />
                <button
                  type="button"
                  className="toggle-pass"
                  aria-label={adminPassVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={adminPassVisible}
                  title={adminPassVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setAdminPassVisible(v => !v)}
                >
                  {adminPassVisible ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </button>
              </div>
              <small id="adminPassHelp" className="muted">Usa al menos 8 caracteres.</small>
            </div>

            <div>
              <label htmlFor="adminPass2">Confirmar contraseña *</label>
              <div className="input input-password">
                <IconLock className="ic" size={16} aria-hidden="true" />
                <input
                  id="adminPass2"
                  type={adminPassVisible ? "text" : "password"}
                  value={adminPassConfirm}
                  onChange={e => setAdminPassConfirm(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="toggle-pass"
                  aria-label={adminPassVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={adminPassVisible}
                  title={adminPassVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setAdminPassVisible(v => !v)}
                >
                  {adminPassVisible ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </button>
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="modal-actions">
              <div className="inline-checks" style={{ display: "flex", gap: 16, alignItems: "center", marginRight: "auto" }}>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={createDesktopShortcut}
                  onChange={(e) => setCreateDesktopShortcut(e.target.checked)}
                />
                Crear acceso directo en el escritorio
              </label>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={openDataAfterCreate}
                  onChange={e => setOpenDataAfterCreate(e.target.checked)}
                />
                Abrir formulario de datos al crear
              </label>
            </div>
            <button onClick={() => setOpenCreate(false)} disabled={savingCreate}>Cancelar</button>
            <button className="primary" onClick={onCreate} disabled={savingCreate}>
              {savingCreate ? "Creando…" : "Crear"}
            </button>
          </div>
        </Modal>


        {/* Modal Editar */}
        <Modal open={openEdit} title="Editar empresa" onClose={() => setOpenEdit(false)}>
          <label htmlFor="newName">Nuevo nombre *</label>
          <input id="newName" value={newName} onChange={e => setNewName(e.target.value)} />

          {/* Icono: imagen o color (oculta color si hay imagen) */}
          <div className="avatar-row" style={{ marginTop: 12 }}>
            <Avatar name={newName || editTarget?.name || "Empresa"} avatarUrl={editLogoPreview} bgColor={editLogoPreview ? null : editColor} />

            <div className="upload-actions">
              <label className="btn-file">
                {editLogoPreview ? "Cambiar imagen" : "Subir imagen"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const f = e.target.files?.[0] || null;
                    if (!f) {
                      setEditLogoFile(null);
                      setEditLogoPreview(editTarget?.avatarUrl ?? null);
                      setRemoveLogo(false);
                      return;
                    }
                    try {
                      setEditLogoFile(f);
                      setEditLogoPreview(await readAsDataUrl(f));
                      setRemoveLogo(false);
                    } catch (err: any) {
                      toast.error(err?.message ?? "No se pudo leer la imagen.");
                    }
                  }}
                />
              </label>

              {editLogoPreview ? (
                <button type="button" onClick={() => { setEditLogoFile(null); setEditLogoPreview(null); setRemoveLogo(true); }}>
                  Quitar imagen
                </button>
              ) : (
                <div className="color-picker">
                  <span>Color:</span>
                  <input
                    type="color"
                    value={editColor}
                    onChange={e => { setEditColor(e.target.value); if (!editLogoPreview) setRemoveLogo(false); }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="modal-actions">
            <button onClick={() => setOpenEdit(false)} disabled={savingEdit}>Cancelar</button>
            <button className="primary" onClick={onEdit} disabled={savingEdit}>
              {savingEdit ? "Guardando…" : "Guardar"}
            </button>
          </div>

        </Modal>

        {/* Confirmación eliminar */}
        <Confirm
          open={openDelete}
          text={deleteTarget ? `¿Borrar la empresa "${deleteTarget.name}"?` : ""}
          onCancel={() => { setOpenDelete(false); setDeleteTarget(null); }}
          onConfirm={onDelete}
          confirmLabel="Eliminar"
        >
          <label className="inline-check" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
            <input
              type="checkbox"
              checked={deleteAlsoBackups}
              onChange={(e) => setDeleteAlsoBackups(e.target.checked)}
            />
            <span>Eliminar también los backups de esta empresa</span>
          </label>
        </Confirm>


        {/* Confirmaciones header */}
        <Confirm
          open={confirmDeleteAll}
          text="¿Eliminar TODAS las empresas? Esta acción no se puede deshacer."
          onCancel={() => setConfirmDeleteAll(false)}
          onConfirm={onDeleteAllConfirmed}
          confirmLabel="Eliminar todo"
        />
        <Confirm
          open={confirmUninstall}
          text={canUninstall
            ? "Se abrirá el desinstalador del sistema para COPPLEM. ¿Continuar?"
            : "La desinstalación no está disponible en modo dev."
          }
          onCancel={() => setConfirmUninstall(false)}
          onConfirm={onUninstallConfirmed}
          confirmLabel={canUninstall ? "Desinstalar" : "Entendido"}
        />

        <Confirm
          open={confirmGoSetup}
          text="¿Guardar cambios antes de abrir los datos de la empresa? (Si presionas Cancelar, se abrirá sin guardar.)"
          onCancel={() => {
            setConfirmGoSetup(false);
            if (editTarget) {
              setOpenEdit(false);
              nav(`/setup/${editTarget.slug}`);     // ir sin guardar
            }
          }}
          onConfirm={async () => {
            const prevSlug = editTarget?.slug;
            const targetSlug = newName.trim() ? slugify(newName.trim()) : prevSlug;
            try {
              await onEdit();                        // guarda (cierra modal y recarga)
              if (targetSlug) nav(`/setup/${targetSlug}`);
            } finally {
              setConfirmGoSetup(false);
            }
          }}
          confirmLabel="Guardar y abrir"
        />
        {/* Verificación */}
        {/* Modal de login para abrir empresa */}
        <CompanyLoginModal
          open={openLoginModal}
          slug={loginCompany?.slug ?? ""}
          onClose={() => { setOpenLoginModal(false); setLoginCompany(null); }}
          onSuccessNav={handleSuccessNav}
        />

        {/* Verificación */}
        <AuthConfirmModal
          open={authOpen}
          slug={authFor?.company.slug ?? ""}
          title={
            authFor?.action === "delete"
              ? "Confirma tu identidad para eliminar"
              : "Confirma tu identidad"
          }
          onClose={() => { setAuthOpen(false); setAuthFor(null); }}
          onSuccess={() => {
            const target = authFor;
            setAuthOpen(false);
            setAuthFor(null);
            if (!target) return;

            if (target.action === "setup") {
              setSetupSlug(target.company.slug);
              setOpenSetupModal(true);
              return;
            }

            if (target.action === "edit") onOpenEdit(target.company);
            else if (target.action === "delete") onOpenDelete(target.company);
          }}
        />
        {openSetupModal && setupSlug && (
          <SetupBusinessModal
            open={openSetupModal}
            slug={setupSlug}
            onClose={() => { setOpenSetupModal(false); setSetupSlug(null); }}
          />
        )}
      </>
    );
  }
