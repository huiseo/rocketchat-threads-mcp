/**
 * Thread Tools
 * Tools for listing, searching, and reading threads
 * Threads are the primary unit for organizational knowledge retrieval
 */

import { z } from 'zod';
import { getClient } from '../api/client.js';
import { formatThreads, formatThreadWithReplies } from '../formatters/message-formatter.js';
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

const logger = getLogger('ThreadTools');

/**
 * rocketchat_list_threads
 * List all threads in a channel
 */
const listThreadsSchema = z.object({
    roomId: z.string()
        .describe('Channel/room ID to list threads from'),
    limit: z.number().min(1).max(100).default(50).optional()
        .describe('Maximum number of threads to return (1-100, default: 50)'),
    offset: z.number().min(0).default(0).optional()
        .describe('Number of threads to skip for pagination'),
    timeRange: z.string().optional()
        .describe('Time filter: relative (1d, 7d, 1w, 1m) or ISO date')
});

export const listThreadsTool = defineTool(
    'rocketchat_list_threads',
    `List all threads in a Rocket.Chat channel.

Returns thread information including:
- Thread ID (same as parent message ID)
- Title (first message text, truncated)
- Author and creation time
- Reply count and last reply time
- Participant user IDs

Use this to discover discussions in a channel before diving into details.

Examples:
- List all threads: { "roomId": "GENERAL" }
- Recent threads: { "roomId": "GENERAL", "timeRange": "7d" }
- Paginate: { "roomId": "GENERAL", "limit": 20, "offset": 20 }`,
    listThreadsSchema,
    async (params) => {
        try {
            const client = getClient();
            const limit = params.limit || 50;
            const offset = params.offset || 0;

            const response = await client.listThreads(params.roomId, limit, offset);

            if (!response.success) {
                return createErrorResult(ErrorCodes.API_ERROR, 'Failed to list threads');
            }

            // Filter by time range if specified
            let threads = response.threads;
            if (params.timeRange) {
                try {
                    const range = parseTimeExpression(params.timeRange);
                    threads = threads.filter(t => {
                        const threadTime = new Date(t.ts).getTime();
                        return threadTime >= range.start.getTime() && threadTime <= range.end.getTime();
                    });
                } catch (error) {
                    // Invalid time expression, log and ignore
                    logger.debug('Invalid time expression, ignoring filter', { timeRange: params.timeRange, error });
                }
            }

            const formatted = formatThreads(threads);
            const { items, truncated } = TokenCounter.truncateToFit(formatted);

            const result = buildPaginatedResponse(items, response.total, offset, truncated);
            return createToolResult(result);
        } catch (error) {
            return createErrorResultFromException(ErrorCodes.API_ERROR, 'Failed to list threads', error);
        }
    }
);

/**
 * rocketchat_get_thread
 * Get a thread with all its replies
 */
const getThreadSchema = z.object({
    threadId: z.string()
        .describe('Thread ID (parent message ID, tmid)'),
    limit: z.number().min(1).max(100).default(50).optional()
        .describe('Maximum number of replies to return (1-100, default: 50)'),
    offset: z.number().min(0).default(0).optional()
        .describe('Number of replies to skip for pagination')
});

export const getThreadTool = defineTool(
    'rocketchat_get_thread',
    `Get a thread with all its replies.

Returns complete thread information:
- Thread metadata (ID, title, author, timestamps)
- Parent message with full details
- All reply messages in chronological order
- Participant information

This is the primary tool for reading organizational discussions, agreements, and decisions.

Examples:
- Get full thread: { "threadId": "abc123xyz" }
- Get with pagination: { "threadId": "abc123xyz", "limit": 100 }`,
    getThreadSchema,
    async (params) => {
        try {
            const client = getClient();
            const limit = params.limit || 50;
            const offset = params.offset || 0;

            // Get thread parent message
            const parentResponse = await client.getThreadParent(params.threadId);
            if (!parentResponse.success) {
                return createErrorResult(
                    ErrorCodes.NOT_FOUND,
                    'Thread not found',
                    `No thread found with ID "${params.threadId}"`
                );
            }

            // Get thread replies
            const repliesResponse = await client.getThreadMessages({
                tmid: params.threadId,
                count: limit,
                offset
            });

            const formatted = formatThreadWithReplies(
                parentResponse.message,
                repliesResponse.messages || []
            );

            // Truncate if needed
            const { items: truncatedReplies, truncated } = TokenCounter.truncateToFit(formatted.replies);

            const result = buildSuccessResponse({
                ...formatted,
                replies: truncatedReplies
            }, {
                count: truncatedReplies.length,
                total: formatted.totalReplies,
                offset,
                truncated
            });

            return createToolResult(result);
        } catch (error) {
            return createErrorResultFromException(ErrorCodes.API_ERROR, 'Failed to get thread', error);
        }
    }
);

