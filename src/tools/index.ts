/**
 * Tool Registry Index
 * Exports all tools and the registry
 */

// Import all tool modules to register them
import './channel-tools.js';
import './message-tools.js';
import './thread-tools.js';
import './user-tools.js';
import './write-tools.js';

// Re-export the registry and utilities
export { toolRegistry, createToolResult, createErrorResult } from './base.js';
export type { ToolDefinition, ToolResult } from './base.js';

// Export individual tools for direct access if needed
export { listChannelsTool, searchChannelsTool, getChannelInfoTool } from './channel-tools.js';
export { getMessagesTool, searchMessagesTool, getMessageTool } from './message-tools.js';
export { listThreadsTool, getThreadTool, searchThreadsTool } from './thread-tools.js';
export { lookupUserTool, listUsersTool, getMeTool } from './user-tools.js';
export { sendMessageTool, reactTool, getWriteStatusTool } from './write-tools.js';
