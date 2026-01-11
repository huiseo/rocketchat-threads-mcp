/**
 * Handler Utilities
 * Common patterns and utilities for tool handlers to reduce code duplication
 */

import { TokenCounter } from '../utils/token-counter.js';
import { buildSuccessResponse, buildPaginatedResponse } from '../formatters/response-builder.js';
import { createToolResult, createErrorResult, ErrorCodes, ToolResult } from './base.js';

/**
 * Common pagination parameters
 */
export interface PaginationParams {
    limit?: number;
    offset?: number;
}

/**
 * Default pagination values
 */
export const DEFAULT_PAGINATION = {
    limit: 50,
    offset: 0,
    maxLimit: 100,
    minLimit: 1
} as const;

/**
 * Extract pagination values with defaults
 */
export function extractPagination(params: PaginationParams): { limit: number; offset: number } {
    return {
        limit: Math.min(
            Math.max(params.limit || DEFAULT_PAGINATION.limit, DEFAULT_PAGINATION.minLimit),
            DEFAULT_PAGINATION.maxLimit
        ),
        offset: Math.max(params.offset || DEFAULT_PAGINATION.offset, 0)
    };
}

/**
 * Process a paginated list response with token truncation
 */
export function processPaginatedResponse<T>(
    items: T[],
    total: number,
    offset: number
): ToolResult {
    const { items: truncatedItems, truncated } = TokenCounter.truncateToFit(items);
    const result = buildPaginatedResponse(truncatedItems, total, offset, truncated);
    return createToolResult(result);
}

/**
 * Process a single item response
 */
export function processSingleResponse<T>(item: T): ToolResult {
    const result = buildSuccessResponse(item);
    return createToolResult(result);
}

/**
 * Process a success response with metadata
 */
export function processSuccessResponse<T>(
    data: T,
    metadata?: { count?: number; total?: number; truncated?: boolean }
): ToolResult {
    const result = buildSuccessResponse(data, metadata);
    return createToolResult(result);
}

/**
 * Create not found error for common resources
 */
export function createNotFoundError(resource: string, identifier: string): ToolResult {
    return createErrorResult(
        ErrorCodes.NOT_FOUND,
        `${resource} not found`,
        `No ${resource} found with identifier "${identifier}"`
    );
}

/**
 * Create validation error for missing required parameters
 */
export function createValidationError(requirement: string, details?: string): ToolResult {
    return createErrorResult(
        ErrorCodes.VALIDATION_ERROR,
        requirement,
        details
    );
}

/**
 * Helper to require at least one of multiple optional parameters
 */
export function requireOneOf(
    params: Record<string, unknown>,
    keys: string[]
): { valid: boolean; error?: ToolResult } {
    const hasValue = keys.some(key => params[key] !== undefined && params[key] !== null && params[key] !== '');

    if (!hasValue) {
        const keysStr = keys.join(' or ');
        return {
            valid: false,
            error: createValidationError(
                `Missing required parameter`,
                `Either ${keysStr} must be provided`
            )
        };
    }

    return { valid: true };
}

/**
 * Format items with truncation and return result
 */
export function formatAndTruncate<T, R>(
    items: T[],
    formatter: (items: T[]) => R[],
    total: number,
    offset: number
): ToolResult {
    const formatted = formatter(items);
    return processPaginatedResponse(formatted, total, offset);
}

/**
 * Check API response success and handle error
 */
export function checkApiSuccess(
    response: { success: boolean },
    errorMessage: string
): { ok: true } | { ok: false; error: ToolResult } {
    if (!response.success) {
        return {
            ok: false,
            error: createErrorResult(ErrorCodes.API_ERROR, errorMessage)
        };
    }
    return { ok: true };
}
