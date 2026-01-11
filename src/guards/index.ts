/**
 * Guards module - Security and access control
 */

// Write guard
export { WriteGuard, getWriteGuard, resetWriteGuard } from './write-guard.js';
export type { WriteCheckResult } from './write-guard.js';

// Message sanitizer
export { MessageSanitizer, getSanitizer, resetSanitizer } from './sanitizer.js';
export type { SanitizeResult } from './sanitizer.js';

// Input validator
export {
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
} from './input-validator.js';
export type { ValidationResult } from './input-validator.js';

// Rate limiter
export {
    RateLimiter,
    RateLimiterManager,
    getRateLimiterManager,
    resetRateLimiterManager,
    checkRateLimit,
    checkApiRateLimit,
    checkWriteRateLimit,
    checkSearchRateLimit,
    DEFAULT_LIMITS
} from './rate-limiter.js';
export type { RateLimitConfig, RateLimitResult } from './rate-limiter.js';
