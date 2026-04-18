import fs from "node:fs";
import { templatePath } from "./paths";

let cached: string | null = null;

export function readTemplateSQL(): string {
  if (cached) return cached;
  cached = fs.readFileSync(templatePath(), "utf8");
  return cached!;
}
