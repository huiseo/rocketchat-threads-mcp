/**
 * LRU Cache Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LRUCache, createCacheKey } from '../utils/cache.js';

describe('LRUCache', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('basic operations', () => {
        it('should set and get values', () => {
            const cache = new LRUCache<string>(10, 60000);
            cache.set('key1', 'value1');
            expect(cache.get('key1')).toBe('value1');
        });

        it('should return undefined for missing keys', () => {
            const cache = new LRUCache<string>(10, 60000);
            expect(cache.get('nonexistent')).toBeUndefined();
        });

        it('should overwrite existing values', () => {
            const cache = new LRUCache<string>(10, 60000);
            cache.set('key1', 'value1');
            cache.set('key1', 'value2');
            expect(cache.get('key1')).toBe('value2');
        });

        it('should delete values', () => {
            const cache = new LRUCache<string>(10, 60000);
            cache.set('key1', 'value1');
            cache.delete('key1');
            expect(cache.get('key1')).toBeUndefined();
        });

        it('should clear all values', () => {
            const cache = new LRUCache<string>(10, 60000);
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            cache.clear();
            expect(cache.get('key1')).toBeUndefined();
            expect(cache.get('key2')).toBeUndefined();
        });
    });

    describe('TTL expiration', () => {
        it('should expire entries after TTL', () => {
            const cache = new LRUCache<string>(10, 1000); // 1 second TTL
            cache.set('key1', 'value1');

            expect(cache.get('key1')).toBe('value1');

            vi.advanceTimersByTime(1001);

            expect(cache.get('key1')).toBeUndefined();
        });

        it('should not expire entries before TTL', () => {
            const cache = new LRUCache<string>(10, 1000);
            cache.set('key1', 'value1');

            vi.advanceTimersByTime(500);

            expect(cache.get('key1')).toBe('value1');
        });
    });

    describe('LRU eviction', () => {
        it('should evict least recently used when full', () => {
            const cache = new LRUCache<string>(3, 60000);
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            cache.set('key3', 'value3');

            // key1 is LRU, should be evicted when key4 is added
            cache.set('key4', 'value4');

            expect(cache.get('key1')).toBeUndefined();
            expect(cache.get('key2')).toBe('value2');
            expect(cache.get('key3')).toBe('value3');
            expect(cache.get('key4')).toBe('value4');
        });

        it('should update LRU order on get', () => {
            const cache = new LRUCache<string>(3, 60000);
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            cache.set('key3', 'value3');

            // Access key1 to make it recently used
            cache.get('key1');

            // key2 is now LRU, should be evicted
            cache.set('key4', 'value4');

            expect(cache.get('key1')).toBe('value1');
            expect(cache.get('key2')).toBeUndefined();
        });
    });

    describe('getStats', () => {
        it('should return correct stats', () => {
            const cache = new LRUCache<string>(10, 5000);
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');

            const stats = cache.getStats();
            expect(stats.size).toBe(2);
            expect(stats.maxSize).toBe(10);
            expect(stats.ttlMs).toBe(5000);
        });
    });
});

describe('createCacheKey', () => {
    it('should create consistent keys for same inputs', () => {
        const key1 = createCacheKey('/api/messages', { roomId: 'GENERAL' });
        const key2 = createCacheKey('/api/messages', { roomId: 'GENERAL' });
        expect(key1).toBe(key2);
    });

    it('should create different keys for different endpoints', () => {
        const key1 = createCacheKey('/api/messages', { roomId: 'GENERAL' });
        const key2 = createCacheKey('/api/channels', { roomId: 'GENERAL' });
        expect(key1).not.toBe(key2);
    });

    it('should create different keys for different params', () => {
        const key1 = createCacheKey('/api/messages', { roomId: 'GENERAL' });
        const key2 = createCacheKey('/api/messages', { roomId: 'OTHER' });
        expect(key1).not.toBe(key2);
    });

    it('should handle empty params', () => {
        const key = createCacheKey('/api/test', {});
        expect(key).toContain('/api/test');
    });
});
