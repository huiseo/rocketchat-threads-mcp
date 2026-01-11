/**
 * Rate Limiter - Prevents excessive API calls
 * Uses a sliding window algorithm for rate limiting
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('RateLimiter');

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
    /** Maximum number of requests allowed in the window */
    maxRequests: number;
    /** Window size in milliseconds */
    windowMs: number;
    /** Optional key prefix for namespacing */
    keyPrefix?: string;
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    retryAfterMs?: number;
}

/**
 * Default rate limit configurations
 */
export const DEFAULT_LIMITS = {
    /** General API calls */
    api: { maxRequests: 100, windowMs: 60000 },
    /** Write operations (send message, react) */
    write: { maxRequests: 20, windowMs: 60000 },
    /** Search operations */
    search: { maxRequests: 30, windowMs: 60000 },
    /** Heavy operations (list all, bulk operations) */
    heavy: { maxRequests: 10, windowMs: 60000 },
} as const;

/**
 * Request record for tracking
 */
interface RequestRecord {
    timestamps: number[];
}

/**
 * Rate limiter class with sliding window algorithm
 */
export class RateLimiter {
    private records: Map<string, RequestRecord> = new Map();
    private config: RateLimitConfig;
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor(config: RateLimitConfig) {
        this.config = config;

        // Cleanup old records every minute
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }

    /**
     * Check if a request is allowed and record it
     */
    check(key: string): RateLimitResult {
        const fullKey = this.config.keyPrefix ? `${this.config.keyPrefix}:${key}` : key;
        const now = Date.now();
        const windowStart = now - this.config.windowMs;

        // Get or create record
        let record = this.records.get(fullKey);
        if (!record) {
            record = { timestamps: [] };
            this.records.set(fullKey, record);
        }

        // Remove timestamps outside the window
        record.timestamps = record.timestamps.filter(ts => ts > windowStart);

        const currentCount = record.timestamps.length;
        const remaining = Math.max(0, this.config.maxRequests - currentCount);
        const resetAt = record.timestamps.length > 0
            ? record.timestamps[0] + this.config.windowMs
            : now + this.config.windowMs;

        if (currentCount >= this.config.maxRequests) {
            const retryAfterMs = resetAt - now;
            logger.debug('Rate limit exceeded', {
                key: fullKey,
                currentCount,
                maxRequests: this.config.maxRequests,
                retryAfterMs
            });

            return {
                allowed: false,
                remaining: 0,
                resetAt,
                retryAfterMs
            };
        }

        // Record this request
        record.timestamps.push(now);

        return {
            allowed: true,
            remaining: remaining - 1,
            resetAt
        };
    }

    /**
     * Check without recording (peek)
     */
    peek(key: string): RateLimitResult {
        const fullKey = this.config.keyPrefix ? `${this.config.keyPrefix}:${key}` : key;
        const now = Date.now();
        const windowStart = now - this.config.windowMs;

        const record = this.records.get(fullKey);
        if (!record) {
            return {
                allowed: true,
                remaining: this.config.maxRequests,
                resetAt: now + this.config.windowMs
            };
        }

        const validTimestamps = record.timestamps.filter(ts => ts > windowStart);
        const currentCount = validTimestamps.length;
        const remaining = Math.max(0, this.config.maxRequests - currentCount);
        const resetAt = validTimestamps.length > 0
            ? validTimestamps[0] + this.config.windowMs
            : now + this.config.windowMs;

        return {
            allowed: currentCount < this.config.maxRequests,
            remaining,
            resetAt,
            retryAfterMs: currentCount >= this.config.maxRequests ? resetAt - now : undefined
        };
    }

    /**
     * Reset rate limit for a key
     */
    reset(key: string): void {
        const fullKey = this.config.keyPrefix ? `${this.config.keyPrefix}:${key}` : key;
        this.records.delete(fullKey);
    }

    /**
     * Reset all rate limits
     */
    resetAll(): void {
        this.records.clear();
    }

    /**
     * Get current configuration
     */
    getConfig(): RateLimitConfig {
        return { ...this.config };
    }

    /**
     * Clean up old records
     */
    private cleanup(): void {
        const now = Date.now();
        const windowStart = now - this.config.windowMs;

        for (const [key, record] of this.records.entries()) {
            record.timestamps = record.timestamps.filter(ts => ts > windowStart);
            if (record.timestamps.length === 0) {
                this.records.delete(key);
            }
        }
    }

    /**
     * Stop the cleanup interval
     */
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.records.clear();
    }
}

/**
 * Rate limiter manager for multiple rate limit types
 */
export class RateLimiterManager {
    private limiters: Map<string, RateLimiter> = new Map();

    /**
     * Get or create a rate limiter
     */
    getLimiter(name: string, config?: RateLimitConfig): RateLimiter {
        if (this.limiters.has(name)) {
            return this.limiters.get(name)!;
        }

        const limiterConfig = config || DEFAULT_LIMITS[name as keyof typeof DEFAULT_LIMITS] || DEFAULT_LIMITS.api;
        const limiter = new RateLimiter({ ...limiterConfig, keyPrefix: name });
        this.limiters.set(name, limiter);
        return limiter;
    }

    /**
     * Check rate limit for a specific limiter type
     */
    check(limiterName: string, key: string): RateLimitResult {
        const limiter = this.getLimiter(limiterName);
        return limiter.check(key);
    }

    /**
     * Reset all limiters
     */
    resetAll(): void {
        for (const limiter of this.limiters.values()) {
            limiter.resetAll();
        }
    }

    /**
     * Destroy all limiters
     */
    destroy(): void {
        for (const limiter of this.limiters.values()) {
            limiter.destroy();
        }
        this.limiters.clear();
    }
}

// Singleton instance
let managerInstance: RateLimiterManager | null = null;

export function getRateLimiterManager(): RateLimiterManager {
    if (!managerInstance) {
        managerInstance = new RateLimiterManager();
    }
    return managerInstance;
}

export function resetRateLimiterManager(): void {
    if (managerInstance) {
        managerInstance.destroy();
        managerInstance = null;
    }
}

// Convenience functions
export function checkRateLimit(limiterName: string, key: string): RateLimitResult {
    return getRateLimiterManager().check(limiterName, key);
}

export function checkApiRateLimit(key: string): RateLimitResult {
    return getRateLimiterManager().check('api', key);
}

export function checkWriteRateLimit(key: string): RateLimitResult {
    return getRateLimiterManager().check('write', key);
}

export function checkSearchRateLimit(key: string): RateLimitResult {
    return getRateLimiterManager().check('search', key);
}
