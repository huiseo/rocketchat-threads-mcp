/**
 * Channel Tools
 * Tools for listing and searching channels
 */

import { z } from 'zod';
import { getClient } from '../api/client.js';
import { formatChannels, formatActiveRoom } from '../formatters/message-formatter.js';
import { buildSuccessResponse, buildPaginatedResponse } from '../formatters/response-builder.js';
import { TokenCounter } from '../utils/token-counter.js';
import { parseTimeExpression } from '../utils/time-parser.js';
import {
    defineTool,
    createToolResult,
    createErrorResult,
    createErrorResultFromException,
    ErrorCodes,
    toolRegistry
} from './base.js';

/**
 * rocketchat_list_channels
 * List all accessible channels with pagination
 */
const listChannelsSchema = z.object({
    limit: z.number().min(1).max(100).default(50).optional()
        .describe('Maximum number of channels to return (1-100, default: 50)'),
    offset: z.number().min(0).default(0).optional()
        .describe('Number of channels to skip for pagination'),
    type: z.enum(['all', 'joined']).default('joined').optional()
        .describe('Filter: "all" for all public channels, "joined" for only joined channels')
});

export const listChannelsTool = defineTool(
    'rocketchat_list_channels',
    `List all accessible Rocket.Chat channels.

**START HERE** - Use this tool first to discover available channels and get their IDs.

Returns channel information including:
- Channel ID and name (use ID for other API calls)
- Type (public/private/direct)
- Member count and message count
- Topic and description
- Last activity timestamp

**Typical Workflow:**
1. rocketchat_list_channels → Get channel IDs
2. rocketchat_get_messages or rocketchat_list_threads → Read content
3. rocketchat_search_messages or rocketchat_search_threads → Find specific content

**Performance Tips:**
- Default "joined" type is faster than "all"
- Use pagination (offset) for large channel lists

**No special requirements** - Works without OpenSearch.

Examples:
- List joined channels: {}
- List all public channels: { "type": "all" }
- Paginate results: { "limit": 20, "offset": 40 }`,
    listChannelsSchema,
    async (params) => {
        try {
            const client = getClient();
            const limit = params.limit || 50;
            const offset = params.offset || 0;

            const response = params.type === 'all'
                ? await client.listChannels({ count: limit, offset })
                : await client.listJoinedChannels({ count: limit, offset });

            if (!response.success) {
                return createErrorResult(ErrorCodes.API_ERROR, 'Failed to list channels');
            }

            const formatted = formatChannels(response.channels);
            const { items, truncated } = TokenCounter.truncateToFit(formatted);

            const result = buildPaginatedResponse(items, response.total, offset, truncated);
            return createToolResult(result);
        } catch (error) {
            return createErrorResultFromException(ErrorCodes.API_ERROR, 'Failed to list channels', error);
        }
    }
);

/**
 * rocketchat_search_channels
 * Search channels by name or topic
 */
const searchChannelsSchema = z.object({
    query: z.string().min(1)
        .describe('Search query to match against channel names and topics'),
    limit: z.number().min(1).max(50).default(20).optional()
        .describe('Maximum number of results (1-50, default: 20)')
});

export const searchChannelsTool = defineTool(
    'rocketchat_search_channels',
    `Search for Rocket.Chat channels by name or topic.

Use this to find specific channels when you know part of the name.

Examples:
- Find project channels: { "query": "project" }
- Find channels by topic: { "query": "support" }`,
    searchChannelsSchema,
    async (params) => {
        try {
            const client = getClient();

            const response = await client.searchChannels(params.query);

            if (!response.success) {
                return createErrorResult(ErrorCodes.API_ERROR, 'Failed to search channels');
            }

            const formatted = formatChannels(response.channels);
            const limited = formatted.slice(0, params.limit || 20);

            const result = buildSuccessResponse(limited, {
                count: limited.length,
                total: response.channels.length
            });
            return createToolResult(result);
        } catch (error) {
            return createErrorResultFromException(ErrorCodes.API_ERROR, 'Failed to search channels', error);
        }
    }
);

/**
 * rocketchat_get_channel_info
 * Get detailed information about a specific channel
 */
const getChannelInfoSchema = z.object({
    roomId: z.string().optional()
        .describe('Channel ID (provide either roomId or roomName)'),
    roomName: z.string().optional()
        .describe('Channel name (provide either roomId or roomName)')
});

