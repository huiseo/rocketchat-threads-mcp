/**
 * Token Counter Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { TokenCounter } from '../utils/token-counter.js';

describe('TokenCounter', () => {
    describe('estimateTokens', () => {
        it('should estimate tokens for simple string', () => {
            const tokens = TokenCounter.estimateTokens('Hello world');
            expect(tokens).toBeGreaterThan(0);
            // "Hello world" = 11 chars, ~3 tokens (11/4 = 2.75, ceil = 3)
            expect(tokens).toBe(3);
        });

        it('should estimate based on character length', () => {
            // 1 token ≈ 4 characters
            const text = 'A'.repeat(100);
            const tokens = TokenCounter.estimateTokens(text);
            expect(tokens).toBe(25); // 100 / 4 = 25
        });

        it('should return 0 for empty string', () => {
            const tokens = TokenCounter.estimateTokens('');
            expect(tokens).toBe(0);
        });

        it('should handle long strings', () => {
            const text = 'A'.repeat(10000);
            const tokens = TokenCounter.estimateTokens(text);
            expect(tokens).toBe(2500); // 10000 / 4 = 2500
        });
    });

    describe('wouldExceedLimit', () => {
        it('should return false for short text', () => {
            const text = 'Hello world';
            expect(TokenCounter.wouldExceedLimit(text)).toBe(false);
        });

        it('should return true for very long text', () => {
            const text = 'A'.repeat(100000); // Over the limit
            expect(TokenCounter.wouldExceedLimit(text)).toBe(true);
        });

        it('should account for safety buffer', () => {
            // Max is 100000, safety buffer is 4000, so limit is 96000
            const justUnder = 'A'.repeat(95999);
            const justOver = 'A'.repeat(96001);
            expect(TokenCounter.wouldExceedLimit(justUnder)).toBe(false);
            expect(TokenCounter.wouldExceedLimit(justOver)).toBe(true);
        });
    });

    describe('getMaxSafeChars', () => {
        it('should return max chars minus safety buffer', () => {
            const maxSafe = TokenCounter.getMaxSafeChars();
            expect(maxSafe).toBe(96000); // 100000 - 4000
        });
    });

    describe('getSafeItemLimit', () => {
        it('should calculate safe item limit based on sample size', () => {
            const sampleItem = { id: 1, text: 'Hello' };
            const limit = TokenCounter.getSafeItemLimit(sampleItem);
            expect(limit).toBeGreaterThan(0);
            expect(limit).toBeLessThanOrEqual(100); // Max items cap
        });

        it('should respect maxItems parameter', () => {
            const sampleItem = { id: 1 };
            const limit = TokenCounter.getSafeItemLimit(sampleItem, 50);
            expect(limit).toBeLessThanOrEqual(50);
        });

        it('should return lower limit for larger items', () => {
            const smallItem = { id: 1 };
            const largeItem = { id: 1, text: 'A'.repeat(1000) };

            const smallLimit = TokenCounter.getSafeItemLimit(smallItem);
            const largeLimit = TokenCounter.getSafeItemLimit(largeItem);

            expect(largeLimit).toBeLessThan(smallLimit);
        });
    });

    describe('truncateToFit', () => {
        it('should return all items if under limit', () => {
            const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
            const result = TokenCounter.truncateToFit(items);
            expect(result.items).toHaveLength(3);
            expect(result.truncated).toBe(false);
            expect(result.originalCount).toBe(3);
        });

        it('should truncate items if over limit', () => {
            // Create items that would exceed the limit
            const items = Array.from({ length: 10000 }, (_, i) => ({
                id: i,
                text: 'A'.repeat(100)
            }));
            const result = TokenCounter.truncateToFit(items);
            expect(result.items.length).toBeLessThan(10000);
            expect(result.truncated).toBe(true);
            expect(result.originalCount).toBe(10000);
        });

        it('should return empty array for empty input', () => {
            const result = TokenCounter.truncateToFit([]);
            expect(result.items).toHaveLength(0);
            expect(result.truncated).toBe(false);
            expect(result.originalCount).toBe(0);
        });

        it('should use custom stringify function', () => {
            const items = [{ a: 1 }, { a: 2 }];
            const result = TokenCounter.truncateToFit(items, (item) => String(item.a));
            expect(result.items).toHaveLength(2);
            expect(result.truncated).toBe(false);
        });

        it('should use JSON.stringify by default', () => {
            const items = [{ id: 1 }];
            const result = TokenCounter.truncateToFit(items);
            expect(result.truncated).toBe(false);
        });
    });

    describe('truncateText', () => {
        it('should not truncate short text', () => {
            const result = TokenCounter.truncateText('Hello world');
            expect(result.text).toBe('Hello world');
            expect(result.truncated).toBe(false);
        });

        it('should truncate long text', () => {
            const longText = 'A'.repeat(100000);
            const result = TokenCounter.truncateText(longText);
            expect(result.text.length).toBeLessThan(100000);
            expect(result.truncated).toBe(true);
            expect(result.text).toContain('[truncated]');
        });

        it('should respect custom maxChars', () => {
            const text = 'Hello world, this is a test';
            const result = TokenCounter.truncateText(text, 15);
            expect(result.text.length).toBeLessThanOrEqual(15);
            expect(result.truncated).toBe(true);
        });

        it('should add truncation marker', () => {
            const text = 'A'.repeat(100);
            const result = TokenCounter.truncateText(text, 50);
            expect(result.text).toContain('...');
            expect(result.text).toContain('[truncated]');
        });
    });
});
