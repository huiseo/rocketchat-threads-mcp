/**
 * LRU Cache implementation for API response caching
 * Reduces redundant API calls and improves response time
 */

interface CacheEntry<T> {
    value: T;
    timestamp: number;
    accessCount: number;
}

export class LRUCache<T> {
    private cache: Map<string, CacheEntry<T>>;
    private readonly maxSize: number;
    private readonly ttlMs: number;

    constructor(maxSize: number = 100, ttlMs: number = 300000) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttlMs = ttlMs;
    }

    /**
     * Get value from cache
     */
    get(key: string): T | undefined {
        const entry = this.cache.get(key);

        if (!entry) {
            return undefined;
        }

        // Check if expired
        if (Date.now() - entry.timestamp > this.ttlMs) {
            this.cache.delete(key);
            return undefined;
        }

        // Update access count and move to end (most recently used)
        entry.accessCount++;
        this.cache.delete(key);
        this.cache.set(key, entry);

        return entry.value;
    }

    /**
     * Set value in cache
     */
    set(key: string, value: T): void {
        // Remove oldest entries if at capacity
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            accessCount: 1
        });
    }

    /**
     * Check if key exists and is not expired
     */
    has(key: string): boolean {
        const entry = this.cache.get(key);
        if (!entry) {
            return false;
        }

        if (Date.now() - entry.timestamp > this.ttlMs) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Delete entry from cache
     */
    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    /**
     * Clear all entries
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getStats(): { size: number; maxSize: number; ttlMs: number } {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            ttlMs: this.ttlMs
        };
    }

    /**
     * Remove expired entries
     */
    prune(): number {
        const now = Date.now();
        let removed = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.ttlMs) {
                this.cache.delete(key);
                removed++;
            }
        }

        return removed;
    }
}

/**
 * Create cache key from parameters
 */
export function createCacheKey(prefix: string, params: Record<string, unknown>): string {
    const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${key}=${JSON.stringify(params[key])}`)
        .join('&');

    return `${prefix}:${sortedParams}`;
}
