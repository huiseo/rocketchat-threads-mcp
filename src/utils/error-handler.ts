/**
 * Centralized Error Handling Utilities
 * Provides consistent error handling across all MCP tools
 */

import { RocketChatApiError } from '../api/client.js';

/**
 * Error codes used across the MCP server
 */
export const ErrorCodes = {
    API_ERROR: 'API_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    RATE_LIMITED: 'RATE_LIMITED',
    WRITE_DISABLED: 'WRITE_DISABLED',
    ROOM_NOT_ALLOWED: 'ROOM_NOT_ALLOWED',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Standardized error result structure
 */
export interface ErrorInfo {
    code: ErrorCode;
    message: string;
    details?: string;
    suggestion?: string;
}

/**
 * Extract a meaningful error message from any error type
 */
export function extractErrorMessage(error: unknown): string {
    if (error instanceof RocketChatApiError) {
        return `${error.message} (Status: ${error.statusCode})`;
    }
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'Unknown error occurred';
}

/**
 * Extract error details (stack trace or additional info)
 */
export function extractErrorDetails(error: unknown): string | undefined {
    if (error instanceof RocketChatApiError) {
        try {
            const body = JSON.parse(error.responseBody);
            return body.error || body.message || error.responseBody;
        } catch {
            return error.responseBody;
        }
    }
    if (error instanceof Error && error.stack) {
        // Only include stack in development
        if (process.env.DEBUG === 'true') {
            return error.stack;
        }
    }
    return undefined;
}

/**
 * Create an error info object from any error
 */
export function createErrorInfo(
    code: ErrorCode,
    defaultMessage: string,
    error?: unknown
): ErrorInfo {
    const message = error ? extractErrorMessage(error) : defaultMessage;
    const details = error ? extractErrorDetails(error) : undefined;

    return {
        code,
        message,
        details
    };
}

/**
 * Map HTTP status codes to error codes
 */
export function httpStatusToErrorCode(status: number): ErrorCode {
    switch (status) {
        case 400:
            return ErrorCodes.VALIDATION_ERROR;
        case 401:
        case 403:
            return ErrorCodes.PERMISSION_DENIED;
        case 404:
            return ErrorCodes.NOT_FOUND;
        case 429:
            return ErrorCodes.RATE_LIMITED;
        default:
            return ErrorCodes.API_ERROR;
    }
}

/**
 * Wrapper for async handler functions with consistent error handling
 * @param handler - The async handler function to wrap
 * @param errorCode - Default error code to use
 * @param errorMessage - Default error message
 * @returns A wrapped function that catches errors and returns error results
 */
export function withErrorHandling<TParams, TResult>(
    handler: (params: TParams) => Promise<TResult>,
    errorCode: ErrorCode,
    errorMessage: string
): (params: TParams) => Promise<TResult | ErrorInfo> {
    return async (params: TParams): Promise<TResult | ErrorInfo> => {
        try {
            return await handler(params);
        } catch (error) {
            return createErrorInfo(errorCode, errorMessage, error);
        }
    };
}

/**
 * Helper to check if a result is an error info
 */
export function isErrorInfo(result: unknown): result is ErrorInfo {
    return (
        typeof result === 'object' &&
        result !== null &&
        'code' in result &&
        'message' in result &&
        typeof (result as ErrorInfo).code === 'string' &&
        typeof (result as ErrorInfo).message === 'string'
    );
}

/**
 * Standard suggestions for common errors
 */
export const ErrorSuggestions: Record<ErrorCode, string> = {
    [ErrorCodes.API_ERROR]: 'Check that the Rocket.Chat server is accessible and credentials are valid.',
    [ErrorCodes.VALIDATION_ERROR]: 'Review the input parameters and ensure they match the expected format.',
    [ErrorCodes.NOT_FOUND]: 'Verify that the resource exists and you have permission to access it.',
    [ErrorCodes.PERMISSION_DENIED]: 'Ensure you have the required permissions for this operation.',
    [ErrorCodes.RATE_LIMITED]: 'Too many requests. Please wait and try again.',
    [ErrorCodes.WRITE_DISABLED]: 'Set ROCKETCHAT_WRITE_ENABLED=true to enable write operations.',
    [ErrorCodes.ROOM_NOT_ALLOWED]: 'Check ROCKETCHAT_WRITE_ROOMS configuration for allowed rooms.',
    [ErrorCodes.UNKNOWN_ERROR]: 'An unexpected error occurred. Check the server logs for details.'
};

/**
 * Add suggestion to error info based on error code
 */
export function enrichErrorInfo(errorInfo: ErrorInfo): ErrorInfo {
    if (!errorInfo.suggestion && ErrorSuggestions[errorInfo.code]) {
        return {
            ...errorInfo,
            suggestion: ErrorSuggestions[errorInfo.code]
        };
    }
    return errorInfo;
}
