/**
 * Input Validator Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
    InputValidator,
    validateRoomId,
    validateMessageId,
    validateUserId,
    validateUsername,
    validateQuery,
    validateMessageText,
    validateEmoji,
    validateLimit,
    validateOffset,
    escapeHtml,
    MAX_LENGTHS
} from '../guards/input-validator.js';

describe('InputValidator', () => {
    describe('validateRoomId', () => {
        it('should accept valid room IDs', () => {
            expect(validateRoomId('GENERAL')).toEqual({ valid: true, sanitized: 'GENERAL' });
            expect(validateRoomId('room-123')).toEqual({ valid: true, sanitized: 'room-123' });
            expect(validateRoomId('room_id_456')).toEqual({ valid: true, sanitized: 'room_id_456' });
        });

        it('should reject non-string values', () => {
            expect(validateRoomId(123).valid).toBe(false);
            expect(validateRoomId(null).valid).toBe(false);
            expect(validateRoomId(undefined).valid).toBe(false);
        });

        it('should reject empty strings', () => {
            expect(validateRoomId('').valid).toBe(false);
            expect(validateRoomId('   ').valid).toBe(false);
        });

        it('should reject strings exceeding max length', () => {
            const longId = 'a'.repeat(MAX_LENGTHS.roomId + 1);
            expect(validateRoomId(longId).valid).toBe(false);
        });

        it('should detect dangerous patterns', () => {
            expect(validateRoomId('room;rm -rf').valid).toBe(false);
            expect(validateRoomId('room$where').valid).toBe(false);
            expect(validateRoomId('room|echo').valid).toBe(false);
        });

        it('should trim whitespace', () => {
            expect(validateRoomId('  GENERAL  ')).toEqual({ valid: true, sanitized: 'GENERAL' });
        });
    });

    describe('validateMessageId', () => {
        it('should accept valid message IDs', () => {
            expect(validateMessageId('abc123XYZ')).toEqual({ valid: true, sanitized: 'abc123XYZ' });
            expect(validateMessageId('msg-123_456')).toEqual({ valid: true, sanitized: 'msg-123_456' });
        });

        it('should reject invalid characters', () => {
            expect(validateMessageId('msg.id').valid).toBe(false);
            expect(validateMessageId('msg@id').valid).toBe(false);
            expect(validateMessageId('msg id').valid).toBe(false);
        });
    });

    describe('validateUserId', () => {
        it('should accept valid user IDs', () => {
            expect(validateUserId('user123')).toEqual({ valid: true, sanitized: 'user123' });
            expect(validateUserId('ABC-123_xyz')).toEqual({ valid: true, sanitized: 'ABC-123_xyz' });
        });

        it('should reject invalid user IDs', () => {
            expect(validateUserId('').valid).toBe(false);
            expect(validateUserId('user.name').valid).toBe(false);
        });
    });

    describe('validateUsername', () => {
        it('should accept valid usernames', () => {
            expect(validateUsername('john.doe')).toEqual({ valid: true, sanitized: 'john.doe' });
            expect(validateUsername('user-name_123')).toEqual({ valid: true, sanitized: 'user-name_123' });
        });

        it('should remove @ prefix', () => {
            expect(validateUsername('@john.doe')).toEqual({ valid: true, sanitized: 'john.doe' });
        });

        it('should reject usernames with invalid characters', () => {
            expect(validateUsername('user name').valid).toBe(false);
            expect(validateUsername('user@domain').valid).toBe(false);
        });
    });

    describe('validateQuery', () => {
        it('should accept valid queries', () => {
            expect(validateQuery('search term')).toEqual({ valid: true, sanitized: 'search term' });
            expect(validateQuery('unicode search')).toEqual({ valid: true, sanitized: 'unicode search' });
        });

        it('should reject empty queries', () => {
            expect(validateQuery('').valid).toBe(false);
            expect(validateQuery('   ').valid).toBe(false);
        });

        it('should reject queries exceeding max length', () => {
            const longQuery = 'a'.repeat(MAX_LENGTHS.query + 1);
            expect(validateQuery(longQuery).valid).toBe(false);
        });

        it('should allow special characters in queries (for code search)', () => {
            // Queries should allow special chars since users might search for code
            expect(validateQuery('function foo() {}').valid).toBe(true);
            expect(validateQuery('$regex pattern').valid).toBe(true);
        });
    });

    describe('validateMessageText', () => {
        it('should accept valid message text', () => {
            expect(validateMessageText('Hello world')).toEqual({ valid: true, sanitized: 'Hello world' });
            expect(validateMessageText('Message content')).toEqual({ valid: true, sanitized: 'Message content' });
        });

        it('should reject empty text', () => {
            expect(validateMessageText('').valid).toBe(false);
            expect(validateMessageText('   ').valid).toBe(false);
        });

        it('should reject text exceeding max length', () => {
            const longText = 'a'.repeat(MAX_LENGTHS.messageText + 1);
            expect(validateMessageText(longText).valid).toBe(false);
        });
    });

    describe('validateEmoji', () => {
        it('should accept valid emoji names', () => {
            expect(validateEmoji(':thumbsup:').valid).toBe(true);
            expect(validateEmoji('thumbsup').valid).toBe(true);
            expect(validateEmoji(':+1:').valid).toBe(true);
            expect(validateEmoji('white_check_mark').valid).toBe(true);
        });

        it('should reject invalid emoji', () => {
            expect(validateEmoji('').valid).toBe(false);
            expect(validateEmoji(':invalid emoji:').valid).toBe(false);
            expect(validateEmoji('<script>').valid).toBe(false);
        });
    });

    describe('validateLimit', () => {
        it('should return default for undefined/null', () => {
            expect(validateLimit(undefined)).toBe(50);
            expect(validateLimit(null)).toBe(50);
        });

        it('should clamp values to range', () => {
            expect(validateLimit(0)).toBe(1);
            expect(validateLimit(1000)).toBe(100);
            expect(validateLimit(50)).toBe(50);
        });

        it('should handle non-numeric values', () => {
            expect(validateLimit('abc')).toBe(50);
            expect(validateLimit(NaN)).toBe(50);
        });

        it('should floor decimal values', () => {
            expect(validateLimit(50.7)).toBe(50);
        });

        it('should use custom min/max/default', () => {
            expect(validateLimit(undefined, 5, 20, 10)).toBe(10);
            expect(validateLimit(3, 5, 20, 10)).toBe(5);
            expect(validateLimit(30, 5, 20, 10)).toBe(20);
        });
    });

    describe('validateOffset', () => {
        it('should return default for undefined/null', () => {
            expect(validateOffset(undefined)).toBe(0);
            expect(validateOffset(null)).toBe(0);
        });

        it('should reject negative values', () => {
            expect(validateOffset(-1)).toBe(0);
            expect(validateOffset(-100)).toBe(0);
        });

        it('should accept valid offsets', () => {
            expect(validateOffset(0)).toBe(0);
            expect(validateOffset(100)).toBe(100);
        });

        it('should floor decimal values', () => {
            expect(validateOffset(10.5)).toBe(10);
        });
    });

    describe('escapeHtml', () => {
        it('should escape HTML entities', () => {
            expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
            expect(escapeHtml('a & b')).toBe('a &amp; b');
            expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
            expect(escapeHtml("it's")).toBe('it&#x27;s');
        });

        it('should handle text without special characters', () => {
            expect(escapeHtml('Hello World')).toBe('Hello World');
        });

        it('should handle empty string', () => {
            expect(escapeHtml('')).toBe('');
        });
    });

    describe('validateString', () => {
        it('should validate required strings', () => {
            expect(InputValidator.validateString('value', 'field', 100, true).valid).toBe(true);
            expect(InputValidator.validateString('', 'field', 100, true).valid).toBe(false);
            expect(InputValidator.validateString(undefined, 'field', 100, true).valid).toBe(false);
        });

        it('should validate optional strings', () => {
            expect(InputValidator.validateString(undefined, 'field', 100, false).valid).toBe(true);
            expect(InputValidator.validateString(null, 'field', 100, false).valid).toBe(true);
        });

        it('should enforce max length', () => {
            expect(InputValidator.validateString('abc', 'field', 2).valid).toBe(false);
            expect(InputValidator.validateString('ab', 'field', 2).valid).toBe(true);
        });
    });
});
