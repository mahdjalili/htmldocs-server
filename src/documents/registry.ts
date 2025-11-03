import fs from "node:fs";
import path from "node:path";
import React from "react";

import { defaultPageConfig, templatesDir } from "../config.js";
import { compileDocument, type CompiledDocument } from "./compiler.js";
import { PageConfig } from "../utils/page-config.js";

export interface DocumentEntry {
    id: string;
    slug: string;
    absolutePath: string;
    compiled: CompiledDocument;
    previewProps: Record<string, unknown>;
}

const documentsById = new Map<string, DocumentEntry>();
const documentsByPath = new Map<string, DocumentEntry>();
let initializationPromise: Promise<void> | null = null;

const ensureRegistry = async () => {
    if (documentsById.size > 0) {
        return;
    }

    if (!initializationPromise) {
        initializationPromise = refreshRegistry();
    }

    await initializationPromise;
};

export const refreshRegistry = async () => {
    const files = await listTemplateFiles(templatesDir);

    const newDocsById = new Map<string, DocumentEntry>();
    const newDocsByPath = new Map<string, DocumentEntry>();

    for (const file of files) {
        const entry = await compileEntry(file);
        newDocsById.set(entry.id, entry);
        newDocsByPath.set(path.resolve(file), entry);
    }

    documentsById.clear();
    newDocsById.forEach((value, key) => documentsById.set(key, value));

    documentsByPath.clear();
    newDocsByPath.forEach((value, key) => documentsByPath.set(key, value));
};

const listTemplateFiles = async (root: string): Promise<string[]> => {
    const result: string[] = [];

    const visit = async (current: string) => {
        const dirents = await fs.promises.readdir(current, { withFileTypes: true });

        for (const dirent of dirents) {
            if (dirent.name.startsWith(".")) continue;

            const absolute = path.join(current, dirent.name);

            if (dirent.isDirectory()) {
                await visit(absolute);
                continue;
            }

            if (/\.(tsx|jsx|ts|js)$/.test(dirent.name)) {
                result.push(absolute);
            }
        }
    };

    if (fs.existsSync(root)) {
        await visit(root);
    }

    return result;
};

const compileEntry = async (file: string): Promise<DocumentEntry> => {
    const compiled = await compileDocument(file);
    const DocumentComponent = compiled.documentComponent as React.FC;

    const documentId =
        (DocumentComponent as unknown as { documentId?: string }).documentId ?? path.basename(file, path.extname(file));

    const previewProps =
        (DocumentComponent as unknown as { PreviewProps?: Record<string, unknown> }).PreviewProps ?? {};

    return {
        id: documentId,
        slug: path.relative(templatesDir, file),
        absolutePath: path.resolve(file),
        compiled,
        previewProps,
    };
};

export const getDocumentIds = async (): Promise<string[]> => {
    await ensureRegistry();
    return Array.from(documentsById.keys());
};

export const getDocumentById = async (documentId: string): Promise<DocumentEntry | undefined> => {
    await ensureRegistry();
    return documentsById.get(documentId);
};

export interface RenderResult {
    markup: string;
    css?: string;
}

export const renderDocumentToHTML = async (
    documentId: string,
    props: Record<string, unknown> | undefined
): Promise<RenderResult> => {
    const entry = await getDocumentById(documentId);

    if (!entry) {
        throw new Error(`Unknown document id: ${documentId}`);
    }

    const DocumentComponent = entry.compiled.documentComponent as React.FC;
    const renderProps = props && Object.keys(props).length > 0 ? props : entry.previewProps;

    const markup = await entry.compiled.renderAsync(
        React.createElement(DocumentComponent, renderProps as never),
        entry.compiled.documentCss
    );

    return {
        markup,
        css: entry.compiled.documentCss,
    };
};

export const resolvePageConfig = (overrides?: Partial<PageConfig>): PageConfig => ({
    size: overrides?.size ?? defaultPageConfig.size,
    orientation: overrides?.orientation ?? defaultPageConfig.orientation,
});
