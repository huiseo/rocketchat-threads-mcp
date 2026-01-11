/**
 * Dependency Injection Container Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the config module
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

import { Container, getContainer, getDependencies, resetContainer } from '../di/container.js';

describe('Container', () => {
    beforeEach(() => {
        resetContainer();
    });

    describe('singleton pattern', () => {
        it('should return the same instance', () => {
            const instance1 = Container.getInstance();
            const instance2 = Container.getInstance();
            expect(instance1).toBe(instance2);
        });

        it('should create new instance after reset', () => {
            const instance1 = Container.getInstance();
            Container.reset();
            const instance2 = Container.getInstance();
            expect(instance1).not.toBe(instance2);
        });
    });

    describe('config', () => {
        it('should provide config', () => {
            const container = getContainer();
            const config = container.config;
            expect(config).toBeDefined();
            expect(config.rocketchat.url).toBe('http://localhost:3000');
        });

        it('should cache config', () => {
            const container = getContainer();
            const config1 = container.config;
            const config2 = container.config;
            expect(config1).toBe(config2);
        });
    });

    describe('client', () => {
        it('should provide client', () => {
            const container = getContainer();
            const client = container.client;
            expect(client).toBeDefined();
        });

        it('should cache client', () => {
            const container = getContainer();
            const client1 = container.client;
            const client2 = container.client;
            expect(client1).toBe(client2);
        });
    });

    describe('writeGuard', () => {
        it('should provide writeGuard', () => {
            const container = getContainer();
            const writeGuard = container.writeGuard;
            expect(writeGuard).toBeDefined();
        });

        it('should cache writeGuard', () => {
            const container = getContainer();
            const guard1 = container.writeGuard;
            const guard2 = container.writeGuard;
            expect(guard1).toBe(guard2);
        });
    });

    describe('sanitizer', () => {
        it('should provide sanitizer', () => {
            const container = getContainer();
            const sanitizer = container.sanitizer;
            expect(sanitizer).toBeDefined();
        });

        it('should cache sanitizer', () => {
            const container = getContainer();
            const san1 = container.sanitizer;
            const san2 = container.sanitizer;
            expect(san1).toBe(san2);
        });
    });

    describe('cache', () => {
        it('should provide cache', () => {
            const container = getContainer();
            const cache = container.cache;
            expect(cache).toBeDefined();
        });

        it('should cache the cache instance', () => {
            const container = getContainer();
            const cache1 = container.cache;
            const cache2 = container.cache;
            expect(cache1).toBe(cache2);
        });
    });

    describe('getDependencies', () => {
        it('should return all dependencies', () => {
            const deps = getDependencies();
            expect(deps.config).toBeDefined();
            expect(deps.client).toBeDefined();
            expect(deps.writeGuard).toBeDefined();
            expect(deps.sanitizer).toBeDefined();
            expect(deps.cache).toBeDefined();
        });
    });

    describe('test container', () => {
        it('should create isolated test container', () => {
            const testContainer = Container.createTestContainer({
                config: {
                    rocketchat: {
                        url: 'http://test:3000',
                        authToken: 'custom-token',
                        userId: 'custom-user'
                    }
                }
            });

            expect(testContainer.config.rocketchat.url).toBe('http://test:3000');
            expect(testContainer.config.rocketchat.authToken).toBe('custom-token');
        });

        it('should not affect singleton instance', () => {
            const mainContainer = getContainer();
            const testContainer = Container.createTestContainer({
                config: {
                    rocketchat: {
                        url: 'http://test:3000',
                        authToken: 'custom-token',
                        userId: 'custom-user'
                    }
                }
            });

            expect(mainContainer.config.rocketchat.url).toBe('http://localhost:3000');
            expect(testContainer.config.rocketchat.url).toBe('http://test:3000');
        });
    });
});
