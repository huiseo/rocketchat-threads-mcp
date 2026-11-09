/**
 * Stubs the Rocket.Chat REST API at the network boundary (global fetch)
 */

import { vi } from 'vitest';
import { ToolResult } from '../../tools/base.js';

export function stubRocketChatEnv(): void {
    vi.stubEnv('ROCKETCHAT_URL', 'https://chat.example.com');
    vi.stubEnv('ROCKETCHAT_AUTH_TOKEN', 'test-token');
    vi.stubEnv('ROCKETCHAT_USER_ID', 'user-me');
}

/**
 * Answers each endpoint (e.g. "/dm.history") with its canned JSON body.
 * Any other endpoint fails with an error naming it.
 */
export function stubRocketChatApi(responses: Record<string, unknown>): { queryOf: (endpoint: string) => Record<string, string> } {
    const requests: URL[] = [];

    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input));
        requests.push(url);
        const endpoint = url.pathname.replace('/api/v1', '');
        const body = responses[endpoint];
        return body === undefined
            ? new Response(`Unexpected request to ${endpoint} in test stub`, { status: 500 })
            : new Response(JSON.stringify(body), { status: 200 });
    }));

    return {
        queryOf: (endpoint) => Object.fromEntries(
            requests.find(url => url.pathname.endsWith(endpoint))?.searchParams ?? []
        )
    };
}

export function readToolData(result: ToolResult): unknown {
    return JSON.parse(result.content[0].text).data;
}
