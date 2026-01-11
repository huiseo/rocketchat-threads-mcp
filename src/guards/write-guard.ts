/**
 * Write Guard - Controls write operations to channels
 * Provides whitelist/blacklist based access control
 */

import { loadConfig } from '../config/config.js';

export interface WriteCheckResult {
    allowed: boolean;
    reason?: string;
}

export class WriteGuard {
    private enabled: boolean;
    private whitelist: string[];
    private blacklist: string[];

    constructor() {
        const config = loadConfig();
        this.enabled = config.write.enabled;
        this.whitelist = config.write.whitelist;
        this.blacklist = config.write.blacklist;
    }

    /**
     * Check if write operation is allowed for a room
     */
    checkWrite(roomId: string, roomName?: string): WriteCheckResult {
        // If write is globally disabled
        if (!this.enabled) {
            return {
                allowed: false,
                reason: 'Write operations are disabled. Set ROCKETCHAT_WRITE_ENABLED=true to enable.'
            };
        }

        const identifiers = [roomId];
        if (roomName) {
            identifiers.push(roomName);
        }

        // Check blacklist first (takes precedence)
        for (const id of identifiers) {
            if (this.blacklist.includes(id)) {
                return {
                    allowed: false,
                    reason: `Room "${id}" is in the blacklist and cannot be written to.`
                };
            }
        }

        // If whitelist is empty, all non-blacklisted rooms are allowed
        if (this.whitelist.length === 0) {
            return { allowed: true };
        }

        // Check if room is in whitelist
        for (const id of identifiers) {
            if (this.whitelist.includes(id)) {
                return { allowed: true };
            }
        }

        // Room not in whitelist
        return {
            allowed: false,
            reason: `Room "${roomId}" is not in the whitelist. Allowed rooms: ${this.whitelist.join(', ')}`
        };
    }

    /**
     * Check if write is globally enabled
     */
    isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Get current configuration
     */
    getConfig(): { enabled: boolean; whitelist: string[]; blacklist: string[] } {
        return {
            enabled: this.enabled,
            whitelist: [...this.whitelist],
            blacklist: [...this.blacklist]
        };
    }
}

// Singleton instance
let writeGuardInstance: WriteGuard | null = null;

export function getWriteGuard(): WriteGuard {
    if (!writeGuardInstance) {
        writeGuardInstance = new WriteGuard();
    }
    return writeGuardInstance;
}

export function resetWriteGuard(): void {
    writeGuardInstance = null;
}
