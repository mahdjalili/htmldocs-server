import { LaunchOptions, chromium } from "playwright";

import { isStandardSize, parseCustomSize, type PageConfig } from "../utils/page-config.js";

export interface RenderPdfOptions extends LaunchOptions {
    baseUrl: string;
    html: string;
    pageConfig: PageConfig;
}

export const renderDocumentToPDF = async ({
    baseUrl,
    html,
    pageConfig,
    ...launchOptions
}: RenderPdfOptions): Promise<Buffer> => {
    const browser = await chromium.launch(launchOptions);

    try {
        const page = await browser.newPage();
        await page.goto(baseUrl);
        await page.setContent(html, { waitUntil: "networkidle" });

        const pdfOptions: Parameters<typeof page.pdf>[0] = {
            printBackground: true,
            ...(isStandardSize(pageConfig.size) ? { format: pageConfig.size } : parseCustomSize(pageConfig.size)),
            landscape: pageConfig.orientation === "landscape",
        };

        const buffer = await page.pdf(pdfOptions);
        return buffer;
    } finally {
        await browser.close();
    }
};
