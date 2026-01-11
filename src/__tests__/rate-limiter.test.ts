/**
 * Rate Limiter Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    RateLimiter,
    RateLimiterManager,
    getRateLimiterManager,
    resetRateLimiterManager,
    checkApiRateLimit,
    checkWriteRateLimit,
    checkSearchRateLimit,
    DEFAULT_LIMITS
} from '../guards/rate-limiter.js';

describe('RateLimiter', () => {
    let limiter: RateLimiter;

    beforeEach(() => {
        vi.useFakeTimers();
        limiter = new RateLimiter({ maxRequests: 5, windowMs: 1000 });
    });

    afterEach(() => {
        limiter.destroy();
        vi.useRealTimers();
    });

    describe('check', () => {
        it('should allow requests within limit', () => {
            for (let i = 0; i < 5; i++) {
                const result = limiter.check('test-key');
                expect(result.allowed).toBe(true);
                expect(result.remaining).toBe(4 - i);
            }
        });

        it('should block requests exceeding limit', () => {
            // Use up all requests
            for (let i = 0; i < 5; i++) {
                limiter.check('test-key');
            }

            // Next request should be blocked
            const result = limiter.check('test-key');
            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
            expect(result.retryAfterMs).toBeGreaterThan(0);
        });

        it('should reset after window expires', () => {
            // Use up all requests
            for (let i = 0; i < 5; i++) {
                limiter.check('test-key');
            }

            // Move time forward past the window
            vi.advanceTimersByTime(1001);

            // Should be allowed again
            const result = limiter.check('test-key');
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(4);
        });

        it('should track different keys separately', () => {
            // Use up all requests for key1
            for (let i = 0; i < 5; i++) {
                limiter.check('key1');
            }

            // key2 should still be allowed
            const result = limiter.check('key2');
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(4);
        });

        it('should use sliding window correctly', () => {
            // Make 3 requests
            limiter.check('test-key');
            limiter.check('test-key');
            limiter.check('test-key');

            // Advance time halfway through window
            vi.advanceTimersByTime(500);

            // Make 2 more requests (total 5 in current window)
            limiter.check('test-key');
            limiter.check('test-key');

            // Next request should be blocked
            const blocked = limiter.check('test-key');
            expect(blocked.allowed).toBe(false);

            // Advance time past first 3 requests' window
            vi.advanceTimersByTime(501);

            // Now first 3 requests are outside window, should allow
            const allowed = limiter.check('test-key');
            expect(allowed.allowed).toBe(true);
        });
    });

    describe('peek', () => {
        it('should check without recording', () => {
            // Peek should not count
            const peek1 = limiter.peek('test-key');
            expect(peek1.allowed).toBe(true);
            expect(peek1.remaining).toBe(5);

            // Peek again - still the same
            const peek2 = limiter.peek('test-key');
            expect(peek2.remaining).toBe(5);
        });

        it('should reflect recorded requests', () => {
            limiter.check('test-key');
            limiter.check('test-key');

            const peek = limiter.peek('test-key');
            expect(peek.remaining).toBe(3);
        });
    });

    describe('reset', () => {
        it('should reset rate limit for a key', () => {
            // Use up all requests
            for (let i = 0; i < 5; i++) {
                limiter.check('test-key');
            }

            // Reset
            limiter.reset('test-key');

            // Should be allowed again
            const result = limiter.check('test-key');
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(4);
        });
    });

    describe('resetAll', () => {
        it('should reset all keys', () => {
            limiter.check('key1');
            limiter.check('key2');

            limiter.resetAll();

            expect(limiter.peek('key1').remaining).toBe(5);
            expect(limiter.peek('key2').remaining).toBe(5);
        });
    });
});

describe('RateLimiterManager', () => {
    let manager: RateLimiterManager;

    beforeEach(() => {
        vi.useFakeTimers();
        manager = new RateLimiterManager();
    });

    afterEach(() => {
        manager.destroy();
        vi.useRealTimers();
    });

    describe('getLimiter', () => {
        it('should create limiter with default config', () => {
            const limiter = manager.getLimiter('api');
            expect(limiter.getConfig().maxRequests).toBe(DEFAULT_LIMITS.api.maxRequests);
            expect(limiter.getConfig().windowMs).toBe(DEFAULT_LIMITS.api.windowMs);
        });

        it('should return same limiter for same name', () => {
            const limiter1 = manager.getLimiter('api');
            const limiter2 = manager.getLimiter('api');
            expect(limiter1).toBe(limiter2);
        });

        it('should use custom config when provided', () => {
            const limiter = manager.getLimiter('custom', { maxRequests: 10, windowMs: 5000 });
            expect(limiter.getConfig().maxRequests).toBe(10);
            expect(limiter.getConfig().windowMs).toBe(5000);
        });
    });

    describe('check', () => {
        it('should check rate limit for specific limiter', () => {
            const result = manager.check('api', 'user1');
            expect(result.allowed).toBe(true);
        });
    });
});

describe('Singleton functions', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        resetRateLimiterManager();
    });

    afterEach(() => {
        resetRateLimiterManager();
        vi.useRealTimers();
    });

    describe('getRateLimiterManager', () => {
        it('should return singleton instance', () => {
            const manager1 = getRateLimiterManager();
            const manager2 = getRateLimiterManager();
            expect(manager1).toBe(manager2);
        });
    });

    describe('checkApiRateLimit', () => {
        it('should use api limiter', () => {
            const result = checkApiRateLimit('test-key');
            expect(result.allowed).toBe(true);
        });
    });

    describe('checkWriteRateLimit', () => {
        it('should use write limiter', () => {
            const result = checkWriteRateLimit('test-key');
            expect(result.allowed).toBe(true);
        });

        it('should have stricter limits than api', () => {
            // Write limit is 20, API is 100
            expect(DEFAULT_LIMITS.write.maxRequests).toBeLessThan(DEFAULT_LIMITS.api.maxRequests);
        });
    });

    describe('checkSearchRateLimit', () => {
        it('should use search limiter', () => {
            const result = checkSearchRateLimit('test-key');
            expect(result.allowed).toBe(true);
        });
    });
});

describe('DEFAULT_LIMITS', () => {
    it('should have sensible defaults', () => {
        expect(DEFAULT_LIMITS.api.maxRequests).toBeGreaterThan(0);
        expect(DEFAULT_LIMITS.api.windowMs).toBeGreaterThan(0);
        expect(DEFAULT_LIMITS.write.maxRequests).toBeGreaterThan(0);
        expect(DEFAULT_LIMITS.search.maxRequests).toBeGreaterThan(0);
        expect(DEFAULT_LIMITS.heavy.maxRequests).toBeGreaterThan(0);
    });

    it('should have write stricter than api', () => {
        expect(DEFAULT_LIMITS.write.maxRequests).toBeLessThan(DEFAULT_LIMITS.api.maxRequests);
    });

    it('should have heavy stricter than search', () => {
        expect(DEFAULT_LIMITS.heavy.maxRequests).toBeLessThan(DEFAULT_LIMITS.search.maxRequests);
    });
});
