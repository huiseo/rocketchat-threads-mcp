/**
 * Logger Unit Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Logger, getLogger, resetLogger } from '../utils/logger.js';

describe('Logger', () => {
    let consoleSpy: {
        log: ReturnType<typeof vi.spyOn>;
        warn: ReturnType<typeof vi.spyOn>;
        error: ReturnType<typeof vi.spyOn>;
    };

    beforeEach(() => {
        consoleSpy = {
            log: vi.spyOn(console, 'log').mockImplementation(() => {}),
            warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
            error: vi.spyOn(console, 'error').mockImplementation(() => {})
        };
        resetLogger();
    });

    afterEach(() => {
        consoleSpy.log.mockRestore();
        consoleSpy.warn.mockRestore();
        consoleSpy.error.mockRestore();
    });

    describe('log levels', () => {
        it('should log info messages', () => {
            const logger = new Logger('Test', false);
            logger.info('Test message');
            expect(consoleSpy.log).toHaveBeenCalled();
            expect(consoleSpy.log.mock.calls[0][0]).toContain('[INFO]');
            expect(consoleSpy.log.mock.calls[0][0]).toContain('Test message');
        });

        it('should log warn messages', () => {
            const logger = new Logger('Test', false);
            logger.warn('Warning message');
            expect(consoleSpy.warn).toHaveBeenCalled();
            expect(consoleSpy.warn.mock.calls[0][0]).toContain('[WARN]');
        });

        it('should log error messages', () => {
            const logger = new Logger('Test', false);
            logger.error('Error message');
            expect(consoleSpy.error).toHaveBeenCalled();
            expect(consoleSpy.error.mock.calls[0][0]).toContain('[ERROR]');
        });

        it('should not log debug messages when debug mode is off', () => {
            const logger = new Logger('Test', false);
            logger.debug('Debug message');
            expect(consoleSpy.log).not.toHaveBeenCalled();
        });

        it('should log debug messages when debug mode is on', () => {
            const logger = new Logger('Test', true);
            logger.debug('Debug message');
            expect(consoleSpy.log).toHaveBeenCalled();
            expect(consoleSpy.log.mock.calls[0][0]).toContain('[DEBUG]');
        });
    });

    describe('context', () => {
        it('should include context in log messages', () => {
            const logger = new Logger('MyContext', false);
            logger.info('Test');
            expect(consoleSpy.log.mock.calls[0][0]).toContain('[MyContext]');
        });

        it('should create child logger with sub-context', () => {
            const parent = new Logger('Parent', false);
            const child = parent.child('Child');
            child.info('Test');
            expect(consoleSpy.log.mock.calls[0][0]).toContain('[Parent:Child]');
        });
    });

    describe('data', () => {
        it('should include data in log messages', () => {
            const logger = new Logger('Test', false);
            logger.info('Message', { key: 'value' });
            expect(consoleSpy.log.mock.calls[0][0]).toContain('{"key":"value"}');
        });

        it('should include string data directly', () => {
            const logger = new Logger('Test', false);
            logger.info('Message', 'extra info');
            expect(consoleSpy.log.mock.calls[0][0]).toContain('extra info');
        });

        it('should extract error message and stack for error logging', () => {
            const logger = new Logger('Test', false);
            const error = new Error('Test error');
            logger.error('Something failed', error);
            expect(consoleSpy.error.mock.calls[0][0]).toContain('Test error');
        });
    });

    describe('getLogger', () => {
        it('should return default logger', () => {
            const logger1 = getLogger();
            const logger2 = getLogger();
            expect(logger1).toBe(logger2);
        });

        it('should return new logger with context', () => {
            const logger1 = getLogger('Context1');
            const logger2 = getLogger('Context2');
            expect(logger1).not.toBe(logger2);
        });
    });

    describe('timestamp', () => {
        it('should include timestamp in log messages', () => {
            const logger = new Logger('Test', false);
            logger.info('Test');
            // Check for ISO timestamp format
            expect(consoleSpy.log.mock.calls[0][0]).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });
    });
});
