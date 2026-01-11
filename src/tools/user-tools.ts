/**
 * User Tools
 * Tools for looking up user information
 */

import { z } from 'zod';
import { getClient } from '../api/client.js';
import { formatUser, formatUsers } from '../formatters/message-formatter.js';
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
 * rocketchat_lookup_user
 * Get user information by ID or username
 */
const lookupUserSchema = z.object({
    userId: z.string().optional()
        .describe('User ID (provide either userId or username)'),
    username: z.string().optional()
        .describe('Username without @ (provide either userId or username)')
});

export const lookupUserTool = defineTool(
    'rocketchat_lookup_user',
    `Look up a Rocket.Chat user by ID or username.

Returns user information:
- User ID and username
- Display name
- Email (if visible)
- Status (online/away/busy/offline)
- Roles (admin, user, etc.)

Use this to get details about message authors or participants.

Examples:
- By ID: { "userId": "x3JG6uXJgE7YNHR3S" }
- By username: { "username": "john.doe" }`,
    lookupUserSchema,
    async (params) => {
        if (!params.userId && !params.username) {
            return createErrorResult(
                ErrorCodes.VALIDATION_ERROR,
                'Missing user identifier',
                'Either userId or username must be provided'
            );
        }

        try {
            const client = getClient();
            const response = await client.getUserInfo(params.userId, params.username);

            if (!response.success) {
                const identifier = params.userId || params.username || '';
                return createErrorResult(
                    ErrorCodes.NOT_FOUND,
                    'User not found',
                    `No user found with identifier "${identifier}"`
                );
            }

            const formatted = formatUser(response.user);
            const result = buildSuccessResponse(formatted);
            return createToolResult(result);
        } catch (error) {
            return createErrorResultFromException(ErrorCodes.API_ERROR, 'Failed to lookup user', error);
        }
    }
);

/**
 * rocketchat_list_users
 * List users with pagination
 */
const listUsersSchema = z.object({
    limit: z.number().min(1).max(100).default(50).optional()
        .describe('Maximum number of users to return (1-100, default: 50)'),
    offset: z.number().min(0).default(0).optional()
        .describe('Number of users to skip for pagination')
});

export const listUsersTool = defineTool(
    'rocketchat_list_users',
    `List Rocket.Chat users with pagination.

Returns user list with basic information for each user.
Use rocketchat_lookup_user for detailed information about a specific user.

Examples:
- List users: {}
- Paginate: { "limit": 20, "offset": 40 }`,
    listUsersSchema,
    async (params) => {
        try {
            const client = getClient();
            const limit = params.limit || 50;
            const offset = params.offset || 0;

            const response = await client.listUsers(limit, offset);

            if (!response.success) {
                return createErrorResult(ErrorCodes.API_ERROR, 'Failed to list users');
            }

            const formatted = formatUsers(response.users);
            const { items, truncated } = TokenCounter.truncateToFit(formatted);

            const result = buildPaginatedResponse(items, response.total, offset, truncated);
            return createToolResult(result);
        } catch (error) {
            return createErrorResultFromException(ErrorCodes.API_ERROR, 'Failed to list users', error);
        }
    }
);

/**
 * rocketchat_get_me
 * Get current authenticated user information
 */
const getMeSchema = z.object({});

export const getMeTool = defineTool(
    'rocketchat_get_me',
    `Get information about the current authenticated user.

Returns the user information for the account used to authenticate with the MCP server.
Useful for understanding the current context and permissions.

Example: {}`,
    getMeSchema,
    async () => {
        try {
            const client = getClient();
            const response = await client.getMe();

            if (!response.success) {
                return createErrorResult(ErrorCodes.API_ERROR, 'Failed to get current user');
            }

            const formatted = formatUser(response.user);
            const result = buildSuccessResponse(formatted);
            return createToolResult(result);
        } catch (error) {
            return createErrorResultFromException(ErrorCodes.API_ERROR, 'Failed to get current user', error);
        }
    }
);

// Register tools
toolRegistry.register(lookupUserTool);
toolRegistry.register(listUsersTool);
toolRegistry.register(getMeTool);
