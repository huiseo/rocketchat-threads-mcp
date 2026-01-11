/**
 * Message Formatter Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
    formatMessage,
    formatMessages,
    formatChannel,
    formatChannels,
    formatThread,
    formatUser,
    createSearchSummary
} from '../formatters/message-formatter.js';
import { RocketChatMessage, RocketChatRoom, RocketChatUser, SearchResultMessage } from '../api/types.js';

describe('formatMessage', () => {
    const mockMessage: RocketChatMessage = {
        _id: 'msg123',
        rid: 'room456',
        msg: 'Hello world',
        ts: '2026-01-11T10:00:00.000Z',
        u: { _id: 'user1', username: 'testuser', name: 'Test User' },
        _updatedAt: '2026-01-11T10:00:00.000Z'
    };

    it('should format basic message correctly', () => {
        const result = formatMessage(mockMessage);

        expect(result.id).toBe('msg123');
        expect(result.roomId).toBe('room456');
        expect(result.text).toBe('Hello world');
        expect(result.author.username).toBe('testuser');
        expect(result.timestamp).toBe('2026-01-11T10:00:00.000Z');
    });

    it('should handle message with reactions', () => {
        const msgWithReactions: RocketChatMessage = {
            ...mockMessage,
            reactions: {
                ':thumbsup:': { usernames: ['user1', 'user2'] },
                ':heart:': { usernames: ['user3'] }
            }
        };

        const result = formatMessage(msgWithReactions);
        expect(result.reactions).toEqual({
            ':thumbsup:': 2,
            ':heart:': 1
        });
    });

    it('should handle message with attachments', () => {
        const msgWithAttachments: RocketChatMessage = {
            ...mockMessage,
            attachments: [{ title: 'file.pdf' }]
        };

        const result = formatMessage(msgWithAttachments);
        expect(result.hasAttachments).toBe(true);
    });

    it('should handle pinned message', () => {
        const pinnedMsg: RocketChatMessage = {
            ...mockMessage,
            pinned: true
        };

        const result = formatMessage(pinnedMsg);
        expect(result.isPinned).toBe(true);
    });

    it('should handle thread message', () => {
        const threadMsg: RocketChatMessage = {
            ...mockMessage,
            tmid: 'parent123',
            tcount: 5,
            tlm: '2026-01-11T11:00:00.000Z'
        };

        const result = formatMessage(threadMsg);
        expect(result.threadId).toBe('parent123');
        expect(result.replyCount).toBe(5);
    });

    it('should handle OpenSearch fields', () => {
        const searchResult: SearchResultMessage = {
            ...mockMessage,
            _highlight: '<mark>Hello</mark> world',
            _score: 1.5
        };

        const result = formatMessage(searchResult);
        expect(result.highlight).toBe('<mark>Hello</mark> world');
        expect(result.score).toBe(1.5);
    });

    it('should handle null _score', () => {
        const searchResult: SearchResultMessage = {
            ...mockMessage,
            _highlight: 'test',
            _score: null
        };

        const result = formatMessage(searchResult);
        expect(result.score).toBeNull();
    });
});

describe('formatMessages', () => {
    it('should format multiple messages', () => {
        const messages: RocketChatMessage[] = [
            { _id: '1', rid: 'r1', msg: 'First', ts: '2026-01-11T10:00:00Z', u: { _id: 'u1', username: 'user1' }, _updatedAt: '2026-01-11T10:00:00Z' },
            { _id: '2', rid: 'r1', msg: 'Second', ts: '2026-01-11T10:01:00Z', u: { _id: 'u2', username: 'user2' }, _updatedAt: '2026-01-11T10:01:00Z' }
        ];

        const result = formatMessages(messages);
        expect(result).toHaveLength(2);
        expect(result[0].text).toBe('First');
        expect(result[1].text).toBe('Second');
    });

    it('should handle empty array', () => {
        const result = formatMessages([]);
        expect(result).toHaveLength(0);
    });
});

describe('formatChannel', () => {
    const mockRoom: RocketChatRoom = {
        _id: 'room123',
        name: 'general',
        fname: 'General Chat',
        t: 'c',
        msgs: 100,
        usersCount: 10,
        u: { _id: 'owner1', username: 'admin' },
        ts: '2026-01-01T00:00:00Z',
        _updatedAt: '2026-01-11T10:00:00Z'
    };

    it('should format channel correctly', () => {
        const result = formatChannel(mockRoom);

        expect(result.id).toBe('room123');
        expect(result.name).toBe('general');
        expect(result.displayName).toBe('General Chat');
        expect(result.type).toBe('public');
        expect(result.messageCount).toBe(100);
        expect(result.memberCount).toBe(10);
    });

    it('should map channel types correctly', () => {
        expect(formatChannel({ ...mockRoom, t: 'c' }).type).toBe('public');
        expect(formatChannel({ ...mockRoom, t: 'p' }).type).toBe('private');
        expect(formatChannel({ ...mockRoom, t: 'd' }).type).toBe('direct');
        expect(formatChannel({ ...mockRoom, t: 'l' }).type).toBe('livechat');
    });

    it('should handle read-only channel', () => {
        const readOnlyRoom = { ...mockRoom, ro: true };
        expect(formatChannel(readOnlyRoom).isReadOnly).toBe(true);
    });
});

describe('formatUser', () => {
    const mockUser: RocketChatUser = {
        _id: 'user123',
        username: 'johndoe',
        name: 'John Doe',
        status: 'online',
        emails: [{ address: 'john@example.com', verified: true }],
        roles: ['user', 'moderator']
    };

    it('should format user correctly', () => {
        const result = formatUser(mockUser);

        expect(result.id).toBe('user123');
        expect(result.username).toBe('johndoe');
        expect(result.displayName).toBe('John Doe');
        expect(result.status).toBe('online');
        expect(result.email).toBe('john@example.com');
        expect(result.roles).toContain('moderator');
    });

    it('should handle user without email', () => {
        const userNoEmail = { ...mockUser, emails: undefined };
        const result = formatUser(userNoEmail);
        expect(result.email).toBeUndefined();
    });

    it('should default status to offline', () => {
        const userNoStatus = { ...mockUser, status: undefined };
        const result = formatUser(userNoStatus);
        expect(result.status).toBe('offline');
    });
});

describe('createSearchSummary', () => {
    it('should create search summary', () => {
        const messages: RocketChatMessage[] = [
            { _id: '1', rid: 'room1', msg: 'test', ts: '2026-01-10T10:00:00Z', u: { _id: 'u1', username: 'u1' }, _updatedAt: '2026-01-10T10:00:00Z' },
            { _id: '2', rid: 'room2', msg: 'test', ts: '2026-01-11T10:00:00Z', u: { _id: 'u2', username: 'u2' }, _updatedAt: '2026-01-11T10:00:00Z' }
        ];

        const result = createSearchSummary('test query', messages, 100);

        expect(result.query).toBe('test query');
        expect(result.totalResults).toBe(100);
        expect(result.channels).toBe(2);
        expect(result.messages).toBe(2);
        expect(result.timeRange?.oldest).toContain('2026-01-10');
        expect(result.timeRange?.newest).toContain('2026-01-11');
    });

    it('should handle empty messages', () => {
        const result = createSearchSummary('query', [], 0);
        expect(result.messages).toBe(0);
        expect(result.timeRange).toBeUndefined();
    });
});
