import { z } from "zod";
import { orientations, standardSizes } from "./constants.js";

export const formatEnum = z.enum(["pdf", "base64", "json"]);

export const pageConfigSchema = z
    .object({
        size: z
            .union([z.enum(standardSizes), z.string().regex(/^[0-9]+(?:in|cm|mm|px)\s+[0-9]+(?:in|cm|mm|px)$/)])
            .optional(),
        orientation: z.enum(orientations).optional(),
    })
    .strict();

export const generateRequestSchema = z
    .object({
        props: z.record(z.any()),
        format: formatEnum.default("pdf"),
        size: pageConfigSchema.shape.size,
        orientation: pageConfigSchema.shape.orientation,
    })
    .strict();

export type GenerateRequestBody = z.infer<typeof generateRequestSchema>;
