// src/alertDefaults.ts
export type AlertaUnidad = "dias" | "semanas" | "meses";
export type AlertDefaults = {
  stock_minimo: number | null;
  consumo_diario_estimado: number | null; 
  cobertura: { unidad: AlertaUnidad; cantidad: number } | null;
};

const FALLBACK: AlertDefaults = {
  stock_minimo: 5,
  consumo_diario_estimado: null,
  cobertura: { unidad: "semanas", cantidad: 2 },
};

const key = (slug: string) => `copplem:alertDefaults:${slug}`;

export function getAlertDefaults(slug: string): AlertDefaults {
  try {
    const raw = localStorage.getItem(key(slug));
    if (!raw) return FALLBACK;
    const obj = JSON.parse(raw);
    return {
      stock_minimo: obj?.stock_minimo ?? FALLBACK.stock_minimo,
      consumo_diario_estimado: obj?.consumo_diario_estimado ?? FALLBACK.consumo_diario_estimado,
      cobertura: obj?.cobertura ?? FALLBACK.cobertura,
    };
  } catch {
    return FALLBACK;
  }
}

export function saveAlertDefaults(slug: string, v: AlertDefaults) {
  localStorage.setItem(key(slug), JSON.stringify(v));
}

export function coberturaEnDias(v: AlertDefaults): number | null {
  if (!v.cobertura) return null;
  const { unidad, cantidad } = v.cobertura;
  if (!cantidad || cantidad <= 0) return null;
  if (unidad === "dias") return cantidad;
  if (unidad === "semanas") return cantidad * 7;
  if (unidad === "meses") return cantidad * 30;
  return null;
}
