/**
 * Time Parser Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseTimeExpression, toRocketChatTimestamp, formatDate, timeAgo } from '../utils/time-parser.js';

describe('parseTimeExpression', () => {
    beforeEach(() => {
        // Mock current time to 2026-01-11T12:00:00.000Z
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-11T12:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('relative time expressions', () => {
        it('should parse "1d" starting from today midnight', () => {
            const result = parseTimeExpression('1d');
            // 1d means today (from midnight), oldest should be start of today
            const startOfToday = new Date(2026, 0, 11, 0, 0, 0, 0);
            expect(result.oldest.getDate()).toBe(startOfToday.getDate());
            expect(result.latest.getTime()).toBeGreaterThan(result.oldest.getTime());
        });

        it('should parse "7d" as 6 days before today midnight', () => {
            const result = parseTimeExpression('7d');
            // 7d = startOfToday - (7-1)*24h = 6 days before today's midnight
            const startOfToday = new Date(2026, 0, 11, 0, 0, 0, 0);
            const expectedOldest = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
            expect(result.oldest.getDate()).toBe(expectedOldest.getDate());
        });

        it('should parse "1w" as 6 days before today midnight', () => {
            const result = parseTimeExpression('1w');
            // 1w = startOfToday - (1*7-1)*24h = 6 days before today's midnight
            const startOfToday = new Date(2026, 0, 11, 0, 0, 0, 0);
            const expectedOldest = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
            expect(result.oldest.getDate()).toBe(expectedOldest.getDate());
        });

        it('should parse "2w" as 13 days before today midnight', () => {
            const result = parseTimeExpression('2w');
            // 2w = startOfToday - (2*7-1)*24h = 13 days before today's midnight
            const startOfToday = new Date(2026, 0, 11, 0, 0, 0, 0);
            const expectedOldest = new Date(startOfToday.getTime() - 13 * 24 * 60 * 60 * 1000);
            expect(result.oldest.getDate()).toBe(expectedOldest.getDate());
        });

        it('should parse "1m" as 1 month before today', () => {
            const result = parseTimeExpression('1m');
            // 1m = one month before start of today
            expect(result.oldest.getMonth()).toBe(11); // December 2025
        });

        it('should have start and end aliases for oldest and latest', () => {
            const result = parseTimeExpression('1d');
            expect(result.start).toBe(result.oldest);
            expect(result.end).toBe(result.latest);
        });
    });

    describe('ISO date expressions', () => {
        it('should parse ISO date string', () => {
            const result = parseTimeExpression('2026-01-01');
            expect(result.oldest.toISOString()).toContain('2026-01-01');
            expect(result.latest.getTime()).toBeGreaterThan(result.oldest.getTime());
        });

        it('should handle end of year date', () => {
            const result = parseTimeExpression('2025-12-31');
            expect(result.oldest.getFullYear()).toBe(2025);
            expect(result.oldest.getMonth()).toBe(11); // December
        });
    });

    describe('Unix timestamp (10 digits)', () => {
        it('should parse 10-digit Unix timestamp in seconds', () => {
            const timestamp = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000);
            const result = parseTimeExpression(String(timestamp));
            expect(result.oldest.getFullYear()).toBe(2026);
            expect(result.oldest.getMonth()).toBe(0); // January
        });

        it('should not parse 13-digit millisecond timestamp', () => {
            const timestamp = new Date('2026-01-01').getTime(); // 13 digits
            expect(() => parseTimeExpression(String(timestamp))).toThrow();
        });
    });

    describe('error handling', () => {
        it('should throw on invalid expression', () => {
            expect(() => parseTimeExpression('invalid')).toThrow();
        });

        it('should throw on empty string', () => {
            expect(() => parseTimeExpression('')).toThrow();
        });

        it('should throw on negative duration', () => {
            expect(() => parseTimeExpression('-1d')).toThrow();
        });

        it('should throw error with helpful message', () => {
            expect(() => parseTimeExpression('abc')).toThrow(/Invalid time expression/);
        });
    });
});

describe('toRocketChatTimestamp', () => {
    it('should convert Date to ISO string', () => {
        const date = new Date('2026-01-11T12:00:00.000Z');
        const result = toRocketChatTimestamp(date);
        expect(result).toBe('2026-01-11T12:00:00.000Z');
    });
});

describe('formatDate', () => {
    it('should format date without T separator', () => {
        const date = new Date('2026-01-11T12:30:45.000Z');
        const result = formatDate(date);
        expect(result).toBe('2026-01-11 12:30:45');
    });

    it('should not include milliseconds', () => {
        const date = new Date('2026-01-11T12:30:45.123Z');
        const result = formatDate(date);
        expect(result).not.toContain('123');
    });
});

describe('timeAgo', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-11T12:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should return "just now" for very recent times', () => {
        const date = new Date('2026-01-11T11:59:30.000Z');
        expect(timeAgo(date)).toBe('just now');
    });

    it('should return minutes ago', () => {
        const date = new Date('2026-01-11T11:55:00.000Z');
        expect(timeAgo(date)).toBe('5m ago');
    });

    it('should return hours ago', () => {
        const date = new Date('2026-01-11T09:00:00.000Z');
        expect(timeAgo(date)).toBe('3h ago');
    });

    it('should return days ago', () => {
        const date = new Date('2026-01-09T12:00:00.000Z');
        expect(timeAgo(date)).toBe('2d ago');
    });

    it('should return formatted date for older times', () => {
        const date = new Date('2026-01-01T12:00:00.000Z');
        expect(timeAgo(date)).toContain('2026-01-01');
    });
});