export const getChannelInfoTool = defineTool(
    'rocketchat_get_channel_info',
    `Get detailed information about a specific Rocket.Chat channel.

Returns:
- Channel ID, name, and display name
- Type (public/private/direct/livechat)
- Member and message counts
- Topic, description, and announcement
- Read-only status
- Last activity timestamp

Examples:
- By ID: { "roomId": "GENERAL" }
- By name: { "roomName": "general" }`,
    getChannelInfoSchema,
    async (params) => {
        if (!params.roomId && !params.roomName) {
            return createErrorResult(
                ErrorCodes.VALIDATION_ERROR,
                'Missing room identifier',
                'Either roomId or roomName must be provided'
            );
        }

        try {
            const client = getClient();
            const response = await client.getChannelInfo(params.roomId, params.roomName);

            if (!response.success) {
                const identifier = params.roomId || params.roomName || '';
                return createErrorResult(
                    ErrorCodes.NOT_FOUND,
                    'Channel not found',
                    `No channel found with identifier "${identifier}"`
                );
            }

            const formatted = formatChannels([response.channel])[0];
            const result = buildSuccessResponse(formatted);
            return createToolResult(result);
        } catch (error) {
            return createErrorResultFromException(ErrorCodes.API_ERROR, 'Failed to get channel info', error);
        }
    }
);

/**
 * rocketchat_list_active_rooms
 * Rooms of the current user with new messages since a given time
 */
const listActiveRoomsSchema = z.object({
    since: z.string().default('1d').optional()
        .describe('Activity since: relative (1d = today since midnight, 7d), ISO date (2024-01-15) or Unix timestamp. Default: 1d'),
    types: z.array(z.enum(['direct', 'private', 'public'])).optional()
        .describe('Room types to include. Default: all'),
    limit: z.number().min(1).max(200).default(50).optional()
        .describe('Maximum number of rooms to return (1-200, default: 50)')
});

export const listActiveRoomsTool = defineTool(
    'rocketchat_list_active_rooms',
    `List the current user's rooms with new messages since a given time: direct messages, private groups and public channels.

A room is active when its last message is newer than \`since\`, or when it got unread messages,
mentions or thread replies since then (a thread reply does not change the room's last message).
Sorted by last message time, newest first. For each room returns:
- Room ID, type and name (for direct messages, the other person's name)
- Last message time and a short preview of the last message
- Unread counter, mentions and threads with unread replies.
  In channels and groups the unread counter may count only mentions, depending on server settings.

**Typical Workflow:**
1. rocketchat_list_active_rooms → Find direct messages with activity
2. rocketchat_get_messages with the same time range → Read them

Examples:
- Direct messages today: { "types": ["direct"] }
- Everything since a date: { "since": "2024-01-15" }`,
    listActiveRoomsSchema,
    async (params) => {
        let since: Date;
        try {
            since = parseTimeExpression(params.since || '1d').start;
        } catch (error) {
            return createErrorResult(
                ErrorCodes.VALIDATION_ERROR,
                'Invalid time expression',
                error instanceof Error ? error.message : String(error)
            );
        }

        try {
            const client = getClient();
            const [rooms, subscriptions] = await Promise.all([
                client.getUpdatedRooms(since.toISOString()),
                client.getSubscriptions()
            ]);

            if (!rooms.success || !subscriptions.success) {
                return createErrorResult(ErrorCodes.API_ERROR, 'Failed to list active rooms');
            }

            const isSince = (timestamp?: string) => !!timestamp && new Date(timestamp).getTime() >= since.getTime();
            const subscriptionsByRoom = new Map(subscriptions.update.map(s => [s.rid, s]));
            // rooms.get also returns rooms changed for other reasons (topic, members): keep new messages and fresh unread activity
            const active = rooms.update
                .filter(room => room.t === 'c' || room.t === 'p' || room.t === 'd')
                .filter(room => {
                    const subscription = subscriptionsByRoom.get(room._id);
                    const hasFreshUnread = !!subscription && isSince(subscription._updatedAt)
                        && (subscription.unread > 0 || subscription.userMentions > 0 || (subscription.tunread?.length || 0) > 0);
                    return isSince(room.lm) || hasFreshUnread;
                })
                .map(room => formatActiveRoom(room, subscriptionsByRoom.get(room._id)))
                .filter(room => !params.types || params.types.includes(room.type as 'direct' | 'private' | 'public'))
                .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

            const { items, truncated } = TokenCounter.truncateToFit(active.slice(0, params.limit || 50));
            const result = buildSuccessResponse(items, {
                count: items.length,
                total: active.length,
                truncated
            });
            return createToolResult(result);
        } catch (error) {
            return createErrorResultFromException(ErrorCodes.API_ERROR, 'Failed to list active rooms', error);
        }
    }
);

// Register tools
toolRegistry.register(listChannelsTool);
toolRegistry.register(searchChannelsTool);
toolRegistry.register(getChannelInfoTool);
toolRegistry.register(listActiveRoomsTool);
