import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { app } from "electron";
import { dbPathForSlug, ensureBackupsDir, backupsDirForSlug } from "./paths";
import * as companies from "./companies";

type BackupSummary = {
  id: string;
  slug: string;
  createdAt: string;
  sizeBytes: number;
  productos: number;
  ventas: number;
  appVersion: string | null;
  absPath: string;
};

function ts() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function metaPath(sqlitePath: string) {
  return sqlitePath.replace(/\.sqlite$/i, ".json");
}

function readCounts(dbFile: string) {
  const ro = new Database(dbFile, { readonly: true, fileMustExist: true });
  try {
    type Row = { c: number };

    const pr = ro.prepare("SELECT COUNT(*) AS c FROM productos WHERE activo = 1").get({}) as Row | undefined;
    const vr = ro.prepare("SELECT COUNT(*) AS c FROM ventas").get({}) as Row | undefined;

    const productos = Number(pr?.c ?? 0);
    const ventas    = Number(vr?.c ?? 0);

    return { productos, ventas };
  } finally {
    ro.close();
  }
}

export function deleteAllBackupsForSlug(slug: string) {
  const dir = backupsDirForSlug(slug);
  if (!dir || typeof dir !== "string") throw new Error("Directorio inválido");
  if (!fs.existsSync(dir)) return { ok: true, removedDir: false };
  fs.rmSync(dir, { recursive: true, force: true });
  return { ok: true, removedDir: true };
}

export function listBackups(slug: string): BackupSummary[] {
  const dir = ensureBackupsDir(slug);
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".sqlite")).sort().reverse();
  const out: BackupSummary[] = [];
  for (const f of files) {
    const abs = path.join(dir, f);
    const st = fs.statSync(abs);
    let meta: any = null;
    const mpath = metaPath(abs);
    if (fs.existsSync(mpath)) {
      try { meta = JSON.parse(fs.readFileSync(mpath, "utf-8")); } catch {}
    }
    const needCounts =
      !meta || !Number.isFinite(Number(meta.productos)) || !Number.isFinite(Number(meta.ventas));
    const counts = needCounts ? readCounts(abs) : { productos: Number(meta.productos), ventas: Number(meta.ventas) };

    out.push({
      id: f,
      slug,
      createdAt: meta?.createdAt ?? st.mtime.toISOString(),
      sizeBytes: st.size,
      productos: counts.productos,
      ventas: counts.ventas,
      appVersion: meta?.appVersion ?? null,
      absPath: abs,
    });
  }
  return out;
}

export function createBackup(slug: string) {
  ensureBackupsDir(slug);
  const src = dbPathForSlug(slug);
  const filename = `backup-${ts()}.sqlite`;
  const dest = path.join(backupsDirForSlug(slug), filename);

  const db = new Database(src);
  try {
    try { db.pragma("wal_checkpoint(FULL)"); } catch {}
    db.prepare("VACUUM INTO ?").run(dest);
  } finally {
    db.close();
  }

  const counts = readCounts(dest);
  const meta = {
    slug,
    createdAt: new Date().toISOString(),
    appVersion: app?.getVersion?.() ?? null,
    ...counts,
  };
  fs.writeFileSync(metaPath(dest), JSON.stringify(meta, null, 2), "utf-8");

  const st = fs.statSync(dest);
  const summary: BackupSummary = {
    id: path.basename(dest),
    slug,
    createdAt: meta.createdAt,
    sizeBytes: st.size,
    productos: counts.productos,
    ventas: counts.ventas,
    appVersion: meta.appVersion,
    absPath: dest,
  };
  return summary;
}

export function restoreFromBackup(slug: string, filename: string) {
  const src = path.join(backupsDirForSlug(slug), filename);
  if (!fs.existsSync(src)) throw new Error("Respaldo no encontrado");

  const live = dbPathForSlug(slug);

  // 1) Respaldo de seguridad previo
  createBackup(slug); // crea backup “pre-restore”

  // 2) Cierra conexión activa para evitar file lock (Windows)
  try { companies.closeCompanyDb?.(slug); } catch {}

  // 3) Elimina archivos WAL/SHM residuales
  for (const suffix of ["-wal", "-shm"]) {
    const p = live + suffix;
    if (fs.existsSync(p)) try { fs.unlinkSync(p); } catch {}
  }

  // 4) Copia el backup sobre la base en vivo
  fs.copyFileSync(src, live);

  // 5) Reabre
  return true;
}

export function restoreFromArbitraryFile(slug: string, anyPath: string) {
  if (!fs.existsSync(anyPath)) throw new Error("Archivo no existe");
  // Validación básica: ¿es SQLite?
  const fd = fs.openSync(anyPath, "r");
  const buf = Buffer.alloc(16);
  fs.readSync(fd, buf, 0, 16, 0);
  fs.closeSync(fd);
  if (!buf.toString("utf8").startsWith("SQLite format")) {
    throw new Error("El archivo no parece ser una base de datos SQLite válida.");
  }

  // Copia el archivo a backups/ como “import-YYYY…” y luego restaura desde ahí
  const dir = ensureBackupsDir(slug);
  const tmp = path.join(dir, `import-${ts()}.sqlite`);
  fs.copyFileSync(anyPath, tmp);

  // Guarda meta de conteos para que aparezca en la lista
  const counts = readCounts(tmp);
  const meta = {
    slug,
    createdAt: new Date().toISOString(),
    importedFrom: anyPath,
    appVersion: app?.getVersion?.() ?? null,
    ...counts,
  };
  fs.writeFileSync(metaPath(tmp), JSON.stringify(meta, null, 2), "utf-8");

  return restoreFromBackup(slug, path.basename(tmp));
}

export function deleteBackup(slug: string, filename: string) {
  const dir = backupsDirForSlug(slug);
  const target = path.join(dir, filename);

  if (!fs.existsSync(target)) throw new Error("Respaldo no encontrado");

  // Seguridad básica: debe estar dentro del dir de backups y terminar en .sqlite
  if (path.dirname(target) !== dir || !/\.sqlite$/i.test(target)) {
    throw new Error("Ruta de respaldo inválida");
  }

  fs.rmSync(target, { force: true });
  const meta = target.replace(/\.sqlite$/i, ".json");
  try { fs.rmSync(meta, { force: true }); } catch {}

  return { ok: true };
}


export function ensureAutoBackup(slug: string, maxAgeDays = 7) {
  const list = listBackups(slug);
  const latest = list[0];
  const now = Date.now();
  const ageMs = latest ? now - new Date(latest.createdAt).getTime() : Number.POSITIVE_INFINITY;
  const need = ageMs > maxAgeDays * 24 * 60 * 60 * 1000;
  if (need) {
    return createBackup(slug);
  }
  return null; 
}
