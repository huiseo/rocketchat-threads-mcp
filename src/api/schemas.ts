/**
 * API Response Validation Schemas
 * Uses Zod for runtime validation of Rocket.Chat API responses
 */

import { z } from 'zod';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('ApiSchemas');

// ============================================
// Common Schemas
// ============================================

/**
 * User object schema
 */
export const userSchema = z.object({
    _id: z.string(),
    username: z.string(),
    name: z.string().optional(),
    status: z.enum(['online', 'away', 'busy', 'offline']).optional(),
    emails: z.array(z.object({
        address: z.string(),
        verified: z.boolean()
    })).optional(),
    roles: z.array(z.string()).optional()
}).passthrough();

/**
 * Room type enum
 */
export const roomTypeSchema = z.enum(['c', 'p', 'd', 'l']);

/**
 * User reference (author) schema
 */
export const userRefSchema = z.object({
    _id: z.string(),
    username: z.string(),
    name: z.string().optional()
}).passthrough();

/**
 * Attachment schema
 */
export const attachmentSchema = z.object({
    color: z.string().optional(),
    text: z.string().optional(),
    ts: z.string().optional(),
    thumb_url: z.string().optional(),
    message_link: z.string().optional(),
    collapsed: z.boolean().optional(),
    author_name: z.string().optional(),
    author_link: z.string().optional(),
    author_icon: z.string().optional(),
    title: z.string().optional(),
    title_link: z.string().optional(),
    title_link_download: z.boolean().optional(),
    image_url: z.string().optional(),
    audio_url: z.string().optional(),
    video_url: z.string().optional(),
    fields: z.array(z.object({
        short: z.boolean().optional(),
        title: z.string(),
        value: z.string()
    })).optional()
}).passthrough();

/**
 * Message schema
 */
export const messageSchema = z.object({
    _id: z.string(),
    rid: z.string(),
    msg: z.string(),
    ts: z.string(),
    u: userRefSchema,
    _updatedAt: z.string(),
    mentions: z.array(z.object({
        _id: z.string(),
        username: z.string()
    })).optional(),
    channels: z.array(z.object({
        _id: z.string(),
        name: z.string()
    })).optional(),
    urls: z.array(z.object({
        url: z.string(),
        meta: z.record(z.string()).optional()
    })).optional(),
    attachments: z.array(attachmentSchema).optional(),
    reactions: z.record(z.object({
        usernames: z.array(z.string())
    })).optional(),
    starred: z.array(z.object({ _id: z.string() })).optional(),
    pinned: z.boolean().optional(),
    editedAt: z.string().optional(),
    editedBy: userRefSchema.optional(),
    // Thread fields
    tmid: z.string().optional(),
    tcount: z.number().optional(),
    tlm: z.string().optional(),
    replies: z.array(z.string()).optional(),
    // OpenSearch fields
    _score: z.number().nullable().optional(),
    _highlight: z.string().optional()
}).passthrough();

/**
 * Room schema
 */
export const roomSchema = z.object({
    _id: z.string(),
    name: z.string().optional(),
    fname: z.string().optional(),
    t: roomTypeSchema,
    msgs: z.number(),
    usersCount: z.number(),
    u: userRefSchema,
    ts: z.string(),
    ro: z.boolean().optional(),
    default: z.boolean().optional(),
    topic: z.string().optional(),
    description: z.string().optional(),
    announcement: z.string().optional(),
    _updatedAt: z.string(),
    lastMessage: messageSchema.optional()
}).passthrough();

// ============================================
// Response Schemas
// ============================================

/**
 * Base response schema
 */
export const baseResponseSchema = z.object({
    success: z.boolean(),
    error: z.string().optional(),
    errorType: z.string().optional()
});

/**
 * Pagination fields schema
 */
export const paginationSchema = z.object({
    count: z.number(),
    offset: z.number(),
    total: z.number()
});

/**
 * Channels list response
 */
export const channelsListResponseSchema = baseResponseSchema.extend({
    channels: z.array(roomSchema),
    ...paginationSchema.shape
});

/**
 * Messages response
 */
export const messagesResponseSchema = baseResponseSchema.extend({
    messages: z.array(messageSchema),
    ...paginationSchema.shape,
    _metadata: z.object({
        source: z.enum(['opensearch', 'rocketchat', 'none']),
        opensearch_available: z.boolean(),
        filtered_client_side: z.boolean().optional(),
        global_search_enabled: z.boolean().optional()
    }).optional()
});

/**
 * Threads list response
 */
export const threadsListResponseSchema = baseResponseSchema.extend({
    threads: z.array(messageSchema),
    ...paginationSchema.shape
});

/**
 * Users list response
 */
export const usersListResponseSchema = baseResponseSchema.extend({
    users: z.array(userSchema),
    ...paginationSchema.shape
});

/**
 * User info response
 */
export const userInfoResponseSchema = baseResponseSchema.extend({
    user: userSchema
});

/**
 * Me response (user fields at root level)
 */
export const meResponseSchema = userSchema.extend({
    success: z.boolean()
});

/**
 * Send message response
 */
export const sendMessageResponseSchema = baseResponseSchema.extend({
    message: messageSchema
});

/**
 * Channel info response
 */
export const channelInfoResponseSchema = baseResponseSchema.extend({
    channel: roomSchema
});

/**
 * Single message response
 */
export const singleMessageResponseSchema = baseResponseSchema.extend({
    message: messageSchema
});

/**
 * Reaction response
 */
export const reactionResponseSchema = baseResponseSchema;

// ============================================
// Validation Utilities
// ============================================

/**
 * Validation result type
 */
export type ValidationResult<T> =
    | { success: true; data: T }
    | { success: false; error: z.ZodError };

/**
 * Validate response data against a schema
 * Returns validated data or original data with logged warning on failure
 */
export function validateResponse<T>(
    schema: z.ZodType<T>,
    data: unknown,
    context: string
): T {
    const result = schema.safeParse(data);

    if (!result.success) {
        logger.warn(`Response validation failed for ${context}`, {
            errors: result.error.errors.slice(0, 5).map(e => ({
                path: e.path.join('.'),
                message: e.message
            }))
        });
        // Return original data cast as T - allows processing to continue
        // This is a graceful degradation pattern
        return data as T;
    }

    return result.data;
}

/**
 * Strict validation - throws on failure
 */
export function validateResponseStrict<T>(
    schema: z.ZodType<T>,
    data: unknown,
    context: string
): T {
    const result = schema.safeParse(data);

    if (!result.success) {
        logger.error(`Response validation failed for ${context}`, {
            errors: result.error.errors.map(e => ({
                path: e.path.join('.'),
                message: e.message
            }))
        });
        throw new Error(`Invalid API response for ${context}: ${result.error.message}`);
    }

    return result.data;
}

/**
 * Check if response is a valid success response
 */
export function isSuccessResponse(data: unknown): data is { success: true } {
    const result = baseResponseSchema.safeParse(data);
    return result.success && result.data.success === true;
}

/**
 * Extract error message from API error response
 */
export function extractApiError(data: unknown): string | undefined {
    const result = baseResponseSchema.safeParse(data);
    if (result.success && !result.data.success) {
        return result.data.error || result.data.errorType;
    }
    return undefined;
}
