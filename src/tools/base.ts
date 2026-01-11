/**
 * Base Tool Definitions
 * Common types and utilities for MCP tools
 */

import { z } from 'zod';
import {
    ErrorCode,
    ErrorCodes,
    extractErrorMessage,
    extractErrorDetails,
    ErrorSuggestions
} from '../utils/error-handler.js';

/**
 * Tool parameter schemas
 */
export const CommonSchemas = {
    // Room/Channel identification
    roomId: z.string().describe('Unique room/channel ID (e.g., "GENERAL", "x3JG6uXJgE7YNHR3S")'),
    roomName: z.string().describe('Room/channel name for human-readable lookup'),

    // Pagination
    limit: z.number().min(1).max(100).default(50).describe('Maximum number of items to return (1-100, default: 50)'),
    offset: z.number().min(0).default(0).describe('Number of items to skip for pagination'),

    // Time expressions
    timeRange: z.string().describe('Time range: relative (1d, 7d, 1w, 1m) or ISO date (2024-01-15) or Unix timestamp'),

    // Search
    query: z.string().describe('Search query text'),

    // Thread
    threadId: z.string().describe('Thread parent message ID (tmid)'),

    // User
    userId: z.string().describe('User ID'),
    username: z.string().describe('Username (without @)')
};

/**
 * Tool result interface matching MCP specification
 */
export interface ToolResult {
    content: Array<{
        type: 'text';
        text: string;
    }>;
    isError?: boolean;
}

/**
 * Create a successful tool result
 */
export function createToolResult(data: unknown): ToolResult {
    return {
        content: [{
            type: 'text',
            text: JSON.stringify(data, null, 2)
        }]
    };
}

/**
 * Create an error tool result
 */
export function createErrorResult(
    code: string,
    message: string,
    details?: string,
    suggestion?: string
): ToolResult {
    return {
        content: [{
            type: 'text',
            text: JSON.stringify({
                success: false,
                error: {
                    code,
                    message,
                    details,
                    suggestion: suggestion || ErrorSuggestions[code as ErrorCode]
                }
            }, null, 2)
        }],
        isError: true
    };
}

/**
 * Create an error result from an exception
 * Automatically extracts message and details from error objects
 */
export function createErrorResultFromException(
    code: ErrorCode,
    defaultMessage: string,
    error: unknown
): ToolResult {
    const message = extractErrorMessage(error);
    const details = extractErrorDetails(error);
    return createErrorResult(code, message || defaultMessage, details);
}

/**
 * Wraps an async handler with standardized error handling
 * Reduces boilerplate try-catch blocks in tool handlers
 */
export function wrapHandler<TParams>(
    handler: (params: TParams) => Promise<ToolResult>,
    errorCode: ErrorCode = ErrorCodes.API_ERROR,
    errorMessage: string = 'Operation failed'
): (params: TParams) => Promise<ToolResult> {
    return async (params: TParams): Promise<ToolResult> => {
        try {
            return await handler(params);
        } catch (error) {
            return createErrorResultFromException(errorCode, errorMessage, error);
        }
    };
}

// Re-export error codes for convenience
export { ErrorCodes } from '../utils/error-handler.js';
export type { ErrorCode } from '../utils/error-handler.js';

/**
 * Tool definition interface with generic type parameter for type-safe handlers
 * @template T - The type of parameters accepted by the handler
 */
export interface ToolDefinition<T = unknown> {
    name: string;
    description: string;
    inputSchema: z.ZodType<T>;
    handler: (params: T) => Promise<ToolResult>;
}

/**
 * Helper function to create a type-safe tool definition
 * Infers the parameter type from the Zod schema
 */
export function defineTool<T extends z.ZodType>(
    name: string,
    description: string,
    inputSchema: T,
    handler: (params: z.infer<T>) => Promise<ToolResult>
): ToolDefinition<z.infer<T>> {
    return {
        name,
        description,
        inputSchema,
        handler
    };
}

/**
 * Registry of all tools
 */
export class ToolRegistry {
    private tools: Map<string, ToolDefinition<unknown>> = new Map();

    register<T>(tool: ToolDefinition<T>): void {
        // Store as ToolDefinition<unknown> for the registry
        this.tools.set(tool.name, tool as ToolDefinition<unknown>);
    }

    get(name: string): ToolDefinition<unknown> | undefined {
        return this.tools.get(name);
    }

    list(): ToolDefinition<unknown>[] {
        return Array.from(this.tools.values());
    }

    getSchemas(): Array<{ name: string; description: string; inputSchema: unknown }> {
        return this.list().map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: zodToJsonSchema(tool.inputSchema)
        }));
    }
}

/**
 * Convert Zod schema to JSON Schema for MCP
 */
export function zodToJsonSchema(schema: z.ZodType<unknown>): Record<string, unknown> {
    // Basic implementation - in production, use zod-to-json-schema library
    if (schema instanceof z.ZodObject) {
        const shape = schema.shape;
        const properties: Record<string, unknown> = {};
        const required: string[] = [];

        for (const [key, value] of Object.entries(shape)) {
            const zodValue = value as z.ZodType<unknown>;
            properties[key] = zodToJsonSchema(zodValue);

            // Check if required (not optional)
            if (!(zodValue instanceof z.ZodOptional) && !(zodValue instanceof z.ZodDefault)) {
                required.push(key);
            }
        }

        return {
            type: 'object',
            properties,
            required: required.length > 0 ? required : undefined
        };
    }

    if (schema instanceof z.ZodString) {
        return { type: 'string', description: schema.description };
    }

    if (schema instanceof z.ZodNumber) {
        return { type: 'number', description: schema.description };
    }

    if (schema instanceof z.ZodBoolean) {
        return { type: 'boolean', description: schema.description };
    }

    if (schema instanceof z.ZodOptional) {
        return zodToJsonSchema(schema.unwrap());
    }

    if (schema instanceof z.ZodDefault) {
        const inner = zodToJsonSchema(schema.removeDefault());
        return { ...inner, default: schema._def.defaultValue() };
    }

    if (schema instanceof z.ZodArray) {
        return {
            type: 'array',
            items: zodToJsonSchema(schema.element)
        };
    }

    if (schema instanceof z.ZodEnum) {
        return {
            type: 'string',
            enum: schema.options
        };
    }

    return { type: 'string' };
}

// Global tool registry
export const toolRegistry = new ToolRegistry();
