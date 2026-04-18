// electron/main.ts
import { app, BrowserWindow, ipcMain, nativeImage, dialog, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { exec } from 'child_process';
import { ensureDirs } from "./db/paths";
const Companies: typeof import("./db/companies") = require("./db/companies");
const Backups: typeof import("./db/backups") = require("./db/backups");
import { warmupReportsExports } from "./db/reportsExport";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { forecastProductStock } from "./db/companies";

// Preferencias persistentes (por empresa) para auto-backup
import Store from "electron-store";
import { ChildProcess } from "node:child_process";

app.setAppUserModelId("com.copplem.app");

type PrefShape = { autoBackupDaysBySlug?: Record<string, number> };
const store = new Store<PrefShape>({ name: "prefs" });


function getAutoDaysFor(slug: string) {
  const v = store.get(`autoBackupDaysBySlug.${slug}`) as any;
  const n = Number(v);
  // default 7
  return Number.isFinite(n) && n > 0 ? Math.min(90, Math.max(1, Math.round(n))) : 7;
}

async function loadJimp() {
  try {

    const mod = require("jimp");
    const any = (mod && (mod.read ? mod : (mod.Jimp ?? mod))) as any;
    return { JimpMod: mod, JimpAny: any, jimpRead: (src: string | Buffer) => any.read(src) };
  } catch (_e1) {
    try {
      const mod: any = await import("jimp");
      const any = (mod && (mod.read ? mod : (mod.Jimp ?? mod))) as any;
      return { JimpMod: mod, JimpAny: any, jimpRead: (src: string | Buffer) => any.read(src) };
    } catch (_e2) {
      return null;
    }
  }
}

function png256ToIco(png: Buffer): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); 
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4); 

  const entry = Buffer.alloc(16);
  const width = 256;
  const height = 256;
  entry.writeUInt8(width === 256 ? 0 : width, 0);   
  entry.writeUInt8(height === 256 ? 0 : height, 1); 
  entry.writeUInt8(0, 2); 
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);  
  entry.writeUInt16LE(32, 6); 
  entry.writeUInt32LE(png.length, 8);    
  entry.writeUInt32LE(6 + 16, 12);     
  
  return Buffer.concat([header, entry, png]);
}


let win: BrowserWindow | null = null;

/* -------------------- helpers -------------------- */
function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

async function loadWithRetry(w: BrowserWindow, url: string, { tries = 40, delay = 300 } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      await w.loadURL(url);
      return;
    } catch {
      await sleep(delay);
    }
  }
  await w.loadURL(url);
}

function parseCompanyArg(argv: string[]): string | null {
  for (const a of argv) {
    if (a.startsWith("--company=")) return a.split("=")[1] || null;
  }
  return null;
}

/* -------------------- single instance -------------------- */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    const slug = parseCompanyArg(argv);
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      if (slug) {
        win.webContents.send("open-login", slug);
      }
    }
  });
}

/* -------------------- createWindow -------------------- */
async function createWindow() {
  const slugArg = parseCompanyArg(process.argv);
  await app.whenReady();
  ensureDirs();
  setTimeout(() => warmupReportsExports(), 500);

  const isDev = !!process.env.VITE_DEV_SERVER_URL;
  const iconPath = isDev
    ? path.join(process.cwd(), "resources/assets/app.ico")
    : path.join(process.resourcesPath, "resources/assets/app.ico");

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,     // oculta la barra en Win/Linux
    backgroundColor: '#F5F6F8',

    title: "COPPLEM",
    icon: nativeImage.createFromPath(iconPath),
    
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.platform === "win32") win.setOverlayIcon(null, "");

  win.webContents.on("did-fail-load", (_e, _code, _desc, validatedURL, isMainFrame) => {
    const isDevUrl = typeof validatedURL === "string" && validatedURL.startsWith("http://localhost:");
    const isDev = !!process.env.VITE_DEV_SERVER_URL;
    if (win && isMainFrame && isDev && isDevUrl) {
      setTimeout(() => {
        if (win && !win.isDestroyed()) {
          loadWithRetry(win, validatedURL, { tries: 20, delay: 350 }).catch(() => {});
        }
      }, 300);
    }
  });

  if (isDev) {
    let url = process.env.VITE_DEV_SERVER_URL!;
    if (slugArg) {
      url += (url.includes("?") ? "&" : "?") + `loginSlug=${encodeURIComponent(slugArg)}`;
    }
    await loadWithRetry(win, url, { tries: 40, delay: 300 });
  } else {
    const fileUrl = pathToFileURL(path.join(__dirname, "../dist/index.html"));
    if (slugArg) {
      fileUrl.searchParams.set("loginSlug", slugArg);
      await win.loadURL(fileUrl.toString());
    } else {
      await win.loadFile(path.join(__dirname, "../dist/index.html"));
    }
  }
}

