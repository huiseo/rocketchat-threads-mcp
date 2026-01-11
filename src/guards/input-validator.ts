/**
 * Input Validator - Validates and sanitizes input parameters
 * Provides defense against injection attacks and malformed input
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('InputValidator');

/**
 * Validation result
 */
export interface ValidationResult {
    valid: boolean;
    error?: string;
    sanitized?: string;
}

/**
 * Maximum lengths for various input types
 */
export const MAX_LENGTHS = {
    roomId: 64,
    messageId: 64,
    threadId: 64,
    userId: 64,
    username: 128,
    query: 500,
    messageText: 10000,
    emoji: 64,
} as const;

/**
 * Patterns for valid input formats
 */
const VALID_PATTERNS = {
    // RocketChat IDs are alphanumeric with some special chars
    id: /^[a-zA-Z0-9_-]+$/,
    // Usernames can contain letters, numbers, dots, hyphens, underscores
    username: /^[a-zA-Z0-9._-]+$/,
    // Emoji names are alphanumeric with underscores, wrapped in colons
    emoji: /^:?[a-zA-Z0-9_+-]+:?$/,
} as const;

/**
 * Dangerous patterns to detect in input
 */
const DANGEROUS_PATTERNS = [
    // MongoDB injection patterns
    /\$where/i,
    /\$gt/i,
    /\$lt/i,
    /\$ne/i,
    /\$regex/i,
    /\$or/i,
    /\$and/i,
    // NoSQL injection
    /\{\s*['"]\$[a-z]+['"]/i,
    // Script injection
    /<script\b/i,
    /javascript:/i,
    /on\w+\s*=/i,
    // Command injection
    /[;&|`$]/,
];

/**
 * Input validator class
 */
export class InputValidator {
    /**
     * Validate a room ID
     */
    static validateRoomId(roomId: unknown): ValidationResult {
        if (typeof roomId !== 'string') {
            return { valid: false, error: 'Room ID must be a string' };
        }

        if (!roomId.trim()) {
            return { valid: false, error: 'Room ID cannot be empty' };
        }

        if (roomId.length > MAX_LENGTHS.roomId) {
            return { valid: false, error: `Room ID exceeds maximum length of ${MAX_LENGTHS.roomId}` };
        }

        // Check for dangerous patterns
        if (this.containsDangerousPattern(roomId)) {
            logger.warn('Dangerous pattern detected in room ID', { roomId: roomId.substring(0, 20) });
            return { valid: false, error: 'Room ID contains invalid characters' };
        }

        return { valid: true, sanitized: roomId.trim() };
    }

    /**
     * Validate a message ID
     */
    static validateMessageId(messageId: unknown): ValidationResult {
        if (typeof messageId !== 'string') {
            return { valid: false, error: 'Message ID must be a string' };
        }

        if (!messageId.trim()) {
            return { valid: false, error: 'Message ID cannot be empty' };
        }

        if (messageId.length > MAX_LENGTHS.messageId) {
            return { valid: false, error: `Message ID exceeds maximum length of ${MAX_LENGTHS.messageId}` };
        }

        if (!VALID_PATTERNS.id.test(messageId)) {
            return { valid: false, error: 'Message ID contains invalid characters' };
        }

        return { valid: true, sanitized: messageId.trim() };
    }

    /**
     * Validate a user ID
     */
    static validateUserId(userId: unknown): ValidationResult {
        if (typeof userId !== 'string') {
            return { valid: false, error: 'User ID must be a string' };
        }

        if (!userId.trim()) {
            return { valid: false, error: 'User ID cannot be empty' };
        }

        if (userId.length > MAX_LENGTHS.userId) {
            return { valid: false, error: `User ID exceeds maximum length of ${MAX_LENGTHS.userId}` };
        }

        if (!VALID_PATTERNS.id.test(userId)) {
            return { valid: false, error: 'User ID contains invalid characters' };
        }

        return { valid: true, sanitized: userId.trim() };
    }

    /**
     * Validate a username
     */
    static validateUsername(username: unknown): ValidationResult {
        if (typeof username !== 'string') {
            return { valid: false, error: 'Username must be a string' };
        }

        // Remove @ prefix if present
        const cleaned = username.replace(/^@/, '').trim();

        if (!cleaned) {
            return { valid: false, error: 'Username cannot be empty' };
        }

        if (cleaned.length > MAX_LENGTHS.username) {
            return { valid: false, error: `Username exceeds maximum length of ${MAX_LENGTHS.username}` };
        }

        if (!VALID_PATTERNS.username.test(cleaned)) {
            return { valid: false, error: 'Username contains invalid characters' };
        }

        return { valid: true, sanitized: cleaned };
    }

    /**
     * Validate a search query
     */
    static validateQuery(query: unknown): ValidationResult {
        if (typeof query !== 'string') {
            return { valid: false, error: 'Search query must be a string' };
        }

        if (!query.trim()) {
            return { valid: false, error: 'Search query cannot be empty' };
        }

        if (query.length > MAX_LENGTHS.query) {
            return { valid: false, error: `Search query exceeds maximum length of ${MAX_LENGTHS.query}` };
        }

        // Don't check for dangerous patterns in queries as they might be searching for code
        // But do sanitize for display
        return { valid: true, sanitized: query.trim() };
    }

    /**
     * Validate message text
     */
    static validateMessageText(text: unknown): ValidationResult {
        if (typeof text !== 'string') {
            return { valid: false, error: 'Message text must be a string' };
        }

        if (!text.trim()) {
            return { valid: false, error: 'Message text cannot be empty' };
        }

        if (text.length > MAX_LENGTHS.messageText) {
            return { valid: false, error: `Message text exceeds maximum length of ${MAX_LENGTHS.messageText}` };
        }

        return { valid: true, sanitized: text };
    }

    /**
     * Validate an emoji
     */
    static validateEmoji(emoji: unknown): ValidationResult {
        if (typeof emoji !== 'string') {
            return { valid: false, error: 'Emoji must be a string' };
        }

        const cleaned = emoji.trim();

        if (!cleaned) {
            return { valid: false, error: 'Emoji cannot be empty' };
        }

        if (cleaned.length > MAX_LENGTHS.emoji) {
            return { valid: false, error: `Emoji exceeds maximum length of ${MAX_LENGTHS.emoji}` };
        }

        if (!VALID_PATTERNS.emoji.test(cleaned)) {
            return { valid: false, error: 'Emoji contains invalid characters' };
        }

        return { valid: true, sanitized: cleaned };
    }

    /**
     * Validate pagination limit
     */
    static validateLimit(limit: unknown, min = 1, max = 100, defaultValue = 50): number {
        if (limit === undefined || limit === null) {
            return defaultValue;
        }

        const num = Number(limit);
        if (isNaN(num)) {
            return defaultValue;
        }

        return Math.max(min, Math.min(max, Math.floor(num)));
    }

    /**
     * Validate pagination offset
     */
    static validateOffset(offset: unknown, defaultValue = 0): number {
        if (offset === undefined || offset === null) {
            return defaultValue;
        }

        const num = Number(offset);
        if (isNaN(num) || num < 0) {
            return defaultValue;
        }

        return Math.floor(num);
    }

    /**
     * Check if string contains dangerous patterns
     */
    private static containsDangerousPattern(input: string): boolean {
        return DANGEROUS_PATTERNS.some(pattern => pattern.test(input));
    }

    /**
     * Escape HTML entities for safe display
     */
    static escapeHtml(text: string): string {
        const htmlEntities: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
        };
        return text.replace(/[&<>"']/g, char => htmlEntities[char] || char);
    }

    /**
     * Validate and sanitize a generic string input
     */
    static validateString(
        value: unknown,
        fieldName: string,
        maxLength: number,
        required = true
    ): ValidationResult {
        if (value === undefined || value === null) {
            if (required) {
                return { valid: false, error: `${fieldName} is required` };
            }
            return { valid: true };
        }

        if (typeof value !== 'string') {
            return { valid: false, error: `${fieldName} must be a string` };
        }

        const trimmed = value.trim();

        if (required && !trimmed) {
            return { valid: false, error: `${fieldName} cannot be empty` };
        }

        if (trimmed.length > maxLength) {
            return { valid: false, error: `${fieldName} exceeds maximum length of ${maxLength}` };
        }

        return { valid: true, sanitized: trimmed };
    }
}

// Export singleton-like utility functions
export const validateRoomId = InputValidator.validateRoomId.bind(InputValidator);
export const validateMessageId = InputValidator.validateMessageId.bind(InputValidator);
export const validateUserId = InputValidator.validateUserId.bind(InputValidator);
export const validateUsername = InputValidator.validateUsername.bind(InputValidator);
export const validateQuery = InputValidator.validateQuery.bind(InputValidator);
export const validateMessageText = InputValidator.validateMessageText.bind(InputValidator);
export const validateEmoji = InputValidator.validateEmoji.bind(InputValidator);
export const validateLimit = InputValidator.validateLimit.bind(InputValidator);
export const validateOffset = InputValidator.validateOffset.bind(InputValidator);
export const escapeHtml = InputValidator.escapeHtml.bind(InputValidator);
