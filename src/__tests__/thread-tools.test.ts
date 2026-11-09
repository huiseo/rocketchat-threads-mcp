/**
 * rocketchat_list_threads: the time filter matches thread activity, not thread creation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { listThreadsTool } from '../tools/thread-tools.js';
import { resetClient } from '../api/client.js';
import { buildMessage } from './data/rocketchat.js';
import { readToolData, stubRocketChatApi, stubRocketChatEnv } from './helpers/rocketchat-api.js';

describe('rocketchat_list_threads', () => {
    beforeEach(() => {
        stubRocketChatEnv();
        resetClient();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
    });

    it('when an old thread got a reply inside the range, it is listed while a thread without fresh replies is not', async () => {
        const revivedThread = buildMessage({ ts: '2026-11-03T08:00:00.000Z', tlm: '2026-11-08T22:00:00.000Z', tcount: 4 });
        const quietThread = buildMessage({ ts: '2026-11-03T09:00:00.000Z', tlm: '2026-11-04T10:00:00.000Z', tcount: 2 });
        stubRocketChatApi({
            '/chat.getThreadsList': { threads: [revivedThread, quietThread], count: 2, offset: 0, total: 2, success: true }
        });

        const result = await listThreadsTool.handler({ roomId: 'room-general', timeRange: '2026-11-06' });

        expect(readToolData(result)).toEqual([expect.objectContaining({ id: revivedThread._id })]);
    });
});
