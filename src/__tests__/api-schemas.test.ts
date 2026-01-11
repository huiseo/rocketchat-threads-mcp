/**
 * API Schemas Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    userSchema,
    messageSchema,
    roomSchema,
    channelsListResponseSchema,
    messagesResponseSchema,
    usersListResponseSchema,
    validateResponse,
    validateResponseStrict,
    isSuccessResponse,
    extractApiError
} from '../api/schemas.js';

// Mock logger
vi.mock('../utils/logger.js', () => ({
    getLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    })
}));

describe('API Schemas', () => {
    describe('userSchema', () => {
        it('should validate a valid user object', () => {
            const user = {
                _id: 'user123',
                username: 'john.doe',
                name: 'John Doe',
                status: 'online',
                emails: [{ address: 'john@example.com', verified: true }],
                roles: ['user', 'admin']
            };

            const result = userSchema.safeParse(user);
            expect(result.success).toBe(true);
        });

        it('should accept minimal user object', () => {
            const user = {
                _id: 'user123',
                username: 'john.doe'
            };

            const result = userSchema.safeParse(user);
            expect(result.success).toBe(true);
        });

        it('should reject invalid user object', () => {
            const user = {
                _id: 'user123'
                // missing username
            };

            const result = userSchema.safeParse(user);
            expect(result.success).toBe(false);
        });

        it('should allow extra fields (passthrough)', () => {
            const user = {
                _id: 'user123',
                username: 'john.doe',
                customField: 'value'
            };

            const result = userSchema.safeParse(user);
            expect(result.success).toBe(true);
            if (result.success) {
                expect((result.data as { customField: string }).customField).toBe('value');
            }
        });
    });

    describe('messageSchema', () => {
        it('should validate a valid message object', () => {
            const message = {
                _id: 'msg123',
                rid: 'room123',
                msg: 'Hello world',
                ts: '2024-01-15T10:00:00.000Z',
                u: { _id: 'user123', username: 'john.doe' },
                _updatedAt: '2024-01-15T10:00:00.000Z'
            };

            const result = messageSchema.safeParse(message);
            expect(result.success).toBe(true);
        });

        it('should validate message with thread fields', () => {
            const message = {
                _id: 'msg123',
                rid: 'room123',
                msg: 'Thread parent',
                ts: '2024-01-15T10:00:00.000Z',
                u: { _id: 'user123', username: 'john.doe' },
                _updatedAt: '2024-01-15T10:00:00.000Z',
                tcount: 5,
                tlm: '2024-01-15T12:00:00.000Z',
                replies: ['user456', 'user789']
            };

            const result = messageSchema.safeParse(message);
            expect(result.success).toBe(true);
        });

        it('should validate message with OpenSearch fields', () => {
            const message = {
                _id: 'msg123',
                rid: 'room123',
                msg: 'Search result',
                ts: '2024-01-15T10:00:00.000Z',
                u: { _id: 'user123', username: 'john.doe' },
                _updatedAt: '2024-01-15T10:00:00.000Z',
                _score: 0.95,
                _highlight: 'Search <em>result</em>'
            };

            const result = messageSchema.safeParse(message);
            expect(result.success).toBe(true);
        });

        it('should handle null score', () => {
            const message = {
                _id: 'msg123',
                rid: 'room123',
                msg: 'Message',
                ts: '2024-01-15T10:00:00.000Z',
                u: { _id: 'user123', username: 'john.doe' },
                _updatedAt: '2024-01-15T10:00:00.000Z',
                _score: null
            };

            const result = messageSchema.safeParse(message);
            expect(result.success).toBe(true);
        });
    });

    describe('roomSchema', () => {
        it('should validate a valid room object', () => {
            const room = {
                _id: 'GENERAL',
                name: 'general',
                fname: 'General',
                t: 'c',
                msgs: 100,
                usersCount: 50,
                u: { _id: 'user123', username: 'admin' },
                ts: '2024-01-01T00:00:00.000Z',
                _updatedAt: '2024-01-15T10:00:00.000Z'
            };

            const result = roomSchema.safeParse(room);
            expect(result.success).toBe(true);
        });

        it('should accept all room types', () => {
            const types = ['c', 'p', 'd', 'l'];
            for (const t of types) {
                const room = {
                    _id: 'room123',
                    t,
                    msgs: 0,
                    usersCount: 0,
                    u: { _id: 'user123', username: 'admin' },
                    ts: '2024-01-01T00:00:00.000Z',
                    _updatedAt: '2024-01-15T10:00:00.000Z'
                };

                const result = roomSchema.safeParse(room);
                expect(result.success).toBe(true);
            }
        });
    });

    describe('channelsListResponseSchema', () => {
        it('should validate a valid channels list response', () => {
            const response = {
                success: true,
                channels: [{
                    _id: 'GENERAL',
                    name: 'general',
                    t: 'c',
                    msgs: 100,
                    usersCount: 50,
                    u: { _id: 'user123', username: 'admin' },
                    ts: '2024-01-01T00:00:00.000Z',
                    _updatedAt: '2024-01-15T10:00:00.000Z'
                }],
                count: 1,
                offset: 0,
                total: 10
            };

            const result = channelsListResponseSchema.safeParse(response);
            expect(result.success).toBe(true);
        });
    });

    describe('messagesResponseSchema', () => {
        it('should validate a valid messages response', () => {
            const response = {
                success: true,
                messages: [{
                    _id: 'msg123',
                    rid: 'room123',
                    msg: 'Hello',
                    ts: '2024-01-15T10:00:00.000Z',
                    u: { _id: 'user123', username: 'john' },
                    _updatedAt: '2024-01-15T10:00:00.000Z'
                }],
                count: 1,
                offset: 0,
                total: 50
            };

            const result = messagesResponseSchema.safeParse(response);
            expect(result.success).toBe(true);
        });

        it('should validate response with metadata', () => {
            const response = {
                success: true,
                messages: [],
                count: 0,
                offset: 0,
                total: 0,
                _metadata: {
                    source: 'opensearch',
                    opensearch_available: true,
                    global_search_enabled: true
                }
            };

            const result = messagesResponseSchema.safeParse(response);
            expect(result.success).toBe(true);
        });
    });

    describe('validateResponse', () => {
        it('should return validated data on success', () => {
            const data = {
                success: true,
                users: [{ _id: 'user1', username: 'john' }],
                count: 1,
                offset: 0,
                total: 1
            };

            const result = validateResponse(usersListResponseSchema, data, 'users.list');
            expect(result.success).toBe(true);
            expect(result.users).toHaveLength(1);
        });

        it('should return original data on validation failure (graceful degradation)', () => {
            const invalidData = {
                success: true,
                users: 'not an array',  // Invalid
                count: 1,
                offset: 0,
                total: 1
            };

            // Should not throw, returns original data
            const result = validateResponse(usersListResponseSchema, invalidData, 'users.list');
            expect(result).toBe(invalidData);
        });
    });

    describe('validateResponseStrict', () => {
        it('should return validated data on success', () => {
            const data = {
                success: true,
                users: [{ _id: 'user1', username: 'john' }],
                count: 1,
                offset: 0,
                total: 1
            };

            const result = validateResponseStrict(usersListResponseSchema, data, 'users.list');
            expect(result.success).toBe(true);
        });

        it('should throw on validation failure', () => {
            const invalidData = {
                success: true,
                users: 'not an array',
                count: 1,
                offset: 0,
                total: 1
            };

            expect(() => validateResponseStrict(usersListResponseSchema, invalidData, 'users.list'))
                .toThrow('Invalid API response');
        });
    });

    describe('isSuccessResponse', () => {
        it('should return true for success response', () => {
            expect(isSuccessResponse({ success: true })).toBe(true);
            expect(isSuccessResponse({ success: true, data: [] })).toBe(true);
        });

        it('should return false for error response', () => {
            expect(isSuccessResponse({ success: false })).toBe(false);
            expect(isSuccessResponse({ success: false, error: 'Error' })).toBe(false);
        });

        it('should return false for invalid response', () => {
            expect(isSuccessResponse(null)).toBe(false);
            expect(isSuccessResponse(undefined)).toBe(false);
            expect(isSuccessResponse({})).toBe(false);
            expect(isSuccessResponse('string')).toBe(false);
        });
    });

    describe('extractApiError', () => {
        it('should extract error message', () => {
            expect(extractApiError({ success: false, error: 'Not found' })).toBe('Not found');
            expect(extractApiError({ success: false, errorType: 'ValidationError' })).toBe('ValidationError');
        });

        it('should return undefined for success response', () => {
            expect(extractApiError({ success: true })).toBeUndefined();
        });

        it('should return undefined for invalid input', () => {
            expect(extractApiError(null)).toBeUndefined();
            expect(extractApiError({})).toBeUndefined();
        });
    });
});
