/**
 * Write Guard Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Create mock config that can be modified per test
let mockWriteEnabled = false;
let mockWhitelist: string[] = [];
let mockBlacklist: string[] = [];

vi.mock('../config/config.js', () => ({
    loadConfig: () => ({
        rocketchat: {
            url: 'http://localhost:3000',
            authToken: 'test-token',
            userId: 'test-user'
        },
        write: {
            enabled: mockWriteEnabled,
            mode: mockWhitelist.length > 0 ? 'whitelist' : (mockBlacklist.length > 0 ? 'blacklist' : 'all'),
            rooms: [...mockWhitelist, ...mockBlacklist],
            whitelist: mockWhitelist,
            blacklist: mockBlacklist
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
import { WriteGuard, getWriteGuard, resetWriteGuard } from '../guards/write-guard.js';

describe('WriteGuard', () => {
    beforeEach(() => {
        // Reset mock config to default
        mockWriteEnabled = false;
        mockWhitelist = [];
        mockBlacklist = [];
        resetWriteGuard();
    });

    describe('when write is disabled', () => {
        it('should deny all writes when disabled', () => {
            mockWriteEnabled = false;
            resetWriteGuard();
            const guard = getWriteGuard();
            const result = guard.checkWrite('GENERAL');
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('disabled');
        });

        it('should return disabled status', () => {
            mockWriteEnabled = false;
            resetWriteGuard();
            const guard = getWriteGuard();
            expect(guard.isEnabled()).toBe(false);
        });
    });

    describe('when write is enabled', () => {
        beforeEach(() => {
            mockWriteEnabled = true;
            mockWhitelist = [];
            mockBlacklist = [];
        });

        it('should allow writes to any room when no whitelist/blacklist', () => {
            resetWriteGuard();
            const guard = getWriteGuard();
            const result = guard.checkWrite('GENERAL');
            expect(result.allowed).toBe(true);
        });

        it('should allow writes to whitelisted rooms', () => {
            mockWhitelist = ['GENERAL', 'dev-team'];
            resetWriteGuard();
            const guard = getWriteGuard();

            expect(guard.checkWrite('GENERAL').allowed).toBe(true);
            expect(guard.checkWrite('dev-team').allowed).toBe(true);
            expect(guard.checkWrite('other-room').allowed).toBe(false);
        });

        it('should deny writes to blacklisted rooms', () => {
            mockBlacklist = ['announcements', 'important'];
            resetWriteGuard();
            const guard = getWriteGuard();

            expect(guard.checkWrite('announcements').allowed).toBe(false);
            expect(guard.checkWrite('important').allowed).toBe(false);
            expect(guard.checkWrite('general').allowed).toBe(true);
        });

        it('should check by room name if provided', () => {
            mockWhitelist = ['general'];
            resetWriteGuard();
            const guard = getWriteGuard();

            const result = guard.checkWrite('someRoomId', 'general');
            expect(result.allowed).toBe(true);
        });

        it('should deny room not in whitelist', () => {
            mockWhitelist = ['allowed-room'];
            resetWriteGuard();
            const guard = getWriteGuard();

            const result = guard.checkWrite('not-allowed');
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('not in the whitelist');
        });
    });

    describe('getConfig', () => {
        it('should return correct config when disabled', () => {
            mockWriteEnabled = false;
            resetWriteGuard();
            const guard = getWriteGuard();
            const config = guard.getConfig();

            expect(config.enabled).toBe(false);
            expect(config.whitelist).toHaveLength(0);
            expect(config.blacklist).toHaveLength(0);
        });

        it('should return whitelist when configured', () => {
            mockWriteEnabled = true;
            mockWhitelist = ['room1', 'room2'];
            resetWriteGuard();
            const guard = getWriteGuard();
            const config = guard.getConfig();

            expect(config.enabled).toBe(true);
            expect(config.whitelist).toContain('room1');
            expect(config.whitelist).toContain('room2');
        });

        it('should return blacklist when configured', () => {
            mockWriteEnabled = true;
            mockBlacklist = ['blocked1', 'blocked2'];
            resetWriteGuard();
            const guard = getWriteGuard();
            const config = guard.getConfig();

            expect(config.blacklist).toContain('blocked1');
            expect(config.blacklist).toContain('blocked2');
        });
    });

    describe('isEnabled', () => {
        it('should return true when enabled', () => {
            mockWriteEnabled = true;
            resetWriteGuard();
            const guard = getWriteGuard();
            expect(guard.isEnabled()).toBe(true);
        });

        it('should return false when disabled', () => {
            mockWriteEnabled = false;
            resetWriteGuard();
            const guard = getWriteGuard();
            expect(guard.isEnabled()).toBe(false);
        });
    });

    describe('singleton pattern', () => {
        it('should return same instance', () => {
            mockWriteEnabled = true;
            resetWriteGuard();
            const instance1 = getWriteGuard();
            const instance2 = getWriteGuard();
            expect(instance1).toBe(instance2);
        });

        it('should create new instance after reset', () => {
            mockWriteEnabled = true;
            resetWriteGuard();
            const instance1 = getWriteGuard();
            resetWriteGuard();
            const instance2 = getWriteGuard();
            expect(instance1).not.toBe(instance2);
        });
    });
});
