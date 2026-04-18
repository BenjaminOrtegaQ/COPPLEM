import type { Business, BusinessUpdate } from "./business";


type BusinessRow = {
  id?: number | null;
  nombre?: string | null;
  rut?: string | null;
  giro?: string | null;
  direccion?: string | null;
  comuna?: string | null;
  ciudad?: string | null;
  region?: string | null;
  telefono?: string | null;
  email?: string | null;
  moneda?: string | null;
  iva_por_defecto?: number | null;
  creado_en?: string | null;
  actualizado_en?: string | null;
};

export function mapRowToBusiness(row: BusinessRow): Business {
  return {
    id: row.id ?? null,
    nombre: row.nombre ?? "",
    rut: row.rut ?? null,
    giro: row.giro ?? null,
    direccion: row.direccion ?? null,
    comuna: row.comuna ?? null,
    ciudad: row.ciudad ?? null,
    region: row.region ?? null,
    telefono: row.telefono ?? null,
    email: row.email ?? null,
    moneda: row.moneda ?? null,
    ivaPorDefecto: row.iva_por_defecto ?? null,
    creadoEn: row.creado_en ?? null,
    actualizadoEn: row.actualizado_en ?? null,
  };
}


export function mapBusinessUpdateToRow(p: BusinessUpdate): Record<string, any> {
  const out: Record<string, any> = {};
  if ("nombre" in p) out.nombre = p.nombre;
  if ("rut" in p) out.rut = p.rut;
  if ("giro" in p) out.giro = p.giro;
  if ("direccion" in p) out.direccion = p.direccion;
  if ("comuna" in p) out.comuna = p.comuna;
  if ("ciudad" in p) out.ciudad = p.ciudad;
  if ("region" in p) out.region = p.region;
  if ("telefono" in p) out.telefono = p.telefono;
  if ("email" in p) out.email = p.email;
  if ("moneda" in p) out.moneda = p.moneda;
  if ("ivaPorDefecto" in p) out.iva_por_defecto = p.ivaPorDefecto;
  
  return out;
}
