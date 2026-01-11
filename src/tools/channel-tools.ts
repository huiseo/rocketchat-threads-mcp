/**
 * Channel Tools
 * Tools for listing and searching channels
 */

import { z } from 'zod';
import { getClient } from '../api/client.js';
import { formatChannels } from '../formatters/message-formatter.js';
import { buildSuccessResponse, buildPaginatedResponse } from '../formatters/response-builder.js';
import { TokenCounter } from '../utils/token-counter.js';
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

// Register tools
toolRegistry.register(listChannelsTool);
toolRegistry.register(searchChannelsTool);
toolRegistry.register(getChannelInfoTool);
