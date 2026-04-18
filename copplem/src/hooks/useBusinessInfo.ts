import { useEffect, useRef, useState, useCallback } from "react";
import { Business, BusinessUpdate, BusinessSchema } from "../shared/business";
import { mapRowToBusiness, mapBusinessUpdateToRow } from "../shared/mappers";

const cache = new Map<string, Business>();

export function useBusinessInfo(slug: string){
  const [data, setData] = useState<Business | null>(cache.get(slug) ?? null);
  const [loading, setLoading] = useState(!cache.has(slug));
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  const refresh = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    setLoading(true); setError(null);
    try {
      const res = await window.api.getBusinessInfo(slug);
      if (!res?.ok) throw new Error(res?.error ?? "No se pudo cargar");
      const biz = BusinessSchema.parse(mapRowToBusiness(res.data || {}));
      cache.set(slug, biz);
      setData(biz);
    } catch (e:any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
      pending.current = false;
    }
  }, [slug]);

  const update = useCallback(async (patch: BusinessUpdate) => {
    const payload = mapBusinessUpdateToRow(patch);
    const res = await window.api.updateBusinessInfo({ slug, data: payload });
    if (!res?.ok) throw new Error(res?.error ?? "No se pudo guardar");
    await refresh();
  }, [slug, refresh]);

  useEffect(() => {
    if (!cache.has(slug)) refresh();
  }, [slug, refresh]);

  return { data, loading, error, refresh, update };
}
