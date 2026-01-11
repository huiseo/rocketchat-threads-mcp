/**
 * Time expression parser
 * Supports: 1d, 7d, 1w, 1m, ISO dates
 */

export interface TimeRange {
    oldest: Date;
    latest: Date;
    start: Date;
    end: Date;
}

/**
 * Parse time expression to date range
 *
 * @param expr - Time expression: "1d", "7d", "1w", "1m", or ISO date
 * @returns TimeRange with oldest and latest dates
 *
 * @example
 * parseTimeExpression("1d")  // Today since midnight
 * parseTimeExpression("7d")  // Last 7 days
 * parseTimeExpression("1w")  // Last week (same as 7d)
 * parseTimeExpression("1m")  // Last month
 * parseTimeExpression("2024-01-01")  // Since specific date
 */
export function parseTimeExpression(expr: string): TimeRange {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Relative time: 1d, 7d, 1w, 1m
    const relativeMatch = expr.match(/^(\d+)([dwm])$/);
    if (relativeMatch) {
        const num = parseInt(relativeMatch[1], 10);
        const unit = relativeMatch[2];

        let oldest: Date;
        switch (unit) {
            case 'd':
                oldest = new Date(startOfToday.getTime() - (num - 1) * 24 * 60 * 60 * 1000);
                break;
            case 'w':
                oldest = new Date(startOfToday.getTime() - (num * 7 - 1) * 24 * 60 * 60 * 1000);
                break;
            case 'm':
                oldest = new Date(startOfToday);
                oldest.setMonth(oldest.getMonth() - num);
                break;
            default:
                throw new Error(`Invalid time unit: ${unit}`);
        }

        return { oldest, latest: now, start: oldest, end: now };
    }

    // ISO date: 2024-01-01
    const dateMatch = expr.match(/^(\d{4}-\d{2}-\d{2})$/);
    if (dateMatch) {
        const oldest = new Date(dateMatch[1]);
        if (isNaN(oldest.getTime())) {
            throw new Error(`Invalid date format: ${expr}`);
        }
        return { oldest, latest: now, start: oldest, end: now };
    }

    // Unix timestamp (10 digits)
    const unixMatch = expr.match(/^(\d{10})$/);
    if (unixMatch) {
        const oldest = new Date(parseInt(unixMatch[1], 10) * 1000);
        return { oldest, latest: now, start: oldest, end: now };
    }

    throw new Error(
        `Invalid time expression: "${expr}". ` +
        `Use formats like "1d", "7d", "1w", "1m", or ISO date "2024-01-01"`
    );
}

/**
 * Convert Date to Rocket.Chat timestamp format
 */
export function toRocketChatTimestamp(date: Date): string {
    return date.toISOString();
}

/**
 * Format date for display
 */
export function formatDate(date: Date): string {
    return date.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Format relative time ago
 */
export function timeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(date);
}
