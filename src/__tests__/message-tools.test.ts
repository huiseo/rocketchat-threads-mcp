/**
 * rocketchat_get_messages: works for every room type, time filter is applied by the server
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getMessagesTool } from '../tools/message-tools.js';
import { resetClient } from '../api/client.js';
import { buildMessage, buildRoom } from './data/rocketchat.js';
import { readToolData, stubRocketChatApi, stubRocketChatEnv } from './helpers/rocketchat-api.js';

describe('rocketchat_get_messages', () => {
    beforeEach(() => {
        stubRocketChatEnv();
        resetClient();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
    });

    it.each([
        { roomType: 'c', endpoint: '/channels.messages' },
        { roomType: 'p', endpoint: '/groups.messages' },
        { roomType: 'd', endpoint: '/dm.messages' }
    ] as const)('when the room type is "$roomType", messages are read from $endpoint', async ({ roomType, endpoint }) => {
        const room = buildRoom({ t: roomType });
        const message = buildMessage({ rid: room._id });
        stubRocketChatApi({
            '/rooms.info': { room, success: true },
            [endpoint]: { messages: [message], count: 1, offset: 0, total: 1, success: true }
        });

        const result = await getMessagesTool.handler({ roomId: room._id });

        expect(readToolData(result)).toEqual([expect.objectContaining({ id: message._id })]);
    });

    it('when a time range is given for a direct message, the history with thread replies is requested from the start of the range', async () => {
        const room = buildRoom({ t: 'd' });
        const api = stubRocketChatApi({
            '/rooms.info': { room, success: true },
            '/dm.history': { messages: [buildMessage({ rid: room._id })], success: true }
        });

        await getMessagesTool.handler({ roomId: room._id, timeRange: '2026-11-06' });

        expect(api.queryOf('/dm.history')).toMatchObject({
            roomId: room._id,
            oldest: '2026-11-06T00:00:00.000Z',
            showThreadMessages: 'true'
        });
    });
});
