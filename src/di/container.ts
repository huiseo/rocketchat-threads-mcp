/**
 * Dependency Injection Container
 * Provides centralized management of singleton instances with support for testing
 */

import { RocketChatClient } from '../api/client.js';
import { WriteGuard } from '../guards/write-guard.js';
import { MessageSanitizer } from '../guards/sanitizer.js';
import { LRUCache } from '../utils/cache.js';
import { loadConfig, Config } from '../config/config.js';

/**
 * Dependencies interface - all injectable services
 */
export interface Dependencies {
    config: Config;
    client: RocketChatClient;
    writeGuard: WriteGuard;
    sanitizer: MessageSanitizer;
    cache: LRUCache<unknown>;
}

/**
 * Container options for customizing behavior
 */
export interface ContainerOptions {
    /** Custom config to use instead of environment-based config */
    config?: Partial<Config>;
    /** Custom client instance */
    client?: RocketChatClient;
    /** Custom write guard instance */
    writeGuard?: WriteGuard;
    /** Custom sanitizer instance */
    sanitizer?: MessageSanitizer;
    /** Custom cache instance */
    cache?: LRUCache<unknown>;
}

/**
 * Dependency Injection Container
 * Manages singleton instances and allows for dependency overrides in tests
 */
export class Container {
    private static instance: Container | null = null;
    private _config: Config | null = null;
    private _client: RocketChatClient | null = null;
    private _writeGuard: WriteGuard | null = null;
    private _sanitizer: MessageSanitizer | null = null;
    private _cache: LRUCache<unknown> | null = null;
    private options: ContainerOptions;

    private constructor(options: ContainerOptions = {}) {
        this.options = options;
    }

    /**
     * Get the singleton container instance
     */
    static getInstance(options?: ContainerOptions): Container {
        if (!Container.instance) {
            Container.instance = new Container(options);
        }
        return Container.instance;
    }

    /**
     * Reset the container (useful for testing)
     */
    static reset(): void {
        Container.instance = null;
    }

    /**
     * Create a new container with custom options (useful for testing)
     */
    static createTestContainer(options: ContainerOptions): Container {
        return new Container(options);
    }

    /**
     * Get the configuration
     */
    get config(): Config {
        if (!this._config) {
            if (this.options.config) {
                // Merge with defaults
                const baseConfig = this.safeLoadConfig();
                this._config = {
                    ...baseConfig,
                    ...this.options.config,
                    rocketchat: {
                        ...baseConfig.rocketchat,
                        ...this.options.config.rocketchat
                    },
                    write: {
                        ...baseConfig.write,
                        ...this.options.config.write
                    },
                    safety: {
                        ...baseConfig.safety,
                        ...this.options.config.safety
                    },
                    cache: {
                        ...baseConfig.cache,
                        ...this.options.config.cache
                    }
                };
            } else {
                this._config = loadConfig();
            }
        }
        return this._config;
    }

    /**
     * Safely load config with fallback for testing
     */
    private safeLoadConfig(): Config {
        try {
            return loadConfig();
        } catch {
            // Return minimal config for testing
            return {
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
            };
        }
    }

    /**
     * Get the RocketChat client
     */
    get client(): RocketChatClient {
        if (!this._client) {
            if (this.options.client) {
                this._client = this.options.client;
            } else {
                this._client = new RocketChatClient(this.config.rocketchat);
            }
        }
        return this._client;
    }

    /**
     * Get the write guard
     */
    get writeGuard(): WriteGuard {
        if (!this._writeGuard) {
            if (this.options.writeGuard) {
                this._writeGuard = this.options.writeGuard;
            } else {
                this._writeGuard = new WriteGuard();
            }
        }
        return this._writeGuard;
    }

    /**
     * Get the sanitizer
     */
    get sanitizer(): MessageSanitizer {
        if (!this._sanitizer) {
            if (this.options.sanitizer) {
                this._sanitizer = this.options.sanitizer;
            } else {
                this._sanitizer = new MessageSanitizer();
            }
        }
        return this._sanitizer;
    }

    /**
     * Get the cache
     */
    get cache(): LRUCache<unknown> {
        if (!this._cache) {
            if (this.options.cache) {
                this._cache = this.options.cache;
            } else {
                const cacheConfig = this.config.cache;
                this._cache = new LRUCache(cacheConfig.maxSize, cacheConfig.ttl);
            }
        }
        return this._cache;
    }

    /**
     * Get all dependencies as an object
     */
    getDependencies(): Dependencies {
        return {
            config: this.config,
            client: this.client,
            writeGuard: this.writeGuard,
            sanitizer: this.sanitizer,
            cache: this.cache
        };
    }
}

/**
 * Convenience function to get the container
 */
export function getContainer(): Container {
    return Container.getInstance();
}

/**
 * Convenience function to get all dependencies
 */
export function getDependencies(): Dependencies {
    return getContainer().getDependencies();
}

/**
 * Reset the container (for testing)
 */
export function resetContainer(): void {
    Container.reset();
}
