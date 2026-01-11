/**
 * Message Formatter
 * Transforms Rocket.Chat API responses into MCP-friendly formats
 */

import {
    RocketChatMessage,
    RocketChatRoom,
    RocketChatUser,
    MessageInfo,
    ChannelInfo,
    ThreadInfo,
    UserInfo,
    SearchResultMessage
} from '../api/types.js';

/**
 * Format a single message for MCP response
 * Supports both regular messages and search results with OpenSearch fields
 */
export function formatMessage(msg: RocketChatMessage | SearchResultMessage): MessageInfo {
    const searchMsg = msg as SearchResultMessage;

    const result: MessageInfo = {
        id: msg._id,
        roomId: msg.rid,
        text: msg.msg,
        author: {
            id: msg.u._id,
            username: msg.u.username,
            displayName: msg.u.name
        },
        timestamp: msg.ts,
        threadId: msg.tmid,
        replyCount: msg.tcount,
        lastReplyAt: msg.tlm,
        reactions: msg.reactions
            ? Object.fromEntries(
                Object.entries(msg.reactions).map(([emoji, data]) => [emoji, data.usernames.length])
            )
            : undefined,
        hasAttachments: (msg.attachments?.length || 0) > 0,
        isPinned: msg.pinned || false
    };

    // Add OpenSearch fields if present
    if (searchMsg._highlight) {
        result.highlight = searchMsg._highlight;
    }
    if (searchMsg._score !== undefined) {
        result.score = searchMsg._score;
    }

    return result;
}

/**
 * Format multiple messages
 */
export function formatMessages(messages: RocketChatMessage[]): MessageInfo[] {
    return messages.map(formatMessage);
}

/**
 * Format a channel for MCP response
 */
export function formatChannel(room: RocketChatRoom): ChannelInfo {
    const typeMap: Record<string, ChannelInfo['type']> = {
        'c': 'public',
        'p': 'private',
        'd': 'direct',
        'l': 'livechat'
    };

    return {
        id: room._id,
        name: room.name || room._id,
        displayName: room.fname,
        type: typeMap[room.t] || 'public',
        memberCount: room.usersCount,
        messageCount: room.msgs,
        topic: room.topic,
        description: room.description,
        isReadOnly: room.ro || false,
        lastActivity: room._updatedAt
    };
}

/**
 * Format multiple channels
 */
export function formatChannels(rooms: RocketChatRoom[]): ChannelInfo[] {
    return rooms.map(formatChannel);
}

/**
 * Format a thread for MCP response
 */
export function formatThread(msg: RocketChatMessage, roomName?: string): ThreadInfo {
    // Truncate title to first 100 characters
    const title = msg.msg.length > 100
        ? msg.msg.substring(0, 100) + '...'
        : msg.msg;

    return {
        id: msg._id,
        roomId: msg.rid,
        roomName,
        title,
        author: {
            id: msg.u._id,
            username: msg.u.username,
            displayName: msg.u.name
        },
        createdAt: msg.ts,
        replyCount: msg.tcount || 0,
        lastReplyAt: msg.tlm || msg.ts,
        participants: msg.replies || []
    };
}

/**
 * Format multiple threads
 */
export function formatThreads(messages: RocketChatMessage[], roomName?: string): ThreadInfo[] {
    return messages.map(msg => formatThread(msg, roomName));
}

/**
 * Format a user for MCP response
 */
export function formatUser(user: RocketChatUser): UserInfo {
    return {
        id: user._id,
        username: user.username,
        displayName: user.name,
        email: user.emails?.[0]?.address,
        status: user.status || 'offline',
        roles: user.roles || []
    };
}

/**
 * Format multiple users
 */
export function formatUsers(users: RocketChatUser[]): UserInfo[] {
    return users.map(formatUser);
}

/**
 * Format a thread with its replies for detailed view
 */
export interface ThreadWithReplies {
    thread: ThreadInfo;
    parentMessage: MessageInfo;
    replies: MessageInfo[];
    totalReplies: number;
}

export function formatThreadWithReplies(
    parentMsg: RocketChatMessage,
    replies: RocketChatMessage[],
    roomName?: string
): ThreadWithReplies {
    return {
        thread: formatThread(parentMsg, roomName),
        parentMessage: formatMessage(parentMsg),
        replies: formatMessages(replies),
        totalReplies: parentMsg.tcount || replies.length
    };
}

/**
 * Create a summary of search results
 */
export interface SearchResultSummary {
    query: string;
    totalResults: number;
    channels: number;
    threads: number;
    messages: number;
    timeRange?: {
        oldest: string;
        newest: string;
    };
}

export function createSearchSummary(
    query: string,
    messages: RocketChatMessage[],
    totalResults: number
): SearchResultSummary {
    const timestamps = messages.map(m => new Date(m.ts).getTime());
    const threadIds = new Set(messages.filter(m => m.tmid).map(m => m.tmid));
    const channelIds = new Set(messages.map(m => m.rid));

    return {
        query,
        totalResults,
        channels: channelIds.size,
        threads: threadIds.size,
        messages: messages.length,
        timeRange: messages.length > 0
            ? {
                oldest: new Date(Math.min(...timestamps)).toISOString(),
                newest: new Date(Math.max(...timestamps)).toISOString()
            }
            : undefined
    };
}
