/**
 * Rocket.Chat API Client
 * Handles all HTTP communication with Rocket.Chat server
 */

import { loadConfig, RocketChatConfig } from '../config/config.js';
import { LRUCache, createCacheKey } from '../utils/cache.js';
import {
    ApiResponse,
    ChannelsListResponse,
    MessagesResponse,
    ThreadsListResponse,
    UserInfoResponse,
    UsersListResponse,
    SendMessageResponse,
    RocketChatMessage,
    RocketChatRoom,
    GetMessagesParams,
    GetThreadMessagesParams,
    SearchMessagesParams,
    SendMessageParams,
    GetRoomsParams,
    MeResponse
} from './types.js';

export class RocketChatClient {
    private baseUrl: string;
    private authToken: string;
    private userId: string;
    private cache: LRUCache<unknown>;

    constructor(config?: RocketChatConfig) {
        const cfg = config || loadConfig().rocketchat;
        this.baseUrl = cfg.url.replace(/\/$/, '');
        this.authToken = cfg.authToken;
        this.userId = cfg.userId;

        const cacheConfig = loadConfig().cache;
        this.cache = new LRUCache(cacheConfig.maxSize, cacheConfig.ttl);
    }

    /**
     * Make authenticated API request
     */
    private async request<T>(
        method: 'GET' | 'POST' | 'PUT' | 'DELETE',
        endpoint: string,
        params?: Record<string, unknown>,
        useCache: boolean = false
    ): Promise<T> {
        const url = new URL(`/api/v1${endpoint}`, this.baseUrl);

        // For GET requests, add query parameters
        if (method === 'GET' && params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    url.searchParams.append(key, String(value));
                }
            });
        }

        // Check cache for GET requests
        const cacheKey = createCacheKey(endpoint, params || {});
        if (method === 'GET' && useCache) {
            const cached = this.cache.get(cacheKey);
            if (cached) {
                return cached as T;
            }
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Auth-Token': this.authToken,
            'X-User-Id': this.userId
        };

        const fetchOptions: RequestInit = {
            method,
            headers
        };

        if (method !== 'GET' && params) {
            fetchOptions.body = JSON.stringify(params);
        }

        const response = await fetch(url.toString(), fetchOptions);

        if (!response.ok) {
            const errorBody = await response.text();
            throw new RocketChatApiError(
                `API request failed: ${response.status} ${response.statusText}`,
                response.status,
                errorBody
            );
        }

        const data = await response.json() as T;

        // Cache successful GET responses
        if (method === 'GET' && useCache) {
            this.cache.set(cacheKey, data);
        }

        return data;
    }

    // ============================================
    // Channel Methods
    // ============================================

    /**
     * List channels (public and joined)
     */
    async listChannels(params?: GetRoomsParams): Promise<ChannelsListResponse> {
        return this.request<ChannelsListResponse>('GET', '/channels.list', {
            count: params?.count || 50,
            offset: params?.offset || 0
        }, true);
    }

    /**
     * List joined channels
     */
    async listJoinedChannels(params?: GetRoomsParams): Promise<ChannelsListResponse> {
        return this.request<ChannelsListResponse>('GET', '/channels.list.joined', {
            count: params?.count || 50,
            offset: params?.offset || 0
        }, true);
    }

    /**
     * Get channel info by ID or name
     */
    async getChannelInfo(roomId?: string, roomName?: string): Promise<{ channel: RocketChatRoom; success: boolean }> {
        const params: Record<string, string> = {};
        if (roomId) params.roomId = roomId;
        if (roomName) params.roomName = roomName;

        return this.request('GET', '/channels.info', params, true);
    }

    /**
     * Search channels by name
     */
    async searchChannels(query: string): Promise<{ channels: RocketChatRoom[]; success: boolean }> {
        return this.request('GET', '/channels.list', {
            query: JSON.stringify({ name: { $regex: query, $options: 'i' } })
        }, true);
    }

    // ============================================
    // Message Methods
    // ============================================

    /**
     * Get messages from a channel
     */
    async getMessages(params: GetMessagesParams): Promise<MessagesResponse> {
        return this.request<MessagesResponse>('GET', '/channels.messages', {
            roomId: params.roomId,
            count: params.count || 50,
            offset: params.offset || 0,
            sort: params.sort ? JSON.stringify(params.sort) : undefined,
            query: params.query ? JSON.stringify(params.query) : undefined
        });
    }

    /**
     * Search messages in a channel or globally
     * When roomId is omitted, performs global search (requires OpenSearch integration)
     */
    async searchMessages(params: SearchMessagesParams): Promise<MessagesResponse> {
        const requestParams: Record<string, unknown> = {
            searchText: params.searchText,
            count: params.count || 50,
            offset: params.offset || 0
        };

        // Only include roomId if provided (enables global search when omitted)
        if (params.roomId) {
            requestParams.roomId = params.roomId;
        }

        return this.request<MessagesResponse>('GET', '/chat.search', requestParams);
    }

    /**
     * Get a specific message by ID
     */
    async getMessage(messageId: string): Promise<{ message: RocketChatMessage; success: boolean }> {
        return this.request('GET', '/chat.getMessage', { msgId: messageId });
    }

    // ============================================
    // Thread Methods
    // ============================================

    /**
     * List threads in a channel
     */
    async listThreads(roomId: string, count?: number, offset?: number): Promise<ThreadsListResponse> {
        return this.request<ThreadsListResponse>('GET', '/chat.getThreadsList', {
            rid: roomId,
            count: count || 50,
            offset: offset || 0
        });
    }

    /**
     * Get thread messages (replies)
     */
    async getThreadMessages(params: GetThreadMessagesParams): Promise<MessagesResponse> {
        return this.request<MessagesResponse>('GET', '/chat.getThreadMessages', {
            tmid: params.tmid,
            count: params.count || 50,
            offset: params.offset || 0
        });
    }

    /**
     * Get thread parent message
     */
    async getThreadParent(tmid: string): Promise<{ message: RocketChatMessage; success: boolean }> {
        return this.getMessage(tmid);
    }

    // ============================================
    // User Methods
    // ============================================

    /**
     * Get user info by ID or username
     */
    async getUserInfo(userId?: string, username?: string): Promise<UserInfoResponse> {
        const params: Record<string, string> = {};
        if (userId) params.userId = userId;
        if (username) params.username = username;

        return this.request<UserInfoResponse>('GET', '/users.info', params, true);
    }

    /**
     * List users
     */
    async listUsers(count?: number, offset?: number): Promise<UsersListResponse> {
        return this.request<UsersListResponse>('GET', '/users.list', {
            count: count || 50,
            offset: offset || 0
        }, true);
    }

    /**
     * Get current user (me)
     * Note: /me endpoint returns user data directly, not wrapped in { user: ... }
     */
    async getMe(): Promise<UserInfoResponse> {
        const response = await this.request<MeResponse>('GET', '/me', {}, true);
        // Transform MeResponse to UserInfoResponse format
        return {
            success: response.success,
            user: {
                _id: response._id,
                username: response.username,
                name: response.name,
                status: response.status,
                emails: response.emails,
                roles: response.roles
            }
        };
    }

    // ============================================
    // Write Methods
    // ============================================

    /**
     * Send a message to a channel
     */
    async sendMessage(params: SendMessageParams): Promise<SendMessageResponse> {
        return this.request<SendMessageResponse>('POST', '/chat.postMessage', {
            roomId: params.roomId,
            text: params.text,
            tmid: params.tmid,
            alias: params.alias,
            emoji: params.emoji,
            avatar: params.avatar
        });
    }

    /**
     * React to a message
     */
    async reactToMessage(messageId: string, emoji: string): Promise<ApiResponse<void>> {
        return this.request<ApiResponse<void>>('POST', '/chat.react', {
            messageId,
            emoji
        });
    }

    // ============================================
    // Utility Methods
    // ============================================

    /**
     * Test connection to Rocket.Chat server
     */
    async testConnection(): Promise<boolean> {
        try {
            await this.getMe();
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; maxSize: number; ttlMs: number } {
        return this.cache.getStats();
    }
}

/**
 * Custom error class for API errors
 */
export class RocketChatApiError extends Error {
    public readonly statusCode: number;
    public readonly responseBody: string;

    constructor(message: string, statusCode: number, responseBody: string) {
        super(message);
        this.name = 'RocketChatApiError';
        this.statusCode = statusCode;
        this.responseBody = responseBody;
    }

    toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            message: this.message,
            statusCode: this.statusCode,
            responseBody: this.responseBody
        };
    }
}

// Singleton instance
let clientInstance: RocketChatClient | null = null;

export function getClient(): RocketChatClient {
    if (!clientInstance) {
        clientInstance = new RocketChatClient();
    }
    return clientInstance;
}

export function resetClient(): void {
    clientInstance = null;
}
