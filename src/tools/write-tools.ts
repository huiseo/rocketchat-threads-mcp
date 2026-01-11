/**
 * Write Tools
 * Tools for sending messages (requires explicit enablement)
 */

import { z } from 'zod';
import { getClient } from '../api/client.js';
import { formatMessages } from '../formatters/message-formatter.js';
import { buildSuccessResponse } from '../formatters/response-builder.js';
import { getWriteGuard } from '../guards/write-guard.js';
import { getSanitizer } from '../guards/sanitizer.js';
import {
    defineTool,
    createToolResult,
    createErrorResult,
    createErrorResultFromException,
    ErrorCodes,
    toolRegistry
} from './base.js';

/**
 * rocketchat_send_message
 * Send a message to a channel
 */
const sendMessageSchema = z.object({
    roomId: z.string()
        .describe('Channel/room ID to send message to'),
    text: z.string().min(1).max(10000)
        .describe('Message text to send (max 10000 characters)'),
    threadId: z.string().optional()
        .describe('Thread ID (tmid) to reply to. If provided, message will be a thread reply.')
});

export const sendMessageTool = defineTool(
    'rocketchat_send_message',
    `Send a message to a Rocket.Chat channel.

**IMPORTANT - Check First:**
1. Call rocketchat_get_write_status to verify write is enabled
2. If disabled, inform user that ROCKETCHAT_WRITE_ENABLED=true is required

**Requirements:**
- ROCKETCHAT_WRITE_ENABLED=true (server configuration)
- Room must be in whitelist (if configured) or not in blacklist

**Safety Features (automatic):**
- @all, @here, @channel mentions are neutralized to prevent mass notifications
- Messages to unauthorized rooms are blocked
- Message length limited to 10000 characters

**Error Handling:**
- "Write disabled": Server not configured for writes
- "Room not allowed": Room not in whitelist or is blacklisted
- "API error": Check roomId is valid

Returns:
- Sent message details
- Whether sanitization was applied
- List of neutralized patterns (if any)

Examples:
- Send to channel: { "roomId": "GENERAL", "text": "Hello team!" }
- Reply to thread: { "roomId": "GENERAL", "text": "I agree", "threadId": "abc123" }`,
    sendMessageSchema,
    async (params) => {
        // Check write permissions
        const writeGuard = getWriteGuard();
        const writeCheck = writeGuard.checkWrite(params.roomId);

        if (!writeCheck.allowed) {
            return createErrorResult(
                ErrorCodes.WRITE_DISABLED,
                writeCheck.reason || 'Write operation not allowed',
                'Write operations are controlled by ROCKETCHAT_WRITE_ENABLED and ROCKETCHAT_WRITE_ROOMS'
            );
        }

        // Sanitize message text
        const sanitizer = getSanitizer();
        const sanitized = sanitizer.sanitize(params.text);

        try {
            const client = getClient();
            const response = await client.sendMessage({
                roomId: params.roomId,
                text: sanitized.text,
                tmid: params.threadId
            });

            if (!response.success) {
                return createErrorResult(ErrorCodes.API_ERROR, 'Failed to send message');
            }

            const formatted = formatMessages([response.message])[0];
            const result = buildSuccessResponse({
                message: formatted,
                sanitized: sanitized.modified,
                neutralizedPatterns: sanitized.neutralized
            });

            return createToolResult(result);
        } catch (error) {
            return createErrorResultFromException(ErrorCodes.API_ERROR, 'Failed to send message', error);
        }
    }
);

/**
 * rocketchat_react
 * Add a reaction to a message
 */
const reactSchema = z.object({
    messageId: z.string()
        .describe('Message ID to react to'),
    emoji: z.string()
        .describe('Emoji to react with (e.g., ":thumbsup:", ":check:", ":eyes:")')
});

export const reactTool = defineTool(
    'rocketchat_react',
    `Add a reaction emoji to a message.

Requires ROCKETCHAT_WRITE_ENABLED=true.

Emoji format:
- With colons: ":thumbsup:"
- Without colons: "thumbsup" (will be normalized)

Common reactions:
- :thumbsup: - Agreement/approval
- :eyes: - Looking into it
- :white_check_mark: - Done/completed
- :hourglass: - In progress
- :question: - Needs clarification

Examples:
- Add thumbsup: { "messageId": "abc123", "emoji": ":thumbsup:" }
- Mark as done: { "messageId": "abc123", "emoji": "white_check_mark" }`,
    reactSchema,
    async (params) => {
        // Reactions require write access
        const writeGuard = getWriteGuard();
        if (!writeGuard.isEnabled()) {
            return createErrorResult(
                ErrorCodes.WRITE_DISABLED,
                'Write operations are disabled',
                'Set ROCKETCHAT_WRITE_ENABLED=true to enable reactions'
            );
        }

        try {
            const client = getClient();

            // Normalize emoji format
            let emoji = params.emoji;
            if (!emoji.startsWith(':')) emoji = ':' + emoji;
            if (!emoji.endsWith(':')) emoji = emoji + ':';

            const response = await client.reactToMessage(params.messageId, emoji);

            if (!response.success) {
                return createErrorResult(ErrorCodes.API_ERROR, 'Failed to add reaction');
            }

            const result = buildSuccessResponse({
                messageId: params.messageId,
                emoji,
                success: true
            });

            return createToolResult(result);
        } catch (error) {
            return createErrorResultFromException(ErrorCodes.API_ERROR, 'Failed to add reaction', error);
        }
    }
);

/**
 * rocketchat_get_write_status
 * Check if write operations are enabled and get configuration
 */
const getWriteStatusSchema = z.object({});

export const getWriteStatusTool = defineTool(
    'rocketchat_get_write_status',
    `Check if write operations are enabled and get the current configuration.

**Call this BEFORE using rocketchat_send_message or rocketchat_react.**

Returns:
- enabled: Whether write operations are allowed
- whitelist: Rooms where writes are allowed (if configured)
- blacklist: Rooms where writes are blocked
- description: Human-readable status summary

**Decision Tree:**
1. If enabled=false → Inform user writes are disabled
2. If enabled=true + whitelist → Check if target room is in whitelist
3. If enabled=true + no whitelist → All rooms allowed except blacklist

Example: {}`,
    getWriteStatusSchema,
    async () => {
        const writeGuard = getWriteGuard();
        const config = writeGuard.getConfig();

        const result = buildSuccessResponse({
            enabled: config.enabled,
            whitelist: config.whitelist,
            blacklist: config.blacklist,
            description: config.enabled
                ? config.whitelist.length > 0
                    ? `Write enabled for rooms: ${config.whitelist.join(', ')}`
                    : 'Write enabled for all rooms (except blacklisted)'
                : 'Write operations are disabled'
        });

        return createToolResult(result);
    }
);

// Register tools
toolRegistry.register(sendMessageTool);
toolRegistry.register(reactTool);
toolRegistry.register(getWriteStatusTool);
