/**
 * rocketchat_list_active_rooms: rooms with new messages since a time, with the user's unread counters
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { listActiveRoomsTool } from '../tools/channel-tools.js';
import { resetClient } from '../api/client.js';
import { buildRoom, buildSubscription } from './data/rocketchat.js';
import { readToolData, stubRocketChatApi, stubRocketChatEnv } from './helpers/rocketchat-api.js';

describe('rocketchat_list_active_rooms', () => {
    beforeEach(() => {
        stubRocketChatEnv();
        resetClient();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
    });

    it('when a room changed since the date but its last message is older, it is not listed', async () => {
        const directWithNewMessage = buildRoom({ t: 'd', lm: '2026-11-08T12:00:00.000Z' });
        const directWithOnlyOldMessages = buildRoom({ t: 'd', lm: '2026-11-02T09:00:00.000Z', _updatedAt: '2026-11-07T08:00:00.000Z' });
        stubRocketChatApi({
            '/rooms.get': { update: [directWithOnlyOldMessages, directWithNewMessage], success: true },
            '/subscriptions.get': { update: [], success: true }
        });

        const result = await listActiveRoomsTool.handler({ since: '2026-11-06' });

        expect(readToolData(result)).toEqual([expect.objectContaining({ id: directWithNewMessage._id })]);
    });

    it('when only direct messages are requested, an active private group is not listed', async () => {
        const activeDirect = buildRoom({ t: 'd', lm: '2026-11-08T12:00:00.000Z' });
        const activeGroup = buildRoom({ t: 'p', lm: '2026-11-08T13:00:00.000Z' });
        stubRocketChatApi({
            '/rooms.get': { update: [activeGroup, activeDirect], success: true },
            '/subscriptions.get': { update: [], success: true }
        });

        const result = await listActiveRoomsTool.handler({ since: '2026-11-06', types: ['direct'] });

        expect(readToolData(result)).toEqual([expect.objectContaining({ id: activeDirect._id })]);
    });

    it('when several rooms are active, the one with the latest message comes first', async () => {
        const earlierDirect = buildRoom({ t: 'd', lm: '2026-11-06T10:30:00.000Z' });
        const laterDirect = buildRoom({ t: 'd', lm: '2026-11-08T12:00:00.000Z' });
        stubRocketChatApi({
            '/rooms.get': { update: [earlierDirect, laterDirect], success: true },
            '/subscriptions.get': { update: [], success: true }
        });

        const result = await listActiveRoomsTool.handler({ since: '2026-11-06' });

        expect(readToolData(result)).toEqual([
            expect.objectContaining({ id: laterDirect._id }),
            expect.objectContaining({ id: earlierDirect._id })
        ]);
    });

    it('when a group only got an unread thread reply since the date, it is listed with that thread', async () => {
        const group = buildRoom({ t: 'p', lm: '2026-11-04T09:00:00.000Z', _updatedAt: '2026-11-08T22:26:00.000Z' });
        const subscription = buildSubscription({ rid: group._id, t: 'p', tunread: ['thread-release-plan'], _updatedAt: '2026-11-08T22:26:00.000Z' });
        stubRocketChatApi({
            '/rooms.get': { update: [group], success: true },
            '/subscriptions.get': { update: [subscription], success: true }
        });

        const result = await listActiveRoomsTool.handler({ since: '2026-11-06' });

        expect(readToolData(result)).toEqual([expect.objectContaining({ id: group._id, unreadThreads: 1 })]);
    });

    it('when a direct message has unread messages, the other person and the counters come from the subscription', async () => {
        const direct = buildRoom({ t: 'd', name: undefined, usernames: ['alice.johnson', 'bob.miller'], lm: '2026-11-08T12:00:00.000Z' });
        const subscription = buildSubscription({ rid: direct._id, fname: 'Alice Johnson', unread: 3, userMentions: 1 });
        stubRocketChatApi({
            '/rooms.get': { update: [direct], success: true },
            '/subscriptions.get': { update: [subscription], success: true }
        });

        const result = await listActiveRoomsTool.handler({ since: '2026-11-06' });

        expect(readToolData(result)).toEqual([
            expect.objectContaining({ name: subscription.fname, unread: subscription.unread, mentions: subscription.userMentions })
        ]);
    });
});
