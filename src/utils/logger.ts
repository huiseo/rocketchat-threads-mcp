/**
 * Simple Logger Utility
 * Provides consistent logging with debug mode support
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    level: LogLevel;
    message: string;
    context?: string;
    data?: unknown;
    timestamp: string;
}

/**
 * Logger class with level filtering
 */
export class Logger {
    private debugMode: boolean;
    private context: string;

    constructor(context: string = 'MCP', debugMode?: boolean) {
        this.context = context;
        this.debugMode = debugMode ?? process.env.DEBUG === 'true';
    }

    /**
     * Log a debug message (only in debug mode)
     */
    debug(message: string, data?: unknown): void {
        if (this.debugMode) {
            this.log('debug', message, data);
        }
    }

    /**
     * Log an info message
     */
    info(message: string, data?: unknown): void {
        this.log('info', message, data);
    }

    /**
     * Log a warning message
     */
    warn(message: string, data?: unknown): void {
        this.log('warn', message, data);
    }

    /**
     * Log an error message
     */
    error(message: string, error?: unknown): void {
        const data = error instanceof Error
            ? { message: error.message, stack: error.stack }
            : error;
        this.log('error', message, data);
    }

    /**
     * Internal log method
     */
    private log(level: LogLevel, message: string, data?: unknown): void {
        const entry: LogEntry = {
            level,
            message,
            context: this.context,
            timestamp: new Date().toISOString(),
            data
        };

        const output = this.formatEntry(entry);

        switch (level) {
            case 'error':
                console.error(output);
                break;
            case 'warn':
                console.warn(output);
                break;
            default:
                console.log(output);
        }
    }

    /**
     * Format log entry for output
     */
    private formatEntry(entry: LogEntry): string {
        const parts = [
            `[${entry.timestamp}]`,
            `[${entry.level.toUpperCase()}]`,
            `[${entry.context}]`,
            entry.message
        ];

        if (entry.data !== undefined) {
            parts.push('-');
            parts.push(typeof entry.data === 'string'
                ? entry.data
                : JSON.stringify(entry.data));
        }

        return parts.join(' ');
    }

    /**
     * Create a child logger with a sub-context
     */
    child(subContext: string): Logger {
        return new Logger(`${this.context}:${subContext}`, this.debugMode);
    }
}

// Default logger instance
let defaultLogger: Logger | null = null;

/**
 * Get the default logger instance
 */
export function getLogger(context?: string): Logger {
    if (context) {
        return new Logger(context);
    }
    if (!defaultLogger) {
        defaultLogger = new Logger();
    }
    return defaultLogger;
}

/**
 * Reset the default logger (for testing)
 */
export function resetLogger(): void {
    defaultLogger = null;
}
