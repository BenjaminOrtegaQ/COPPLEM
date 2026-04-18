import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import {
  Search as IconSearch,
  Plus as IconPlus,
  Minus as IconMinus,
  Trash2 as IconTrash,
  ShoppingCart as IconCart,
  CreditCard as IconCard,
  Banknote as IconCash,
  ShoppingCart as IconPOS,
} from "lucide-react";
import "../styles/pos.css";

type Prod = {
  id: number;
  nombre: string;
  precio_venta: number;
  stock_actual: number;
  sku?: string | null;
  codigo_barras?: string | null;
};

type CartItem = { product: Prod; qty: number };

const api = (window as any).api ?? {};
const nfMoney = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const nfInt = new Intl.NumberFormat("es-CL");

export default function POS() {
  const { slug = "" } = useParams();

  // catálogo
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Prod[]>([]);

  // carrito
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<string>("0");
  const [draftQty, setDraftQty] = useState<Record<number, string>>({});

  // pago
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState<"EFECTIVO"|"TARJETA"|"TRANSFERENCIA">("EFECTIVO");
  const [cash, setCash] = useState<string>("0");
  const [customer, setCustomer] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => { refresh(); }, [slug, q]);

  async function refresh() {
    if (typeof api.listProducts !== "function") {
      toast.error("API listProducts no disponible");
      return;
    }
    try {
      setLoading(true);
      // pedimos todo y filtramos en memoria
      const res = await api.listProducts({ slug, q: "" });
      setRows(Array.isArray(res) ? res : []);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al cargar productos");
    } finally {
      setLoading(false);
    }
  }


  function addToCart(p: Prod) {
    setCart(curr => {
      const i = curr.findIndex(c => c.product.id === p.id);
      if (i >= 0) {
        const next = [...curr];
        const target = next[i];
        if (target.qty + 1 > p.stock_actual) {
          toast.error("No hay stock suficiente");
          return curr;
        }
        target.qty += 1;
        return next;
      }
      if (p.stock_actual < 1) {
        toast.error("Sin stock");
        return curr;
      }
      return [...curr, { product: p, qty: 1 }];
    });
  }

  function setQty(productId: number, qty: number) {
    setCart(curr => {
      const i = curr.findIndex(c => c.product.id === productId);
      if (i < 0) return curr;

      const max = curr[i].product.stock_actual;
      const n = Math.max(0, Math.min(max, Math.floor(qty || 0)));

      if (n === 0) {
        return curr.filter(c => c.product.id !== productId);
      }
      const next = [...curr];
      next[i] = { ...next[i], qty: n };
      return next;
    });
  }

  function commitDraft(productId: number) {
    setDraftQty(prev => {
      const raw = prev[productId];
      if (raw === undefined) return prev;

      const parsed = Number(String(raw).replace(/[^\d]/g, ""));
      setQty(productId, Number.isFinite(parsed) ? parsed : 1);

      const { [productId]: _, ...rest } = prev;
      return rest;
    });
  }

  function inc(id: number) {
    setCart(curr => curr.map(c => {
      if (c.product.id !== id) return c;
      const nextQty = c.qty + 1;
      if (nextQty > c.product.stock_actual) { toast.error("No hay stock suficiente"); return c; }
      return { ...c, qty: nextQty };
    }));
  }
  function dec(id: number) {
    setCart(curr => curr.flatMap(c => {
      if (c.product.id !== id) return [c];
      const next = Math.max(0, c.qty - 1);
      return next === 0 ? [] : [{ ...c, qty: next }];
    }));
  }
  function removeItem(id: number) {
    setCart(curr => curr.filter(c => c.product.id !== id));
  }
  function clearCart() {
    setCart([]); setDiscount("0"); setNotes(""); setCash("0");
  }

  const subTotal = useMemo(
    () => cart.reduce((a, it) => a + it.product.precio_venta * it.qty, 0),
    [cart]
  );
  const discountNum = Math.max(0, Number((discount || "0").replace(/[^\d.]/g, "")));
  const total = Math.max(0, subTotal - discountNum);
  const cashNum = Math.max(0, Number((cash || "0").replace(/[^\d.]/g, "")));
  const change = method === "EFECTIVO" ? Math.max(0, cashNum - total) : 0;

  async function completeSale() {
    if (!cart.length) { toast.error("Carrito vacío"); return; }
    if (method === "EFECTIVO" && cashNum < total) { toast.error("Efectivo insuficiente"); return; }
    try {
      const payload = {
        slug,
        data: {
          items: cart.map(it => ({
            producto_id: it.product.id,           
            cantidad: it.qty,                     
            precio_unit: it.product.precio_venta, 
          })),
          metodo_cobro: method,
          descuento_total: discountNum || 0,
          observacion: notes || null,
          usuario_id: null,
          cliente_nombre: customer.trim() || null,

        }
      };
      const r = await api.createSale(payload);
      if (r?.ok === false) throw new Error(r.error || "No se pudo registrar la venta");
      toast.success(`Venta registrada (${r.correlativo})`);
      setPayOpen(false);
      clearCart();
      setCustomer("");
      await refresh(); // actualizar stock en grid
    } catch (e: any) {
      toast.error(e?.message ?? "Error al completar venta");
    }
  }

  type UnidadTiempo = "dias" | "semanas" | "meses";

  type Prod = {
    id: number;
    nombre: string;
    precio_venta: number;
    stock_actual: number;
    sku?: string | null;
    codigo_barras?: string | null;

    // alertas
    precio_compra?: number | null;
    stock_minimo?: number | null;
    consumo_diario_estimado?: number | null;
    alerta_tiempo_unidad?: UnidadTiempo | null;
    alerta_tiempo_cantidad?: number | null;

    // categoría
    categoria?: string | null;
    categoria_id?: number | null;
  };

  type Category = { id: number; nombre: string; color_hex: string | null };
  type CartItem = { product: Prod; qty: number };

  function daysFrom(unit?: UnidadTiempo | null, qty?: number | null) {
    const n = Math.max(0, Number(qty || 0));
    if (unit === "semanas") return n * 7;
    if (unit === "meses") return n * 30;
    return n;
  }
  function getAlerts(p: Prod) {
    const stock = Number(p.stock_actual || 0);
    const crit = stock <= 0;
    const min = p.stock_minimo != null && Number.isFinite(p.stock_minimo)
      ? stock < Number(p.stock_minimo) : false;
    const d = daysFrom(p.alerta_tiempo_unidad ?? null, p.alerta_tiempo_cantidad ?? null);
    const consumo = Number(p.consumo_diario_estimado || 0);
    const need = d > 0 && consumo > 0 ? d * consumo : 0;
    const time = need > 0 ? stock < need : false;
    return { crit, min, time };
  }
  function mainThreshold(p: Prod): number | null {
    if (p.stock_minimo != null && Number.isFinite(p.stock_minimo)) return Number(p.stock_minimo);
    const d = daysFrom(p.alerta_tiempo_unidad ?? null, p.alerta_tiempo_cantidad ?? null);
    const consumo = Number(p.consumo_diario_estimado || 0);
    if (d > 0 && consumo > 0) return Math.ceil(d * consumo);
    return null;
  }
  function hexToRgba(hex?: string | null, alpha = 1) {
    const fallback = `rgba(153,153,153,${alpha})`;
    if (!hex) return fallback;
    let c = hex.trim(); if (!c) return fallback;
    if (c.startsWith("#")) c = c.slice(1);
    if (c.length === 3) c = c.split("").map(x => x + x).join("");
    if (c.length !== 6) return fallback;
    const n = parseInt(c, 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  function norm(s?: string | null) {
    return ((s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")).toLowerCase();
  }

  // categorías
  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const r = await api.listCategories?.({ slug });
        if (Array.isArray(r)) setCategories(r);
      } catch {}
    })();
  }, [slug]);

  const catColorById = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of categories) if (c.color_hex) m.set(c.id, c.color_hex);
    return m;
  }, [categories]);

  const catNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of categories) m.set(c.id, c.nombre || "");
    return m;
  }, [categories]);

    const filtered = useMemo(() => {
    const needle = norm(q.trim());
    if (!needle) return rows;
    return rows.filter(r => {
      const catName = r.categoria ?? (r.categoria_id != null ? (catNameById.get(r.categoria_id) || "") : "");
      return (
        norm(r.nombre).includes(needle) ||
        norm(r.sku).includes(needle) ||
        norm(r.codigo_barras).includes(needle) ||
        norm(catName).includes(needle)
      );
    });
  }, [rows, q, catNameById]);


  return (
    <div className="pos-wrap">
      <Toaster position="top-right" />

      {/* Header con botón "Ver ventas" */}
      <header className="page-header">
        <div className="ph-left">
          <div className="ph-icon" aria-hidden="true"><IconPOS size={28} aria-hidden="true" color="#D07A43" /></div>
          <div>
            <h1>Punto de venta</h1>
            <p className="muted">Registra ventas y controla el inventario</p>
          </div>
        </div>
        <div className="ph-actions">
          <Link className="primary" to="../ventas" relative="path">
            Ver ventas
          </Link>
        </div>
      </header>

      <div className="pos-grid">
        {/* Izquierda: catálogo */}
        <section className="catalog">
          <div className="search">
            <IconSearch className="ic" size={16} />
            <input
              placeholder="Busca por nombre, SKU o código de barras…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>

          <div className="cards">
            {loading ? (
              <div className="muted">Cargando…</div>
            ) : filtered.length === 0 ? (
              <div className="muted">No hay productos</div>
            ) : (
              filtered.map(p => (
                <div key={p.id} className="prod-card">
                  <div className="pc-head">
                    <div className="pc-left">
                      <div className="pc-name" title={p.nombre}>{p.nombre}</div>
                      <div className="pc-skuline muted tiny">
                        {p.sku ? `SKU: ${p.sku}` : `ID: ${p.id}`}
                      </div>
                      <div className="pc-catline">
                        {(() => {
                          const name = p.categoria ?? (p.categoria_id != null ? catNameById.get(p.categoria_id) ?? null : null);
                          if (!name) return <span className="muted tiny">—</span>;
                          const hex = p.categoria_id != null ? catColorById.get(p.categoria_id) : null;
                          const bg  = hexToRgba(hex, 0.14);
                          const bdr = hexToRgba(hex, 0.35);
                          const dot = hex ?? "#999";
                          return (
                            <span
                              className="cat-chip"
                              style={{
                                "--cat-bg": bg, "--cat-border": bdr, "--cat-dot": dot
                              } as React.CSSProperties}
                              title={name}
                            >
                              <span className="dot" />
                              <span className="name">{name}</span>
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    {/* badge de stock a la derecha */}
                    {(() => {
                      const alerts = getAlerts(p);
                      const th = mainThreshold(p);
                      const stockTxt = th != null
                        ? `${nfInt.format(p.stock_actual)}/${nfInt.format(th)} u`
                        : `${nfInt.format(p.stock_actual)} u`;
                      const cls = alerts.crit ? "crit" : (alerts.min || alerts.time) ? "warn" : "ok";
                      return (
                        <div
                          className={`pc-stock ${cls}`}
                          title={
                            alerts.crit ? "Sin stock"
                            : alerts.min ? `Bajo mínimo (${p.stock_minimo ?? "—"})`
                            : alerts.time ? "Cobertura baja"
                            : "Sin alertas"
                          }
                        >
                          {stockTxt}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="pc-price">{nfMoney.format(p.precio_venta)}</div>
                  <button className="pc-add" onClick={() => addToCart(p)}>
                    <IconPlus size={16} /> Agregar
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Derecha: carrito */}
        <aside className="cart">
          <div className="cart-head">
            <div className="ch-left">
              <IconCart size={18} />
              <strong>Carrito de compra</strong>
            </div>
            <button className="link small" onClick={clearCart} disabled={!cart.length}>Vaciar</button>
          </div>

          <div className="cart-body">
            {!cart.length ? (
              <div className="muted">Añade productos desde la izquierda.</div>
            ) : (
              cart.map(ci => (
                <div key={ci.product.id} className="cart-row">
                  <div className="cr-info">
                    <div className="cr-name">{ci.product.nombre}</div>
                    <div className="cr-sub muted">
                      {nfMoney.format(ci.product.precio_venta)} c/u
                    </div>
                  </div>
                  <div className="cr-qty">
                    <button className="icon" onClick={() => dec(ci.product.id)} aria-label="menos">
                      <IconMinus size={14} />
                    </button>

                    <input
                      className="qty-input"
                      inputMode="numeric"
                      value={draftQty[ci.product.id] ?? String(ci.qty)}
                      onFocus={() => setDraftQty(prev => ({ ...prev, [ci.product.id]: String(ci.qty) }))}
                      onChange={e => {
                        const onlyDigits = e.target.value.replace(/[^\d]/g, "");
                        setDraftQty(prev => ({ ...prev, [ci.product.id]: onlyDigits }));
                      }}
                      onBlur={() => commitDraft(ci.product.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); commitDraft(ci.product.id); }
                        if (e.key === "Escape") {
                          setDraftQty(({ [ci.product.id]: _, ...rest }) => rest);
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      title={`Máximo disponible: ${nfInt.format(ci.product.stock_actual)}`}
                    />

                    <button className="icon" onClick={() => inc(ci.product.id)} aria-label="más">
                      <IconPlus size={14} />
                    </button>
                  </div>

                  <div className="cr-total">{nfMoney.format(ci.product.precio_venta * ci.qty)}</div>
                  <button className="icon danger" onClick={() => removeItem(ci.product.id)} aria-label="quitar">
                    <IconTrash size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="cart-summary">
            <div className="row">
              <span>Subtotal</span>
              <span>{nfMoney.format(subTotal)}</span>
            </div>
            <div className="row">
              <span>Descuento</span>
              <input
                className="disc-input"
                inputMode="numeric"
                value={discount}
                onChange={e => setDiscount(e.target.value.replace(/[^\d.]/g, ""))}
              />
            </div>
            <div className="row total">
              <span>Total</span>
              <span>{nfMoney.format(total)}</span>
            </div>
          </div>

          <button
            className="pay-btn"
            disabled={!cart.length || total <= 0}
            onClick={() => setPayOpen(true)}
          >
            Registrar Venta
          </button>
        </aside>
      </div>

      {/* Modal de pago */}
      {payOpen && (
        <div className="modal pos-modal" onClick={() => setPayOpen(false)}>
          <div className="modal-card pos-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Registrar Venta</h3>
              <button className="icon" onClick={() => setPayOpen(false)}>✕</button>
            </div>

            <div className="pay-grid">
              <div className="box">
                <div className="box-title">Resumen</div>
                <div className="summary">
                  {cart.map(ci => (
                    <div key={ci.product.id} className="s-row">
                      <span>{ci.product.nombre} × {ci.qty}</span>
                      <span>{nfMoney.format(ci.product.precio_venta * ci.qty)}</span>
                    </div>
                  ))}
                  <div className="s-row">
                    <span>Subtotal</span><span>{nfMoney.format(subTotal)}</span>
                  </div>
                  <div className="s-row">
                    <span>Descuento</span><span>{nfMoney.format(discountNum)}</span>
                  </div>
                  <div className="s-row total">
                    <strong>Total</strong><strong>{nfMoney.format(total)}</strong>
                  </div>
                </div>
              </div>

              <div className="box">
                <div className="box-title">Método de pago</div>
                <div className="pay-methods">
                  <button
                    className={`pm ${method === "EFECTIVO" ? "active" : ""}`}
                    onClick={() => setMethod("EFECTIVO")}
                  >
                    <IconCash size={16} /> Efectivo
                  </button>
                  <button
                    className={`pm ${method === "TARJETA" ? "active" : ""}`}
                    onClick={() => setMethod("TARJETA")}
                  >
                    <IconCard size={16} /> Tarjeta
                  </button>
                  <button
                    className={`pm ${method === "TRANSFERENCIA" ? "active" : ""}`}
                    onClick={() => setMethod("TRANSFERENCIA")}
                  >
                    <IconCard size={16} /> Transferencia
                  </button>
                </div>

                <div className="customer">
                  <label>Cliente (opcional)</label>
                  <input
                    placeholder="Nombre del cliente"
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                  />
                </div>

                {method === "EFECTIVO" && (
                  <div className="cash">
                    <label>Efectivo recibido</label>
                    <input
                      inputMode="numeric"
                      value={cash}
                      onChange={e => setCash(e.target.value.replace(/[^\d.]/g, ""))}
                    />
                    <div className="muted tiny">Vuelto: {nfMoney.format(change)}</div>
                  </div>
                )}

                <div className="notes">
                  <label>Notas (opcional)</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} />
                </div>

                <div className="pay-actions">
                  <button onClick={() => setPayOpen(false)}>Cancelar</button>
                  <button
                    className="primary"
                    disabled={!cart.length || total <= 0 || (method === "EFECTIVO" && cashNum < total)}
                    onClick={completeSale}
                  >
                    Registrar venta
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
