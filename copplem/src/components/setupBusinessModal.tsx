// src/components/SetupBusinessModal.tsx
import { useEffect, useMemo, useState } from "react";
import FocusTrap from "focus-trap-react";
import { toast } from "react-hot-toast";
import {
  Building2 as IconBiz,
  MapPin as IconMap,
  Mail as IconMail,
  Phone as IconPhone,
} from "lucide-react";

import { Business } from "../shared/business";
import { useBusinessInfo } from "../hooks/useBusinessInfo";

import "../styles/data.css";
import "../styles/setupbusiness.css";

/* ===== Utils para avatar ===== */
const DEFAULT_AVATAR_BG = "#ffe8da";
function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
function hexToRgb(hex: string) {
  let h = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{3,6}$/.test(h)) return { r: 255, g: 255, b: 255 };
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
function textColorForBg(bgHex: string) {
  const { r, g, b } = hexToRgb(bgHex);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; // 0..1
  return luminance > 0.6 ? "#1f2937" : "#ffffff";
}

/* Avatar local */
function BizAvatar({
  name,
  avatarUrl,
  bgColor,
}: {
  name: string;
  avatarUrl?: string | null;
  bgColor?: string | null;
}) {
  const bg = avatarUrl ? null : (bgColor ?? DEFAULT_AVATAR_BG);
  return (
    <div
      className="biz-avatar"
      style={{ background: bg ?? undefined, color: bg ? textColorForBg(bg) : undefined }}
      aria-hidden={!!avatarUrl}
      title={`Icono de ${name}`}
    >
      {avatarUrl ? <img src={avatarUrl} alt={`Logo de ${name}`} /> : initials(name)}
    </div>
  );
}

type Props = {
  open: boolean;
  slug: string;
  onClose: () => void;
};

