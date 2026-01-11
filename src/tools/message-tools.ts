/**
 * Message Tools
 * Tools for reading and searching messages
 */

import { z } from 'zod';
import { getClient } from '../api/client.js';
import { formatMessages, createSearchSummary } from '../formatters/message-formatter.js';
import { buildSuccessResponse, buildPaginatedResponse } from '../formatters/response-builder.js';
import { TokenCounter } from '../utils/token-counter.js';
import { parseTimeExpression } from '../utils/time-parser.js';
import { getLogger } from '../utils/logger.js';
import {
    defineTool,
    createToolResult,
    createErrorResult,
    createErrorResultFromException,
    ErrorCodes,
    toolRegistry
} from './base.js';

const logger = getLogger('MessageTools');

/**
 * rocketchat_get_messages
 * Get messages from a channel with optional time filtering
 */
const getMessagesSchema = z.object({
    roomId: z.string()
        .describe('Channel/room ID to get messages from'),
    limit: z.number().min(1).max(100).default(50).optional()
        .describe('Maximum number of messages to return (1-100, default: 50)'),
    offset: z.number().min(0).default(0).optional()
        .describe('Number of messages to skip for pagination'),
    timeRange: z.string().optional()
        .describe('Time filter: relative (1d, 7d, 1w, 1m), ISO date (2024-01-15), or "oldest" for oldest first')
});

export const getMessagesTool = defineTool(
    'rocketchat_get_messages',
    `Get messages from a Rocket.Chat channel.

Returns message information including:
- Message ID, text, and author
- Timestamp and edit history
- Thread information (if part of a thread)
- Reactions and attachments
- Pinned status

Time filtering options:
- Relative: "1d" (1 day), "7d" (7 days), "1w" (1 week), "1m" (1 month)
- ISO date: "2024-01-15" (from that date to now)
- Unix timestamp: "1705276800"

Examples:
- Recent messages: { "roomId": "GENERAL" }
- Last 24 hours: { "roomId": "GENERAL", "timeRange": "1d" }
- Last week: { "roomId": "GENERAL", "timeRange": "1w", "limit": 100 }`,
    getMessagesSchema,
    async (params) => {
        try {
            const client = getClient();
            const limit = params.limit || 50;
            const offset = params.offset || 0;

            // Build query with time filter if provided
            let query: Record<string, unknown> | undefined;
            if (params.timeRange) {
                try {
                    const range = parseTimeExpression(params.timeRange);
                    query = {
                        ts: {
                            $gte: range.start.toISOString(),
                            $lte: range.end.toISOString()
                        }
                    };
                } catch (error) {
                    // Invalid time expression, log and continue without filter
                    logger.debug('Invalid time expression, ignoring filter', { timeRange: params.timeRange, error });
                }
            }

            const response = await client.getMessages({
                roomId: params.roomId,
                count: limit,
                offset,
                query,
                sort: { ts: -1 }  // Newest first
            });

            if (!response.success) {
                return createErrorResult(ErrorCodes.API_ERROR, 'Failed to get messages');
            }

            const formatted = formatMessages(response.messages);
            const { items, truncated } = TokenCounter.truncateToFit(formatted);

            const result = buildPaginatedResponse(items, response.total, offset, truncated);
            return createToolResult(result);
        } catch (error) {
            return createErrorResultFromException(ErrorCodes.API_ERROR, 'Failed to get messages', error);
        }
    }
);

/**
 * rocketchat_search_messages
 * Search messages across channels (global search supported with OpenSearch)
 */
const searchMessagesSchema = z.object({
    query: z.string().min(1)
        .describe('Search text to find in messages'),
    roomId: z.string().optional()
        .describe('Channel/room ID to search in. If omitted, searches globally across all accessible channels (requires OpenSearch integration)'),
    limit: z.number().min(1).max(100).default(50).optional()
        .describe('Maximum number of results (1-100, default: 50)'),
    offset: z.number().min(0).default(0).optional()
        .describe('Number of results to skip for pagination')
});

export const searchMessagesTool = defineTool(
    'rocketchat_search_messages',
    `Search for messages containing specific text across all channels or in a specific channel.

**IMPORTANT: Use global search (without roomId) first!**
- Global search finds messages across ALL channels at once
- Only use roomId if you need to filter results to a specific channel
- Do NOT iterate through channels one by one - use global search instead

This searches message content (parent messages only, not thread replies).
For searching within threads, use rocketchat_search_threads instead.

**Search Strategy (Recommended):**
1. First, try global search WITHOUT roomId - this searches all channels at once
2. If global search fails with "roomId required" error, then use channel-specific search
3. Do NOT loop through channels - global search is much more efficient

**OpenSearch Dependency:**
- WITHOUT roomId (global search): REQUIRES OpenSearch integration - searches ALL channels
- WITH roomId: Works on all servers but only searches ONE channel

Returns:
- Search summary (query, total results, time range)
- Matching messages with full details (including which channel/roomId each message is from)
- Thread IDs for messages that are thread parents
- Highlighted text snippets (when OpenSearch is available)

**When to use which tool:**
- rocketchat_search_messages: Find messages by keyword (fast, single messages)
- rocketchat_search_threads: Find discussions/decisions (searches replies too)
- rocketchat_get_messages: Browse recent messages chronologically

**Error Handling:**
- If "roomId required" error: Server lacks OpenSearch, provide roomId
- If empty results: Try broader search terms

Examples:
- Global search (RECOMMENDED): { "query": "삼성전자" }
- Global search (RECOMMENDED): { "query": "authentication" }
- Channel-specific (only if needed): { "query": "API integration", "roomId": "GENERAL" }`,
    searchMessagesSchema,
    async (params) => {
        try {
            const client = getClient();
            const limit = params.limit || 50;
            const offset = params.offset || 0;

            const response = await client.searchMessages({
                roomId: params.roomId,
                searchText: params.query,
                count: limit,
                offset
            });

            if (!response.success) {
                return createErrorResult(ErrorCodes.API_ERROR, 'Failed to search messages');
            }

            const formatted = formatMessages(response.messages);
            const { items, truncated } = TokenCounter.truncateToFit(formatted);
            const summary = createSearchSummary(params.query, response.messages, response.total);

            const result = buildSuccessResponse({
                summary,
                messages: items
            }, {
                count: items.length,
                total: response.total,
                truncated
            });
            return createToolResult(result);
        } catch (error) {
            return createErrorResultFromException(ErrorCodes.API_ERROR, 'Failed to search messages', error);
        }
    }
);

/**
 * rocketchat_get_message
 * Get a specific message by ID
 */
const getMessageSchema = z.object({
    messageId: z.string()
        .describe('Message ID to retrieve')
});

export const getMessageTool = defineTool(
    'rocketchat_get_message',
    `Get a specific message by its ID.

Use this to retrieve full details of a message when you have its ID.

Examples:
- Get message: { "messageId": "abc123xyz" }`,
    getMessageSchema,
    async (params) => {
        try {
            const client = getClient();
            const response = await client.getMessage(params.messageId);

            if (!response.success) {
                return createErrorResult(
                    ErrorCodes.NOT_FOUND,
                    'Message not found',
                    `No message found with ID "${params.messageId}"`
                );
            }

            const formatted = formatMessages([response.message])[0];
            const result = buildSuccessResponse(formatted);
            return createToolResult(result);
        } catch (error) {
            return createErrorResultFromException(ErrorCodes.API_ERROR, 'Failed to get message', error);
        }
    }
);

// Register tools
toolRegistry.register(getMessagesTool);
toolRegistry.register(searchMessagesTool);
toolRegistry.register(getMessageTool);
