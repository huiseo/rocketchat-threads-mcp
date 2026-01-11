/**
 * Token counting utility for preventing response size overflow
 * Estimates token count based on character length (rough approximation)
 */

export interface TruncateResult<T> {
    items: T[];
    truncated: boolean;
    originalCount: number;
}

export class TokenCounter {
    // Rough estimation: 1 token ≈ 4 characters
    private static readonly CHARS_PER_TOKEN = 4;

    // MCP response character limit (~25,000 tokens)
    private static readonly MAX_RESPONSE_CHARS = 100000;

    // Safety buffer to ensure we don't exceed limits
    private static readonly SAFETY_BUFFER = 4000;

    /**
     * Estimate token count from text
     */
    static estimateTokens(text: string): number {
        return Math.ceil(text.length / this.CHARS_PER_TOKEN);
    }

    /**
     * Check if text would exceed token limit
     */
    static wouldExceedLimit(text: string): boolean {
        return text.length > (this.MAX_RESPONSE_CHARS - this.SAFETY_BUFFER);
    }

    /**
     * Get maximum safe character count
     */
    static getMaxSafeChars(): number {
        return this.MAX_RESPONSE_CHARS - this.SAFETY_BUFFER;
    }

    /**
     * Get safe limit for number of items based on average item size
     */
    static getSafeItemLimit(sampleItem: unknown, maxItems: number = 100): number {
        const sampleText = JSON.stringify(sampleItem);
        const charsPerItem = sampleText.length;
        const maxChars = this.MAX_RESPONSE_CHARS - this.SAFETY_BUFFER;
        const safeItemCount = Math.floor(maxChars / charsPerItem);

        return Math.min(safeItemCount, maxItems);
    }

    /**
     * Truncate array to fit within token limit
     */
    static truncateToFit<T>(
        items: T[],
        stringify: (item: T) => string = JSON.stringify
    ): TruncateResult<T> {
        const maxChars = this.MAX_RESPONSE_CHARS - this.SAFETY_BUFFER;
        let totalSize = 0;
        const safeItems: T[] = [];

        for (const item of items) {
            const itemSize = stringify(item).length;
            if (totalSize + itemSize > maxChars) {
                return {
                    items: safeItems,
                    truncated: true,
                    originalCount: items.length
                };
            }
            safeItems.push(item);
            totalSize += itemSize;
        }

        return {
            items: safeItems,
            truncated: false,
            originalCount: items.length
        };
    }

    /**
     * Truncate text to fit within limit
     */
    static truncateText(text: string, maxChars?: number): { text: string; truncated: boolean } {
        const limit = maxChars || (this.MAX_RESPONSE_CHARS - this.SAFETY_BUFFER);

        if (text.length <= limit) {
            return { text, truncated: false };
        }

        const truncatedText = text.substring(0, limit - 20) + '... [truncated]';
        return { text: truncatedText, truncated: true };
    }
}