/* -------------------- app lifecycle -------------------- */
app.on("ready", createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (!win) createWindow(); });

process.on("unhandledRejection", (reason) => {
  console.warn("[main] Unhandled rejection:", reason);
});


/*IPC Dessinstalar*/
ipcMain.handle('uninstall-app', async () => {
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  if (isWindows) {
    const uninstallCommand = `"${path.join(app.getAppPath(), 'uninstaller.exe')}"`;
    exec(uninstallCommand, (err, stdout, stderr) => {
      if (err) {
        console.error('Error al desinstalar:', err);
        return;
      }
      console.log(stdout);
    });
  } else if (isMac) {
    const appPath = path.join('/Applications', 'YourAppName.app');
    exec(`rm -rf ${appPath}`, (err, stdout, stderr) => {
      if (err) {
        console.error('Error al desinstalar:', err);
        return;
      }
      console.log(stdout);
    });
  }
});

/* -------------------- IPC: Companies -------------------- */
ipcMain.handle("company:list", () => Companies.listCompanies());
ipcMain.handle("company:create", (_e, p) => Companies.createCompany(p));
ipcMain.handle("company:edit",   (_e, p) => Companies.editCompany(p));
ipcMain.handle("company:delete", (_e, slug: string) => Companies.deleteCompany(slug));


ipcMain.handle("window:setCompanyOverlay", async () => {
  if (win && process.platform === "win32") {
    win.setOverlayIcon(null, "");
  }
  return { ok: true };
});

/* -------------------- IPC: Auth -------------------- */
ipcMain.handle("auth:login", (_e, p) => Companies.login(p.slug, p.username, p.password));

/* -------------------- IPC: Products -------------------- */
ipcMain.handle("product:list",   (_e, p) => Companies.listProducts(p.slug, p.q));
ipcMain.handle("product:create", (_e, p) => Companies.createProduct(p.slug, p.product));
ipcMain.handle("product:update", (_e, p) => Companies.updateProduct(p.slug, p.id, p.patch));
ipcMain.handle("product:delete", (_e, p) => Companies.deleteProduct(p.slug, p.id));
ipcMain.handle("product:adjust", (_e, p) => Companies.adjustProductStock(p.slug, p));
ipcMain.handle(
  "product:template:xlsx",
  (_e, p: { destPath?: string } = {}) => Companies.copyProductsXlsxTemplate(p.destPath)
);
ipcMain.handle("product:autoAlertsSuggest", (_e, p: { slug: string; producto_id: number; windowDays?: number; targetCoverageDays?: number }) =>
  Companies.suggestProductAlerts(p.slug, p)
);

