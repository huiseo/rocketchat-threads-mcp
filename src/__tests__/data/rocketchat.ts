/**
 * Test data factories for Rocket.Chat API entities
 */

import { randomUUID } from 'node:crypto';
import { RocketChatMessage, RocketChatRoom, RocketChatSubscription } from '../../api/types.js';

export function buildMessage(overrides: Partial<RocketChatMessage> = {}): RocketChatMessage {
    return {
        _id: randomUUID(),
        rid: 'room-general',
        msg: 'Release candidate is ready for testing',
        ts: '2026-11-06T10:00:00.000Z',
        u: { _id: 'user-alice', username: 'alice.johnson', name: 'Alice Johnson' },
        _updatedAt: '2026-11-06T10:00:00.000Z',
        ...overrides
    };
}

export function buildRoom(overrides: Partial<RocketChatRoom> = {}): RocketChatRoom {
    return {
        _id: randomUUID(),
        t: 'c',
        name: 'release-planning',
        msgs: 120,
        usersCount: 8,
        u: { _id: 'user-alice', username: 'alice.johnson' },
        ts: '2026-01-15T09:00:00.000Z',
        _updatedAt: '2026-11-06T10:00:00.000Z',
        lm: '2026-11-06T10:00:00.000Z',
        ...overrides
    };
}

export function buildSubscription(overrides: Partial<RocketChatSubscription> = {}): RocketChatSubscription {
    return {
        _id: randomUUID(),
        rid: 'room-direct-alice',
        t: 'd',
        name: 'alice.johnson',
        fname: 'Alice Johnson',
        unread: 0,
        userMentions: 0,
        _updatedAt: '2026-11-06T10:00:00.000Z',
        ...overrides
    };
}
