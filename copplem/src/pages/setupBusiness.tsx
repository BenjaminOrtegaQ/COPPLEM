import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import {
  Building2 as IconBiz,
  MapPin as IconMap,
  Mail as IconMail,
  Phone as IconPhone,
  ArrowLeft as IconBack,
  LogIn as IconLogin,
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

export default function SetupBusiness() {
  const nav = useNavigate();
  const { slug = "" } = useParams<{ slug: string }>();
  const { data, loading, error, update } = useBusinessInfo(slug);

  const [form, setForm] = useState<Business | null>(null);
  const [saving, setSaving] = useState(false);

  const [meta, setMeta] = useState<{ name: string; avatarUrl?: string | null; color?: string | null } | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const list: any[] = await (window as any).api?.listCompanies?.();
        const found = Array.isArray(list) ? list.find((x) => x.slug === slug) : null;
        if (found) setMeta({ name: found.name, avatarUrl: found.avatarUrl ?? null, color: found.color ?? null });
      } catch {}
    })();
  }, [slug]);

  useEffect(() => {
    setForm(data ?? null);
  }, [data]);

  const setVal =
    (k: keyof Business) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => (prev ? { ...prev, [k]: e.target.value } : prev));
    };

  /* ===== Navegación con confirmación si hay cambios ===== */
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

  // destino pendiente: back | login | null
  const [confirmNav, setConfirmNav] = useState<null | "back" | "login">(null);

  const goBack = () => nav("/");
  const goLogin = () => nav(`/login/${slug}`);

  const onClickBack = () => {
    if (hasChanges) setConfirmNav("back");
    else goBack();
  };
  const onClickLogin = () => {
    if (hasChanges) setConfirmNav("login");
    else goLogin();
  };

  // Guarda y devuelve true/false para saber si navegar
  const onSave = async (): Promise<boolean> => {
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

  // desactiivar guardar si no hay nombre o está guardando
  const isSavingDisabled = useMemo(
    () => saving || !form || !form.nombre?.trim(),
    [saving, form]
  );

  // cerrar confirm con ESC
  useEffect(() => {
    if (!confirmNav) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmNav(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmNav]);

  return (
    <div className="data-wrap setup">
      <Toaster position="top-right" />

      {/* ===== Barra superior ===== */}
      <div className="setup-top">
        <button className="back-btn" onClick={onClickBack}>
          <IconBack size={18} />
          Volver a Empresas
        </button>

        <button className="login-btn" onClick={onClickLogin}>
          Ir al login
          <IconLogin size={18} />
        </button>
      </div>

      {/* Header */}
      <div className="data-page-header">
        <h1>Configurar empresa</h1>
        <div className="muted">Completa la información básica antes de iniciar sesión</div>
      </div>

      {/* Contenido */}
      <div className="data-grid mg-top">
        <div className="left-col">
          <section className="card">
            <div className="card-head">
              <div className="ch-left">
                {/* Avatar real de la empresa */}
                <BizAvatar
                  name={meta?.name ?? form?.nombre ?? "Empresa"}
                  avatarUrl={meta?.avatarUrl}
                  bgColor={meta?.color}
                />
                <div>
                  <div className="ch-title">Información del Negocio</div>
                  <div className="ch-sub muted">Nombre, RUT y contacto</div>
                </div>
              </div>
              <div className="ch-actions">
                <button className="btn" onClick={onSave} disabled={isSavingDisabled}>
                  {saving ? "Guardando…" : loading ? "Cargando…" : "Guardar"}
                </button>
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
          </section>
        </div>

        <div className="right-col" />
      </div>

      {/* ===== Confirmación de navegación ===== */}
      {confirmNav && (
        <div className="modal" role="dialog" aria-modal="true" onClick={() => setConfirmNav(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 style={{ margin: 0 }}>Cambios sin guardar</h3>
              <button className="icon" onClick={() => setConfirmNav(null)} aria-label="Cerrar">
                ✕
              </button>
            </div>

            <p style={{ marginTop: 10 }}>
              ¿Quieres guardar antes de {confirmNav === "login" ? "ir al login" : "volver a Empresas"}?
            </p>

            <div className="modal-actions">
              <button
                onClick={() => {
                  const t = confirmNav;
                  setConfirmNav(null);
                  t === "login" ? goLogin() : goBack();
                }}
              >
                Salir sin guardar
              </button>

              <button
                className="primary"
                onClick={async () => {
                  const ok = await onSave();
                  if (ok) {
                    const t = confirmNav;
                    setConfirmNav(null);
                    t === "login" ? goLogin() : goBack();
                  }
                }}
                disabled={saving}
              >
                {saving ? "Guardando…" : "Guardar y continuar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
