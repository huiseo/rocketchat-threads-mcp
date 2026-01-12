/**
 * Configuration management for Rocket.Chat MCP
 */

export interface RocketChatConfig {
    url: string;
    authToken: string;
    userId: string;
}

export interface WriteConfig {
    enabled: boolean;
    mode: 'all' | 'whitelist' | 'blacklist';
    rooms: string[];
    whitelist: string[];
    blacklist: string[];
}

export interface SafetyConfig {
    blockMentions: boolean;
    maxMessageLength: number;
    dangerousMentions: string[];
    blockedMentions: string[];
}

export interface CacheConfig {
    channelsTtl: number;
    usersTtl: number;
    maxSize: number;
    ttl: number;
}

export interface Config {
    rocketchat: RocketChatConfig;
    write: WriteConfig;
    safety: SafetyConfig;
    cache: CacheConfig;
    debug: boolean;
}

function parseWriteConfig(): WriteConfig {
    const enabled = process.env.ROCKETCHAT_WRITE_ENABLED || '';
    const rooms = process.env.ROCKETCHAT_WRITE_ROOMS || '';

    if (!enabled || enabled === 'false' || enabled === '0') {
        return {
            enabled: false,
            mode: 'whitelist',
            rooms: [],
            whitelist: [],
            blacklist: []
        };
    }

    if (enabled === 'true' || enabled === '1') {
        if (!rooms) {
            return {
                enabled: true,
                mode: 'all',
                rooms: [],
                whitelist: [],
                blacklist: []
            };
        }

        const roomList = rooms.split(',').map(r => r.trim()).filter(Boolean);
        const isBlacklist = roomList[0]?.startsWith('!');
        const cleanedRooms = roomList.map(r => r.replace(/^!/, ''));

        return {
            enabled: true,
            mode: isBlacklist ? 'blacklist' : 'whitelist',
            rooms: cleanedRooms,
            whitelist: isBlacklist ? [] : cleanedRooms,
            blacklist: isBlacklist ? cleanedRooms : []
        };
    }

    return {
        enabled: false,
        mode: 'whitelist',
        rooms: [],
        whitelist: [],
        blacklist: []
    };
}

export function loadConfig(): Config {
    const url = process.env.ROCKETCHAT_URL;
    const authToken = process.env.ROCKETCHAT_AUTH_TOKEN;
    const userId = process.env.ROCKETCHAT_USER_ID;

    if (!url || !authToken || !userId) {
        throw new Error(
            'Missing required environment variables: ROCKETCHAT_URL, ROCKETCHAT_AUTH_TOKEN, ROCKETCHAT_USER_ID'
        );
    }

    return {
        rocketchat: {
            url: url.replace(/\/$/, ''), // Remove trailing slash
            authToken,
            userId
        },
        write: parseWriteConfig(),
        safety: {
            blockMentions: process.env.ROCKETCHAT_BLOCK_MENTIONS !== 'false',
            maxMessageLength: parseInt(process.env.ROCKETCHAT_MAX_MESSAGE_LENGTH || '4000', 10),
            dangerousMentions: ['@all', '@here', '@channel', '@everyone'],
            blockedMentions: ['@all', '@here', '@channel', '@everyone']
        },
        cache: {
            channelsTtl: parseInt(process.env.ROCKETCHAT_CACHE_TTL_CHANNELS || '300000', 10),
            usersTtl: parseInt(process.env.ROCKETCHAT_CACHE_TTL_USERS || '1800000', 10),
            maxSize: 500,
            ttl: parseInt(process.env.ROCKETCHAT_CACHE_TTL || '300000', 10)
        },
        debug: process.env.DEBUG === 'true'
    };
}

// Lazy config getter - only loads when accessed
let _config: Config | null = null;
export function getConfig(): Config {
    if (!_config) {
        _config = loadConfig();
    }
    return _config;
}

// For backwards compatibility - lazy getter
export const config: Config = new Proxy({} as Config, {
    get(_, prop: keyof Config) {
        return getConfig()[prop];
    }
});
