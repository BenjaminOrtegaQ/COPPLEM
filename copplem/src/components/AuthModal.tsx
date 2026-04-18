// src/components/AuthModal.tsx
import { useEffect, useState } from "react";
import {
  User as IconUser,
  Lock as IconLock,
  Eye as IconEye,
  EyeOff as IconEyeOff,
} from "lucide-react";

import "../styles/login.css";


export default function AuthConfirmModal({
  open,
  slug,
  title = "Verificación de identidad",
  subtitle = "Ingresa tus credenciales para continuar",
  onClose,
  onSuccess,
}: {
  open: boolean;
  slug: string;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onSuccess: (data: { user: any; raw: any }) => void;
}) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUser("");
      setPass("");
      setVisible(false);
      setErr(null);
      setLoading(false);
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

  const verify = async () => {
    setErr(null);
    if (!user.trim() || !pass) {
      setErr("Ingresa usuario y contraseña.");
      return;
    }
    try {
      setLoading(true);
      const res = await (window as any).api?.login?.({
        slug,
        username: user.trim(),
        password: pass,
      });
      if (!res || !("ok" in res) || !res.ok) {
        setErr("Credenciales inválidas.");
        return;
      }
      const rawUser: any =
        (res as any).user ??
        (res as any).data?.user ??
        (res as any).data ??
        null;
      onSuccess({ user: rawUser, raw: res });
    } catch {
      setErr("No se pudo verificar. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="login-card authcard-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="brand" style={{ marginBottom: 8 }}>
          <h1 className="brand-name" style={{ marginBottom: 4 }}>{title}</h1>
          <p className="brand-sub">{subtitle}</p>
        </div>

        {/* Enter envía automáticamente */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!loading) verify();
          }}
        >
          <div className="field">
            <label>Usuario</label>
            <div className="input">
              <IconUser className="ic" size={16} />
              <input
                autoFocus
                placeholder="Tu usuario"
                value={user}
                onChange={(e) => setUser(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>Contraseña</label>
            <div className="input input-password">
              <IconLock className="ic" size={16} />
              <input
                type={visible ? "text" : "password"}
                placeholder="Tu contraseña"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
              />
              <button
                type="button"
                className="toggle-pass"
                aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={visible}
                onClick={() => setVisible(v => !v)}
              >
                {visible ? <IconEyeOff size={18} /> : <IconEye size={18} />}
              </button>
            </div>
          </div>

          {err && <div className="form-error">{err}</div>}

          {/* Acciones */}
          <div className="auth-actions">
            <button type="button" className="btn" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="primary" disabled={loading}>
              {loading ? "Verificando…" : "Continuar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
