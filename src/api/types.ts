/**
 * Rocket.Chat API Type Definitions
 * Based on Rocket.Chat REST API v1
 */

// ============================================
// Common Types
// ============================================

export interface RocketChatUser {
    _id: string;
    username: string;
    name?: string;
    status?: 'online' | 'away' | 'busy' | 'offline';
    emails?: Array<{ address: string; verified: boolean }>;
    roles?: string[];
}

export interface RocketChatRoom {
    _id: string;
    name?: string;
    fname?: string;  // Display name
    t: 'c' | 'p' | 'd' | 'l';  // channel, private, direct, livechat
    msgs: number;
    usersCount: number;
    u: { _id: string; username: string };
    ts: string;
    ro?: boolean;  // read-only
    default?: boolean;
    topic?: string;
    description?: string;
    announcement?: string;
    _updatedAt: string;
    lastMessage?: RocketChatMessage;
}

export interface RocketChatMessage {
    _id: string;
    rid: string;  // Room ID
    msg: string;
    ts: string;
    u: { _id: string; username: string; name?: string };
    _updatedAt: string;
    mentions?: Array<{ _id: string; username: string }>;
    channels?: Array<{ _id: string; name: string }>;
    urls?: Array<{ url: string; meta?: Record<string, string> }>;
    attachments?: RocketChatAttachment[];
    reactions?: Record<string, { usernames: string[] }>;
    starred?: Array<{ _id: string }>;
    pinned?: boolean;
    editedAt?: string;
    editedBy?: { _id: string; username: string };

    // Thread-related fields
    tmid?: string;  // Thread parent message ID
    tcount?: number;  // Thread reply count
    tlm?: string;  // Thread last message timestamp
    replies?: string[];  // User IDs who replied
}

export interface RocketChatAttachment {
    color?: string;
    text?: string;
    ts?: string;
    thumb_url?: string;
    message_link?: string;
    collapsed?: boolean;
    author_name?: string;
    author_link?: string;
    author_icon?: string;
    title?: string;
    title_link?: string;
    title_link_download?: boolean;
    image_url?: string;
    audio_url?: string;
    video_url?: string;
    fields?: Array<{ short?: boolean; title: string; value: string }>;
}

// ============================================
// API Request Types
// ============================================

export interface GetMessagesParams {
    roomId: string;
    count?: number;
    offset?: number;
    sort?: Record<string, 1 | -1>;
    query?: Record<string, unknown>;
}

export interface GetThreadMessagesParams {
    tmid: string;  // Thread parent message ID
    count?: number;
    offset?: number;
}

export interface SearchMessagesParams {
    roomId?: string;  // Optional for global search (OpenSearch integration)
    searchText: string;
    count?: number;
    offset?: number;
}

export interface SendMessageParams {
    roomId: string;
    text: string;
    tmid?: string;  // Thread parent message ID (for replies)
    alias?: string;
    emoji?: string;
    avatar?: string;
}

export interface GetRoomsParams {
    type?: 'c' | 'p' | 'd';  // channel, private, direct
    count?: number;
    offset?: number;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
    success: boolean;
    error?: string;
    errorType?: string;
    data?: T;
}

export interface PaginatedResponse<T> {
    success: boolean;
    items: T[];
    count: number;
    offset: number;
    total: number;
}

export interface ChannelsListResponse {
    channels: RocketChatRoom[];
    count: number;
    offset: number;
    total: number;
    success: boolean;
}

export interface MessagesResponse {
    messages: RocketChatMessage[];
    count: number;
    offset: number;
    total: number;
    success: boolean;
}

export interface ThreadsListResponse {
    threads: RocketChatMessage[];
    count: number;
    offset: number;
    total: number;
    success: boolean;
}

export interface UsersListResponse {
    users: RocketChatUser[];
    count: number;
    offset: number;
    total: number;
    success: boolean;
}

export interface UserInfoResponse {
    user: RocketChatUser;
    success: boolean;
}

// /me endpoint returns user data directly at root level
export interface MeResponse extends RocketChatUser {
    success: boolean;
}

export interface SendMessageResponse {
    message: RocketChatMessage;
    success: boolean;
}

// ============================================
// MCP Tool Response Types
// ============================================

export interface ChannelInfo {
    id: string;
    name: string;
    displayName?: string;
    type: 'public' | 'private' | 'direct' | 'livechat';
    memberCount: number;
    messageCount: number;
    topic?: string;
    description?: string;
    isReadOnly: boolean;
    lastActivity?: string;
}

export interface MessageInfo {
    id: string;
    roomId: string;
    text: string;
    author: {
        id: string;
        username: string;
        displayName?: string;
    };
    timestamp: string;
    threadId?: string;
    replyCount?: number;
    lastReplyAt?: string;
    reactions?: Record<string, number>;
    hasAttachments: boolean;
    isPinned: boolean;
    /** Highlighted text snippet from OpenSearch (with <em> tags) */
    highlight?: string;
    /** Relevance score from OpenSearch */
    score?: number | null;
}

export interface ThreadInfo {
    id: string;
    roomId: string;
    roomName?: string;
    title: string;  // First message text (truncated)
    author: {
        id: string;
        username: string;
        displayName?: string;
    };
    createdAt: string;
    replyCount: number;
    lastReplyAt: string;
    participants: string[];
}

export interface UserInfo {
    id: string;
    username: string;
    displayName?: string;
    email?: string;
    status: 'online' | 'away' | 'busy' | 'offline';
    roles: string[];
}

// ============================================
// OpenSearch Integration Types
// ============================================

/**
 * Metadata indicating data source (from OpenSearch proxy)
 */
export interface ProxyMetadata {
    source: 'opensearch' | 'rocketchat' | 'none';
    opensearch_available: boolean;
    filtered_client_side?: boolean;
    global_search_enabled?: boolean;
}

/**
 * Extended message with OpenSearch fields
 */
export interface SearchResultMessage extends RocketChatMessage {
    /** Relevance score from OpenSearch (null if not available) */
    _score?: number | null;
    /** Highlighted text snippet with <em> tags */
    _highlight?: string;
}

/**
 * Extended response with metadata
 */
export interface SearchMessagesResponse extends MessagesResponse {
    messages: SearchResultMessage[];
    _metadata?: ProxyMetadata;
}
