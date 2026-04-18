"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// copplem/electron/preload.ts
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("api", {
    // --- companies ---
    listCompanies: () => electron_1.ipcRenderer.invoke("company:list"),
    createCompany: (data) => electron_1.ipcRenderer.invoke("company:create", data),
    editCompany: (data) => electron_1.ipcRenderer.invoke("company:edit", data),
    deleteCompany: (slug) => electron_1.ipcRenderer.invoke("company:delete", slug),
    setCompanyOverlay: (_p) => Promise.resolve({ ok: true }),
    // --- auth ---
    login: (p) => electron_1.ipcRenderer.invoke("auth:login", p),
    // --- uninstall ---
    uninstallApp: () => electron_1.ipcRenderer.invoke('uninstall-app'),
    // --- products ---
    listProducts: (p) => electron_1.ipcRenderer.invoke("product:list", p),
    createProduct: (p) => electron_1.ipcRenderer.invoke("product:create", p),
    updateProduct: (p) => electron_1.ipcRenderer.invoke("product:update", p),
    deleteProduct: (p) => electron_1.ipcRenderer.invoke("product:delete", p),
    adjustProductStock: (p) => electron_1.ipcRenderer.invoke("product:adjust", p),
    autoAlertsSuggest: (p) => electron_1.ipcRenderer.invoke("product:autoAlertsSuggest", p),
    stockForecast: (p) => electron_1.ipcRenderer.invoke("stockForecast", p),
    // --- categories ---
    listCategories: (p) => electron_1.ipcRenderer.invoke("cat:list", p),
    createCategory: (p) => electron_1.ipcRenderer.invoke("cat:create", p),
    updateCategory: (p) => electron_1.ipcRenderer.invoke("cat:update", p),
    deleteCategory: (p) => electron_1.ipcRenderer.invoke("cat:delete", p),
    // --- sales (POS) ---
    createSale: (p) => electron_1.ipcRenderer.invoke("sale:create", p),
    // --- sales ---
    listSales: (p) => electron_1.ipcRenderer.invoke("sale:list", p),
    getSale: (p) => electron_1.ipcRenderer.invoke("sale:get", p),
    // --- business info ---
    getBusinessInfo: (slug) => electron_1.ipcRenderer.invoke("biz:get", slug),
    updateBusinessInfo: (p) => electron_1.ipcRenderer.invoke("biz:update", p),
    // --- users ---
    listUsers: (p) => electron_1.ipcRenderer.invoke("user:list", p),
    countUsers: (p) => electron_1.ipcRenderer.invoke("user:count", p),
    createUser: (p) => electron_1.ipcRenderer.invoke("user:create", p),
    updateUser: (p) => electron_1.ipcRenderer.invoke("user:edit", p),
    changeUserPassword: (p) => electron_1.ipcRenderer.invoke("user:password", p),
    deleteUser: (p) => electron_1.ipcRenderer.invoke("user:delete", p),
    // --- templates / importación ---
    downloadProductsTemplate: (p) => electron_1.ipcRenderer.invoke("product:template:xlsx", p),
    pickXlsx: () => electron_1.ipcRenderer.invoke("sys:pickXlsx"),
    importProductsXlsx: (p) => electron_1.ipcRenderer.invoke("product:importXlsx", p),
    // dashboard
    getDashboard: (slug) => electron_1.ipcRenderer.invoke("dash:get", slug),
    // --- backups ---
    listBackups: (p) => electron_1.ipcRenderer.invoke("backup:list", p),
    createBackup: (p) => electron_1.ipcRenderer.invoke("backup:create", p),
    restoreBackup: (p) => electron_1.ipcRenderer.invoke("backup:restore", p),
    restoreBackupFromPath: (p) => electron_1.ipcRenderer.invoke("backup:restoreFile", p),
    ensureAutoBackup: (p) => electron_1.ipcRenderer.invoke("backup:autoEnsure", p),
    openBackupsFolder: (p) => electron_1.ipcRenderer.invoke("backup:openFolder", p),
    deleteBackup: (p) => electron_1.ipcRenderer.invoke("backup:delete", p),
    deleteAllBackupsForSlug: (p) => electron_1.ipcRenderer.invoke("backup:deleteAllForSlug", p),
    getAutoBackupDays: (p) => electron_1.ipcRenderer.invoke("backup:getAutoDays", p),
    setAutoBackupDays: (p) => electron_1.ipcRenderer.invoke("backup:setAutoDays", p),
    // --- util: selector .sqlite ---
    pickSqlite: () => electron_1.ipcRenderer.invoke("sys:pickSqlite"),
    // --- app lifecycle ---
    restartApp(p) {
        return electron_1.ipcRenderer.invoke("app:restart", p);
    },
    onOpenLoginFromMain(cb) {
        const ch = "open-login";
        const handler = (_evt, slug) => { try {
            cb(slug);
        }
        catch { } };
        electron_1.ipcRenderer.on(ch, handler);
        return () => electron_1.ipcRenderer.removeListener(ch, handler);
    },
    // reports
    getReports: (p) => electron_1.ipcRenderer.invoke("reports:get", p),
    exportReportsXlsx: (p) => electron_1.ipcRenderer.invoke("reports:exportXlsx", p),
    exportReportsPdf: (p) => electron_1.ipcRenderer.invoke("reports:exportPdf", p),
    pickDirectory: () => electron_1.ipcRenderer.invoke("utils:pickDirectory"),
    pickSaveFile: (opts) => electron_1.ipcRenderer.invoke("utils:pickSaveFile", opts),
    revealInFolder: (absPath) => electron_1.ipcRenderer.invoke("utils:revealInFolder", absPath),
    // contabilidad
    accountingExportXlsx: (p) => electron_1.ipcRenderer.invoke("accounting:exportXlsx", p),
    // Accesos Directos
    createCompanyShortcut(payload) {
        return electron_1.ipcRenderer.invoke("shortcut:createForCompany", payload);
    },
});