/**
 * rocketchat_search_threads
 * Search for threads containing specific text (searches both parent and replies)
 * This is a key differentiator from standard Slack MCPs
 */
const searchThreadsSchema = z.object({
    query: z.string().min(1)
        .describe('Search text to find in thread content (parent and replies)'),
    roomId: z.string()
        .describe('Channel/room ID to search in'),
    limit: z.number().min(1).max(50).default(20).optional()
        .describe('Maximum number of threads to return (1-50, default: 20)'),
    includeReplies: z.boolean().default(true).optional()
        .describe('Whether to search within thread replies (default: true)')
});

export const searchThreadsTool = defineTool(
    'rocketchat_search_threads',
    `Search for threads containing specific text.

IMPORTANT: Unlike basic message search, this tool searches BOTH parent messages AND replies within threads. This is essential for finding organizational knowledge that may be discussed in thread replies.

Returns:
- Thread ID and title
- Where the match was found (parent or reply)
- Match count within the thread
- Reply count and participants

Use cases:
- Finding discussions: "Find threads about API authentication"
- Finding decisions: "Server migration decisions"
- Finding agreements: "API spec agreements"

Examples:
- Search discussions: { "query": "deployment", "roomId": "GENERAL" }
- Search with more results: { "query": "migration", "roomId": "dev-team", "limit": 50 }`,
    searchThreadsSchema,
    async (params) => {
        try {
            const client = getClient();
            const limit = params.limit || 20;

            // Search in main messages first
            const searchResponse = await client.searchMessages({
                roomId: params.roomId,
                searchText: params.query,
                count: 100  // Get more to filter threads
            });

            if (!searchResponse.success) {
                return createErrorResult(ErrorCodes.API_ERROR, 'Failed to search threads');
            }

            // Collect unique thread IDs (messages with tcount > 0 or with tmid)
            const threadMap = new Map<string, {
                parentId: string;
                matchedIn: 'parent' | 'reply';
                matchCount: number;
            }>();

            for (const msg of searchResponse.messages) {
                if (msg.tcount && msg.tcount > 0) {
                    // This is a thread parent
                    const existing = threadMap.get(msg._id);
                    threadMap.set(msg._id, {
                        parentId: msg._id,
                        matchedIn: 'parent',
                        matchCount: (existing?.matchCount || 0) + 1
                    });
                } else if (msg.tmid) {
                    // This is a thread reply
                    const existing = threadMap.get(msg.tmid);
                    threadMap.set(msg.tmid, {
                        parentId: msg.tmid,
                        matchedIn: existing?.matchedIn === 'parent' ? 'parent' : 'reply',
                        matchCount: (existing?.matchCount || 0) + 1
                    });
                }
            }

            // Fetch thread details for found threads
            const threadResults = [];
            const threadIds = Array.from(threadMap.keys()).slice(0, limit);

            for (const threadId of threadIds) {
                try {
                    const parentResponse = await client.getThreadParent(threadId);
                    if (parentResponse.success) {
                        const info = threadMap.get(threadId)!;
                        threadResults.push({
                            ...formatThreads([parentResponse.message])[0],
                            matchedIn: info.matchedIn,
                            matchCount: info.matchCount
                        });
                    }
                } catch (error) {
                    // Skip threads we can't access, but log for debugging
                    logger.debug('Failed to fetch thread, skipping', { threadId, error });
                }
            }

            const { items, truncated } = TokenCounter.truncateToFit(threadResults);

            const result = buildSuccessResponse({
                query: params.query,
                threads: items
            }, {
                count: items.length,
                total: threadMap.size,
                truncated
            });

            return createToolResult(result);
        } catch (error) {
            return createErrorResultFromException(ErrorCodes.API_ERROR, 'Failed to search threads', error);
        }
    }
);

// Register tools
toolRegistry.register(listThreadsTool);
toolRegistry.register(getThreadTool);
toolRegistry.register(searchThreadsTool);