export default function SetupBusinessModal({ open, slug, onClose }: Props) {
  const { data, loading, error, update } = useBusinessInfo(slug);

  const [form, setForm] = useState<Business | null>(null);
  const [saving, setSaving] = useState(false);

  const [meta, setMeta] = useState<{ name: string; avatarUrl?: string | null; color?: string | null } | null>(null);

  // Cargar meta desde preload
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const list: any[] = await (window as any).api?.listCompanies?.();
        const found = Array.isArray(list) ? list.find((x) => x.slug === slug) : null;
        if (found) setMeta({ name: found.name, avatarUrl: found.avatarUrl ?? null, color: found.color ?? null });
      } catch {}
    })();
  }, [open, slug]);

  useEffect(() => {
    setForm(data ?? null);
  }, [data, open]);

  const setVal =
    (k: keyof Business) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => (prev ? { ...prev, [k]: e.target.value } : prev));
    };

  /* ===== detectar cambios sin guardar ===== */
  const hasChanges = useMemo(() => {
    if (!data || !form) return false;

    const norm = (b: Business) => ({
      nombre: (b.nombre ?? "").trim(),
      rut: (b.rut ?? "").trim(),
      giro: (b.giro ?? "").trim(),
      direccion: (b.direccion ?? "").trim(),
      comuna: (b.comuna ?? "").trim(),
      ciudad: (b.ciudad ?? "").trim(),
      region: (b.region ?? "").trim(),
      telefono: (b.telefono ?? "").trim(),
      email: (b.email ?? "").trim(),
      moneda: (b.moneda ?? "").trim(),
      ivaPorDefecto:
        b.ivaPorDefecto === null ||
        b.ivaPorDefecto === undefined ||
        (b.ivaPorDefecto as any) === ""
          ? null
          : Number(b.ivaPorDefecto),
    });

    return JSON.stringify(norm(data)) !== JSON.stringify(norm(form));
  }, [data, form]);

  // Confirmación al cerrar con cambios
  const [confirmClose, setConfirmClose] = useState(false);

  const tryClose = () => {
    if (hasChanges) setConfirmClose(true);
    else onClose();
  };

  const doSave = async (): Promise<boolean> => {
    if (!form?.nombre?.trim()) {
      toast.error("El nombre del negocio es obligatorio.");
      return false;
    }
    try {
      setSaving(true);
      await update({
        nombre: form.nombre,
        rut: form.rut ?? null,
        giro: form.giro ?? null,
        direccion: form.direccion ?? null,
        comuna: form.comuna ?? null,
        ciudad: form.ciudad ?? null,
        region: form.region ?? null,
        telefono: form.telefono ?? null,
        email: form.email ?? null,
        moneda: form.moneda ?? null,
        ivaPorDefecto:
          form.ivaPorDefecto === null ||
          form.ivaPorDefecto === undefined ||
          (form.ivaPorDefecto as any) === ""
            ? null
            : Number(form.ivaPorDefecto),
      });
      toast.success("Datos guardados");
      return true;
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar");
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={tryClose}>
      <FocusTrap active={open}>
        <div className="modal-card-setup" onClick={(e) => e.stopPropagation()}>
          <div className="data-page-header" style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <BizAvatar
                name={meta?.name ?? form?.nombre ?? "Empresa"}
                avatarUrl={meta?.avatarUrl}
                bgColor={meta?.color}
              />
              <div>
                <h1 style={{ margin: 0 }}>Configurar empresa</h1>
                <div className="muted">Completa la información básica antes de iniciar sesión</div>
              </div>
            </div>
          </div>

          {error && <div className="note warning small">⚠️ {error}</div>}

          {!form ? (
            <div className="muted">Cargando…</div>
          ) : (
            <div className="biz-form">
              <div className="row one">
                <div className="field">
                  <label>Nombre*</label>
                  <div className="input">
                    <IconBiz className="ic" size={16} />
                    <input
                      value={form.nombre ?? ""}
                      onChange={setVal("nombre")}
                      placeholder="Mi Empresa Ltda."
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>

              <div className="row two">
                <div className="field">
                  <label>RUT</label>
                  <div className="input">
                    <IconBiz className="ic" size={16} />
                    <input
                      value={form.rut ?? ""}
                      onChange={setVal("rut")}
                      placeholder="76.123.456-7"
                      disabled={saving}
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Giro</label>
                  <div className="input">
                    <IconBiz className="ic" size={16} />
                    <input
                      value={form.giro ?? ""}
                      onChange={setVal("giro")}
                      placeholder="Comercio al por menor"
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>

              <div className="row three">
                <div className="field">
                  <label>Región</label>
                  <div className="input">
                    <IconMap className="ic" size={16} />
                    <input
                      value={form.region ?? ""}
                      onChange={setVal("region")}
                      placeholder="Región Metropolitana"
                      disabled={saving}
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Ciudad</label>
                  <div className="input">
                    <IconMap className="ic" size={16} />
                    <input
                      value={form.ciudad ?? ""}
                      onChange={setVal("ciudad")}
                      placeholder="Santiago"
                      disabled={saving}
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Comuna</label>
                  <div className="input">
                    <IconMap className="ic" size={16} />
                    <input
                      value={form.comuna ?? ""}
                      onChange={setVal("comuna")}
                      placeholder="Providencia"
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>

              <div className="row two">
                <div className="field">
                  <label>Dirección</label>
                  <div className="input">
                    <IconMap className="ic" size={16} />
                    <input
                      value={form.direccion ?? ""}
                      onChange={setVal("direccion")}
                      placeholder="Av. Siempre Viva 123"
                      disabled={saving}
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Teléfono</label>
                  <div className="input">
                    <IconPhone className="ic" size={16} />
                    <input
                      value={form.telefono ?? ""}
                      onChange={setVal("telefono")}
                      placeholder="+56 9 1234 5678"
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>

              <div className="row two">
                <div className="field">
                  <label>Correo</label>
                  <div className="input">
                    <IconMail className="ic" size={16} />
                    <input
                      value={form.email ?? ""}
                      onChange={setVal("email")}
                      placeholder="contacto@empresa.cl"
                      disabled={saving}
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Moneda</label>
                  <div className="input">
                    <IconBiz className="ic" size={16} />
                    <input
                      value={form.moneda ?? "CLP"}
                      onChange={setVal("moneda")}
                      placeholder="CLP"
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>

              <div className="row one">
                <div className="field">
                  <label>IVA por defecto</label>
                  <div className="input">
                    <IconBiz className="ic" size={16} />
                    <input
                      type="number"
                      inputMode="numeric"
                      value={form.ivaPorDefecto ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((f) =>
                          f
                            ? {
                                ...f,
                                ivaPorDefecto: v === "" ? null : Number(v),
                              }
                            : f
                        );
                      }}
                      placeholder="19"
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button
              onClick={tryClose}
              disabled={saving}
            >
              Cerrar
            </button>
            <button
              className="primary"
              onClick={async () => {
                const ok = await doSave();
                if (ok) onClose(); 
              }}
              disabled={saving}
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>

          {/* Confirmar cierre con cambios sin guardar */}
          {confirmClose && (
            <div className="modal" role="dialog" aria-modal="true" onClick={() => setConfirmClose(false)}>
              <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-head">
                  <h3 style={{ margin: 0 }}>Cambios sin guardar</h3>
                  <button className="icon" onClick={() => setConfirmClose(false)} aria-label="Cerrar">✕</button>
                </div>
                <p style={{ marginTop: 10 }}>¿Quieres guardar antes de cerrar?</p>
                <div className="modal-actions">
                  <button onClick={() => { setConfirmClose(false); onClose(); }}>Salir sin guardar</button>
                  <button
                    className="primary"
                    onClick={async () => {
                      const ok = await doSave();
                      if (ok) { setConfirmClose(false); onClose(); }
                    }}
                  >
                    Guardar y cerrar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </FocusTrap>
    </div>
  );
}
