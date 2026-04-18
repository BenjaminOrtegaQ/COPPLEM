// src/pages/Login.tsx
import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  User as IconUser,
  Lock as IconLock,
  ArrowLeft as IconBack,
  Eye as IconEye,
  EyeOff as IconEyeOff
} from "lucide-react";
import "../styles/login.css";
import appLogoUrl from "../assets/logo.svg";
import mascotUrl from "../assets/happy-copply.svg";

// ===== Helpers para permisos =====
type PageId = "dashboard" | "productos" | "pos" | "reportes" | "usuarios" | "datos";
const ROLE_DEFAULTS: Record<"ADMIN" | "VENDEDOR", PageId[]> = {
  ADMIN:    ["dashboard","productos","pos","reportes","usuarios","datos"],
  VENDEDOR: ["pos"], // por defecto POS
};
const allowKey = (slug: string, userId: number) => `copplem:allow:${slug}:${userId}`;

export default function Login() {
  const { slug = "" } = useParams();
  const nav = useNavigate();

  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [pVisible, setPVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErr(null);
    if (!u.trim() || !p) {
      setErr("Completa usuario y contraseña.");
      return;
    }

    try {
      setLoading(true);
      const res = await window.api.login({ slug, username: u.trim(), password: p });

      if (!res || !("ok" in res) || !res.ok) {
        setErr("Credenciales inválidas o error de servidor.");
        return;
      }

      const rawUser: any =
        (res as any).user ??
        (res as any).data?.user ??
        (res as any).data ??
        null;

      // Campos que esperamos: id, nombre/username, rol ('ADMIN'|'VENDEDOR')
      const userId: number = Number(rawUser?.id ?? rawUser?.userId ?? 0);
      const userName: string = rawUser?.nombre ?? rawUser?.fullName ?? rawUser?.username ?? "";
      const userRoleRaw: string = String(rawUser?.rol ?? rawUser?.role ?? "").toUpperCase();
      const userRole: "ADMIN" | "VENDEDOR" = userRoleRaw === "ADMIN" ? "ADMIN" : "VENDEDOR";

      const safeUserId = Number.isFinite(userId) && userId > 0 ? userId : Math.abs(hash(`${slug}:${userName}`));

      // --------- guardamos sesión para el header/App ---------
      const session = {
        slug,
        user: {
          id: safeUserId,
          nombre: userName,
          username: rawUser?.username ?? userName,
          rol: userRole, // 'ADMIN' | 'VENDEDOR'
        },
      };
      try {
        localStorage.setItem("copplem:session", JSON.stringify(session));
      } catch {}

      // --------- inicializa whitelist si es vendedor y no existe ---------
      if (userRole === "VENDEDOR") {
        const key = allowKey(slug, safeUserId);
        try {
          const exists = localStorage.getItem(key);
          if (!exists) {
            localStorage.setItem(key, JSON.stringify(ROLE_DEFAULTS.VENDEDOR)); // pos
          }
        } catch {}
      }

      nav(`/app/${slug}`);
    } catch (e) {
      setErr("No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      {/* Botón volver arriba-izquierda */}
      <button className="ghost-back" onClick={() => nav("/")}>
        <IconBack size={18} /> Volver a Empresas
      </button>

      <div className="login-card">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <img src={appLogoUrl} alt="" />
          </div>
          <h1 className="brand-name">COPPLEM</h1>
          <p className="brand-sub">Ingrese sus credenciales para iniciar sesión en el sistema</p>
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

          <button className="primary wfull" type="submit" disabled={loading}>
            {loading ? "Iniciando…" : "Iniciar sesión"}
          </button>
        </form>

        <img className="login-mascot" src={mascotUrl} alt="" />
      </div>
    </div>
  );
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

