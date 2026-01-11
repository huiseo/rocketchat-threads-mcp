/**
 * Message Sanitizer - Neutralizes dangerous mentions and patterns
 * Prevents accidental mass notifications (@all, @here, @channel)
 */

import { loadConfig } from '../config/config.js';

export interface SanitizeResult {
    text: string;
    modified: boolean;
    neutralized: string[];
}

// Dangerous mention patterns that trigger mass notifications
const DANGEROUS_MENTIONS = [
    { pattern: /@all\b/gi, replacement: '@\u200Ball', name: '@all' },
    { pattern: /@here\b/gi, replacement: '@\u200Bhere', name: '@here' },
    { pattern: /@channel\b/gi, replacement: '@\u200Bchannel', name: '@channel' },
    { pattern: /@everyone\b/gi, replacement: '@\u200Beveryone', name: '@everyone' },
];

// URL patterns that might be malicious
const URL_PATTERNS = [
    // JavaScript URLs
    { pattern: /javascript:/gi, replacement: 'javascript\u200B:', name: 'javascript:' },
    // Data URLs (can contain malicious content)
    { pattern: /data:text\/html/gi, replacement: 'data\u200B:text/html', name: 'data:' },
];

export class MessageSanitizer {
    private blockMentions: boolean;
    private blockedMentions: string[];

    constructor() {
        const config = loadConfig();
        this.blockMentions = config.safety.blockMentions;
        this.blockedMentions = config.safety.blockedMentions;
    }

    /**
     * Sanitize message text
     */
    sanitize(text: string): SanitizeResult {
        let result = text;
        const neutralized: string[] = [];

        if (this.blockMentions) {
            // Neutralize dangerous mentions
            for (const mention of DANGEROUS_MENTIONS) {
                if (this.blockedMentions.length === 0 ||
                    this.blockedMentions.includes(mention.name)) {
                    if (mention.pattern.test(result)) {
                        result = result.replace(mention.pattern, mention.replacement);
                        neutralized.push(mention.name);
                    }
                    // Reset regex lastIndex
                    mention.pattern.lastIndex = 0;
                }
            }
        }

        // Always neutralize potentially dangerous URLs
        for (const urlPattern of URL_PATTERNS) {
            if (urlPattern.pattern.test(result)) {
                result = result.replace(urlPattern.pattern, urlPattern.replacement);
                neutralized.push(urlPattern.name);
            }
            urlPattern.pattern.lastIndex = 0;
        }

        return {
            text: result,
            modified: result !== text,
            neutralized
        };
    }

    /**
     * Check if text contains dangerous patterns without modifying
     */
    check(text: string): { hasDangerousPatterns: boolean; patterns: string[] } {
        const patterns: string[] = [];

        for (const mention of DANGEROUS_MENTIONS) {
            if (mention.pattern.test(text)) {
                patterns.push(mention.name);
            }
            mention.pattern.lastIndex = 0;
        }

        for (const urlPattern of URL_PATTERNS) {
            if (urlPattern.pattern.test(text)) {
                patterns.push(urlPattern.name);
            }
            urlPattern.pattern.lastIndex = 0;
        }

        return {
            hasDangerousPatterns: patterns.length > 0,
            patterns
        };
    }

    /**
     * Get current configuration
     */
    getConfig(): { blockMentions: boolean; blockedMentions: string[] } {
        return {
            blockMentions: this.blockMentions,
            blockedMentions: [...this.blockedMentions]
        };
    }
}

// Singleton instance
let sanitizerInstance: MessageSanitizer | null = null;

export function getSanitizer(): MessageSanitizer {
    if (!sanitizerInstance) {
        sanitizerInstance = new MessageSanitizer();
    }
    return sanitizerInstance;
}

export function resetSanitizer(): void {
    sanitizerInstance = null;
}
