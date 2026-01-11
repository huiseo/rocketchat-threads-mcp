/**
 * Message Sanitizer Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the config module before importing sanitizer
vi.mock('../config/config.js', () => ({
    loadConfig: () => ({
        rocketchat: {
            url: 'http://localhost:3000',
            authToken: 'test-token',
            userId: 'test-user'
        },
        write: {
            enabled: false,
            mode: 'whitelist',
            rooms: [],
            whitelist: [],
            blacklist: []
        },
        safety: {
            blockMentions: true,
            maxMessageLength: 4000,
            dangerousMentions: ['@all', '@here', '@channel', '@everyone'],
            blockedMentions: ['@all', '@here', '@channel', '@everyone']
        },
        cache: {
            channelsTtl: 300000,
            usersTtl: 1800000,
            maxSize: 500,
            ttl: 300000
        },
        debug: false
    })
}));

// Import after mocking
import { MessageSanitizer, getSanitizer, resetSanitizer } from '../guards/sanitizer.js';

describe('MessageSanitizer', () => {
    beforeEach(() => {
        resetSanitizer();
    });

    describe('sanitize', () => {
        it('should neutralize @all mention', () => {
            const sanitizer = getSanitizer();
            const result = sanitizer.sanitize('Hello @all!');
            expect(result.text).not.toContain('@all');
            expect(result.text).toContain('@\u200Ball'); // Zero-width space inserted
            expect(result.modified).toBe(true);
            expect(result.neutralized).toContain('@all');
        });

        it('should neutralize @here mention', () => {
            const sanitizer = getSanitizer();
            const result = sanitizer.sanitize('Hey @here, check this out');
            expect(result.text).not.toContain('@here');
            expect(result.modified).toBe(true);
            expect(result.neutralized).toContain('@here');
        });

        it('should neutralize @channel mention', () => {
            const sanitizer = getSanitizer();
            const result = sanitizer.sanitize('Attention @channel');
            expect(result.text).not.toContain('@channel');
            expect(result.modified).toBe(true);
            expect(result.neutralized).toContain('@channel');
        });

        it('should neutralize @everyone mention', () => {
            const sanitizer = getSanitizer();
            const result = sanitizer.sanitize('Hello @everyone');
            expect(result.text).not.toContain('@everyone');
            expect(result.modified).toBe(true);
            expect(result.neutralized).toContain('@everyone');
        });

        it('should neutralize multiple mentions', () => {
            const sanitizer = getSanitizer();
            const result = sanitizer.sanitize('@all @here @channel please respond');
            expect(result.neutralized.length).toBe(3);
            expect(result.modified).toBe(true);
        });

        it('should not modify safe text', () => {
            const sanitizer = getSanitizer();
            const result = sanitizer.sanitize('Hello @username, how are you?');
            expect(result.text).toBe('Hello @username, how are you?');
            expect(result.modified).toBe(false);
            expect(result.neutralized).toHaveLength(0);
        });

        it('should handle case insensitive mentions', () => {
            const sanitizer = getSanitizer();
            const result = sanitizer.sanitize('@ALL @Here @CHANNEL');
            expect(result.neutralized.length).toBe(3);
        });

        it('should preserve message structure', () => {
            const sanitizer = getSanitizer();
            const original = 'Line 1\n@all\nLine 3';
            const result = sanitizer.sanitize(original);
            expect(result.text.split('\n').length).toBe(3);
        });

        it('should handle empty string', () => {
            const sanitizer = getSanitizer();
            const result = sanitizer.sanitize('');
            expect(result.text).toBe('');
            expect(result.modified).toBe(false);
        });

        it('should neutralize javascript: URLs', () => {
            const sanitizer = getSanitizer();
            const result = sanitizer.sanitize('Click here: javascript:alert(1)');
            expect(result.text).not.toContain('javascript:');
            expect(result.modified).toBe(true);
            expect(result.neutralized).toContain('javascript:');
        });

        it('should neutralize data: URLs', () => {
            const sanitizer = getSanitizer();
            const result = sanitizer.sanitize('Image: data:text/html,<script>alert(1)</script>');
            expect(result.modified).toBe(true);
            expect(result.neutralized).toContain('data:');
        });
    });

    describe('check', () => {
        it('should detect dangerous patterns without modifying', () => {
            const sanitizer = getSanitizer();
            const result = sanitizer.check('Hello @all!');
            expect(result.hasDangerousPatterns).toBe(true);
            expect(result.patterns).toContain('@all');
        });

        it('should return empty patterns for safe text', () => {
            const sanitizer = getSanitizer();
            const result = sanitizer.check('Hello @username');
            expect(result.hasDangerousPatterns).toBe(false);
            expect(result.patterns).toHaveLength(0);
        });
    });

    describe('getConfig', () => {
        it('should return current configuration', () => {
            const sanitizer = getSanitizer();
            const config = sanitizer.getConfig();
            expect(config.blockMentions).toBe(true);
            expect(config.blockedMentions).toContain('@all');
        });
    });

    describe('singleton pattern', () => {
        it('should return same instance', () => {
            const instance1 = getSanitizer();
            const instance2 = getSanitizer();
            expect(instance1).toBe(instance2);
        });

        it('should create new instance after reset', () => {
            const instance1 = getSanitizer();
            resetSanitizer();
            const instance2 = getSanitizer();
            expect(instance1).not.toBe(instance2);
        });
    });
});
