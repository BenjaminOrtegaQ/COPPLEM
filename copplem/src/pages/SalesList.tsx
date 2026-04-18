import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import {
  NotebookTabs as IconSales,
  ChevronLeft as IconPrev,
  ChevronRight as IconNext,
} from "lucide-react";
import "../styles/sales.css";


type Row = {
  id: number; fecha: string; correlativo_interno: string;
  cliente_nombre: string | null; metodo_cobro: string;
  subtotal: number; descuento_total: number; total: number; items_count: number;
};

const nf = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fmtDate = (s: string) => new Date(s).toLocaleString();

function Modal({ open, title, onClose, children }:{
  open: boolean; title: string; onClose: () => void; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="modal" role="dialog" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon" onClick={onClose}>✕</button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

export default function SalesList() {
  const { slug = "" } = useParams();

  // filtros
  const today = useMemo(() => new Date().toISOString().slice(0,10), []);
  const defFrom = useMemo(() => new Date(Date.now()-29*24*3600*1000).toISOString().slice(0,10), []);
  const [from, setFrom] = useState(defFrom);
  const [to, setTo] = useState(today);
  const [q, setQ] = useState("");

  // páginas
  const [pageSize, setPageSize] = useState<number>(50); 
  const [page, setPage] = useState<number>(1);

  // data
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // detalle
  const [openDetail, setOpenDetail] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  const load = async () => {
    try {
      setLoading(true);
      const limit  = pageSize;
      const offset = (page - 1) * pageSize;
      const r = await window.api.listSales({ slug, from, to, q, limit, offset });
      setRows(r.rows);
      setTotal(r.total);
    } catch (e:any) {
      toast.error(e?.message ?? "Error cargando ventas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [slug, from, to, q, pageSize]);

  useEffect(() => {
    load();
  }, [slug, from, to, q, page, pageSize]);

  const openSale = async (id: number) => {
    try {
      const r = await window.api.getSale({ slug, id });
      if (r.ok) { setDetail(r); setOpenDetail(true); }
      else toast.error(r.error);
    } catch (e:any) { toast.error(e?.message ?? "No se pudo cargar la venta"); }
  };

  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const visiblePages = useMemo<number[]>(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 3) return [1, 2, 3, 4, totalPages];
    if (page >= totalPages - 2) return [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, page - 1, page, page + 1, totalPages];
  }, [totalPages, page]);

  const goto = (p: number) => setPage(Math.min(totalPages, Math.max(1, p)));
  const prevPage = () => goto(page - 1);
  const nextPage = () => goto(page + 1);

  const startRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow   = Math.min(page * pageSize, total);

  return (
    <div className="sales-wrap">
      <Toaster position="top-right" />
      <header className="page-header">
        <div className="ph-left">
          <div className="ph-icon"><IconSales size={30} aria-hidden="true" color="#D07A43" /></div>
          <div>
            <h1>Ventas</h1>
            <p className="muted">Listado de ventas</p>
          </div>
        </div>
        <div className="ph-actions">
          <Link className="btn" to="../POS" relative="path">
            Ir al Punto de Venta
          </Link>
        </div>
      </header>

      <section className="card">
        <div className="toolbar">
          <div className="search">
            <input placeholder="Buscar por cliente o correlativo…" value={q} onChange={e=>setQ(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="date" value={from} onChange={e=>setFrom(e.target.value)} />
            <input type="date" value={to} onChange={e=>setTo(e.target.value)} />
            <button onClick={() => setPage(1)}>Actualizar</button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th style={{textAlign:"left"}}>Fecha</th>
                <th>Correlativo</th>
                <th>Cliente</th>
                <th>Método</th>
                <th>Ítems</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
            {loading ? (
              <tr><td colSpan={6} className="muted">Cargando…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="muted">Sin resultados</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} style={{cursor:"pointer"}} onClick={() => openSale(r.id)}>
                <td style={{textAlign:"left"}}>{fmtDate(r.fecha)}</td>
                <td>{r.correlativo_interno}</td>
                <td>{r.cliente_nombre ?? "—"}</td>
                <td>{r.metodo_cobro}</td>
                <td>{r.items_count}</td>
                <td>{nf.format(r.total)}</td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>

        {/* Páginas */}
        <div className="pager">
          <div className="pager-left tiny muted">
            Mostrando {startRow}–{endRow} de {total}
          </div>

          <div className="pager-center">
            <button className="nav-btn" onClick={prevPage} disabled={page <= 1} aria-label="Anterior">
              <IconPrev size={16} />
            </button>
            <div className="pages">
              {visiblePages.map(p => (
                <button
                  key={p}
                  className={`page-btn ${p === page ? "active" : ""}`}
                  onClick={() => goto(p)}
                  aria-current={p === page ? "page" : undefined}
                >
                  {p}
                </button>
              ))}
            </div>
            <button className="nav-btn" onClick={nextPage} disabled={page >= totalPages} aria-label="Siguiente">
              <IconNext size={16} />
            </button>
          </div>

          <div className="pager-right">
            <label className="muted tiny" htmlFor="pageSizeSel" style={{ marginRight: 6 }}>Por página:</label>
            <select id="pageSizeSel" value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>


        <div className="tiny muted" style={{marginTop:8}}>
          {total} venta(s) en el rango seleccionado.
        </div>
      </section>

      {/* Detalle */}
      <Modal open={openDetail} title="Detalle de venta" onClose={() => setOpenDetail(false)}>
        {!detail ? (
          <div className="muted">Cargando…</div>
        ) : (
          <div>
            {/* Encabezado de la venta */}
            <div className="muted tiny" style={{ marginBottom: 8 }}>
              <strong>{detail.header.correlativo_interno}</strong> • {fmtDate(detail.header.fecha)} • {detail.header.metodo_cobro}
            </div>

            {/* Items */}
            <div className="table-wrap">
              <table className="grid detail">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Producto</th>
                    <th>Cantidad</th>
                    <th>Precio</th>
                    <th>Descuento</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((it: any) => (
                    <tr key={it.id}>
                      <td className="td-name">
                        <span className="ellipsis" title={it.nombre}>{it.nombre}</span>
                      </td>
                      <td>{it.cantidad}</td>
                      <td>{nf.format(it.precio_unit)}</td>
                      <td>{it.descuento ? nf.format(it.descuento) : "—"}</td>
                      <td>{nf.format(it.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
                  
            {/* Cliente y Nota (si existen) */}
            {(detail.header.cliente_nombre || detail.header.observacion) && (
              <div className="note" style={{ marginBottom: 10 }}>
                {detail.header.cliente_nombre && (
                  <div><strong>Cliente:</strong> {detail.header.cliente_nombre}</div>
                )}
                {detail.header.observacion && (
                  <div style={{ marginTop: 4 }}>
                    <strong>Nota:</strong> <span style={{ whiteSpace: "pre-wrap" }}>{detail.header.observacion}</span>
                  </div>
                )}
              </div>
            )}

            {/* Totales */}
            <div style={{ display: "grid", justifyContent: "end", marginTop: 10 }}>
              <div className="tiny">Subtotal: {nf.format(detail.header.subtotal)}</div>
              <div className="tiny">Descuento: {nf.format(detail.header.descuento_total)}</div>
              <div style={{ fontWeight: 700 }}>Total: {nf.format(detail.header.total)}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
