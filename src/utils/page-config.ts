import { orientations, standardSizes } from "../constants.js";

export type Orientation = (typeof orientations)[number];
export type StandardSize = (typeof standardSizes)[number];
export type Unit = "in" | "cm" | "mm" | "px";
export type CustomSize = `${number}${Unit} ${number}${Unit}`;
export type DocumentSize = StandardSize | CustomSize;

export interface PageConfig {
    size: DocumentSize;
    orientation: Orientation;
}

export const isStandardSize = (size: string): size is StandardSize => {
    return standardSizes.includes(size as StandardSize);
};

export const parseCustomSize = (size: string) => {
    const [width, height] = size.split(" ");
    return { width, height };
};
