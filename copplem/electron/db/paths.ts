import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

const APP_DIRNAME = "copplem";

export const userDataRoot    = () => path.join(app.getPath("userData"), APP_DIRNAME);
export const getCompaniesDir = () => path.join(userDataRoot(), "companies");
export const getIconsDir     = () => path.join(userDataRoot(), "icons");

export const ensureDirs = () => {
  [userDataRoot(), getCompaniesDir(), getIconsDir()].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
};

export const templatePath = () => {
  const dev = !!process.env.VITE_DEV_SERVER_URL;
  return dev
    ? path.join(process.cwd(), "resources", "template.sql") 
    : path.join(process.resourcesPath, "template.sql");
};

export const slugify = (s: string) =>
  (s.normalize("NFD").replace(/\p{Diacritic}/gu, "")
     .replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "_").toLowerCase()) || "empresa";

export const dbPathForSlug      = (slug: string) => path.join(getCompaniesDir(), `${slug}.sqlite`);
export const iconPathForSlug    = (slug: string) => path.join(getIconsDir(), `${slug}.ico`);
export const logoPngPathForSlug = (slug: string) => path.join(getIconsDir(), `${slug}.png`);

export const productTemplateXlsxPath = () => {
  const dev = !!process.env.VITE_DEV_SERVER_URL;
  return dev
    ? path.join(process.cwd(), "resources", "plantillas", "Plantilla_Productos.xlsx")
    : path.join(process.resourcesPath, "plantillas", "Plantilla_Productos.xlsx");
};

// === Backups ===
export const getBackupsRootDir = () => path.join(getCompaniesDir(), "_backups");
export const backupsDirForSlug = (slug: string) => path.join(getBackupsRootDir(), slug);
export const ensureBackupsDir = (slug: string) => {
  const dir = backupsDirForSlug(slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};