ipcMain.handle("stockForecast", async (_evt, args: {
  slug: string;
  producto_id: number;
  windowDays?: number;
  horizonDays?: number;
  leadTimeDays?: number;
  serviceLevel?: number;
}) => {
  try {
    const { slug, producto_id, windowDays, horizonDays, leadTimeDays, serviceLevel } = args || {};
    if (!slug) throw new Error("slug requerido");
    if (!Number.isFinite(Number(producto_id))) throw new Error("producto_id inválido");

    const r = forecastProductStock(slug, {
      producto_id: Number(producto_id),
      windowDays,
      horizonDays,
      leadTimeDays,
      serviceLevel,
    });
    return r;
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
});



// Abrir diálogo para elegir archivo .xlsx
ipcMain.handle("sys:pickXlsx", async () => {
  const res = await dialog.showOpenDialog({
    title: "Selecciona la plantilla Excel",
    filters: [{ name: "Excel", extensions: ["xlsx", "xls"] }],
    properties: ["openFile"],
  });
  if (res.canceled || !res.filePaths.length) return { ok: false };
  return { ok: true, filePath: res.filePaths[0] };
});

// Importar
ipcMain.handle("product:importXlsx", (_e, p) =>
  Companies.importProductsFromXlsx(p.slug, p.filePath, p.options)
);

/* -------------------- IPC: Categories -------------------- */
ipcMain.handle("cat:list",   (_e, p) => Companies.listCategories(p.slug));
ipcMain.handle("cat:create", (_e, p) => Companies.createCategory(p.slug, p.data));
ipcMain.handle("cat:update", (_e, p) => Companies.updateCategory(p.slug, p.id, p.patch));
ipcMain.handle("cat:delete", (_e, p) => Companies.deleteCategory(p.slug, p.id));

/* -------------------- IPC: Business Info -------------------- */
ipcMain.handle("biz:get",    (_e, slug: string) => Companies.getBusinessInfo(slug));
ipcMain.handle("biz:update", (_e, p: { slug: string; data: any }) => Companies.updateBusinessInfo(p.slug, p.data));

/* -------------------- IPC: Backups -------------------- */
ipcMain.handle("backup:list", (_e, p: { slug: string }) => Backups.listBackups(p.slug));
ipcMain.handle("backup:create", (_e, p: { slug: string }) => Backups.createBackup(p.slug));
ipcMain.handle("backup:restore", (_e, p: { slug: string; filename: string }) => {
  const ok = Backups.restoreFromBackup(p.slug, p.filename);
  return { ok };
});
ipcMain.handle("backup:restoreFile", (_e, p: { slug: string; absPath: string }) => {
  const ok = Backups.restoreFromArbitraryFile(p.slug, p.absPath);
  return { ok };
});
ipcMain.handle("backup:autoEnsure", (_e, p: { slug: string; maxAgeDays?: number }) => {
  const days = typeof p?.maxAgeDays === "number"
    ? Math.min(90, Math.max(1, Math.round(p.maxAgeDays)))
    : getAutoDaysFor(p.slug);
  return Backups.ensureAutoBackup(p.slug, days);
});
ipcMain.handle("backup:getAutoDays", (_e, p: { slug: string }) => {
  const days = getAutoDaysFor(p.slug);
  return { ok: true, days };
});
ipcMain.handle("backup:setAutoDays", (_e, p: { slug: string; days: number }) => {
  const n = Math.min(90, Math.max(1, Math.round(Number(p.days))));
  store.set(`autoBackupDaysBySlug.${p.slug}`, n);
  return { ok: true, days: n };
});
ipcMain.handle("backup:openFolder", (_e, p: { slug: string }) => {
  const { backupsDirForSlug } = require("./db/paths");
  return shell.openPath(backupsDirForSlug(p.slug));
});
ipcMain.handle("backup:delete", (_e, p: { slug: string; filename: string }) =>
  Backups.deleteBackup(p.slug, p.filename)
);
ipcMain.handle("backup:deleteAllForSlug", (_e, p: { slug: string }) =>
  Backups.deleteAllBackupsForSlug(p.slug)
);

/* ---------- IPC: reinicio de la app ---------- */
ipcMain.handle("app:restart", (_e, p?: { slug?: string }) => {
  const baseArgs = process.argv.slice(1).filter(a => !a.startsWith("--company="));
  if (p?.slug) baseArgs.push(`--company=${p.slug}`);

  app.relaunch({ args: baseArgs });
  app.exit(0);
});

/* ---------- IPC: Users ---------- */
ipcMain.handle("user:list",     (_e, p) => Companies.listUsers(p.slug));
ipcMain.handle("user:count",    (_e, p) => Companies.countUsers(p.slug));
ipcMain.handle("user:create",   (_e, p) => Companies.createUser(p.slug, p.user));
ipcMain.handle("user:edit",     (_e, p) => Companies.updateUser(p.slug, p.id, p.patch));
ipcMain.handle("user:password", (_e, p) => Companies.changeUserPassword(p.slug, p.id, p.password));
ipcMain.handle("user:delete",   (_e, p) => Companies.deleteUser(p.slug, p.id));

/* -------------------- IPC: Sales (POS) -------------------- */
ipcMain.handle("sale:create", (_e, p) => Companies.createSale(p.slug, p.data));
ipcMain.handle("sale:list", (_e, p) => Companies.listSales(p.slug, p));
ipcMain.handle("sale:get",  (_e, p) => Companies.getSale(p.slug, p.id));

/* -------------------- IPC: Dashboard -------------------- */
ipcMain.handle("dash:get", (_e, slug: string) => Companies.getDashboard(slug));

/* -------------------- IPC: Reports -------------------- */
ipcMain.handle("reports:get", (_e, p: { slug: string; mode?: "total"|"week"|"month"|"year"; from?: string; to?: string }) =>
  Companies.getReports(p.slug, { mode: p.mode, from: p.from, to: p.to })
);
ipcMain.handle("reports:exportXlsx", (_e, p: { slug: string; from?: string; to?: string; group?: 'day'|'month'|'year'; allTime?: boolean }) =>
  Companies.exportReportsXlsx(p.slug, p)
);
ipcMain.handle("reports:exportPdf", (_e, p: { slug: string; from?: string; to?: string; group?: 'day'|'month'|'year'; allTime?: boolean }) =>
  Companies.exportReportsPdf(p.slug, p)
);

/* -------------------- IPC: utils pickers -------------------- */
ipcMain.handle("utils:pickDirectory", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Elegir carpeta",
    properties: ["openDirectory", "createDirectory"],
  });
  if (canceled || !filePaths?.[0]) return null;
  return filePaths[0];
});
ipcMain.handle("utils:pickSaveFile", async (_e, opts: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Guardar como…",
    defaultPath: opts?.defaultPath ?? path.join(app.getPath("documents"), "Reporte"),
    filters: opts?.filters,
  });
  if (canceled || !filePath) return null;
  return filePath;
});
ipcMain.handle("sys:pickSqlite", async () => {
  const res = await dialog.showOpenDialog({
    title: "Selecciona archivo de respaldo (.sqlite)",
    filters: [{ name: "SQLite", extensions: ["sqlite", "db"] }],
    properties: ["openFile"]
  });
  if (res.canceled || !res.filePaths.length) return { ok: false };
  return { ok: true, filePath: res.filePaths[0] };
});
ipcMain.handle("utils:revealInFolder", (_e, absPath: string) => {
  if (absPath) shell.showItemInFolder(absPath);
  return { ok: true };
});

