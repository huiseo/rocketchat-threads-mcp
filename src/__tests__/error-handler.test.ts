/**
 * Error Handler Unit Tests
 */

import { describe, it, expect, vi } from 'vitest';

// Mock the api/client module before any imports that use error-handler
vi.mock('../api/client.js', () => {
    class RocketChatApiError extends Error {
        public readonly statusCode: number;
        public readonly responseBody: string;

        constructor(message: string, statusCode: number, responseBody: string) {
            super(message);
            this.name = 'RocketChatApiError';
            this.statusCode = statusCode;
            this.responseBody = responseBody;
        }
    }
    return { RocketChatApiError };
});

// Import after mocking
import {
    ErrorCodes,
    extractErrorMessage,
    extractErrorDetails,
    createErrorInfo,
    httpStatusToErrorCode,
    isErrorInfo,
    enrichErrorInfo
} from '../utils/error-handler.js';

describe('ErrorCodes', () => {
    it('should have all expected error codes', () => {
        expect(ErrorCodes.API_ERROR).toBe('API_ERROR');
        expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
        expect(ErrorCodes.NOT_FOUND).toBe('NOT_FOUND');
        expect(ErrorCodes.PERMISSION_DENIED).toBe('PERMISSION_DENIED');
        expect(ErrorCodes.RATE_LIMITED).toBe('RATE_LIMITED');
        expect(ErrorCodes.WRITE_DISABLED).toBe('WRITE_DISABLED');
        expect(ErrorCodes.ROOM_NOT_ALLOWED).toBe('ROOM_NOT_ALLOWED');
        expect(ErrorCodes.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
    });
});

describe('extractErrorMessage', () => {
    it('should extract message from Error object', () => {
        const error = new Error('Something went wrong');
        expect(extractErrorMessage(error)).toBe('Something went wrong');
    });

    it('should extract message from string', () => {
        expect(extractErrorMessage('String error')).toBe('String error');
    });

    it('should return default for unknown error type', () => {
        expect(extractErrorMessage(null)).toBe('Unknown error occurred');
        expect(extractErrorMessage(undefined)).toBe('Unknown error occurred');
        expect(extractErrorMessage(123)).toBe('Unknown error occurred');
        expect(extractErrorMessage({})).toBe('Unknown error occurred');
    });
});

describe('extractErrorDetails', () => {
    it('should return undefined for plain Error without DEBUG', () => {
        const originalDebug = process.env.DEBUG;
        delete process.env.DEBUG;

        const error = new Error('Test');
        expect(extractErrorDetails(error)).toBeUndefined();

        process.env.DEBUG = originalDebug;
    });

    it('should return undefined for non-error objects', () => {
        expect(extractErrorDetails('string')).toBeUndefined();
        expect(extractErrorDetails(null)).toBeUndefined();
        expect(extractErrorDetails({})).toBeUndefined();
    });
});

describe('createErrorInfo', () => {
    it('should create error info with code and message', () => {
        const info = createErrorInfo(ErrorCodes.API_ERROR, 'Test message');
        expect(info.code).toBe('API_ERROR');
        expect(info.message).toBe('Test message');
    });

    it('should create error info from error object', () => {
        const error = new Error('Error message');
        const info = createErrorInfo(ErrorCodes.API_ERROR, 'Default', error);
        expect(info.code).toBe('API_ERROR');
        expect(info.message).toBe('Error message');
    });

    it('should use default message when error has no message', () => {
        const info = createErrorInfo(ErrorCodes.API_ERROR, 'Default', null);
        expect(info.message).toBe('Default');
    });
});

describe('httpStatusToErrorCode', () => {
    it('should map 400 to VALIDATION_ERROR', () => {
        expect(httpStatusToErrorCode(400)).toBe(ErrorCodes.VALIDATION_ERROR);
    });

    it('should map 401 and 403 to PERMISSION_DENIED', () => {
        expect(httpStatusToErrorCode(401)).toBe(ErrorCodes.PERMISSION_DENIED);
        expect(httpStatusToErrorCode(403)).toBe(ErrorCodes.PERMISSION_DENIED);
    });

    it('should map 404 to NOT_FOUND', () => {
        expect(httpStatusToErrorCode(404)).toBe(ErrorCodes.NOT_FOUND);
    });

    it('should map 429 to RATE_LIMITED', () => {
        expect(httpStatusToErrorCode(429)).toBe(ErrorCodes.RATE_LIMITED);
    });

    it('should map other codes to API_ERROR', () => {
        expect(httpStatusToErrorCode(500)).toBe(ErrorCodes.API_ERROR);
        expect(httpStatusToErrorCode(502)).toBe(ErrorCodes.API_ERROR);
        expect(httpStatusToErrorCode(503)).toBe(ErrorCodes.API_ERROR);
    });
});

describe('isErrorInfo', () => {
    it('should return true for valid error info', () => {
        const info = { code: 'API_ERROR', message: 'Test' };
        expect(isErrorInfo(info)).toBe(true);
    });

    it('should return false for invalid objects', () => {
        expect(isErrorInfo(null)).toBe(false);
        expect(isErrorInfo(undefined)).toBe(false);
        expect(isErrorInfo('string')).toBe(false);
        expect(isErrorInfo({})).toBe(false);
        expect(isErrorInfo({ code: 'API_ERROR' })).toBe(false);
        expect(isErrorInfo({ message: 'Test' })).toBe(false);
        expect(isErrorInfo({ code: 123, message: 'Test' })).toBe(false);
    });
});

describe('enrichErrorInfo', () => {
    it('should add suggestion based on error code', () => {
        const info = { code: ErrorCodes.API_ERROR, message: 'Test' };
        const enriched = enrichErrorInfo(info);
        expect(enriched.suggestion).toBeDefined();
        expect(enriched.suggestion).toContain('Rocket.Chat');
    });

    it('should not override existing suggestion', () => {
        const info = {
            code: ErrorCodes.API_ERROR,
            message: 'Test',
            suggestion: 'Custom suggestion'
        };
        const enriched = enrichErrorInfo(info);
        expect(enriched.suggestion).toBe('Custom suggestion');
    });

    it('should add suggestion for WRITE_DISABLED', () => {
        const info = { code: ErrorCodes.WRITE_DISABLED, message: 'Test' };
        const enriched = enrichErrorInfo(info);
        expect(enriched.suggestion).toContain('ROCKETCHAT_WRITE_ENABLED');
    });
});
