// src/components/CompanyLoginModal.tsx
import { useEffect, useState } from "react";
import {
  User as IconUser,
  Lock as IconLock,
  Eye as IconEye,
  EyeOff as IconEyeOff,
  ArrowLeft as IconBack
} from "lucide-react";
import "../styles/login.css";
import appLogoUrl from "../assets/logo.svg";

// ===== Helpers para permisos =====
type PageId = "dashboard" | "productos" | "pos" | "reportes" | "usuarios" | "datos";
const ROLE_DEFAULTS: Record<"ADMIN" | "VENDEDOR", PageId[]> = {
  ADMIN:    ["dashboard","productos","pos","reportes","usuarios","datos"],
  VENDEDOR: ["pos"], // por defecto POS
};
const allowKey = (slug: string, userId: number) => `copplem:allow:${slug}:${userId}`;

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return h;
}

export default function CompanyLoginModal({
  open,
  slug,
  onClose,
  onSuccessNav,
}: {
  open: boolean;
  slug: string;
  onClose: () => void;
  onSuccessNav: (slug: string) => void;
}) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [pVisible, setPVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setU(""); setP(""); setPVisible(false); setErr(null); setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!loading) onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErr(null);
    if (!u.trim() || !p) {
      setErr("Completa usuario y contraseña.");
      return;
    }

    try {
      setLoading(true);
      const res = await (window as any).api?.login?.({ slug, username: u.trim(), password: p });

      if (!res || !("ok" in res) || !res.ok) {
        setErr("Credenciales inválidas o error de servidor.");
        return;
      }

      const rawUser: any =
        (res as any).user ??
        (res as any).data?.user ??
        (res as any).data ??
        null;

      const userId: number = Number(rawUser?.id ?? rawUser?.userId ?? 0);
      const userName: string = rawUser?.nombre ?? rawUser?.fullName ?? rawUser?.username ?? "";
      const userRoleRaw: string = String(rawUser?.rol ?? rawUser?.role ?? "").toUpperCase();
      const userRole: "ADMIN" | "VENDEDOR" = userRoleRaw === "ADMIN" ? "ADMIN" : "VENDEDOR";
      const safeUserId = Number.isFinite(userId) && userId > 0 ? userId : Math.abs(hash(`${slug}:${userName}`));

      // sesión
      const session = {
        slug,
        user: {
          id: safeUserId,
          nombre: userName,
          username: rawUser?.username ?? userName,
          rol: userRole,
        },
      };
      try { localStorage.setItem("copplem:session", JSON.stringify(session)); } catch {}

      // whitelist vendedor por defecto
      if (userRole === "VENDEDOR") {
        const key = allowKey(slug, safeUserId);
        try { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(ROLE_DEFAULTS.VENDEDOR)); } catch {}
      }

      onClose();
      onSuccessNav(slug);
    } catch {
      setErr("No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="login-card authcard-modal" onClick={(e) => e.stopPropagation()}>
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <img src={appLogoUrl} alt="" />
          </div>
          <h1 className="brand-name">COPPLEM</h1>
          <p className="brand-sub">Ingrese sus credenciales para iniciar sesión</p>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label>Usuario</label>
            <div className="input">
              <IconUser className="ic" size={16} />
              <input
                autoFocus
                placeholder="Ingrese su nombre de usuario"
                value={u}
                onChange={(e) => setU(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>Contraseña</label>
            <div className="input input-password">
              <IconLock className="ic" size={16} />
              <input
                type={pVisible ? "text" : "password"}
                placeholder="Ingrese su contraseña"
                value={p}
                onChange={(e) => setP(e.target.value)}
                aria-describedby="passHelp"
              />
              <button
                type="button"
                className="toggle-pass"
                aria-label={pVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={pVisible}
                title={pVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                onClick={() => setPVisible(v => !v)}
              >
                {pVisible ? <IconEyeOff size={18} /> : <IconEye size={18} />}
              </button>
            </div>
            <small id="passHelp" className="muted">Puedes alternar la visibilidad con el botón de la derecha.</small>
          </div>

          {err && <div className="form-error">{err}</div>}

          <div className="auth-actions">
            <button type="button" className="btn" onClick={onClose} disabled={loading}>
              <IconBack size={16} style={{ marginRight: 6 }} /> Cancelar
            </button>
            <button className="primary" type="submit" disabled={loading}>
              {loading ? "Iniciando…" : "Iniciar sesión"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