/* -------------------- IPC: accounting -------------------- */
ipcMain.handle(
  "accounting:exportXlsx",
  async (_e, p: { slug: string; periods: Array<{ from: string; to: string; label: string }>; filePath: string; includeItems?: boolean }) =>
    Companies.exportAccountingXlsx(p.slug, { periods: p.periods, filePath: p.filePath, includeItems: !!p.includeItems })
);

function pickFontId(JimpAny: any, sizePx: number, white: boolean) {
  const family = sizePx >= 120 ? 128 : (sizePx >= 96 ? 64 : 32);
  const color  = white ? "white" : "black";

  const constName = `FONT_SANS_${family}_${white ? "WHITE" : "BLACK"}`;
  if ((JimpAny as any)[constName]) {
    return (JimpAny as any)[constName];
  }

  const folder = `open-sans-${family}-${color}`;

  try {
    const jimpDir = path.dirname(require.resolve("jimp/package.json"));
    const base    = path.join(jimpDir, "fonts", "open-sans", folder);
    const fnt     = path.join(base, `${folder}.fnt`);
    const png     = path.join(base, `${folder}.png`);
    if (fs.existsSync(fnt) && fs.existsSync(png)) {
      return fnt;
    }
  } catch {}

  {
    const base = path.join(process.resourcesPath, "jimp-fonts", "open-sans", folder);
    const fnt  = path.join(base, `${folder}.fnt`);
    const png  = path.join(base, `${folder}.png`);
    if (fs.existsSync(fnt) && fs.existsSync(png)) {
      return fnt; 
    }
  }

  throw new Error(`No se encontró fuente Jimp (${family}/${color}).`);
}

