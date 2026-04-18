// src/components/ExportModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

type Group = "day" | "month" | "year" | "total"; 
type PeriodOption = { key: Group; label: string; hint?: string };

const api = (window as any).api ?? {};

const OPTIONS: PeriodOption[] = [
  { key: "day",   label: "Últimos 7 días" },
  { key: "month", label: "Últimos 12 meses" },
  { key: "year",  label: "Últimos 5 años" },
  { key: "total", label: "Todo el tiempo" },
];

export type ExportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  currentGroup: Group;
  slug: string;
  kind: "pdf" | "xlsx";
};

type ExportRes = { ok: boolean; path?: string; error?: string };

export function ExportModal({ isOpen, onClose, currentGroup, slug, kind }: ExportModalProps) {
  const [selected, setSelected] = useState<Record<Group, boolean>>({
    day: false, month: false, year: false, total: false,
  });
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [from, setFrom] = useState<string>(""); // YYYY-MM-DD
  const [to, setTo] = useState<string>("");
  const [outDir, setOutDir] = useState<string>("");
  const [createSubfolder, setCreateSubfolder] = useState<boolean>(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelected({ day: false, month: false, year: false, total: false, [currentGroup]: true });
    setUseCustomRange(false);
    setFrom("");
    setTo("");
    setOutDir("");
    setCreateSubfolder(true);
    setBusy(false);
  }, [isOpen, currentGroup]);

  const hasAny = useMemo(
    () => Object.values(selected).some(Boolean) || (useCustomRange && !!from && !!to),
    [selected, useCustomRange, from, to]
  );

  const toggle = (k: Group) => setSelected(s => ({ ...s, [k]: !s[k] }));

  const pickFolder = async () => {
    const dir = await api.pickDirectory?.();
    if (dir) setOutDir(dir);
  };

  const onExport = async () => {
    if (!hasAny || busy) return;
    setBusy(true);

    // payloads seleccionados
    const selections: Array<{ group?: Group; allTime?: boolean; from?: string; to?: string }> = [];
    (Object.keys(selected) as Group[])
      .filter(k => selected[k])
      .forEach(k => { selections.push(k === "total" ? { allTime: true } : { group: k }); });
    if (useCustomRange && from && to) selections.push({ from, to, group: "day" });

    const base = { slug, outDir: outDir || undefined, createSubfolder };

    const runOne = async (sel: any): Promise<ExportRes> => {
      return kind === "pdf"
        ? await api.exportReportsPdf?.({ ...base, ...sel })
        : await api.exportReportsXlsx?.({ ...base, ...sel });
    };

    try {
      const results = await Promise.all(selections.map(runOne));
      const failed = results.find(r => !r?.ok);
      if (failed) {
        toast.error(failed?.error || "No se pudo completar la exportación");
        return;
      }

      const paths = results.map(r => r.path).filter(Boolean) as string[];
      const n = paths.length || 1;
      const label = kind === "pdf" ? "PDF" : "Excel";
      const plural = n > 1 ? "s" : "";
      const title = n === 1
        ? `Archivo ${label} generado`
        : `${n} archivo${plural} ${label} generado${plural}`;

      // Toast con botón "Abrir carpeta"
      toast((t) => (
        <div style={{ display: "grid", gap: 8 }}>
          <b>{title}</b>
          {paths[0] && <small style={{ opacity: 0.8 }}>{paths[0]}</small>}
          {api.revealInFolder && paths[0] && (
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                onClick={() => { api.revealInFolder(paths[0]); toast.dismiss(t.id); }}
                className="btn btn-sm"
              >
                Abrir carpeta
              </button>
              <button onClick={() => toast.dismiss(t.id)} className="btn btn-sm btn-ghost">
                Cerrar
              </button>
            </div>
          )}
        </div>
      ), { duration: 6000 });

      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Error al exportar");
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="export-backdrop">
      <div className="export-modal">
        <h3>Exportar {kind.toUpperCase()}</h3>

        <p>Selecciona uno o varios periodos:</p>
        <div className="grid">
          {OPTIONS.map(opt => (
            <label key={opt.key} className="checkrow">
              <input
                type="checkbox"
                checked={selected[opt.key]}
                onChange={() => toggle(opt.key)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>

        <hr />

        <label className="checkrow">
          <input
            type="checkbox"
            checked={useCustomRange}
            onChange={() => setUseCustomRange(!useCustomRange)}
          />
          <span>Rango personalizado</span>
        </label>

        {useCustomRange && (
          <div className="row">
            <div>
              <small>Desde</small>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div>
              <small>Hasta</small>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} />
            </div>
          </div>
        )}

        <hr />

        <div className="row" style={{ alignItems: "center" }}>
          <button className="btn btn-ghost" onClick={pickFolder}>Elegir carpeta…</button>
          <span style={{ marginLeft: 8, opacity: outDir ? 1 : 0.6 }}>
            {outDir || "No seleccionada (se usará Escritorio)"}
          </span>
        </div>

        <label className="checkrow" style={{ marginTop: 8 }}>
          <input
            type="checkbox"
            checked={createSubfolder}
            onChange={() => setCreateSubfolder(!createSubfolder)}
          />
          <span>Crear una subcarpeta para estos archivos</span>
        </label>

        <div className="footer">
          <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="btn btn-primary" disabled={!hasAny || busy} onClick={onExport}>
            {busy ? "Exportando…" : "Exportar"}
          </button>
        </div>
      </div>
    </div>
  );
}
