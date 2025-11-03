import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { ensureEnvironment, apiKey, staticDir } from "./config.js";
import { getDocumentById, renderDocumentToHTML, resolvePageConfig } from "./documents/registry.js";
import { renderDocumentToPDF } from "./documents/pdf.js";
import {
    DEFAULT_TTL_MS,
    consumeDownloadToken,
    createDownloadToken,
    pruneExpiredEntries,
} from "./storage/download-cache.js";
import { generateRequestSchema } from "./types.js";
import type { DocumentSize, Orientation } from "./utils/page-config.js";

ensureEnvironment();

const app = new Hono();

app.use("*", async (c, next) => {
    if (apiKey) {
        const path = c.req.path;
        const isStatic = path.startsWith("/static/");
        const isDownload = path.startsWith("/api/downloads");
        const isRoot = path === "/" && c.req.method === "GET";

        if (!isStatic && !isDownload && !isRoot) {
            const header = c.req.header("authorization");
            if (header !== apiKey) {
                throw new HTTPException(401, { message: "Unauthorized" });
            }
        }
    }
    return next();
});

app.get("/", (c) =>
    c.json({
        name: "htmldocs-server",
        status: "ok",
        templatesRoot: process.env.DOCUMENTS_DIR_ABSOLUTE_PATH,
    })
);

app.get("/health", (c) => c.text("ok"));

app.get("/static/*", async (c) => {
    const relative = c.req.path.replace(/^\/static\/?/, "");
    const filePath = path.resolve(staticDir, relative);

    if (!filePath.startsWith(path.resolve(staticDir))) {
        throw new HTTPException(403, { message: "Forbidden" });
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        throw new HTTPException(404, { message: "Not Found" });
    }

    const file = Bun.file(filePath);
    return new Response(file);
});

app.get("/api/downloads/:token", (c) => {
    pruneExpiredEntries();
    const token = c.req.param("token");
    const entry = consumeDownloadToken(token);

    if (!entry) {
        throw new HTTPException(404, { message: "Download expired" });
    }

    const dataView = new Uint8Array(entry.data);

    return new Response(dataView, {
        headers: {
            "content-type": entry.mime,
            "content-length": entry.data.length.toString(),
            "cache-control": "no-store",
        },
    });
});

app.post("/api/documents/:documentId", async (c) => {
    const documentId = c.req.param("documentId");
    const body = await c.req.json().catch(() => {
        throw new HTTPException(400, { message: "Invalid JSON body" });
    });

    const parsed = generateRequestSchema.safeParse(body);
    if (!parsed.success) {
        throw new HTTPException(400, {
            message: "Invalid request",
            cause: parsed.error.flatten(),
        });
    }

    const document = await getDocumentById(documentId);
    if (!document) {
        throw new HTTPException(404, { message: "Unknown document" });
    }

    const requestedSize = parsed.data.size as DocumentSize | undefined;
    const requestedOrientation = parsed.data.orientation as Orientation | undefined;

    const resolvedPageConfig = resolvePageConfig({
        size: requestedSize,
        orientation: requestedOrientation,
    });

    const { markup } = await renderDocumentToHTML(documentId, parsed.data.props);
    const baseUrl = new URL("/", c.req.url).toString();

    const pdfBuffer = await renderDocumentToPDF({
        baseUrl,
        html: markup,
        pageConfig: resolvedPageConfig,
    });

    const pdfBytes = new Uint8Array(pdfBuffer);
    const nodeBuffer = Buffer.from(pdfBytes);

    switch (parsed.data.format) {
        case "base64": {
            const base64 = nodeBuffer.toString("base64");
            return c.json({
                documentId,
                format: "base64",
                data: base64,
                mime: "application/pdf",
                size: nodeBuffer.byteLength,
            });
        }
        case "json": {
            const token = createDownloadToken(nodeBuffer, "application/pdf");
            const downloadUrl = new URL(`/api/downloads/${token}`, c.req.url).toString();
            return c.json({
                documentId,
                format: "json",
                url: downloadUrl,
                expiresInMs: DEFAULT_TTL_MS,
            });
        }
        default:
            return new Response(pdfBytes, {
                headers: {
                    "content-type": "application/pdf",
                    "content-length": nodeBuffer.byteLength.toString(),
                    "cache-control": "no-store",
                },
            });
    }
});

app.onError((err, c) => {
    if (err instanceof HTTPException) {
        if (err.cause) {
            console.error("Request error:", err.cause);
        }
        return err.getResponse();
    }

    console.error("Unexpected error", err);
    return c.json({ message: "Internal Server Error" }, 500);
});

export default {
    port: Number(process.env.PORT ?? 4000),
    fetch: app.fetch,
};

if (import.meta.main) {
    Bun.serve({
        port: Number(process.env.PORT ?? 4000),
        fetch: app.fetch,
    });
}
