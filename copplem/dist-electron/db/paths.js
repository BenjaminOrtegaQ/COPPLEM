"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureBackupsDir = exports.backupsDirForSlug = exports.getBackupsRootDir = exports.productTemplateXlsxPath = exports.logoPngPathForSlug = exports.iconPathForSlug = exports.dbPathForSlug = exports.slugify = exports.templatePath = exports.ensureDirs = exports.getIconsDir = exports.getCompaniesDir = exports.userDataRoot = void 0;
const electron_1 = require("electron");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const APP_DIRNAME = "copplem";
const userDataRoot = () => node_path_1.default.join(electron_1.app.getPath("userData"), APP_DIRNAME);
exports.userDataRoot = userDataRoot;
const getCompaniesDir = () => node_path_1.default.join((0, exports.userDataRoot)(), "companies");
exports.getCompaniesDir = getCompaniesDir;
const getIconsDir = () => node_path_1.default.join((0, exports.userDataRoot)(), "icons");
exports.getIconsDir = getIconsDir;
const ensureDirs = () => {
    [(0, exports.userDataRoot)(), (0, exports.getCompaniesDir)(), (0, exports.getIconsDir)()].forEach(d => {
        if (!node_fs_1.default.existsSync(d))
            node_fs_1.default.mkdirSync(d, { recursive: true });
    });
};
exports.ensureDirs = ensureDirs;
const templatePath = () => {
    const dev = !!process.env.VITE_DEV_SERVER_URL;
    return dev
        ? node_path_1.default.join(process.cwd(), "resources", "template.sql")
        : node_path_1.default.join(process.resourcesPath, "template.sql");
};
exports.templatePath = templatePath;
const slugify = (s) => (s.normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "_").toLowerCase()) || "empresa";
exports.slugify = slugify;
const dbPathForSlug = (slug) => node_path_1.default.join((0, exports.getCompaniesDir)(), `${slug}.sqlite`);
exports.dbPathForSlug = dbPathForSlug;
const iconPathForSlug = (slug) => node_path_1.default.join((0, exports.getIconsDir)(), `${slug}.ico`);
exports.iconPathForSlug = iconPathForSlug;
const logoPngPathForSlug = (slug) => node_path_1.default.join((0, exports.getIconsDir)(), `${slug}.png`);
exports.logoPngPathForSlug = logoPngPathForSlug;
const productTemplateXlsxPath = () => {
    const dev = !!process.env.VITE_DEV_SERVER_URL;
    return dev
        ? node_path_1.default.join(process.cwd(), "resources", "plantillas", "Plantilla_Productos.xlsx")
        : node_path_1.default.join(process.resourcesPath, "plantillas", "Plantilla_Productos.xlsx");
};
exports.productTemplateXlsxPath = productTemplateXlsxPath;
// === Backups ===
const getBackupsRootDir = () => node_path_1.default.join((0, exports.getCompaniesDir)(), "_backups");
exports.getBackupsRootDir = getBackupsRootDir;
const backupsDirForSlug = (slug) => node_path_1.default.join((0, exports.getBackupsRootDir)(), slug);
exports.backupsDirForSlug = backupsDirForSlug;
const ensureBackupsDir = (slug) => {
    const dir = (0, exports.backupsDirForSlug)(slug);
    if (!node_fs_1.default.existsSync(dir))
        node_fs_1.default.mkdirSync(dir, { recursive: true });
    return dir;
};
exports.ensureBackupsDir = ensureBackupsDir;
