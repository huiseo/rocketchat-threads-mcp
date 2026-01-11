# 우수한 MCP(Model Context Protocol) 설계 기준서

> AI Agent가 효과적으로 외부 시스템과 상호작용하기 위한 MCP 설계 필수 항목 및 품질 기준

---

## 목차

1. [개요](#1-개요)
2. [도구(Tool) 설계](#2-도구tool-설계)
3. [스키마(Schema) 설계](#3-스키마schema-설계)
4. [응답(Response) 설계](#4-응답response-설계)
5. [에러 처리(Error Handling)](#5-에러-처리error-handling)
6. [안전성(Safety)](#6-안전성safety)
7. [성능 및 효율성(Performance)](#7-성능-및-효율성performance)
8. [아키텍처(Architecture)](#8-아키텍처architecture)
9. [지식 데이터 활용을 위한 MCP 설계](#9-지식-데이터-활용을-위한-mcp-설계)
10. [체크리스트](#10-체크리스트)

---

## 1. 개요

### 1.1 MCP란?

MCP(Model Context Protocol)는 AI Agent(LLM)가 외부 시스템의 기능을 **도구(Tool)**로 사용할 수 있게 해주는 프로토콜이다.

```
┌─────────────────────────────────────────────────────────────────┐
│                        MCP 동작 흐름                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   사용자 → "개발팀 채널에서 오늘 논의된 내용 요약해줘"             │
│                          ↓                                       │
│   AI Agent (LLM)                                                │
│   ├── 1. 요청 분석: "채널 조회 필요"                              │
│   ├── 2. 도구 선택: rocketchat_get_messages                     │
│   ├── 3. 파라미터 결정: channel="개발팀", time_range="1d"        │
│   └── 4. 도구 호출                                               │
│                          ↓                                       │
│   MCP Server                                                     │
│   ├── 파라미터 검증                                              │
│   ├── API 호출                                                   │
│   └── 응답 포맷팅                                                │
│                          ↓                                       │
│   AI Agent → 결과 분석 → 요약 생성 → 사용자에게 응답             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 우수한 MCP의 핵심 원칙

| 원칙 | 설명 | 예시 |
|------|------|------|
| **결정론적 참조** | 모호하지 않은 식별자 사용 | 채널 이름 → 채널 ID 변환 제공 |
| **자기 설명적** | 도구와 응답이 스스로를 설명 | 결과 + 다음 가능한 액션 포함 |
| **안전 기본** | 위험한 작업은 기본 비활성화 | 쓰기 도구는 opt-in |
| **토큰 효율** | LLM 컨텍스트 낭비 방지 | 응답 크기 제한, 자동 truncate |
| **실패 복구** | 에러 시 해결 방법 제시 | What-Why-How 에러 메시지 |

---

## 2. 도구(Tool) 설계

### 2.1 도구 이름 명명 규칙

#### 필수 규칙

```
형식: {서비스}_{동사}_{대상}

예시:
✓ rocketchat_get_messages      (서비스_동사_대상)
✓ rocketchat_send_message      (단수형 - 하나씩 전송)
✓ rocketchat_list_channels     (복수형 - 목록 조회)
✓ rocketchat_search_users      (동사가 행위를 명확히 설명)

✗ getMessage                   (서비스 접두사 없음)
✗ rocketchat_messages          (동사 없음)
✗ rc_get_msg                   (약어 사용)
✗ rocketchat_getMessages       (camelCase 혼용)
```

#### 동사 가이드라인

| 동사 | 용도 | 예시 |
|------|------|------|
| `get` | 단일 항목 조회 | `get_message`, `get_user` |
| `list` | 목록 조회 | `list_channels`, `list_users` |
| `search` | 검색/필터링 | `search_messages`, `search_channels` |
| `send` | 전송/생성 | `send_message`, `send_file` |
| `reply` | 답장 | `reply_thread` |
| `add` | 추가 | `add_reaction`, `add_member` |
| `remove` | 제거 | `remove_reaction`, `remove_member` |
| `update` | 수정 | `update_message`, `update_profile` |
| `delete` | 삭제 | `delete_message` |
| `lookup` | 이름→ID 변환 | `lookup_user`, `lookup_channel` |
| `parse` | 파싱/추출 | `parse_url` |

### 2.2 도구 설명(Description) 작성법

#### 나쁜 예시

```typescript
// ❌ 너무 짧음
description: "Get messages"

// ❌ 기술적 용어만
description: "Retrieves message objects from the conversations.history API endpoint"
```

#### 좋은 예시

```typescript
// ✓ 완전한 도구 설명
description: `
Retrieve recent messages from a channel.

USE WHEN:
- Understanding recent conversation context
- Finding specific messages by content
- Checking what was discussed in a time period

RETURNS:
- Messages in reverse chronological order (newest first)
- Each message includes: id, sender, text, timestamp, thread info

RELATED TOOLS:
- Use rocketchat_search_channels to find channel ID by name
- Use rocketchat_get_thread for thread replies
- Use rocketchat_search_messages for keyword search across channels

LIMITS:
- Default: 20 messages
- Maximum: 100 messages per request
- For older messages, use 'before' parameter for pagination
`.trim()
```

#### 도구 설명 필수 요소

| 요소 | 설명 | 필수 여부 |
|------|------|----------|
| **기능 요약** | 도구가 무엇을 하는지 한 문장 | 필수 |
| **사용 시점** | 언제 이 도구를 사용하는지 | 필수 |
| **반환 정보** | 어떤 데이터가 반환되는지 | 필수 |
| **관련 도구** | 함께 사용하면 좋은 도구 | 권장 |
| **제한 사항** | 한계, 제약 조건 | 권장 |
| **예시** | 실제 사용 예시 | 선택 |

### 2.3 도구 분류 및 구성

#### 필수 도구 카테고리

```
읽기 도구 (Read) - 기본 활성화
├── 목록 조회: list_channels, list_users
├── 상세 조회: get_messages, get_thread, get_user_info
├── 검색: search_channels, search_messages, search_users
└── 변환: lookup_user, lookup_channel, parse_url

쓰기 도구 (Write) - 선택적 활성화
├── 생성: send_message, reply_thread
├── 수정: update_message, add_reaction
└── 삭제: delete_message, remove_reaction

관리 도구 (Admin) - 제한적 활성화
├── 채널 관리: create_channel, archive_channel
└── 멤버 관리: invite_user, kick_user
```

#### 통합 도구 패턴

복잡한 워크플로를 단일 도구로 제공:

```typescript
// ❌ 분리된 도구 - AI가 3단계 실행 필요
// 1. search_users("김철수")
// 2. open_dm_channel(user_id)
// 3. send_message(channel_id, text)

// ✓ 통합 도구 - 한 번에 실행
{
    name: "rocketchat_message_user",
    description: `
        Send a direct message to a user by name, email, or ID.

        This tool combines user lookup, DM channel creation, and message sending.
        No need to call separate tools for each step.

        ACCEPTS:
        - Username: "john.doe"
        - Display name: "John Doe"
        - Email: "john@example.com"
        - User ID: "user123"
    `,
    parameters: {
        user: { type: "string", description: "User identifier (name, email, or ID)" },
        text: { type: "string", description: "Message to send" }
    }
}
```

---

## 3. 스키마(Schema) 설계

### 3.1 파라미터 설명 품질

#### 레벨별 비교

```typescript
// Level 1: 최소 (❌ 부족)
channel_id: { type: "string" }

// Level 2: 기본 (⚠️ 불충분)
channel_id: {
    type: "string",
    description: "The ID of the channel"
}

// Level 3: 상세 (✓ 권장)
channel_id: {
    type: "string",
    description: `
        Unique identifier for the channel.

        FORMAT: 17-character alphanumeric string
        EXAMPLE: "GENERAL" or "hGE7sBz8WW4JiFxPy"

        HOW TO GET:
        - Use rocketchat_list_channels to see all channels
        - Use rocketchat_search_channels to find by name
        - Extract from message URL using rocketchat_parse_url
    `.trim()
}

// Level 4: 완전 (✓✓ 이상적)
channel_id: {
    type: "string",
    description: `
        Unique identifier for the channel.

        FORMAT: 17-character alphanumeric string (e.g., "hGE7sBz8WW4JiFxPy")
        SPECIAL: "GENERAL" for the default channel

        HOW TO GET:
        - From channel list: rocketchat_list_channels
        - By name search: rocketchat_search_channels(query="개발팀")
        - From URL: rocketchat_parse_url(url="https://...")

        NOTE: This is NOT the channel name. Channel names like "#general"
        must be converted to IDs first using lookup tools.
    `.trim(),
    pattern: "^[a-zA-Z0-9]{17}$|^GENERAL$",
    examples: ["hGE7sBz8WW4JiFxPy", "GENERAL"]
}
```

### 3.2 필수 파라미터 설명 항목

| 항목 | 설명 | 예시 |
|------|------|------|
| **형식(FORMAT)** | 값의 형태, 패턴 | "17자 영숫자", "ISO 8601 날짜" |
| **예시(EXAMPLE)** | 실제 값 예시 | `"hGE7sBz8WW4JiFxPy"` |
| **획득 방법(HOW TO GET)** | 이 값을 얻는 방법 | "rocketchat_list_channels에서 획득" |
| **주의사항(NOTE)** | 흔한 실수 방지 | "채널 이름이 아닌 ID를 사용" |

### 3.3 시간 파라미터 설계

#### 시간 표현식 지원 (권장)

```typescript
time_range: {
    type: "string",
    description: `
        Time range for message retrieval.

        FORMATS SUPPORTED:
        - Relative: "1d" (1 day), "7d" (7 days), "1w" (1 week), "1m" (1 month)
        - Absolute: "2024-01-01" to "2024-01-15"
        - Unix timestamp: "1704067200"

        EXAMPLES:
        - "1d" → Messages from today (since midnight)
        - "7d" → Messages from last 7 days
        - "1w" → Same as "7d"
        - "1m" → Messages from last month

        DEFAULT: "1d" (today's messages)
    `.trim(),
    pattern: "^(\\d+[dwm]|\\d{4}-\\d{2}-\\d{2}|\\d{10})$",
    default: "1d"
}
```

#### 시간 표현식 파싱 구현

```typescript
interface TimeRange {
    oldest: Date;
    latest: Date;
}

function parseTimeExpression(expr: string): TimeRange {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 상대 시간: 1d, 7d, 1w, 1m
    const relativeMatch = expr.match(/^(\d+)([dwm])$/);
    if (relativeMatch) {
        const [, numStr, unit] = relativeMatch;
        const num = parseInt(numStr);

        switch (unit) {
            case 'd':
                return {
                    oldest: new Date(startOfToday.getTime() - (num - 1) * 24 * 60 * 60 * 1000),
                    latest: now
                };
            case 'w':
                return {
                    oldest: new Date(startOfToday.getTime() - (num * 7 - 1) * 24 * 60 * 60 * 1000),
                    latest: now
                };
            case 'm':
                const oldestMonth = new Date(startOfToday);
                oldestMonth.setMonth(oldestMonth.getMonth() - num);
                return { oldest: oldestMonth, latest: now };
        }
    }

    // ISO 날짜: 2024-01-01
    const dateMatch = expr.match(/^(\d{4}-\d{2}-\d{2})$/);
    if (dateMatch) {
        return {
            oldest: new Date(dateMatch[1]),
            latest: now
        };
    }

    // Unix timestamp
    const unixMatch = expr.match(/^(\d{10})$/);
    if (unixMatch) {
        return {
            oldest: new Date(parseInt(unixMatch[1]) * 1000),
            latest: now
        };
    }

    throw new Error(`Invalid time expression: ${expr}. Use formats like "1d", "7d", "1w", "1m", or "2024-01-01"`);
}
```

### 3.4 검색 파라미터 설계

```typescript
// 채널 검색
{
    name: "rocketchat_search_channels",
    parameters: {
        query: {
            type: "string",
            description: `
                Search query for channels.

                MATCHES AGAINST:
                - Channel name (fuzzy match)
                - Channel topic
                - Channel description

                EXAMPLES:
                - "개발" → Matches "개발팀", "프론트개발", etc.
                - "frontend" → Matches channels with "frontend" in name/topic

                RETURNS: List of matching channels with IDs for use in other tools.
            `.trim()
        },
        type: {
            type: "string",
            enum: ["all", "public", "private", "dm"],
            default: "all",
            description: "Filter by channel type"
        },
        limit: {
            type: "number",
            default: 10,
            maximum: 50,
            description: "Maximum results to return"
        }
    }
}

// 메시지 검색
{
    name: "rocketchat_search_messages",
    parameters: {
        query: {
            type: "string",
            description: "Search keywords. Supports AND/OR operators."
        },
        channel: {
            type: "string",
            description: "Limit search to specific channel (name or ID)"
        },
        from_user: {
            type: "string",
            description: "Filter by sender (username, display name, or ID)"
        },
        time_range: {
            type: "string",
            description: "Time range (e.g., '7d' for last 7 days)"
        },
        has_link: {
            type: "boolean",
            description: "Only messages containing URLs"
        },
        has_file: {
            type: "boolean",
            description: "Only messages with file attachments"
        }
    }
}
```

### 3.5 URL 파싱 도구 설계

```typescript
{
    name: "rocketchat_parse_url",
    description: `
        Parse a Rocket.Chat message URL to extract channel and message IDs.

        USE WHEN:
        - User shares a message link
        - Need to access a specific message from URL
        - Want to reply to a linked message

        SUPPORTED URL FORMATS:
        - https://chat.example.com/channel/general?msg=abc123
        - https://chat.example.com/group/private-team?msg=xyz789
        - https://chat.example.com/direct/user123?msg=msg456

        RETURNS:
        - room_id: Channel/Room ID
        - room_type: "channel" | "group" | "direct"
        - message_id: Message ID (if present in URL)

        NEXT STEPS after parsing:
        - Get message: rocketchat_get_messages(channel_id, around_message)
        - Get thread: rocketchat_get_thread(message_id)
        - Reply: rocketchat_reply_thread(message_id, text)
    `.trim(),
    parameters: {
        url: {
            type: "string",
            description: "Rocket.Chat message or channel URL",
            pattern: "^https?://.*"
        }
    }
}
```

---

## 4. 응답(Response) 설계

### 4.1 자기 설명적 응답 구조

#### 응답 필수 요소

```
┌─────────────────────────────────────────────────────────────────┐
│                     자기 설명적 응답 구조                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. RESULT (결과)                                               │
│     └── 작업 성공/실패 여부 및 핵심 결과 요약                     │
│                                                                  │
│  2. DATA (데이터)                                               │
│     └── 요청한 실제 데이터 (메시지, 사용자 정보 등)               │
│                                                                  │
│  3. METADATA (메타데이터)                                       │
│     └── 총 개수, 페이지 정보, truncated 여부                     │
│                                                                  │
│  4. CONTEXT (컨텍스트)                                          │
│     └── 현재 상태 정보 (채널명, 권한 등)                         │
│                                                                  │
│  5. NEXT ACTIONS (다음 액션)                                    │
│     └── 이어서 할 수 있는 작업과 도구 호출 예시                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 응답 포맷 예시

#### 메시지 조회 응답

```typescript
interface GetMessagesResponse {
    // 1. Result
    success: true;
    summary: "Retrieved 15 messages from #개발팀";

    // 2. Data
    messages: Array<{
        id: string;
        sender: {
            id: string;
            username: string;
            display_name: string;
        };
        text: string;
        timestamp: string;
        thread_id?: string;
        reply_count?: number;
        reactions?: Array<{ emoji: string; count: number }>;
    }>;

    // 3. Metadata
    metadata: {
        total_count: number;
        returned_count: number;
        truncated: boolean;
        has_more: boolean;
        next_cursor?: string;
    };

    // 4. Context
    context: {
        channel: {
            id: string;
            name: string;
            type: "public" | "private" | "direct";
        };
        time_range: {
            from: string;
            to: string;
        };
    };

    // 5. Next Actions
    next_actions: Array<{
        description: string;
        tool: string;
        example_params: Record<string, any>;
    }>;
}
```

#### 마크다운 포맷 응답

```typescript
function formatGetMessagesResponse(result: GetMessagesResult): string {
    return `
## Result
Retrieved ${result.messages.length} messages from #${result.channel.name}

## Messages
${result.messages.map((m, i) => `
### ${i + 1}. ${m.sender.display_name} (${formatTime(m.timestamp)})
${m.text}
${m.thread_id ? `↳ Thread: ${m.reply_count} replies` : ''}
${m.reactions?.length ? `Reactions: ${m.reactions.map(r => `${r.emoji}(${r.count})`).join(' ')}` : ''}
`).join('\n')}

## Metadata
- Total messages in range: ${result.metadata.total_count}
- Returned: ${result.metadata.returned_count}
${result.metadata.truncated ? '- ⚠️ Results truncated due to size limit' : ''}
${result.metadata.has_more ? `- More messages available (use cursor: "${result.metadata.next_cursor}")` : ''}

## Context
- Channel: #${result.channel.name} (${result.channel.id})
- Type: ${result.channel.type}
- Time range: ${result.time_range.from} to ${result.time_range.to}

## Next Actions
${result.messages.some(m => m.thread_id) ?
    `- View thread: \`rocketchat_get_thread(thread_id="${result.messages.find(m => m.thread_id)?.thread_id}")\`` : ''}
- Search in this channel: \`rocketchat_search_messages(channel="${result.channel.id}", query="...")\`
- Send message: \`rocketchat_send_message(channel="${result.channel.id}", text="...")\`
${result.metadata.has_more ?
    `- Load more: \`rocketchat_get_messages(channel="${result.channel.id}", cursor="${result.metadata.next_cursor}")\`` : ''}
    `.trim();
}
```

#### 메시지 전송 응답

```typescript
function formatSendMessageResponse(result: SendResult): string {
    return `
## Result
✓ Message sent to #${result.channel.name}

## Message Details
- Message ID: ${result.message.id}
- Channel: #${result.channel.name} (${result.channel.id})
- Time: ${formatTime(result.message.timestamp)}
- Text: ${truncateText(result.message.text, 100)}

## Permalink
${result.message.permalink}

## Next Actions
- Reply to this message (start thread):
  \`rocketchat_reply_thread(thread_id="${result.message.id}", text="...")\`
- Add reaction:
  \`rocketchat_add_reaction(message_id="${result.message.id}", emoji="thumbsup")\`
- Edit message:
  \`rocketchat_update_message(message_id="${result.message.id}", text="...")\`
- Delete message:
  \`rocketchat_delete_message(message_id="${result.message.id}")\`
    `.trim();
}
```

### 4.3 검색 결과 응답

```typescript
function formatSearchChannelsResponse(result: SearchResult): string {
    if (result.channels.length === 0) {
        return `
## Result
No channels found matching "${result.query}"

## Suggestions
- Try a shorter or more general search term
- Check spelling
- Use rocketchat_list_channels to see all available channels

## Available Channel Types
- Public channels: Anyone can join
- Private channels: Invitation required (only shows if you're a member)
        `.trim();
    }

    return `
## Result
Found ${result.channels.length} channel(s) matching "${result.query}"

## Channels
${result.channels.map((ch, i) => `
${i + 1}. **${ch.name}** (${ch.id})
   - Type: ${ch.type}
   - Members: ${ch.member_count}
   ${ch.topic ? `- Topic: ${ch.topic}` : ''}
   ${ch.description ? `- Description: ${ch.description}` : ''}
`).join('\n')}

## Next Actions
- Get messages from a channel:
  \`rocketchat_get_messages(channel_id="${result.channels[0].id}")\`
- Send message to a channel:
  \`rocketchat_send_message(channel_id="${result.channels[0].id}", text="...")\`
- Get channel details:
  \`rocketchat_get_channel_info(channel_id="${result.channels[0].id}")\`
    `.trim();
}
```

### 4.4 응답 품질 체크리스트

| 항목 | 설명 | 필수 |
|------|------|------|
| 성공/실패 명시 | `success: true/false` 또는 명확한 Result 섹션 | ✓ |
| 요약 한 줄 | 무엇을 했는지 한 문장으로 | ✓ |
| 실제 데이터 | 요청한 정보 (메시지, 사용자 등) | ✓ |
| ID 포함 | 후속 작업에 사용할 ID들 | ✓ |
| truncated 표시 | 결과가 잘렸으면 명시 | ✓ |
| 다음 액션 | 이어서 할 수 있는 작업 예시 | 권장 |
| 퍼머링크 | 해당되는 경우 URL 제공 | 권장 |
| 컨텍스트 정보 | 채널명, 시간 범위 등 현재 상태 | 권장 |

---

## 5. 에러 처리(Error Handling)

### 5.1 What-Why-How 에러 패턴

모든 에러 메시지는 세 가지 요소를 포함해야 한다:

```
┌─────────────────────────────────────────────────────────────────┐
│                    What-Why-How 에러 패턴                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  WHAT (무엇이 실패했나)                                          │
│  └── 어떤 작업이 실패했는지 명확히                               │
│                                                                  │
│  WHY (왜 실패했나)                                               │
│  └── 실패 원인 상세 설명                                         │
│  └── 가능하면 유사한 항목 제안                                   │
│                                                                  │
│  HOW (어떻게 해결하나)                                           │
│  └── 구체적인 해결 방법                                          │
│  └── 대안 도구나 접근법 제시                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 에러 응답 예시

#### 채널을 찾을 수 없음

```typescript
// ❌ 나쁜 에러
throw new Error("Channel not found");

// ✓ 좋은 에러
function channelNotFoundError(query: string, suggestions: Channel[]): ErrorResponse {
    return {
        success: false,
        error: {
            code: "CHANNEL_NOT_FOUND",

            // WHAT
            what: `Cannot find channel "${query}"`,

            // WHY
            why: {
                searched_in: ["public channels", "private channels (where you are a member)"],
                possible_reasons: [
                    "Channel name might be spelled differently",
                    "Channel might be private and you're not a member",
                    "Channel might have been archived or deleted"
                ],
                similar_channels: suggestions.map(ch => ({
                    name: ch.name,
                    id: ch.id,
                    type: ch.type
                }))
            },

            // HOW
            how: {
                suggestions: [
                    `Use rocketchat_list_channels to see all available channels`,
                    `Try searching with a shorter term: rocketchat_search_channels(query="${query.substring(0, 3)}")`,
                    suggestions.length > 0
                        ? `Did you mean "${suggestions[0].name}"? Use channel_id="${suggestions[0].id}"`
                        : null
                ].filter(Boolean)
            }
        }
    };
}
```

#### 권한 부족

```typescript
function permissionDeniedError(action: string, resource: string): ErrorResponse {
    return {
        success: false,
        error: {
            code: "PERMISSION_DENIED",

            // WHAT
            what: `Cannot ${action} in ${resource}`,

            // WHY
            why: {
                reason: "Insufficient permissions",
                required_permission: getRequiredPermission(action),
                your_role: "Bot User",
                channel_type: "private"
            },

            // HOW
            how: {
                suggestions: [
                    "Ask a channel admin to grant the bot appropriate permissions",
                    "Use a different channel where the bot has write access",
                    `Check bot permissions: rocketchat_get_bot_info()`
                ]
            }
        }
    };
}
```

#### 잘못된 파라미터 형식

```typescript
function invalidParameterError(param: string, value: any, expected: string): ErrorResponse {
    return {
        success: false,
        error: {
            code: "INVALID_PARAMETER",

            // WHAT
            what: `Invalid value for parameter "${param}"`,

            // WHY
            why: {
                provided_value: value,
                expected_format: expected,
                examples: getExamplesForParam(param)
            },

            // HOW
            how: {
                fix: `Provide a value matching: ${expected}`,
                examples: getExamplesForParam(param)
            }
        }
    };
}

// 사용 예시
invalidParameterError(
    "time_range",
    "yesterday",
    "Relative (1d, 7d, 1w, 1m) or ISO date (2024-01-01)"
);
// → "yesterday"는 지원되지 않습니다. "1d", "7d" 같은 형식을 사용하세요.
```

### 5.3 에러 코드 체계

| 코드 | 설명 | HTTP 상당 |
|------|------|----------|
| `CHANNEL_NOT_FOUND` | 채널 없음 | 404 |
| `USER_NOT_FOUND` | 사용자 없음 | 404 |
| `MESSAGE_NOT_FOUND` | 메시지 없음 | 404 |
| `PERMISSION_DENIED` | 권한 부족 | 403 |
| `WRITE_DISABLED` | 쓰기 비활성화됨 | 403 |
| `INVALID_PARAMETER` | 잘못된 파라미터 | 400 |
| `RATE_LIMITED` | 속도 제한 | 429 |
| `SERVER_ERROR` | 서버 오류 | 500 |
| `NETWORK_ERROR` | 네트워크 오류 | 503 |

### 5.4 재시도 가이드

```typescript
interface RetryableError {
    code: string;
    retry_after?: number;  // 초 단위
    retry_suggestion?: string;
}

function rateLimitError(retryAfter: number): ErrorResponse {
    return {
        success: false,
        error: {
            code: "RATE_LIMITED",
            what: "Request rate limit exceeded",
            why: {
                reason: "Too many requests in a short period",
                limit: "60 requests per minute"
            },
            how: {
                retry_after: retryAfter,
                suggestion: `Wait ${retryAfter} seconds before retrying`
            }
        }
    };
}
```

---

## 6. 안전성(Safety)

### 6.1 쓰기 보호 시스템

#### 기본 원칙

```
┌─────────────────────────────────────────────────────────────────┐
│                      쓰기 보호 원칙                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 기본 비활성화 (Opt-in)                                      │
│     └── 쓰기 도구는 명시적으로 활성화해야 사용 가능               │
│                                                                  │
│  2. 채널 제한 (Whitelist/Blacklist)                             │
│     └── 특정 채널만 허용하거나 특정 채널 제외                     │
│                                                                  │
│  3. 위험 멘션 차단                                               │
│     └── @all, @here, @channel 등 전체 알림 방지                  │
│                                                                  │
│  4. 메시지 크기 제한                                             │
│     └── 너무 긴 메시지 방지                                      │
│                                                                  │
│  5. 삭제 작업 확인                                               │
│     └── 삭제는 더 엄격한 확인 필요                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 쓰기 보호 구현

```typescript
interface WriteGuardConfig {
    enabled: boolean;
    mode: 'whitelist' | 'blacklist' | 'all';
    channels: string[];  // 채널 ID 목록
    blockDangerousMentions: boolean;
    maxMessageLength: number;
    requireConfirmationForDelete: boolean;
}

class WriteGuard {
    private config: WriteGuardConfig;

    constructor() {
        // 환경 변수에서 설정 로드
        const writeConfig = process.env.ROCKETCHAT_WRITE_ROOMS || '';

        if (!writeConfig || writeConfig === 'false' || writeConfig === '0') {
            // 기본: 쓰기 비활성화
            this.config = {
                enabled: false,
                mode: 'whitelist',
                channels: [],
                blockDangerousMentions: true,
                maxMessageLength: 4000,
                requireConfirmationForDelete: true
            };
        } else if (writeConfig === 'true' || writeConfig === '1') {
            // 전체 활성화
            this.config = {
                enabled: true,
                mode: 'all',
                channels: [],
                blockDangerousMentions: true,
                maxMessageLength: 4000,
                requireConfirmationForDelete: true
            };
        } else {
            // 채널 목록 파싱: "C123,C456" 또는 "!C789,!C012"
            const channels = writeConfig.split(',').map(s => s.trim());
            const isBlacklist = channels[0]?.startsWith('!');

            this.config = {
                enabled: true,
                mode: isBlacklist ? 'blacklist' : 'whitelist',
                channels: channels.map(c => c.replace('!', '')),
                blockDangerousMentions: true,
                maxMessageLength: 4000,
                requireConfirmationForDelete: true
            };
        }
    }

    canWrite(roomId: string): { allowed: boolean; reason?: string } {
        if (!this.config.enabled) {
            return {
                allowed: false,
                reason: "Write operations are disabled. Set ROCKETCHAT_WRITE_ROOMS to enable."
            };
        }

        switch (this.config.mode) {
            case 'all':
                return { allowed: true };

            case 'whitelist':
                if (this.config.channels.includes(roomId)) {
                    return { allowed: true };
                }
                return {
                    allowed: false,
                    reason: `Channel ${roomId} is not in the allowed list.`
                };

            case 'blacklist':
                if (this.config.channels.includes(roomId)) {
                    return {
                        allowed: false,
                        reason: `Channel ${roomId} is in the blocked list.`
                    };
                }
                return { allowed: true };
        }
    }

    sanitizeMessage(text: string): { text: string; warnings: string[] } {
        const warnings: string[] = [];
        let sanitized = text;

        // 위험한 멘션 차단
        if (this.config.blockDangerousMentions) {
            const dangerousMentions = ['@all', '@here', '@channel', '@everyone'];
            for (const mention of dangerousMentions) {
                if (sanitized.toLowerCase().includes(mention.toLowerCase())) {
                    sanitized = sanitized.replace(
                        new RegExp(mention, 'gi'),
                        `[${mention}]`  // 무력화
                    );
                    warnings.push(`Dangerous mention "${mention}" was neutralized to prevent mass notification.`);
                }
            }
        }

        // 메시지 길이 제한
        if (sanitized.length > this.config.maxMessageLength) {
            sanitized = sanitized.substring(0, this.config.maxMessageLength) + '... [truncated]';
            warnings.push(`Message was truncated to ${this.config.maxMessageLength} characters.`);
        }

        return { text: sanitized, warnings };
    }
}
```

### 6.2 환경 변수 설정 예시

```bash
# 쓰기 완전 비활성화 (기본값, 가장 안전)
ROCKETCHAT_WRITE_ROOMS=""

# 모든 채널에서 쓰기 허용
ROCKETCHAT_WRITE_ROOMS="true"

# 특정 채널만 허용 (Whitelist)
ROCKETCHAT_WRITE_ROOMS="GENERAL,hGE7sBz8WW4JiFxPy,yZm3kQhNwR7XbVcFp"

# 특정 채널만 제외 (Blacklist)
ROCKETCHAT_WRITE_ROOMS="!GENERAL,!announcement"

# 추가 안전 설정
ROCKETCHAT_BLOCK_MENTIONS="true"          # @all, @here 차단
ROCKETCHAT_MAX_MESSAGE_LENGTH="4000"      # 최대 메시지 길이
ROCKETCHAT_REQUIRE_DELETE_CONFIRM="true"  # 삭제 시 확인 필요
```

### 6.3 안전성 응답

쓰기 작업 시 안전성 관련 정보 포함:

```typescript
function formatSendMessageResponse(result: SendResult, warnings: string[]): string {
    let response = `
## Result
✓ Message sent to #${result.channel.name}

## Message Details
- Message ID: ${result.message.id}
- Channel: #${result.channel.name}
- Text: ${truncateText(result.message.text, 100)}
`;

    // 안전성 경고가 있으면 표시
    if (warnings.length > 0) {
        response += `
## Safety Notices
${warnings.map(w => `- ⚠️ ${w}`).join('\n')}
`;
    }

    response += `
## Next Actions
- Reply to thread: \`rocketchat_reply_thread(thread_id="${result.message.id}", text="...")\`
`;

    return response.trim();
}
```

---

## 7. 성능 및 효율성(Performance)

### 7.1 토큰 오버플로 방지

#### 문제

LLM의 컨텍스트 윈도우는 제한되어 있음. 큰 응답은:
- 컨텍스트 소진
- 처리 속도 저하
- 비용 증가
- 잠재적 오류

#### 해결: TokenCounter

```typescript
class TokenCounter {
    // 설정
    private static readonly MAX_RESPONSE_CHARS = 100000;  // ~25,000 토큰
    private static readonly CHARS_PER_TOKEN = 4;          // 대략적 추정
    private static readonly SAFETY_BUFFER = 4000;         // 안전 마진

    /**
     * 텍스트의 토큰 수 추정
     */
    static estimateTokens(text: string): number {
        return Math.ceil(text.length / this.CHARS_PER_TOKEN);
    }

    /**
     * 토큰 한도 초과 여부 확인
     */
    static wouldExceedLimit(text: string): boolean {
        return text.length > (this.MAX_RESPONSE_CHARS - this.SAFETY_BUFFER);
    }

    /**
     * 배열을 토큰 한도에 맞게 자르기
     */
    static truncateToFit<T>(
        items: T[],
        stringify: (item: T) => string = JSON.stringify
    ): { items: T[]; truncated: boolean; originalCount: number } {
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
     * 샘플 기반 안전 아이템 수 계산
     */
    static getSafeItemLimit(sampleItem: any, maxItems: number = 100): number {
        const sampleSize = JSON.stringify(sampleItem).length;
        const tokensPerItem = Math.ceil(sampleSize / this.CHARS_PER_TOKEN);
        const maxTokens = (this.MAX_RESPONSE_CHARS - this.SAFETY_BUFFER) / this.CHARS_PER_TOKEN;
        const safeCount = Math.floor(maxTokens / tokensPerItem);

        return Math.min(safeCount, maxItems);
    }
}
```

#### 사용 예시

```typescript
async function getMessages(channelId: string, limit: number): Promise<GetMessagesResponse> {
    // API에서 메시지 가져오기
    const messages = await api.getMessages(channelId, limit);

    // 토큰 한도에 맞게 자르기
    const { items, truncated, originalCount } = TokenCounter.truncateToFit(messages);

    return {
        success: true,
        messages: items,
        metadata: {
            returned_count: items.length,
            original_count: originalCount,
            truncated: truncated,
            truncation_reason: truncated
                ? "Response size exceeded token limit for safety"
                : undefined
        }
    };
}
```

### 7.2 페이지네이션

#### 커서 기반 페이지네이션 (권장)

```typescript
{
    name: "rocketchat_get_messages",
    parameters: {
        channel_id: { type: "string", required: true },
        limit: {
            type: "number",
            default: 20,
            maximum: 100,
            description: "Number of messages to retrieve (max 100)"
        },
        cursor: {
            type: "string",
            description: `
                Pagination cursor from previous response.
                Use the 'next_cursor' value from metadata to get more messages.
            `
        },
        before: {
            type: "string",
            description: "Get messages before this message ID"
        },
        after: {
            type: "string",
            description: "Get messages after this message ID"
        }
    }
}

// 응답에 페이지네이션 정보 포함
interface PaginatedResponse<T> {
    items: T[];
    pagination: {
        has_more: boolean;
        next_cursor?: string;
        prev_cursor?: string;
        total_count?: number;
    };
}
```

### 7.3 캐싱 전략

```typescript
interface CacheConfig {
    ttl: number;           // Time-to-live (ms)
    maxSize: number;       // 최대 캐시 항목 수
    refreshOnAccess: boolean;
}

class LRUCache<K, V> {
    private cache: Map<K, { value: V; expires: number }>;
    private readonly config: CacheConfig;

    constructor(config: CacheConfig) {
        this.cache = new Map();
        this.config = config;
    }

    get(key: K): V | undefined {
        const entry = this.cache.get(key);
        if (!entry) return undefined;

        // 만료 확인
        if (Date.now() > entry.expires) {
            this.cache.delete(key);
            return undefined;
        }

        // LRU: 최근 접근한 항목을 끝으로 이동
        if (this.config.refreshOnAccess) {
            this.cache.delete(key);
            this.cache.set(key, {
                value: entry.value,
                expires: Date.now() + this.config.ttl
            });
        }

        return entry.value;
    }

    set(key: K, value: V): void {
        // 크기 초과 시 가장 오래된 항목 제거
        if (this.cache.size >= this.config.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }

        this.cache.set(key, {
            value,
            expires: Date.now() + this.config.ttl
        });
    }
}

// 캐시 사용 예시
const channelCache = new LRUCache<string, Channel>({
    ttl: 5 * 60 * 1000,      // 5분
    maxSize: 100,
    refreshOnAccess: true
});

const userCache = new LRUCache<string, User>({
    ttl: 30 * 60 * 1000,     // 30분 (사용자 정보는 덜 변함)
    maxSize: 500,
    refreshOnAccess: false
});
```

### 7.4 캐시 가능한 항목

| 데이터 | TTL | 이유 |
|--------|-----|------|
| 채널 목록 | 5분 | 채널은 자주 생성/삭제되지 않음 |
| 채널 정보 | 5분 | 토픽/설명은 가끔 변경 |
| 사용자 목록 | 30분 | 사용자는 더 적게 변경 |
| 사용자 정보 | 30분 | 프로필은 드물게 변경 |
| 메시지 | 캐시 안함 | 실시간성 중요 |
| 쓰레드 | 캐시 안함 | 실시간성 중요 |

---

## 8. 아키텍처(Architecture)

### 8.1 Clean Architecture 권장

```
┌─────────────────────────────────────────────────────────────────┐
│                     MCP Clean Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Presentation Layer                     │    │
│  │  ├── MCP Server (도구 정의, 요청 처리)                    │    │
│  │  ├── Response Formatter (응답 포맷팅)                    │    │
│  │  └── Error Handler (에러 변환)                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Application Layer                      │    │
│  │  ├── Use Cases (비즈니스 로직)                           │    │
│  │  │   ├── GetMessagesUseCase                              │    │
│  │  │   ├── SendMessageUseCase                              │    │
│  │  │   ├── SearchChannelsUseCase                           │    │
│  │  │   └── ...                                             │    │
│  │  ├── DTOs (Data Transfer Objects)                        │    │
│  │  └── Validators (입력 검증)                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                     Domain Layer                          │    │
│  │  ├── Entities (Channel, Message, User, Thread)           │    │
│  │  ├── Value Objects (MessageId, ChannelId, TimeRange)     │    │
│  │  └── Repository Interfaces                               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  Infrastructure Layer                     │    │
│  │  ├── RocketChatApiClient (HTTP 통신)                     │    │
│  │  ├── Repository Implementations                          │    │
│  │  ├── Cache (LRU/TTL 캐시)                               │    │
│  │  └── Config (환경 변수, 설정)                            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 디렉토리 구조

```
src/
├── index.ts                    # MCP 서버 진입점
├── server.ts                   # MCP 서버 설정
│
├── presentation/               # 프레젠테이션 레이어
│   ├── tools/                  # 도구 정의
│   │   ├── channels.ts         # 채널 관련 도구
│   │   ├── messages.ts         # 메시지 관련 도구
│   │   ├── users.ts            # 사용자 관련 도구
│   │   └── index.ts            # 도구 등록
│   ├── formatters/             # 응답 포맷터
│   │   ├── message-formatter.ts
│   │   ├── channel-formatter.ts
│   │   └── error-formatter.ts
│   └── middleware/             # 미들웨어
│       ├── write-guard.ts      # 쓰기 보호
│       └── token-limiter.ts    # 토큰 제한
│
├── application/                # 애플리케이션 레이어
│   ├── use-cases/              # 유스케이스
│   │   ├── get-messages.ts
│   │   ├── send-message.ts
│   │   ├── search-channels.ts
│   │   └── ...
│   ├── dto/                    # Data Transfer Objects
│   │   ├── message.dto.ts
│   │   └── channel.dto.ts
│   └── validators/             # 입력 검증
│       ├── time-range.validator.ts
│       └── channel-id.validator.ts
│
├── domain/                     # 도메인 레이어
│   ├── entities/               # 엔티티
│   │   ├── channel.ts
│   │   ├── message.ts
│   │   ├── user.ts
│   │   └── thread.ts
│   ├── value-objects/          # 값 객체
│   │   ├── channel-id.ts
│   │   ├── message-id.ts
│   │   └── time-range.ts
│   └── repositories/           # 리포지토리 인터페이스
│       ├── channel.repository.ts
│       ├── message.repository.ts
│       └── user.repository.ts
│
├── infrastructure/             # 인프라스트럭처 레이어
│   ├── api/                    # API 클라이언트
│   │   ├── rocketchat-client.ts
│   │   └── types.ts
│   ├── repositories/           # 리포지토리 구현
│   │   ├── channel.repository.impl.ts
│   │   ├── message.repository.impl.ts
│   │   └── user.repository.impl.ts
│   ├── cache/                  # 캐시
│   │   ├── lru-cache.ts
│   │   └── cache-keys.ts
│   └── config/                 # 설정
│       └── config.ts
│
└── utils/                      # 유틸리티
    ├── token-counter.ts
    ├── time-parser.ts
    └── url-parser.ts
```

### 8.3 의존성 주입

```typescript
// infrastructure/container.ts
import { Container } from 'inversify';

const container = new Container();

// 리포지토리
container.bind<IChannelRepository>('ChannelRepository')
    .to(ChannelRepositoryImpl).inSingletonScope();
container.bind<IMessageRepository>('MessageRepository')
    .to(MessageRepositoryImpl).inSingletonScope();
container.bind<IUserRepository>('UserRepository')
    .to(UserRepositoryImpl).inSingletonScope();

// 유스케이스
container.bind<GetMessagesUseCase>('GetMessagesUseCase')
    .to(GetMessagesUseCase);
container.bind<SendMessageUseCase>('SendMessageUseCase')
    .to(SendMessageUseCase);

// 인프라
container.bind<RocketChatClient>('ApiClient')
    .to(RocketChatClient).inSingletonScope();
container.bind<LRUCache>('Cache')
    .to(LRUCache).inSingletonScope();

export { container };
```

### 8.4 테스트 용이성

```typescript
// application/use-cases/get-messages.ts
export class GetMessagesUseCase {
    constructor(
        @inject('MessageRepository') private messageRepo: IMessageRepository,
        @inject('ChannelRepository') private channelRepo: IChannelRepository
    ) {}

    async execute(request: GetMessagesRequest): Promise<GetMessagesResponse> {
        // 비즈니스 로직
    }
}

// tests/use-cases/get-messages.test.ts
describe('GetMessagesUseCase', () => {
    let useCase: GetMessagesUseCase;
    let mockMessageRepo: jest.Mocked<IMessageRepository>;
    let mockChannelRepo: jest.Mocked<IChannelRepository>;

    beforeEach(() => {
        mockMessageRepo = createMockMessageRepository();
        mockChannelRepo = createMockChannelRepository();
        useCase = new GetMessagesUseCase(mockMessageRepo, mockChannelRepo);
    });

    it('should return messages from channel', async () => {
        mockMessageRepo.getMessages.mockResolvedValue([...]);

        const result = await useCase.execute({
            channelId: 'test-channel',
            limit: 10
        });

        expect(result.success).toBe(true);
        expect(result.messages).toHaveLength(10);
    });

    it('should handle channel not found', async () => {
        mockChannelRepo.findById.mockResolvedValue(null);

        const result = await useCase.execute({
            channelId: 'non-existent',
            limit: 10
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe('CHANNEL_NOT_FOUND');
    });
});
```

---

## 9. 지식 데이터 활용을 위한 MCP 설계

> 메시지 협업 플랫폼의 대화 내용을 **조직의 지식 데이터**로 활용하기 위한 MCP 설계 가이드

### 9.1 지식 데이터로서의 메시지 플랫폼

#### 협업 플랫폼의 정보 구조

```
┌─────────────────────────────────────────────────────────────────┐
│              채널 - 쓰레드 기반 정보 계층 구조                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  워크스페이스 (Organization)                                     │
│  └── 채널 (Channel)                                              │
│      ├── 주제별 분류: #개발팀, #프론트엔드, #배포                  │
│      ├── 프로젝트별: #project-alpha, #project-beta               │
│      └── 유형별: #announcements, #random, #help                  │
│                                                                  │
│  채널 내 메시지 흐름                                              │
│  └── 메시지 (Message)                                            │
│      ├── 단순 메시지: 알림, 공유, 질문                            │
│      └── 쓰레드 부모 (Thread Parent)                              │
│          └── 쓰레드 답장들 (Thread Replies)                       │
│              ├── 논의 (Discussion)                               │
│              ├── 협의 (Agreement)                                │
│              └── 결정 (Decision)                                 │
│                                                                  │
│  ※ 핵심 인사이트:                                                │
│     쓰레드 = 하나의 주제에 대한 완결된 대화 단위                   │
│     → 지식 데이터의 기본 단위로 적합                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 지식 조회 시나리오

| 시나리오 | 사용자 질문 예시 | 필요한 정보 |
|----------|------------------|-------------|
| **논의사항 검색** | "API 설계 관련 논의된 내용 찾아줘" | 키워드 + 쓰레드 전체 맥락 |
| **협의사항 확인** | "인증 방식 협의한 거 뭐였지?" | 특정 주제 쓰레드 + 결론 |
| **결정사항 추적** | "이번 주 결정된 사항들 정리해줘" | 시간 범위 + 쓰레드 + 결정 키워드 |
| **참여자 기반 검색** | "김철수랑 배포 관련 얘기한 거" | 사용자 + 키워드 + 쓰레드 |
| **맥락 파악** | "이 쓰레드 전체 맥락이 뭐야?" | URL → 쓰레드 전체 조회 |

### 9.2 현재 Slack MCP들의 한계

#### 쓰레드 중심 조회의 비효율성

```
┌─────────────────────────────────────────────────────────────────┐
│     현재 방식: "논의사항 찾기" 워크플로우 (비효율적)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  사용자: "API 설계 관련 논의된 내용 찾아줘"                       │
│                                                                  │
│  AI Agent 작업 (현재 MCP):                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 1. search_messages("API 설계")                            │   │
│  │    → 메시지 20개 반환 (쓰레드 부모만, 답장 제외)            │   │
│  │                                                           │   │
│  │ 2. 메시지 중 thread_count > 0 인 것 필터 (AI가 직접)       │   │
│  │    → 쓰레드가 있는 메시지 5개 식별                         │   │
│  │                                                           │   │
│  │ 3. 각 쓰레드 조회 (5번 호출)                               │   │
│  │    get_thread(thread_id_1)                                │   │
│  │    get_thread(thread_id_2)                                │   │
│  │    get_thread(thread_id_3)                                │   │
│  │    get_thread(thread_id_4)                                │   │
│  │    get_thread(thread_id_5)                                │   │
│  │                                                           │   │
│  │ 4. 모든 쓰레드 내용을 AI가 읽고 분석                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  문제점:                                                         │
│  ├── API 호출 6번 (검색 1 + 쓰레드 5)                           │
│  ├── 토큰 소모 큼 (모든 쓰레드 전문 전달)                        │
│  ├── 쓰레드 내 답장은 검색 안 됨                                │
│  └── 쓰레드 없는 단순 메시지도 섞여서 반환                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 기존 MCP 기능 매트릭스

| 기능 | korotovsky | dennison | lbeatu | 지식 활용 필요도 |
|------|:----------:|:--------:|:------:|:---------------:|
| 메시지 검색 | O | O | X | 필수 |
| 쓰레드 조회 | O | O | O | 필수 |
| 시간 범위 검색 | O | X | X | 필수 |
| 사용자 필터 | O | O | X | 필수 |
| **쓰레드 목록 조회** | X | X | X | **필요** |
| **쓰레드 내용 검색** | X | X | X | **필요** |
| **쓰레드 요약 조회** | X | X | X | **권장** |
| **활성 쓰레드 필터** | X | X | X | **권장** |

### 9.3 지식 데이터 활용을 위한 필수 도구

#### 도구 목록

```typescript
// ========================================
// 쓰레드 중심 도구 (지식 데이터 활용)
// ========================================

// 1. 쓰레드 목록 조회 - 논의가 있는 메시지만 효율적 조회
{
    name: "rocketchat_list_threads",
    description: `
        List threads (messages with replies) in a channel.

        USE WHEN:
        - Finding discussions, decisions, or conversations
        - Looking for messages that had engagement/replies
        - Identifying important topics (threads indicate importance)

        WHY THREADS MATTER:
        - Threads represent complete discussion units
        - A message with 10+ replies likely contains important decisions
        - Filtering threads reduces noise from simple announcements

        RETURNS:
        - Only messages that have thread replies
        - Sorted by reply count (most discussed first) or recency
        - Includes: parent message, reply count, last reply time, participants
    `,
    parameters: {
        channel_id: { type: "string", required: true },
        time_range: {
            type: "string",
            description: "Time range: 1d, 7d, 1w, 1m"
        },
        min_replies: {
            type: "number",
            default: 1,
            description: "Minimum reply count (use higher for important discussions)"
        },
        sort_by: {
            type: "string",
            enum: ["reply_count", "recent_activity", "created"],
            default: "recent_activity"
        },
        limit: { type: "number", default: 10, maximum: 50 }
    }
}

// 2. 쓰레드 검색 - 쓰레드 내용까지 검색
{
    name: "rocketchat_search_threads",
    description: `
        Search within thread contents (both parent and replies).

        USE WHEN:
        - Finding discussions about a specific topic
        - Looking for decisions or agreements
        - Searching for context that may be in replies, not just parent

        DIFFERENCE FROM search_messages:
        - search_messages: Only searches parent messages
        - search_threads: Searches parent AND all replies

        EXAMPLE:
        - Query "결정" finds threads where someone said "결정됨" in a reply
    `,
    parameters: {
        query: { type: "string", required: true },
        channel_id: { type: "string", description: "Limit to channel" },
        from_user: { type: "string", description: "Filter by participant" },
        time_range: { type: "string", description: "1d, 7d, 1w, 1m" },
        include_context: {
            type: "boolean",
            default: true,
            description: "Include surrounding messages for context"
        },
        limit: { type: "number", default: 10 }
    }
}

// 3. 쓰레드 전체 조회 (개선) - 맥락 포함
{
    name: "rocketchat_get_thread",
    description: `
        Get complete thread with full context.

        RETURNS:
        - Parent message (the topic/question)
        - All replies in chronological order
        - Participant list with roles
        - Thread summary (if available)
        - Related threads (same participants or keywords)

        USE FOR:
        - Understanding full discussion context
        - Following a decision-making process
        - Extracting conclusions from discussions
    `,
    parameters: {
        thread_id: { type: "string", required: true },
        include_reactions: {
            type: "boolean",
            default: true,
            description: "Include emoji reactions (often indicate agreement)"
        },
        include_participant_info: {
            type: "boolean",
            default: true,
            description: "Include participant roles/titles"
        }
    }
}

// 4. 채널 논의 요약 - 지식 추출
{
    name: "rocketchat_get_channel_discussions",
    description: `
        Get summary of discussions in a channel.

        USE WHEN:
        - "이번 주 개발팀 논의사항 정리해줘"
        - "프로젝트 채널에서 결정된 것들 알려줘"
        - Onboarding: understanding what a channel discusses

        RETURNS:
        - List of active threads with summaries
        - Key participants
        - Potential decisions (messages with decision keywords)
        - Open questions (messages ending with ?)

        NOTE: This is a high-level overview, not full content.
        Use get_thread for detailed content.
    `,
    parameters: {
        channel_id: { type: "string", required: true },
        time_range: {
            type: "string",
            default: "7d",
            description: "1d, 7d, 1w, 1m"
        },
        focus: {
            type: "string",
            enum: ["all", "decisions", "questions", "active"],
            default: "all",
            description: "Filter by discussion type"
        }
    }
}

// 5. 결정사항 검색 - 의사결정 추적
{
    name: "rocketchat_find_decisions",
    description: `
        Find messages that likely contain decisions or agreements.

        HOW IT WORKS:
        - Searches for decision indicators: "결정", "확정", "합의",
          "agreed", "decided", "finalized", "go with", "let's do"
        - Prioritizes messages with high reaction counts (agreement signals)
        - Looks in threads where discussions concluded

        USE WHEN:
        - "이번 달 결정된 사항들 정리해줘"
        - "API 버전 관련 최종 결정이 뭐였지?"
        - Auditing past decisions

        NOTE: This uses heuristics. May include false positives.
        Always verify by reading the thread context.
    `,
    parameters: {
        channel_id: { type: "string", description: "Limit to channel" },
        time_range: { type: "string", required: true },
        keywords: {
            type: "array",
            items: { type: "string" },
            description: "Additional decision keywords to search"
        },
        min_reactions: {
            type: "number",
            default: 0,
            description: "Minimum reactions (higher = more likely agreed)"
        }
    }
}
```

### 9.4 효율적인 지식 조회 워크플로우

#### 개선된 워크플로우

```
┌─────────────────────────────────────────────────────────────────┐
│    개선된 방식: "논의사항 찾기" 워크플로우 (효율적)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  사용자: "API 설계 관련 논의된 내용 찾아줘"                       │
│                                                                  │
│  AI Agent 작업 (개선된 MCP):                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 1. search_threads("API 설계", time_range="1m")            │   │
│  │    → 쓰레드 5개 반환 (제목 + 요약 + 답장 수)               │   │
│  │                                                           │   │
│  │ 2. 가장 관련성 높은 쓰레드 1-2개 상세 조회                 │   │
│  │    get_thread(thread_id_1)                                │   │
│  │    → 해당 쓰레드 전체 맥락 반환                            │   │
│  │                                                           │   │
│  │ 3. AI가 분석 및 요약 제공                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  개선 효과:                                                      │
│  ├── API 호출 2번 (검색 1 + 상세 1)                             │
│  ├── 토큰 효율적 (요약 먼저, 필요시 상세)                        │
│  ├── 쓰레드 내용도 검색됨                                       │
│  └── 논의 없는 단순 메시지 제외됨                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 시나리오별 최적 도구 조합

```typescript
// 시나리오 1: "이번 주 개발팀 논의사항 정리해줘"
// Step 1: 채널 논의 요약 조회
rocketchat_get_channel_discussions(
    channel_id: "개발팀",
    time_range: "1w",
    focus: "all"
)
// → 쓰레드 목록 + 요약 반환

// Step 2: 필요시 특정 쓰레드 상세 조회
rocketchat_get_thread(thread_id: "...")

// ─────────────────────────────────────────────

// 시나리오 2: "인증 방식 협의한 내용 찾아줘"
// Step 1: 쓰레드 내용 검색
rocketchat_search_threads(
    query: "인증 방식",
    include_context: true
)
// → 관련 쓰레드 + 매칭된 메시지 하이라이트

// ─────────────────────────────────────────────

// 시나리오 3: "이번 달 결정된 사항들"
// Step 1: 결정사항 검색
rocketchat_find_decisions(
    time_range: "1m",
    min_reactions: 2  // 동의 표시가 있는 것
)
// → 결정 키워드 포함 메시지 + 맥락

// ─────────────────────────────────────────────

// 시나리오 4: "김철수랑 배포 관련 얘기한 거"
// Step 1: 참여자 + 키워드 검색
rocketchat_search_threads(
    query: "배포",
    from_user: "김철수"
)
```

### 9.5 응답 설계: 지식 조회 최적화

#### 쓰레드 목록 응답 형식

```typescript
// list_threads 또는 search_threads 응답
interface ThreadListResponse {
    success: true;
    summary: "Found 5 threads about 'API 설계' in #개발팀";

    threads: Array<{
        // 식별 정보
        thread_id: string;
        channel: { id: string; name: string };

        // 부모 메시지 (주제)
        parent: {
            text: string;      // 전문 또는 요약
            author: string;
            timestamp: string;
        };

        // 쓰레드 메타데이터
        stats: {
            reply_count: number;
            participant_count: number;
            last_activity: string;
        };

        // 주요 참여자
        participants: Array<{
            name: string;
            reply_count: number;
        }>;

        // 쓰레드 요약 (있으면)
        summary?: string;

        // 매칭된 답장 미리보기 (검색 시)
        matched_replies?: Array<{
            text: string;
            author: string;
            highlight: string;  // 검색어 하이라이트
        }>;
    }>;

    // 메타데이터
    metadata: {
        total_found: number;
        returned: number;
        truncated: boolean;
        time_range: { from: string; to: string };
    };

    // 다음 액션
    next_actions: [
        {
            description: "Get full thread content",
            tool: "rocketchat_get_thread",
            example: { thread_id: "..." }
        },
        {
            description: "Search within specific channel",
            tool: "rocketchat_search_threads",
            example: { channel_id: "...", query: "..." }
        }
    ];
}
```

#### 마크다운 포맷 (AI 가독성 최적화)

```markdown
## Result
Found 5 threads about "API 설계" in #개발팀 (last 30 days)

## Threads

### 1. REST vs GraphQL 결정 (가장 활발)
- **Started by**: 김철수 (2024-01-08)
- **Replies**: 23 | **Participants**: 5
- **Last activity**: 2024-01-10 14:30

**Topic**: REST API로 갈지 GraphQL로 갈지 논의
**Key participants**: 김철수(8), 이영희(6), 박민수(5)

**Matched reply**: "...GraphQL로 **결정**했습니다. 이유는..."

---

### 2. API 버전 관리 방식
- **Started by**: 이영희 (2024-01-05)
- **Replies**: 12 | **Participants**: 3
- **Last activity**: 2024-01-07 16:20

**Topic**: v1, v2 버전 관리를 어떻게 할지
**Summary**: URL 경로 방식 (/api/v1/) 채택

---

[3 more threads...]

## Metadata
- Time range: 2023-12-11 to 2024-01-10
- Showing 5 of 5 threads

## Next Actions
- View full discussion: `rocketchat_get_thread(thread_id="thread_1")`
- Find decisions: `rocketchat_find_decisions(channel_id="개발팀", time_range="1m")`
- Search more: `rocketchat_search_threads(query="GraphQL", channel_id="개발팀")`
```

### 9.6 지식 데이터 활용 체크리스트

| 항목 | 설명 | 중요도 |
|------|------|--------|
| ☐ | 쓰레드 목록 조회 도구가 있는가? (논의 필터링) | 필수 |
| ☐ | 쓰레드 내용까지 검색하는 도구가 있는가? | 필수 |
| ☐ | 시간 범위 + 채널 + 사용자 복합 필터가 가능한가? | 필수 |
| ☐ | 쓰레드 요약/미리보기가 제공되는가? | 권장 |
| ☐ | 결정사항 검색 도구가 있는가? | 권장 |
| ☐ | 반응(리액션) 기반 필터가 가능한가? | 권장 |
| ☐ | 활성 쓰레드 (최근 답장) 필터가 가능한가? | 권장 |

### 9.7 Rocket.Chat API 매핑

```typescript
// Rocket.Chat REST API → MCP 도구 매핑

// 1. 쓰레드 목록 조회
// Rocket.Chat: GET /api/v1/channels.messages + tmid 필터
// 또는: GET /api/v1/chat.getThreadsList
async function listThreads(channelId: string, options: ListThreadsOptions) {
    // Rocket.Chat의 getThreadsList API 활용
    const result = await api.get('/chat.getThreadsList', {
        rid: channelId,
        count: options.limit,
        offset: 0,
        sort: { tlm: -1 }  // 최근 활동순
    });

    return result.threads.filter(t =>
        t.tcount >= (options.min_replies || 1)
    );
}

// 2. 쓰레드 내용 검색
// Rocket.Chat: GET /api/v1/chat.search + 후처리
async function searchThreads(query: string, options: SearchThreadsOptions) {
    // 1. 일반 검색
    const messages = await api.get('/chat.search', {
        roomId: options.channel_id,
        searchText: query,
        count: 100
    });

    // 2. 쓰레드 부모 또는 쓰레드 내 메시지 필터
    const threadMessages = messages.filter(m =>
        m.tmid || m.tcount > 0
    );

    // 3. 쓰레드별로 그룹핑
    const threads = groupByThread(threadMessages);

    return threads;
}

// 3. 결정사항 검색
const DECISION_KEYWORDS = [
    '결정', '확정', '합의', '동의', '채택',
    'decided', 'agreed', 'finalized', 'approved',
    'let\'s go with', 'we\'ll use'
];

async function findDecisions(options: FindDecisionsOptions) {
    const query = DECISION_KEYWORDS.join(' OR ');
    const results = await searchThreads(query, options);

    // 반응 수로 정렬 (동의 신호)
    return results.sort((a, b) =>
        b.reactionCount - a.reactionCount
    );
}
```

### 9.8 아키텍처 확장

```
┌─────────────────────────────────────────────────────────────────┐
│           지식 데이터 활용을 위한 MCP 아키텍처 확장                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  기본 도구 (Tier 1)                                              │
│  ├── list_channels, list_users                                  │
│  ├── get_messages, get_thread                                   │
│  └── send_message, reply_thread                                 │
│                                                                  │
│  지식 조회 도구 (Tier 2) ← 새로 추가                              │
│  ├── list_threads: 쓰레드만 필터링                               │
│  ├── search_threads: 쓰레드 내용까지 검색                        │
│  ├── get_channel_discussions: 채널 논의 요약                     │
│  └── find_decisions: 결정사항 탐색                               │
│                                                                  │
│  고급 분석 도구 (Tier 3) ← 선택적                                │
│  ├── summarize_thread: 쓰레드 AI 요약                           │
│  ├── extract_action_items: 액션 아이템 추출                      │
│  └── find_related_discussions: 관련 논의 찾기                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. 체크리스트

### 10.1 도구 설계 체크리스트

| 항목 | 설명 | 중요도 |
|------|------|--------|
| ☐ | 도구 이름이 `{서비스}_{동사}_{대상}` 형식인가? | 필수 |
| ☐ | 도구 설명에 "무엇을", "언제 사용", "반환값"이 있는가? | 필수 |
| ☐ | 관련 도구가 안내되어 있는가? | 권장 |
| ☐ | 이름→ID 변환 도구가 있는가? (lookup, search) | 필수 |
| ☐ | URL 파싱 도구가 있는가? | 권장 |
| ☐ | 통합 도구가 있는가? (message_user 등) | 권장 |

### 10.2 스키마 설계 체크리스트

| 항목 | 설명 | 중요도 |
|------|------|--------|
| ☐ | 모든 파라미터에 description이 있는가? | 필수 |
| ☐ | 형식(FORMAT)이 명시되어 있는가? | 필수 |
| ☐ | 예시(EXAMPLE)가 포함되어 있는가? | 필수 |
| ☐ | 획득 방법(HOW TO GET)이 설명되어 있는가? | 권장 |
| ☐ | pattern 정규식이 정의되어 있는가? | 권장 |
| ☐ | 시간 표현식(1d, 7d)이 지원되는가? | 권장 |

### 10.3 응답 설계 체크리스트

| 항목 | 설명 | 중요도 |
|------|------|--------|
| ☐ | success/failure가 명확히 표시되는가? | 필수 |
| ☐ | 결과 요약이 한 줄로 있는가? | 필수 |
| ☐ | 후속 작업에 필요한 ID가 포함되는가? | 필수 |
| ☐ | truncated 여부가 표시되는가? | 필수 |
| ☐ | 다음 가능한 액션이 안내되는가? | 권장 |
| ☐ | 퍼머링크가 제공되는가? | 권장 |
| ☐ | 컨텍스트 정보가 포함되는가? | 권장 |

### 10.4 에러 처리 체크리스트

| 항목 | 설명 | 중요도 |
|------|------|--------|
| ☐ | What-Why-How 패턴을 따르는가? | 필수 |
| ☐ | 에러 코드가 체계적인가? | 필수 |
| ☐ | 해결 방법이 제시되는가? | 필수 |
| ☐ | 유사 항목이 제안되는가? | 권장 |
| ☐ | 재시도 가능 여부가 표시되는가? | 권장 |

### 10.5 안전성 체크리스트

| 항목 | 설명 | 중요도 |
|------|------|--------|
| ☐ | 쓰기 도구가 기본 비활성화인가? | 필수 |
| ☐ | 채널 화이트리스트/블랙리스트가 지원되는가? | 필수 |
| ☐ | @all, @here 멘션이 차단되는가? | 필수 |
| ☐ | 메시지 길이 제한이 있는가? | 권장 |
| ☐ | 삭제 작업에 확인이 필요한가? | 권장 |

### 10.6 성능 체크리스트

| 항목 | 설명 | 중요도 |
|------|------|--------|
| ☐ | 토큰 오버플로 방지가 구현되어 있는가? | 필수 |
| ☐ | 자동 truncate가 적용되는가? | 필수 |
| ☐ | 페이지네이션이 지원되는가? | 필수 |
| ☐ | 적절한 캐싱이 구현되어 있는가? | 권장 |
| ☐ | 요청 제한(rate limit) 처리가 있는가? | 권장 |

### 10.7 아키텍처 체크리스트

| 항목 | 설명 | 중요도 |
|------|------|--------|
| ☐ | 레이어가 명확히 분리되어 있는가? | 권장 |
| ☐ | 의존성이 올바른 방향인가? (안쪽으로) | 권장 |
| ☐ | 인터페이스로 추상화되어 있는가? | 권장 |
| ☐ | 단위 테스트가 작성 가능한가? | 권장 |
| ☐ | 설정이 외부화되어 있는가? | 권장 |

---

## 요약

### 우수한 MCP의 핵심 요소

```
┌─────────────────────────────────────────────────────────────────┐
│                  우수한 MCP 핵심 요소 요약                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 도구 설계                                                    │
│     ├── 명확한 이름: {서비스}_{동사}_{대상}                       │
│     ├── 완전한 설명: 기능 + 사용시점 + 반환값 + 관련도구           │
│     └── 통합 도구: 복잡한 워크플로를 단일 호출로                   │
│                                                                  │
│  2. 스키마 설계                                                  │
│     ├── 상세 파라미터: 형식 + 예시 + 획득방법                     │
│     ├── 시간 표현식: 1d, 7d, 1w, 1m                              │
│     └── 이름→ID 변환: lookup, search 도구                        │
│                                                                  │
│  3. 응답 설계                                                    │
│     ├── 자기 설명적: 결과 + 메타데이터 + 다음액션                  │
│     ├── ID 포함: 후속 작업에 사용 가능                           │
│     └── truncated 표시: 결과 잘림 여부 명시                       │
│                                                                  │
│  4. 에러 처리                                                    │
│     ├── What-Why-How: 실패 원인과 해결책                         │
│     ├── 유사 항목 제안: 오타 시 대안 제시                         │
│     └── 에러 코드 체계: 일관된 코드 사용                          │
│                                                                  │
│  5. 안전성                                                       │
│     ├── 기본 비활성화: 쓰기 도구는 opt-in                        │
│     ├── 채널 제한: 화이트리스트/블랙리스트                        │
│     └── 멘션 차단: @all, @here 무력화                            │
│                                                                  │
│  6. 성능                                                         │
│     ├── 토큰 제한: 응답 크기 자동 조절                           │
│     ├── 페이지네이션: 커서 기반                                  │
│     └── 캐싱: LRU/TTL 기반                                       │
│                                                                  │
│  7. 아키텍처                                                     │
│     ├── 레이어 분리: Presentation/Application/Domain/Infra       │
│     ├── 의존성 주입: 테스트 용이성                               │
│     └── 인터페이스 추상화: 교체 가능성                           │
│                                                                  │
│  8. 지식 데이터 활용 (메시지 협업 플랫폼 특화)                    │
│     ├── 쓰레드 중심 설계: 쓰레드 = 지식의 기본 단위               │
│     ├── 쓰레드 목록/검색: list_threads, search_threads           │
│     ├── 복합 필터: 시간 + 채널 + 사용자 + 키워드                  │
│     └── 결정사항 추적: find_decisions (키워드 + 리액션 기반)      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 메시지 플랫폼 지식 활용의 핵심

```
┌─────────────────────────────────────────────────────────────────┐
│           메시지 플랫폼을 지식 데이터로 활용하기                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  핵심 인사이트:                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  쓰레드 = 하나의 주제에 대한 완결된 논의 단위              │   │
│  │  → 논의사항, 협의사항, 결정사항의 기본 단위                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  기존 MCP의 한계:                                                │
│  ├── 메시지 검색 → 쓰레드 답장 내용 검색 안 됨                   │
│  ├── 쓰레드 조회 → 하나씩만 조회, 목록 조회 없음                 │
│  └── 결과 → 논의 없는 단순 메시지도 섞여서 반환                  │
│                                                                  │
│  지식 활용을 위한 필수 도구:                                     │
│  ├── list_threads: 쓰레드만 필터링 (논의 있는 메시지만)          │
│  ├── search_threads: 쓰레드 답장까지 검색                        │
│  ├── get_channel_discussions: 채널 논의 요약                     │
│  └── find_decisions: 결정 키워드 + 리액션 기반 탐색              │
│                                                                  │
│  효율적 워크플로우:                                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  1. search_threads("API 설계") → 요약 + 메타데이터         │   │
│  │  2. get_thread(관련도 높은 것) → 상세 맥락                 │   │
│  │  3. AI 분석 → 사용자에게 답변                              │   │
│  │                                                           │   │
│  │  API 호출 2번, 토큰 효율적, 정확도 높음                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

이 문서를 기준으로 MCP를 설계하면 AI Agent가 효과적으로 외부 시스템과 상호작용할 수 있는 고품질 MCP를 구현할 수 있다.

**특히 메시지 협업 플랫폼(Slack, Rocket.Chat 등)에서는 쓰레드 중심 도구를 추가하여 조직의 논의/협의/결정 사항을 지식 데이터로 효과적으로 활용할 수 있다.**
