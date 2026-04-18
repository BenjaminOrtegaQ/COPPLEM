"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAllBackupsForSlug = deleteAllBackupsForSlug;
exports.listBackups = listBackups;
exports.createBackup = createBackup;
exports.restoreFromBackup = restoreFromBackup;
exports.restoreFromArbitraryFile = restoreFromArbitraryFile;
exports.deleteBackup = deleteBackup;
exports.ensureAutoBackup = ensureAutoBackup;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const electron_1 = require("electron");
const paths_1 = require("./paths");
const companies = __importStar(require("./companies"));
function ts() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
function metaPath(sqlitePath) {
    return sqlitePath.replace(/\.sqlite$/i, ".json");
}
function readCounts(dbFile) {
    const ro = new better_sqlite3_1.default(dbFile, { readonly: true, fileMustExist: true });
    try {
        const pr = ro.prepare("SELECT COUNT(*) AS c FROM productos WHERE activo = 1").get({});
        const vr = ro.prepare("SELECT COUNT(*) AS c FROM ventas").get({});
        const productos = Number(pr?.c ?? 0);
        const ventas = Number(vr?.c ?? 0);
        return { productos, ventas };
    }
    finally {
        ro.close();
    }
}
function deleteAllBackupsForSlug(slug) {
    const dir = (0, paths_1.backupsDirForSlug)(slug);
    if (!dir || typeof dir !== "string")
        throw new Error("Directorio inválido");
    if (!fs_1.default.existsSync(dir))
        return { ok: true, removedDir: false };
    fs_1.default.rmSync(dir, { recursive: true, force: true });
    return { ok: true, removedDir: true };
}
function listBackups(slug) {
    const dir = (0, paths_1.ensureBackupsDir)(slug);
    const files = fs_1.default.readdirSync(dir).filter(f => f.endsWith(".sqlite")).sort().reverse();
    const out = [];
    for (const f of files) {
        const abs = path_1.default.join(dir, f);
        const st = fs_1.default.statSync(abs);
        let meta = null;
        const mpath = metaPath(abs);
        if (fs_1.default.existsSync(mpath)) {
            try {
                meta = JSON.parse(fs_1.default.readFileSync(mpath, "utf-8"));
            }
            catch { }
        }
        const needCounts = !meta || !Number.isFinite(Number(meta.productos)) || !Number.isFinite(Number(meta.ventas));
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
function createBackup(slug) {
    (0, paths_1.ensureBackupsDir)(slug);
    const src = (0, paths_1.dbPathForSlug)(slug);
    const filename = `backup-${ts()}.sqlite`;
    const dest = path_1.default.join((0, paths_1.backupsDirForSlug)(slug), filename);
    const db = new better_sqlite3_1.default(src);
    try {
        try {
            db.pragma("wal_checkpoint(FULL)");
        }
        catch { }
        db.prepare("VACUUM INTO ?").run(dest);
    }
    finally {
        db.close();
    }
    const counts = readCounts(dest);
    const meta = {
        slug,
        createdAt: new Date().toISOString(),
        appVersion: electron_1.app?.getVersion?.() ?? null,
        ...counts,
    };
    fs_1.default.writeFileSync(metaPath(dest), JSON.stringify(meta, null, 2), "utf-8");
    const st = fs_1.default.statSync(dest);
    const summary = {
        id: path_1.default.basename(dest),
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
function restoreFromBackup(slug, filename) {
    const src = path_1.default.join((0, paths_1.backupsDirForSlug)(slug), filename);
    if (!fs_1.default.existsSync(src))
        throw new Error("Respaldo no encontrado");
    const live = (0, paths_1.dbPathForSlug)(slug);
    // 1) Respaldo de seguridad previo
    createBackup(slug); // crea backup “pre-restore”
    // 2) Cierra conexión activa para evitar file lock (Windows)
    try {
        companies.closeCompanyDb?.(slug);
    }
    catch { }
    // 3) Elimina archivos WAL/SHM residuales
    for (const suffix of ["-wal", "-shm"]) {
        const p = live + suffix;
        if (fs_1.default.existsSync(p))
            try {
                fs_1.default.unlinkSync(p);
            }
            catch { }
    }
    // 4) Copia el backup sobre la base en vivo
    fs_1.default.copyFileSync(src, live);
    // 5) Reabre
    return true;
}
function restoreFromArbitraryFile(slug, anyPath) {
    if (!fs_1.default.existsSync(anyPath))
        throw new Error("Archivo no existe");
    // Validación básica: ¿es SQLite?
    const fd = fs_1.default.openSync(anyPath, "r");
    const buf = Buffer.alloc(16);
    fs_1.default.readSync(fd, buf, 0, 16, 0);
    fs_1.default.closeSync(fd);
    if (!buf.toString("utf8").startsWith("SQLite format")) {
        throw new Error("El archivo no parece ser una base de datos SQLite válida.");
    }
    // Copia el archivo a backups/ como “import-YYYY…” y luego restaura desde ahí
    const dir = (0, paths_1.ensureBackupsDir)(slug);
    const tmp = path_1.default.join(dir, `import-${ts()}.sqlite`);
    fs_1.default.copyFileSync(anyPath, tmp);
    // Guarda meta de conteos para que aparezca en la lista
    const counts = readCounts(tmp);
    const meta = {
        slug,
        createdAt: new Date().toISOString(),
        importedFrom: anyPath,
        appVersion: electron_1.app?.getVersion?.() ?? null,
        ...counts,
    };
    fs_1.default.writeFileSync(metaPath(tmp), JSON.stringify(meta, null, 2), "utf-8");
    return restoreFromBackup(slug, path_1.default.basename(tmp));
}
function deleteBackup(slug, filename) {
    const dir = (0, paths_1.backupsDirForSlug)(slug);
    const target = path_1.default.join(dir, filename);
    if (!fs_1.default.existsSync(target))
        throw new Error("Respaldo no encontrado");
    // Seguridad básica: debe estar dentro del dir de backups y terminar en .sqlite
    if (path_1.default.dirname(target) !== dir || !/\.sqlite$/i.test(target)) {
        throw new Error("Ruta de respaldo inválida");
    }
    fs_1.default.rmSync(target, { force: true });
    const meta = target.replace(/\.sqlite$/i, ".json");
    try {
        fs_1.default.rmSync(meta, { force: true });
    }
    catch { }
    return { ok: true };
}
function ensureAutoBackup(slug, maxAgeDays = 7) {
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
