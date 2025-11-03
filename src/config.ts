import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const serverRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

export const templateProjectRoot = process.env.HTMDOCS_TEMPLATES_ROOT
    ? path.resolve(process.env.HTMDOCS_TEMPLATES_ROOT)
    : path.resolve(serverRoot, "../templates");

export const documentsDir = process.env.HTMDOCS_DOCUMENTS_DIR
    ? path.resolve(process.env.HTMDOCS_DOCUMENTS_DIR)
    : path.join(templateProjectRoot, "documents");

export const templatesDir = path.join(documentsDir, "templates");
export const staticDir = path.join(documentsDir, "static");
export const distDir = path.join(serverRoot, "dist");

export const apiKey = process.env.HTMDOCS_API_KEY ?? null;

export const defaultPageConfig = {
    size: "A4" as const,
    orientation: "portrait" as const,
};

export const ensureEnvironment = () => {
    process.env.NEXT_PUBLIC_USER_PROJECT_LOCATION ??= templateProjectRoot;
    process.env.NEXT_PUBLIC_DOCUMENTS_DIR_RELATIVE_PATH ??=
        path.relative(templateProjectRoot, documentsDir) || "documents";
    process.env.NEXT_PUBLIC_OS_PATH_SEPARATOR ??= path.sep;
    process.env.DOCUMENTS_DIR_ABSOLUTE_PATH ??= documentsDir;
    process.env.DOCUMENTS_DIR_RELATIVE_PATH ??= path.relative(serverRoot, documentsDir);
    process.env.DOCUMENTS_STATIC_PATH ??= path.join(documentsDir, "static");
    process.env.TAILWIND_CONFIG ??= path.join(templateProjectRoot, "tailwind.config.js");
    process.env.POSTCSS_CONFIG ??= path.join(templateProjectRoot, "postcss.config.js");

    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }
};
