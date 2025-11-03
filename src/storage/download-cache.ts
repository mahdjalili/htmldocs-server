import { randomUUID } from "node:crypto";

interface CacheEntry {
    data: Buffer;
    mime: string;
    expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
export const DEFAULT_TTL_MS = 5 * 60 * 1000;

export const createDownloadToken = (data: Buffer, mime: string, ttlMs: number = DEFAULT_TTL_MS): string => {
    const token = randomUUID();
    cache.set(token, {
        data,
        mime,
        expiresAt: Date.now() + ttlMs,
    });
    return token;
};

export const consumeDownloadToken = (token: string): CacheEntry | undefined => {
    const entry = cache.get(token);

    if (!entry) {
        return undefined;
    }

    cache.delete(token);

    if (entry.expiresAt < Date.now()) {
        return undefined;
    }

    return entry;
};

export const pruneExpiredEntries = () => {
    const now = Date.now();
    for (const [token, entry] of cache.entries()) {
        if (entry.expiresAt < now) {
            cache.delete(token);
        }
    }
};
