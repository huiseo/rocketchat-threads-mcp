/**
 * Response Builder
 * Creates standardized MCP tool responses with consistent structure
 */

import { TokenCounter } from '../utils/token-counter.js';

export interface McpToolResponse {
    success: boolean;
    data?: unknown;
    error?: {
        code: string;
        message: string;
        details?: string;
        suggestion?: string;
    };
    metadata?: {
        count?: number;
        total?: number;
        offset?: number;
        truncated?: boolean;
        executionTime?: number;
    };
}

/**
 * Build a successful response
 */
export function buildSuccessResponse<T>(
    data: T,
    metadata?: McpToolResponse['metadata']
): McpToolResponse {
    return {
        success: true,
        data,
        metadata
    };
}

/**
 * Build a paginated success response
 */
export function buildPaginatedResponse<T>(
    items: T[],
    total: number,
    offset: number,
    truncated: boolean = false
): McpToolResponse {
    return {
        success: true,
        data: items,
        metadata: {
            count: items.length,
            total,
            offset,
            truncated
        }
    };
}

/**
 * Build an error response following What-Why-How pattern
 */
export function buildErrorResponse(
    code: string,
    what: string,
    why?: string,
    how?: string
): McpToolResponse {
    return {
        success: false,
        error: {
            code,
            message: what,
            details: why,
            suggestion: how
        }
    };
}

/**
 * Common error responses
 */
export const CommonErrors = {
    NOT_FOUND: (resource: string, identifier: string) => buildErrorResponse(
        'NOT_FOUND',
        `${resource} not found`,
        `No ${resource} with identifier "${identifier}" exists`,
        `Check the ${resource} ID or name and try again`
    ),

    UNAUTHORIZED: () => buildErrorResponse(
        'UNAUTHORIZED',
        'Authentication failed',
        'Invalid or expired authentication token',
        'Check ROCKETCHAT_AUTH_TOKEN and ROCKETCHAT_USER_ID environment variables'
    ),

    FORBIDDEN: (action: string, resource: string) => buildErrorResponse(
        'FORBIDDEN',
        `Cannot ${action} ${resource}`,
        'You do not have permission to perform this action',
        'Request access from a channel administrator'
    ),

    WRITE_DISABLED: () => buildErrorResponse(
        'WRITE_DISABLED',
        'Write operations are disabled',
        'The MCP server is configured in read-only mode',
        'Set ROCKETCHAT_WRITE_ENABLED=true to enable write operations'
    ),

    ROOM_NOT_WRITABLE: (roomId: string, whitelist: string[]) => buildErrorResponse(
        'ROOM_NOT_WRITABLE',
        'Cannot write to this room',
        `Room "${roomId}" is not in the allowed write list`,
        whitelist.length > 0
            ? `Allowed rooms: ${whitelist.join(', ')}`
            : 'Configure ROCKETCHAT_WRITE_ROOMS to allow write access'
    ),

    RATE_LIMITED: (retryAfter?: number) => buildErrorResponse(
        'RATE_LIMITED',
        'Too many requests',
        'The Rocket.Chat API rate limit has been exceeded',
        retryAfter
            ? `Wait ${retryAfter} seconds before retrying`
            : 'Reduce request frequency and try again'
    ),

    VALIDATION_ERROR: (field: string, requirement: string) => buildErrorResponse(
        'VALIDATION_ERROR',
        `Invalid parameter: ${field}`,
        requirement,
        `Provide a valid value for "${field}"`
    ),

    API_ERROR: (statusCode: number, message: string) => buildErrorResponse(
        'API_ERROR',
        `Rocket.Chat API error (${statusCode})`,
        message,
        'Check the Rocket.Chat server status and logs'
    ),

    CONNECTION_ERROR: () => buildErrorResponse(
        'CONNECTION_ERROR',
        'Cannot connect to Rocket.Chat server',
        'The server may be down or the URL is incorrect',
        'Verify ROCKETCHAT_URL and ensure the server is running'
    ),

    TIMEOUT: () => buildErrorResponse(
        'TIMEOUT',
        'Request timed out',
        'The Rocket.Chat server took too long to respond',
        'Try again with smaller limits or a more specific query'
    )
};

/**
 * Serialize response to JSON string with token limiting
 */
export function serializeResponse(response: McpToolResponse): string {
    const json = JSON.stringify(response, null, 2);

    // Check if response exceeds token limit
    if (TokenCounter.wouldExceedLimit(json)) {
        // If response is an array, truncate items
        if (Array.isArray(response.data)) {
            const { items, truncated } = TokenCounter.truncateToFit(
                response.data,
                item => JSON.stringify(item)
            );

            const truncatedResponse: McpToolResponse = {
                ...response,
                data: items,
                metadata: {
                    ...response.metadata,
                    truncated: truncated,
                    count: items.length
                }
            };

            return JSON.stringify(truncatedResponse, null, 2);
        }

        // For non-array data, truncate the JSON string
        const { text } = TokenCounter.truncateText(json);
        return text;
    }

    return json;
}

/**
 * Format response for MCP text content
 */
export function formatAsTextContent(response: McpToolResponse): { type: 'text'; text: string }[] {
    return [{
        type: 'text',
        text: serializeResponse(response)
    }];
}