/* -------------------- IPC: create desktop shortcut -------------------- */
ipcMain.handle("shortcut:createForCompany", async (_e, payload: any) => {
  if (process.platform !== "win32") {
    return { ok: false, error: "Solo implementado en Windows por ahora." };
  }

  try {
    const j = await loadJimp();
    if (!payload || typeof payload !== "object") {
      return { ok: false, error: "Payload inválido: se esperaba un objeto." };
    }

    const p = payload as { slug: string; name: string; avatarDataUrl?: string | null; colorHex?: string | null };
    if (typeof p.slug !== "string" || typeof p.name !== "string") {
      return { ok: false, error: "Payload inválido: faltan 'slug' o 'name'." };
    }

    // ===== Ajustes visuales =====
    const BASE = 256;        // tamaño del icono final
    const BADGE_PCT = 0.32;  // tamaño relativo del badge
    const MARGIN_PCT = 0.06; // margen a la esquina
    const RING_WIDTH = 4;    // grosor del anillo
    const SHADOW_BLUR = 4;   // blur de sombra
    const SHADOW_ALPHA = 80; // opacidad sombra
    const SHADOW_OFFSET = 2; // desplazamiento sombra

    // ===== Helpers de color =====
    const hexToRgb = (hex: string) => {
      let h = hex.replace("#", "").trim();
      if (!/^[0-9a-fA-F]{3,6}$/.test(h)) return { r: 255, g: 255, b: 255 };
      if (h.length === 3) h = h.split("").map(c => c + c).join("");
      const n = parseInt(h, 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    };
    const rgbToHex = (r:number,g:number,b:number) =>
      "#" + [r,g,b].map(v => Math.max(0,Math.min(255,v)).toString(16).padStart(2,"0")).join("");
    const rgbToHsl = (r:number,g:number,b:number) => {
      r/=255; g/=255; b/=255;
      const max=Math.max(r,g,b), min=Math.min(r,g,b);
      let h=0,s=0,l=(max+min)/2;
      if(max!==min){
        const d=max-min;
        s= l>0.5 ? d/(2-max-min): d/(max+min);
        switch(max){
          case r: h=(g-b)/d + (g<b?6:0); break;
          case g: h=(b-r)/d + 2; break;
          case b: h=(r-g)/d + 4; break;
        }
        h/=6;
      }
      return {h,s,l};
    };
    const hslToRgb = (h:number,s:number,l:number) => {
      let r:number,g:number,b:number;
      if(s===0){ r=g=b=l; }
      else{
        const hue2rgb=(p:number,q:number,t:number)=>{
          if(t<0)t+=1; if(t>1)t-=1;
          if(t<1/6)return p+(q-p)*6*t;
          if(t<1/2)return q;
          if(t<2/3)return p+(q-p)*(2/3-t)*6;
          return p;
        };
        const q= l<0.5 ? l*(1+s) : l+s-l*s;
        const p= 2*l-q;
        r=hue2rgb(p,q,h+1/3);
        g=hue2rgb(p,q,h);
        b=hue2rgb(p,q,h-1/3);
      }
      return { r:Math.round(r*255), g:Math.round(g*255), b:Math.round(b*255) };
    };
    const darkenHex = (hex:string, pct:number) => {
      const {r,g,b} = hexToRgb(hex);
      const {h,s,l} = rgbToHsl(r,g,b);
      const l2 = Math.max(0, l - pct); 
      const {r:rr,g:gg,b:bb} = hslToRgb(h,s,l2);
      return rgbToHex(rr,gg,bb);
    };
    const relLum = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const f = (v: number) => { v/=255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
      const R=f(r), G=f(g), B=f(b);
      return 0.2126*R + 0.7152*G + 0.0722*B;
    };
    const bestText = (bgHex: string) => relLum(hexToRgb(bgHex)) > 0.5 ? "black" : "white";

    // ===== Rutas =====
    const desktop = app.getPath("desktop");
    const sanitizeFileName = (s: string) => s.replace(/[/\\?%*:|"<>]/g, "").replace(/\s+/g, " ").trim();
    const baseName = `COPPLEM - ${sanitizeFileName(p.name || p.slug)}`;
    const shortcutPath = path.join(desktop, `${baseName}.lnk`);

    const isDev = !!process.env.VITE_DEV_SERVER_URL;

    function resolveAsset(...segs: string[]) {
      const base = isDev ? process.cwd() : process.resourcesPath;
      return path.join(base, "resources", ...segs);
    }

    const basePng = resolveAsset("assets", "app-256.png");
    const appIco  = resolveAsset("assets", "app.ico");

    if (!isDev) {
      console.log("[shortcut] assets", {
        basePng,
        appIco,
        existsBase: fs.existsSync(basePng),
        existsIco:  fs.existsSync(appIco),
      });
    }


      if (!j) {
        if (fs.existsSync(shortcutPath)) { try { fs.unlinkSync(shortcutPath); } catch {} }
        const target = process.execPath;
        const args = [`--company=${p.slug}`];
        const ok = shell.writeShortcutLink(shortcutPath, {
            target,
            args: args.join(" "),
            icon: appIco, 
            iconIndex: 0,
            description: `Login rápido • ${p.name || p.slug}`,
            cwd: path.dirname(target),
          });
        return ok
          ? { ok: true, path: shortcutPath, warning: "Jimp no disponible: se usó ícono por defecto." }
          : { ok: false, error: "No se pudo crear el acceso directo (fallback sin Jimp)." };
      }


    const outDir = path.join(app.getPath("userData"), "shortcuts");
    const { JimpMod, JimpAny, jimpRead } = j; 
    // ===== Helpers Jimp =====
    const newImage = (w: number, h: number, color = { r: 0, g: 0, b: 0, a: 0 }) =>
      new JimpAny(w, h, JimpAny.rgbaToInt(color.r, color.g, color.b, color.a));
    fs.mkdirSync(outDir, { recursive: true });
    const finalPng = path.join(outDir, `icon-${p.slug}.png`);

    const hasBasePng = fs.existsSync(basePng);
    if (hasBasePng) {
      const baseImg = await jimpRead(basePng);
      baseImg.contain(BASE, BASE, JimpAny.HORIZONTAL_ALIGN_CENTER | JimpAny.VERTICAL_ALIGN_MIDDLE);

      // tamaño/margen del badge
      const BADGE_SIZE = Math.round(BASE * BADGE_PCT);
      const BADGE_MARGIN = Math.round(BASE * MARGIN_PCT);

      // ── badge: avatar ──
      let badgeImage: any | null = null;

      if (p.avatarDataUrl && /^data:image\/(png|jpe?g);base64,/.test(p.avatarDataUrl)) {
        const avatarBuf = Buffer.from(p.avatarDataUrl.split(",")[1], "base64");
        let avatar = await jimpRead(avatarBuf);
        avatar.contain(BADGE_SIZE, BADGE_SIZE, JimpAny.HORIZONTAL_ALIGN_CENTER | JimpAny.VERTICAL_ALIGN_MIDDLE);

        const anyAvatar: any = avatar as any;
        if (typeof anyAvatar.circle === "function") {
          anyAvatar.circle();
        } else {
          const mask = newImage(BADGE_SIZE, BADGE_SIZE);
          const cx = BADGE_SIZE / 2, cy = BADGE_SIZE / 2, r = BADGE_SIZE / 2;
          mask.scan(0, 0, BADGE_SIZE, BADGE_SIZE, function (this: any, x: number, y: number, idx: number) {
            const dx = x - cx, dy = y - cy;
            this.bitmap.data[idx + 3] = (dx * dx + dy * dy) <= (r * r) ? 0xff : 0x00;
          });
          avatar.mask(mask, 0, 0);
        }
        badgeImage = avatar;
      } else {
        // sin imagen (iniciales)
        const baseHex = (p.colorHex && /^#?[0-9a-fA-F]{3,6}$/.test(p.colorHex))
          ? (p.colorHex.startsWith("#") ? p.colorHex : "#" + p.colorHex)
          : "#ffe8da";

        const bgHex = darkenHex(baseHex, 0.12); // oscurecer 12%
        const bgRGB = hexToRgb(bgHex);

        const disc = newImage(BADGE_SIZE, BADGE_SIZE);
        const cx = BADGE_SIZE / 2, cy = BADGE_SIZE / 2, r = BADGE_SIZE / 2;
        disc.scan(0, 0, BADGE_SIZE, BADGE_SIZE, function (this: any, x: number, y: number, idx: number) {
          const dx = x - cx, dy = y - cy;
          const inside = (dx * dx + dy * dy) <= (r * r);
          if (inside) {
            this.bitmap.data[idx + 0] = bgRGB.r;
            this.bitmap.data[idx + 1] = bgRGB.g;
            this.bitmap.data[idx + 2] = bgRGB.b;
            this.bitmap.data[idx + 3] = 255;
          } else {
            this.bitmap.data[idx + 3] = 0;
          }
        });

        const initials =
          ((p.name || "")
            .split(" ").filter(Boolean).slice(0, 2)
            .map(w => w[0]!.toUpperCase()).join("")) || "?";

        const useWhite = bestText(bgHex) === "white";
        const fontId = pickFontId(JimpAny, BADGE_SIZE, useWhite);
        const font = await JimpMod.loadFont(fontId);

        const alignmentX = (JimpMod as any).HORIZONTAL_ALIGN_CENTER ?? 1;
        const alignmentY = (JimpMod as any).VERTICAL_ALIGN_MIDDLE ?? 2;

        const textBox = { x: 0, y: 0, w: BADGE_SIZE, h: BADGE_SIZE };
        disc.print(
          font,
          0,
          0,
          { text: initials, alignmentX, alignmentY },
          BADGE_SIZE,
          BADGE_SIZE
        );

        badgeImage = disc;
      }

      const makeFilledCircle = (size: number, color: { r: number; g: number; b: number; a: number }) => {
        const img = newImage(size, size);
        const ccx = size / 2, ccy = size / 2, rr = (size / 2) * (size / 2);
        img.scan(0, 0, size, size, function (this: any, x: number, y: number, idx: number) {
          const dx = x - ccx, dy = y - ccy;
          if ((dx * dx + dy * dy) <= rr) {
            this.bitmap.data[idx + 0] = color.r;
            this.bitmap.data[idx + 1] = color.g;
            this.bitmap.data[idx + 2] = color.b;
            this.bitmap.data[idx + 3] = color.a;
          }
        });
        return img;
      };

      const shadowSize = BADGE_SIZE + RING_WIDTH * 2 + 4;
      const shadow = makeFilledCircle(shadowSize, { r: 0, g: 0, b: 0, a: SHADOW_ALPHA });
      if (SHADOW_BLUR > 0) shadow.blur(SHADOW_BLUR);

      const ringSize = BADGE_SIZE + RING_WIDTH * 2;
      const ringHex = (p.colorHex && /^#?[0-9a-fA-F]{3,6}$/.test(p.colorHex))
        ? (p.colorHex.startsWith("#") ? p.colorHex : "#" + p.colorHex)
        : "#c1c1c1";
      const ringRGB = hexToRgb(ringHex);
      const ring = makeFilledCircle(ringSize, { r: ringRGB.r, g: ringRGB.g, b: ringRGB.b, a: 255 });

      const groupSize = Math.max(shadowSize, ringSize);
      const group = newImage(groupSize, groupSize);
      group.composite(
        shadow,
        Math.floor((groupSize - shadowSize) / 2) + SHADOW_OFFSET,
        Math.floor((groupSize - shadowSize) / 2) + SHADOW_OFFSET
      );
      group.composite(
        ring,
        Math.floor((groupSize - ringSize) / 2),
        Math.floor((groupSize - ringSize) / 2)
      );
      group.composite(
        badgeImage,
        Math.floor((groupSize - BADGE_SIZE) / 2),
        Math.floor((groupSize - BADGE_SIZE) / 2)
      );

      // Posición abajo-derecha
      const x = BASE - BADGE_MARGIN - group.bitmap.width;
      const y = BASE - BADGE_MARGIN - group.bitmap.height;
      baseImg.composite(group, x, y);

      // PNG a ICO 
      await baseImg.writeAsync(finalPng);
      const pngBuffer = await fs.promises.readFile(finalPng);
      const icoBuf = png256ToIco(pngBuffer); // ← generamos ICO sin dependencias
      const hash = crypto.createHash("md5").update(icoBuf).digest("hex").slice(0, 8);
      const finalIco = path.join(outDir, `icon-${p.slug}-${hash}.ico`);


      // limpia ICOs viejos del mismo slug
      try {
        for (const f of fs.readdirSync(outDir)) {
          if (f.startsWith(`icon-${p.slug}-`) && f.endsWith(".ico") && f !== path.basename(finalIco)) {
            try { fs.unlinkSync(path.join(outDir, f)); } catch {}
          }
        }
      } catch {}

      fs.writeFileSync(finalIco, icoBuf);
      await new Promise(r => setTimeout(r, 75));

      // Forzar refresco del .lnk
      if (fs.existsSync(shortcutPath)) { try { fs.unlinkSync(shortcutPath); } catch {} }

      const target = process.execPath;
      const args = [`--company=${p.slug}`];
      const ok = shell.writeShortcutLink(shortcutPath, {
        target,
        args: args.join(" "),
        icon: finalIco,
        iconIndex: 0,
        description: `Login rápido • ${p.name || p.slug}`,
        cwd: path.dirname(target),
      });

      return ok ? { ok: true, path: shortcutPath } : { ok: false, error: "No se pudo crear el acceso directo." };
    }

    if (fs.existsSync(shortcutPath)) { try { fs.unlinkSync(shortcutPath); } catch {} }
    const target = process.execPath;
    const args = [`--company=${p.slug}`];
    const ok = shell.writeShortcutLink(shortcutPath, {
      target,
      args: args.join(" "),
      icon: appIco,
      iconIndex: 0,
      description: `Login rápido • ${p.name || p.slug}`,
      cwd: path.dirname(target),
    });
    return ok ? { ok: true, path: shortcutPath } : { ok: false, error: "No se pudo crear el acceso directo." };

  } catch (e: any) {
    const msg =
      (Array.isArray(e) && e[0]?.message) ? e.map((x: any) => x.message).join("; ")
      : (e?.issues?.length ? e.issues.map((x: any) => x.message).join("; ") : (e?.message ?? String(e)));
    console.error("[shortcut:createForCompany] ERROR:", e);
    return { ok: false, error: msg };
  }
});
