"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readTemplateSQL = readTemplateSQL;
const node_fs_1 = __importDefault(require("node:fs"));
const paths_1 = require("./paths");
let cached = null;
function readTemplateSQL() {
    if (cached)
        return cached;
    cached = node_fs_1.default.readFileSync((0, paths_1.templatePath)(), "utf8");
    return cached;
}
