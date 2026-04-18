// copplem/electron/preload.ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  // --- companies ---
  listCompanies: () => ipcRenderer.invoke("company:list"),
  createCompany: (data: any) => ipcRenderer.invoke("company:create", data),
  editCompany:   (data: any) => ipcRenderer.invoke("company:edit", data),
  deleteCompany: (slug: string) => ipcRenderer.invoke("company:delete", slug),
  setCompanyOverlay: (_p: { slug?: string|null; hint?: string|null }) =>
  Promise.resolve({ ok: true }),

  // --- auth ---
  login: (p: any) => ipcRenderer.invoke("auth:login", p),

  // --- uninstall ---
  uninstallApp: () => ipcRenderer.invoke('uninstall-app'),


  // --- products ---
  listProducts:   (p: any) => ipcRenderer.invoke("product:list", p),
  createProduct:  (p: any) => ipcRenderer.invoke("product:create", p),
  updateProduct:  (p: any) => ipcRenderer.invoke("product:update", p),
  deleteProduct:  (p: any) => ipcRenderer.invoke("product:delete", p),
  adjustProductStock: (p: any) => ipcRenderer.invoke("product:adjust", p),
  autoAlertsSuggest: (p: { slug: string; producto_id: number; windowDays?: number; targetCoverageDays?: number }) =>
  ipcRenderer.invoke("product:autoAlertsSuggest", p),

  stockForecast: (p: {
    slug: string;
    producto_id: number;
    windowDays?: number;
    horizonDays?: number;
    leadTimeDays?: number;
    serviceLevel?: number;
  }) => ipcRenderer.invoke("stockForecast", p),



  // --- categories ---
  listCategories:  (p: any) => ipcRenderer.invoke("cat:list", p),
  createCategory:  (p: any) => ipcRenderer.invoke("cat:create", p),
  updateCategory:  (p: any) => ipcRenderer.invoke("cat:update", p),
  deleteCategory:  (p: any) => ipcRenderer.invoke("cat:delete", p),

  
  // --- sales (POS) ---
  createSale: (p: any) => ipcRenderer.invoke("sale:create", p),

    // --- sales ---
  listSales: (p: any) => ipcRenderer.invoke("sale:list", p),
  getSale:  (p: any) => ipcRenderer.invoke("sale:get", p),

  // --- business info ---
  getBusinessInfo: (slug: string) => ipcRenderer.invoke("biz:get", slug),
  updateBusinessInfo: (p: { slug: string; data: any }) => ipcRenderer.invoke("biz:update", p),

  // --- users ---
  listUsers:          (p: any) => ipcRenderer.invoke("user:list", p),
  countUsers:         (p: any) => ipcRenderer.invoke("user:count", p),
  createUser:         (p: any) => ipcRenderer.invoke("user:create", p),
  updateUser:         (p: any) => ipcRenderer.invoke("user:edit", p),
  changeUserPassword: (p: any) => ipcRenderer.invoke("user:password", p),
  deleteUser:         (p: any) => ipcRenderer.invoke("user:delete", p),
  
    // --- templates / importación ---
  downloadProductsTemplate: (p?: { destPath?: string }) => ipcRenderer.invoke("product:template:xlsx", p),
  pickXlsx: () => ipcRenderer.invoke("sys:pickXlsx"),
  importProductsXlsx: (p: any) => ipcRenderer.invoke("product:importXlsx", p),


  // dashboard
  getDashboard: (slug: string) => ipcRenderer.invoke("dash:get", slug),

  // --- backups ---
  listBackups:           (p: { slug: string }) => ipcRenderer.invoke("backup:list", p),
  createBackup:          (p: { slug: string }) => ipcRenderer.invoke("backup:create", p),
  restoreBackup:         (p: { slug: string; filename: string }) => ipcRenderer.invoke("backup:restore", p),
  restoreBackupFromPath: (p: { slug: string; absPath: string }) => ipcRenderer.invoke("backup:restoreFile", p),
  ensureAutoBackup:      (p: { slug: string; maxAgeDays?: number }) => ipcRenderer.invoke("backup:autoEnsure", p),
  openBackupsFolder:     (p: { slug: string }) => ipcRenderer.invoke("backup:openFolder", p),
  deleteBackup:          (p: { slug: string; filename: string }) => ipcRenderer.invoke("backup:delete", p),
  deleteAllBackupsForSlug: (p: any) => ipcRenderer.invoke("backup:deleteAllForSlug", p),
  getAutoBackupDays: (p: { slug: string }) =>
    ipcRenderer.invoke("backup:getAutoDays", p),

  setAutoBackupDays: (p: { slug: string; days: number }) =>
    ipcRenderer.invoke("backup:setAutoDays", p),
  
  // --- util: selector .sqlite ---
  pickSqlite: () => ipcRenderer.invoke("sys:pickSqlite"),

  // --- app lifecycle ---
  restartApp(p?: { slug?: string }) {
    return ipcRenderer.invoke("app:restart", p);
  },

  onOpenLoginFromMain(cb: (slug: string) => void) {
    const ch = "open-login";
    const handler = (_evt: any, slug: string) => { try { cb(slug); } catch {} };
    ipcRenderer.on(ch, handler);
    return () => ipcRenderer.removeListener(ch, handler);
  },
    
  // reports
  getReports: (p: { slug: string; mode?: "total"|"week"|"month"|"year"; from?: string; to?: string }) =>
    ipcRenderer.invoke("reports:get", p),
  exportReportsXlsx: (p: any) => ipcRenderer.invoke("reports:exportXlsx", p),

  exportReportsPdf: (p: any) => ipcRenderer.invoke("reports:exportPdf", p),

  pickDirectory: () => ipcRenderer.invoke("utils:pickDirectory") as Promise<string | null>,

  pickSaveFile: (opts: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) =>
    ipcRenderer.invoke("utils:pickSaveFile", opts) as Promise<string | null>,

  revealInFolder: (absPath: string) =>
    ipcRenderer.invoke("utils:revealInFolder", absPath),

  // contabilidad
  accountingExportXlsx: (p: { slug: string; periods: Array<{ from: string; to: string; label: string }>; filePath: string; includeItems?: boolean }) =>
    ipcRenderer.invoke("accounting:exportXlsx", p),

  // Accesos Directos
  createCompanyShortcut(payload: {
    slug: string;
    name: string;
    avatarDataUrl?: string | null;
    colorHex?: string | null;
  }) {
    return ipcRenderer.invoke("shortcut:createForCompany", payload);
  },


});

