import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { BuildFailure, OutputFile, build, type OnLoadArgs, type PluginBuild } from "esbuild";
import postCssPlugin from "esbuild-style-plugin";
import {
    configureSourceMap,
    createFakeContext,
    executeBuiltCode,
    extractOutputFiles,
    renderAsync,
    type ErrorObject,
} from "@htmldocs/render";

import { templateProjectRoot } from "../config.js";

const require = createRequire(import.meta.url);

export interface CompiledDocument {
    documentComponent: any;
    documentCss?: string;
    renderAsync: typeof renderAsync;
    sourceMapToOriginalFile: ReturnType<typeof configureSourceMap>;
}

export class CompilationError extends Error {
    constructor(message: string, readonly error: ErrorObject) {
        super(message);
    }
}

export const compileDocument = async (documentPath: string, isBuild = false): Promise<CompiledDocument> => {
    let outputFiles: OutputFile[];

    try {
        const buildResult = await build({
            entryPoints: [documentPath],
            platform: "node",
            bundle: true,
            minify: true,
            write: false,
            format: "cjs",
            jsx: "automatic",
            define: {
                "process.env.NODE_ENV": '"production"',
            },
            plugins: [renderExportPlugin(documentPath, isBuild), cssPlugin(documentPath)],
            loader: {
                ".ts": "ts",
                ".tsx": "tsx",
                ".css": "css",
            },
            outdir: "out",
            sourcemap: "external",
        });

        outputFiles = buildResult.outputFiles;
    } catch (error) {
        const failure = error as BuildFailure;
        throw new CompilationError("Failed to compile document", {
            message: failure.message,
            stack: failure.stack ?? new Error().stack,
            name: failure.name,
            cause: failure.cause,
        });
    }

    const { sourceMapFile, bundledDocumentFile, cssFile } = extractOutputFiles(outputFiles);

    const builtDocumentCode = bundledDocumentFile.text;
    const documentCss = cssFile?.text;

    const fakeContext = createFakeContext(documentPath);
    const sourceMapToDocument = configureSourceMap(sourceMapFile);

    const executionResult = executeBuiltCode(builtDocumentCode, fakeContext, documentPath, sourceMapToDocument);

    if ("error" in executionResult) {
        throw new CompilationError("Failed to execute compiled document", executionResult.error);
    }

    return {
        documentComponent: executionResult.DocumentComponent,
        documentCss,
        renderAsync: executionResult.renderAsync,
        sourceMapToOriginalFile: sourceMapToDocument,
    };
};

const cssPlugin = (documentPath: string) => {
    const tailwindConfigPath = process.env.TAILWIND_CONFIG;

    const loadedConfig = tailwindConfigPath && fs.existsSync(tailwindConfigPath) ? require(tailwindConfigPath) : {};
    const tailwindConfig = loadedConfig?.default ?? loadedConfig ?? {};

    const normalizeContent = (contentValue: unknown) => {
        if (Array.isArray(contentValue)) {
            const files = [...contentValue.map((entry) => entry)];
            if (!files.includes(documentPath)) {
                files.push(documentPath);
            }
            return files;
        }

        if (
            contentValue &&
            typeof contentValue === "object" &&
            "files" in contentValue &&
            Array.isArray((contentValue as { files: unknown }).files)
        ) {
            const contentObject = { ...(contentValue as { files: string[]; extract?: unknown }) };
            const files = [...contentObject.files];
            if (!files.includes(documentPath)) {
                files.push(documentPath);
            }
            contentObject.files = files;
            return contentObject;
        }

        return [documentPath];
    };

    const mergedConfig = {
        ...tailwindConfig,
        content: normalizeContent(tailwindConfig.content),
        cwd: templateProjectRoot,
    };

    return postCssPlugin({
        postcss: {
            plugins: [require("tailwindcss")(mergedConfig), require("autoprefixer")],
        },
    });
};

const renderExportPlugin = (documentPath: string, isBuild: boolean) => ({
    name: "htmldocs-render-export",
    setup(build: PluginBuild) {
        build.onLoad({ filter: /\.([tj]sx?)$/ }, async (args: OnLoadArgs) => {
            if (path.resolve(args.path) !== path.resolve(documentPath)) {
                return undefined;
            }

            let contents = await fs.promises.readFile(args.path, "utf8");

            if (isBuild) {
                contents = contents.replace(/\/static/g, "./static");
            }

            const loader = path.extname(args.path).slice(1) as "ts" | "tsx";

            return {
                contents: `${contents}\nexport { renderAsync } from '@htmldocs/render';`,
                loader,
            };
        });
    },
});
