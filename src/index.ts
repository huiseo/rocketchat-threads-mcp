#!/usr/bin/env node
/**
 * Rocket.Chat MCP Server
 * Model Context Protocol server for Rocket.Chat integration
 *
 * Features:
 * - Channel/room listing and search
 * - Message history with time filtering
 * - Thread-centric knowledge retrieval
 * - User lookup
 * - Safe message sending (optional)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ErrorCode,
    McpError
} from '@modelcontextprotocol/sdk/types.js';

import { loadConfig } from './config/config.js';
import { toolRegistry } from './tools/index.js';
import { getClient } from './api/client.js';

// Server metadata
const SERVER_NAME = 'mcp-rocketchat';
const SERVER_VERSION = '0.1.0';

/**
 * Create and configure the MCP server
 */
function createServer(): Server {
    const server = new Server(
        {
            name: SERVER_NAME,
            version: SERVER_VERSION
        },
        {
            capabilities: {
                tools: {}
            }
        }
    );

    // Handle list tools request
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        const tools = toolRegistry.getSchemas();
        return { tools };
    });

    // Handle tool execution
    server.setRequestHandler(CallToolRequestSchema, async (request): Promise<{
        content: Array<{ type: 'text'; text: string }>;
        isError?: boolean;
    }> => {
        const { name, arguments: args } = request.params;

        const tool = toolRegistry.get(name);
        if (!tool) {
            throw new McpError(
                ErrorCode.MethodNotFound,
                `Unknown tool: ${name}`
            );
        }

        try {
            const result = await tool.handler(args || {});
            return {
                content: result.content,
                isError: result.isError
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: false,
                        error: {
                            code: 'EXECUTION_ERROR',
                            message: `Tool execution failed: ${message}`
                        }
                    }, null, 2)
                }],
                isError: true
            };
        }
    });

    return server;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
    // Load and validate configuration
    const config = loadConfig();

    // Validate required configuration
    if (!config.rocketchat.url) {
        console.error('Error: ROCKETCHAT_URL environment variable is required');
        process.exit(1);
    }
    if (!config.rocketchat.authToken) {
        console.error('Error: ROCKETCHAT_AUTH_TOKEN environment variable is required');
        process.exit(1);
    }
    if (!config.rocketchat.userId) {
        console.error('Error: ROCKETCHAT_USER_ID environment variable is required');
        process.exit(1);
    }

    // Test connection
    const client = getClient();
    const connected = await client.testConnection();
    if (!connected) {
        console.error('Error: Failed to connect to Rocket.Chat server');
        console.error(`URL: ${config.rocketchat.url}`);
        process.exit(1);
    }

    // Create and start server
    const server = createServer();
    const transport = new StdioServerTransport();

    console.error(`Starting ${SERVER_NAME} v${SERVER_VERSION}`);
    console.error(`Connected to: ${config.rocketchat.url}`);
    console.error(`Write operations: ${config.write.enabled ? 'enabled' : 'disabled'}`);

    await server.connect(transport);
}

/**
 * Export createSandboxServer for Smithery scanning
 * This allows Smithery to scan server capabilities without real credentials
 */
export function createSandboxServer(): Server {
    // Set mock environment variables for scanning
    if (!process.env.ROCKETCHAT_URL) {
        process.env.ROCKETCHAT_URL = 'https://sandbox.rocketchat.example';
        process.env.ROCKETCHAT_AUTH_TOKEN = 'sandbox-token';
        process.env.ROCKETCHAT_USER_ID = 'sandbox-user';
    }
    return createServer();
}

/**
 * Default export for Smithery hosted deployment
 * Returns a configured MCP server instance
 */
export default function(): Server {
    // Set mock environment variables if not provided (for Smithery hosting)
    if (!process.env.ROCKETCHAT_URL) {
        process.env.ROCKETCHAT_URL = 'https://sandbox.rocketchat.example';
        process.env.ROCKETCHAT_AUTH_TOKEN = 'sandbox-token';
        process.env.ROCKETCHAT_USER_ID = 'sandbox-user';
    }
    return createServer();
}

// Only run main() when executed directly (not imported)
// Check if this module is the entry point
const isMainModule = process.argv[1]?.includes('index.js') || process.argv[1]?.includes('index.cjs');
if (isMainModule && !process.env.SMITHERY_SCANNING) {
    main().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}
