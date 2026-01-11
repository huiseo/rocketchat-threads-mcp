# Rocket.Chat MCP 상세 요건사항

> 메시지 협업 플랫폼의 대화 내용을 **조직의 지식 데이터**로 활용하기 위한 Rocket.Chat MCP 설계 명세서

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [핵심 사용 시나리오](#2-핵심-사용-시나리오)
3. [기존 Slack MCP 분석 결과](#3-기존-slack-mcp-분석-결과)
4. [Rocket.Chat API 분석](#4-rocketchat-api-분석)
5. [필수 도구 명세](#5-필수-도구-명세)
6. [권장 도구 명세](#6-권장-도구-명세)
7. [스키마 설계 기준](#7-스키마-설계-기준)
8. [응답 설계 기준](#8-응답-설계-기준)
9. [안전성 요건](#9-안전성-요건)
10. [성능 요건](#10-성능-요건)
11. [아키텍처 설계](#11-아키텍처-설계)
12. [구현 우선순위](#12-구현-우선순위)

---

## 1. 프로젝트 개요

### 1.1 목적

Rocket.Chat 메시지 플랫폼에서 AI Agent가 다음을 수행할 수 있도록 MCP 서버 구현:

1. **지식 조회**: 채널/쓰레드의 논의사항, 협의사항, 결정사항 검색 및 조회
2. **메시지 전송**: 채널/쓰레드에 메시지 전송, 사용자에게 DM 전송
3. **맥락 이해**: URL 파싱, 쓰레드 전체 맥락 조회

### 1.2 대상 서버

| 항목 | 값 |
|------|-----|
| 서버 URL | https://message.thinkpool-insight.com |
| 인증 방식 | Auth Token + User ID |
| Auth Token | `TecKoNjM4irJUxmVfIQQ8CFL031h8HLNgVT39HoBfXl` |
| User ID | `x3JG6uXJgE7YNHR3S` |

### 1.3 핵심 원칙

```
┌─────────────────────────────────────────────────────────────────┐
│                    Rocket.Chat MCP 핵심 원칙                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 쓰레드 중심 설계                                             │
│     └── 쓰레드 = 논의/협의/결정의 기본 단위                       │
│                                                                  │
│  2. 지식 검색 최적화                                             │
│     ├── 쓰레드 답장까지 검색 가능                                │
│     ├── 시간 범위 + 채널 + 사용자 복합 필터                       │
│     └── 결정사항 키워드 기반 탐색                                │
│                                                                  │
│  3. 효율적 워크플로우                                            │
│     ├── API 호출 최소화 (통합 도구)                              │
│     ├── 토큰 효율성 (요약 → 상세 단계적 조회)                     │
│     └── 자기 설명적 응답 (다음 액션 안내)                         │
│                                                                  │
│  4. 안전 우선                                                    │
│     ├── 쓰기 도구 기본 비활성화                                  │
│     ├── @all, @here 멘션 차단                                    │
│     └── 채널 화이트리스트/블랙리스트                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 핵심 사용 시나리오

### 2.1 지식 조회 시나리오 (Read)

#### R1: 키워드 기반 논의 검색

```
사용자: "농협 은행 관련 논의된 이력 찾아줘"

필요한 기능:
├── 쓰레드 내용(답장 포함) 검색
├── 시간 범위 필터 (기본: 최근 1개월)
├── 검색 결과에 쓰레드 요약 포함
└── 상세 조회를 위한 thread_id 제공

AI Agent 워크플로우:
1. search_threads("농협 은행", time_range="1m")
   → 관련 쓰레드 목록 + 매칭된 메시지 미리보기
2. get_thread(thread_id) [필요시]
   → 특정 쓰레드 전체 내용
3. 사용자에게 요약 제공
```

#### R2: 기간별 채널 논의 요약

```
사용자: "이번 주 개발팀 채널 논의사항 정리해줘"

필요한 기능:
├── 채널 내 쓰레드 목록 조회
├── 시간 범위 필터 (1w)
├── 쓰레드별 요약/메타데이터
└── 답장 수 기반 중요도 정렬

AI Agent 워크플로우:
1. list_threads(channel="개발팀", time_range="1w", sort="reply_count")
   → 쓰레드 목록 + 답장 수 + 참여자
2. 주요 쓰레드 요약 제공
```

#### R3: 결정사항 추적

```
사용자: "이번 달 결정된 사항들 알려줘"

필요한 기능:
├── 결정 키워드 검색 ("결정", "확정", "합의" 등)
├── 리액션 기반 동의 신호 탐지
├── 쓰레드 맥락 포함
└── 시간순 정렬

AI Agent 워크플로우:
1. find_decisions(time_range="1m", min_reactions=2)
   → 결정 키워드 포함 메시지 + 맥락
2. 결정사항 목록 정리
```

#### R4: URL 기반 맥락 파악

```
사용자: "이 링크 내용 알려줘: https://message.thinkpool-insight.com/..."

필요한 기능:
├── URL 파싱 → room_id, message_id 추출
├── 해당 메시지 조회
├── 쓰레드면 전체 쓰레드 조회
└── 채널 정보 포함

AI Agent 워크플로우:
1. parse_url(url)
   → room_id, message_id, room_type
2. get_thread(message_id) 또는 get_messages(room_id, around=message_id)
   → 전체 맥락
```

#### R5: 특정 사용자 참여 대화 검색

```
사용자: "김철수랑 배포 관련 얘기한 거 찾아줘"

필요한 기능:
├── 사용자 이름 → ID 변환
├── 사용자 + 키워드 복합 검색
├── 쓰레드 내 참여 여부 확인
└── 시간 범위 필터

AI Agent 워크플로우:
1. lookup_user("김철수")
   → user_id, display_name
2. search_threads("배포", participant="김철수")
   → 관련 쓰레드 목록
```

### 2.2 메시지 전송 시나리오 (Write)

#### W1: 채널에 메시지 전송

```
사용자: "개발팀 채널에 '배포 완료' 메시지 보내줘"

필요한 기능:
├── 채널 이름 → ID 변환
├── 메시지 전송
├── 결과에 message_id, permalink 포함
└── 쓰기 권한 확인

AI Agent 워크플로우:
1. lookup_channel("개발팀")
   → room_id
2. send_message(room_id, "배포 완료")
   → message_id, permalink
```

#### W2: 쓰레드 답장

```
사용자: "방금 그 메시지에 '확인했습니다' 답장해줘"

필요한 기능:
├── 이전 맥락에서 message_id 확인
├── 쓰레드 답장 전송
├── 결과에 permalink 포함
└── 쓰기 권한 확인

AI Agent 워크플로우:
1. reply_thread(thread_id, "확인했습니다")
   → message_id, permalink
```

#### W3: 사용자에게 DM

```
사용자: "김철수에게 회의 참석 요청 보내줘"

필요한 기능:
├── 사용자 이름 → ID 변환
├── DM 채널 열기/조회
├── 메시지 전송
└── 통합 도구로 한 번에 처리

AI Agent 워크플로우:
1. message_user("김철수", "회의 참석 요청드립니다")
   → dm_room_id, message_id
```

---

## 3. 기존 Slack MCP 분석 결과

### 3.1 분석 대상

| MCP | 언어 | 도구 수 | 특징 |
|-----|------|--------|------|
| korotovsky-slack | Go | 5 | 시간 표현식, 검색 필터, 쓰기 보호 |
| dennison-slack | TypeScript | 14 | 통합 도구, 토큰 제한, LRU 캐시 |
| lbeatu-slack | TypeScript | 7 | Clean Architecture, URL 파싱 |
| zencoderai-slack | TypeScript | 8 | 공식 유지관리, 단순 구조 |

### 3.2 기존 MCP의 한계

```
┌─────────────────────────────────────────────────────────────────┐
│                    기존 Slack MCP 한계점                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 쓰레드 검색 불가                                             │
│     ├── 메시지 검색 = 부모 메시지만 검색                         │
│     ├── 쓰레드 답장 내용은 검색 안 됨                            │
│     └── "결정"이 답장에 있으면 못 찾음                           │
│                                                                  │
│  2. 쓰레드 목록 조회 없음                                        │
│     ├── 채널의 "논의가 있는 메시지" 필터링 불가                   │
│     ├── 쓰레드 하나씩만 조회 가능                                │
│     └── AI가 직접 reply_count > 0 필터링 필요                    │
│                                                                  │
│  3. 시간 범위 제한 (korotovsky 외)                               │
│     ├── 대부분 limit=N개만 지원                                  │
│     └── "지난주 메시지" 직접 지정 불가                           │
│                                                                  │
│  4. 복합 필터 부족                                               │
│     ├── 시간 + 사용자 + 키워드 동시 필터 제한적                  │
│     └── korotovsky만 풍부한 필터 지원                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 채택할 패턴

| 패턴 | 출처 | 설명 |
|------|------|------|
| 시간 표현식 | korotovsky | `1d`, `7d`, `1w`, `1m` |
| 검색 필터 | korotovsky | `is:thread`, `in:채널`, `from:사용자` |
| 이름→ID 변환 | dennison | fuzzy 매칭 검색 |
| 통합 DM 도구 | dennison | `message_user(이름, 텍스트)` |
| URL 파싱 | dennison/lbeatu | 메시지 URL → room_id, message_id |
| 토큰 제한 | dennison | TokenCounter로 응답 크기 제어 |
| 쓰기 보호 | korotovsky | 기본 비활성화, 화이트리스트 |
| 멘션 차단 | dennison | @all, @here 무력화 |
| Result 패턴 | lbeatu | `{ success, data?, error? }` |
| 자기설명적 응답 | Playwright | 결과 + 다음 액션 가이드 |

---

## 4. Rocket.Chat API 분석

### 4.1 인증

```typescript
// 모든 요청에 필요한 헤더
headers: {
    "X-Auth-Token": "TecKoNjM4irJUxmVfIQQ8CFL031h8HLNgVT39HoBfXl",
    "X-User-Id": "x3JG6uXJgE7YNHR3S",
    "Content-Type": "application/json"
}
```

### 4.2 핵심 API 엔드포인트

#### 채널/룸 관련

| API | 메서드 | 용도 |
|-----|--------|------|
| `/api/v1/channels.list` | GET | 공개 채널 목록 |
| `/api/v1/groups.list` | GET | 비공개 그룹 목록 |
| `/api/v1/channels.info` | GET | 채널 상세 정보 |
| `/api/v1/channels.members` | GET | 채널 멤버 목록 |

#### 메시지 관련

| API | 메서드 | 용도 |
|-----|--------|------|
| `/api/v1/channels.messages` | GET | 채널 메시지 조회 |
| `/api/v1/groups.messages` | GET | 그룹 메시지 조회 |
| `/api/v1/chat.postMessage` | POST | 메시지 전송 |
| `/api/v1/chat.update` | POST | 메시지 수정 |
| `/api/v1/chat.delete` | POST | 메시지 삭제 |

#### 쓰레드 관련 (핵심)

| API | 메서드 | 용도 |
|-----|--------|------|
| `/api/v1/chat.getThreadsList` | GET | **채널 내 쓰레드 목록** |
| `/api/v1/chat.getThreadMessages` | GET | **쓰레드 전체 메시지** |
| `/api/v1/chat.followMessage` | POST | 쓰레드 팔로우 |
| `/api/v1/chat.unfollowMessage` | POST | 쓰레드 언팔로우 |

#### 검색 관련

| API | 메서드 | 용도 |
|-----|--------|------|
| `/api/v1/chat.search` | GET | 메시지 검색 |
| `/api/v1/spotlight` | GET | 사용자/채널 통합 검색 |

#### 사용자 관련

| API | 메서드 | 용도 |
|-----|--------|------|
| `/api/v1/users.list` | GET | 사용자 목록 |
| `/api/v1/users.info` | GET | 사용자 상세 정보 |
| `/api/v1/im.create` | POST | DM 채널 생성 |
| `/api/v1/im.messages` | GET | DM 메시지 조회 |

### 4.3 쓰레드 API 상세

#### getThreadsList - 채널 내 쓰레드 목록

```typescript
// GET /api/v1/chat.getThreadsList
// 채널 내에서 쓰레드가 있는 메시지(부모) 목록 조회

interface GetThreadsListParams {
    rid: string;        // Room ID
    count?: number;     // 조회 개수 (기본 50)
    offset?: number;    // 페이지네이션 오프셋
    sort?: string;      // 정렬 (예: { "tlm": -1 } = 최근 활동순)
}

interface ThreadListResponse {
    threads: Array<{
        _id: string;           // 메시지 ID (= thread_id)
        rid: string;           // Room ID
        msg: string;           // 부모 메시지 내용
        ts: string;            // 생성 시간
        u: { _id: string; username: string; name: string };  // 작성자
        tcount: number;        // 답장 수
        tlm: string;           // 마지막 답장 시간
        replies: string[];     // 답장 작성자 ID 목록
    }>;
    count: number;
    offset: number;
    total: number;
}
```

#### getThreadMessages - 쓰레드 전체 메시지

```typescript
// GET /api/v1/chat.getThreadMessages
// 특정 쓰레드의 모든 메시지(부모 + 답장) 조회

interface GetThreadMessagesParams {
    tmid: string;       // Thread Message ID (부모 메시지 ID)
    count?: number;     // 조회 개수
    offset?: number;    // 페이지네이션
    sort?: string;      // 정렬
}

interface ThreadMessagesResponse {
    messages: Array<{
        _id: string;
        rid: string;
        msg: string;
        ts: string;
        u: { _id: string; username: string; name: string };
        tmid: string;          // 부모 메시지 ID
        reactions?: Record<string, { usernames: string[] }>;
    }>;
    count: number;
    total: number;
}
```

### 4.4 Rocket.Chat vs Slack 용어 매핑

| 개념 | Slack | Rocket.Chat |
|------|-------|-------------|
| 쓰레드 부모 ID | `thread_ts` | `tmid` |
| 채널 ID | `channel_id` | `rid` (Room ID) |
| 메시지 ID | `ts` (timestamp) | `_id` |
| 쓰레드 답장 수 | `reply_count` | `tcount` |
| 마지막 답장 시간 | `latest_reply` | `tlm` |
| 쓰레드 참여자 | `reply_users` | `replies` |

---

## 5. 필수 도구 명세

### 5.1 개요

```
┌─────────────────────────────────────────────────────────────────┐
│                      필수 도구 목록 (11개)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  조회 도구 (8개) - 기본 활성화                                    │
│  ├── rocketchat_list_channels      채널 목록                     │
│  ├── rocketchat_search_channels    채널 검색 (이름→ID)            │
│  ├── rocketchat_get_messages       메시지 조회 (시간 범위)        │
│  ├── rocketchat_list_threads       쓰레드 목록 ★                 │
│  ├── rocketchat_get_thread         쓰레드 전체 조회               │
│  ├── rocketchat_search_threads     쓰레드 검색 (답장 포함) ★      │
│  ├── rocketchat_lookup_user        사용자 검색 (이름→ID)          │
│  └── rocketchat_parse_url          URL 파싱                      │
│                                                                  │
│  전송 도구 (3개) - 선택적 활성화                                  │
│  ├── rocketchat_send_message       메시지 전송                   │
│  ├── rocketchat_reply_thread       쓰레드 답장                   │
│  └── rocketchat_message_user       DM 전송 (통합)                │
│                                                                  │
│  ★ = 기존 Slack MCP에 없는 새 도구                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 조회 도구 상세

#### 5.2.1 rocketchat_list_channels

```typescript
{
    name: "rocketchat_list_channels",
    description: `
        List all accessible channels and groups.

        USE WHEN:
        - Finding available channels
        - Getting channel IDs for other tools
        - Checking channel membership

        RETURNS:
        - Public channels
        - Private groups (where user is member)
        - Each with: id, name, type, member_count, topic

        RELATED:
        - Use rocketchat_search_channels for name-based lookup
        - Use rocketchat_get_messages to read channel content
    `,
    inputSchema: {
        type: "object",
        properties: {
            type: {
                type: "string",
                enum: ["all", "public", "private"],
                default: "all",
                description: "Filter by channel type"
            },
            limit: {
                type: "number",
                default: 50,
                maximum: 100,
                description: "Maximum channels to return"
            }
        }
    }
}
```

#### 5.2.2 rocketchat_search_channels

```typescript
{
    name: "rocketchat_search_channels",
    description: `
        Search channels by name, topic, or description.
        Converts channel names to IDs for use in other tools.

        USE WHEN:
        - User mentions channel by name ("개발팀 채널")
        - Need to find channel ID from partial name
        - Looking for channels about a topic

        MATCHING:
        - Fuzzy match on channel name
        - Searches topic and description
        - Case-insensitive

        EXAMPLE:
        - query="개발" matches "개발팀", "프론트개발", "개발-백엔드"
    `,
    inputSchema: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "Search term for channel name/topic"
            },
            type: {
                type: "string",
                enum: ["all", "public", "private"],
                default: "all"
            },
            limit: {
                type: "number",
                default: 10,
                maximum: 50
            }
        },
        required: ["query"]
    }
}
```

#### 5.2.3 rocketchat_get_messages

```typescript
{
    name: "rocketchat_get_messages",
    description: `
        Get messages from a channel with time range filtering.

        USE WHEN:
        - Reading recent channel activity
        - Getting context around a specific time
        - Understanding what was discussed

        TIME RANGE FORMATS:
        - Relative: "1d" (today), "7d" (week), "1w", "1m" (month)
        - ISO date: "2024-01-01" to "2024-01-15"

        RETURNS:
        - Messages with sender info
        - Thread indicators (tcount > 0 means has replies)
        - Reactions

        NOTE: For thread replies, use rocketchat_get_thread instead.
    `,
    inputSchema: {
        type: "object",
        properties: {
            room_id: {
                type: "string",
                description: `
                    Room ID. Get from rocketchat_search_channels.
                    Format: 17-char alphanumeric or "GENERAL"
                `
            },
            time_range: {
                type: "string",
                default: "1d",
                description: `
                    Time range: "1d", "7d", "1w", "1m" or ISO date range.
                    Default: "1d" (today's messages)
                `
            },
            limit: {
                type: "number",
                default: 50,
                maximum: 100,
                description: "Maximum messages to return"
            },
            include_threads: {
                type: "boolean",
                default: false,
                description: "Include thread reply counts"
            }
        },
        required: ["room_id"]
    }
}
```

#### 5.2.4 rocketchat_list_threads ★ (신규)

```typescript
{
    name: "rocketchat_list_threads",
    description: `
        List threads (messages with replies) in a channel.

        ★ KEY FEATURE: Filters to only show messages that have discussions.

        USE WHEN:
        - Finding discussions in a channel
        - Looking for important topics (threads = engagement)
        - "이번 주 논의사항 알려줘"
        - Identifying decision points

        WHY THREADS MATTER:
        - Threads represent complete discussion units
        - A message with 10+ replies likely contains important decisions
        - Filtering threads reduces noise from announcements

        RETURNS:
        - Only messages that have thread replies
        - Sorted by reply count or recent activity
        - Includes: parent message, reply count, last reply time, participants
    `,
    inputSchema: {
        type: "object",
        properties: {
            room_id: {
                type: "string",
                description: "Room ID from rocketchat_search_channels"
            },
            time_range: {
                type: "string",
                default: "7d",
                description: "Time range: 1d, 7d, 1w, 1m"
            },
            min_replies: {
                type: "number",
                default: 1,
                description: "Minimum reply count. Use higher (5+) for important discussions only."
            },
            sort_by: {
                type: "string",
                enum: ["reply_count", "recent_activity", "created"],
                default: "recent_activity",
                description: "Sort order for threads"
            },
            limit: {
                type: "number",
                default: 20,
                maximum: 50
            }
        },
        required: ["room_id"]
    }
}
```

#### 5.2.5 rocketchat_get_thread

```typescript
{
    name: "rocketchat_get_thread",
    description: `
        Get complete thread content including all replies.

        USE WHEN:
        - Reading full discussion context
        - Understanding a decision-making process
        - Following up on a specific topic

        RETURNS:
        - Parent message (the topic/question)
        - All replies in chronological order
        - Each message with: author, timestamp, reactions
        - Participant summary

        TIP: Get thread_id from rocketchat_list_threads or rocketchat_search_threads
    `,
    inputSchema: {
        type: "object",
        properties: {
            thread_id: {
                type: "string",
                description: `
                    Thread ID (= parent message ID).
                    Get from list_threads or search_threads results.
                `
            },
            room_id: {
                type: "string",
                description: "Room ID containing the thread"
            },
            include_reactions: {
                type: "boolean",
                default: true,
                description: "Include emoji reactions (often indicate agreement)"
            },
            limit: {
                type: "number",
                default: 50,
                maximum: 100,
                description: "Maximum replies to return"
            }
        },
        required: ["thread_id", "room_id"]
    }
}
```

#### 5.2.6 rocketchat_search_threads ★ (신규 - 핵심)

```typescript
{
    name: "rocketchat_search_threads",
    description: `
        Search within thread contents INCLUDING replies.

        ★ KEY FEATURE: Searches both parent messages AND all replies.

        USE WHEN:
        - "농협 은행 관련 논의 찾아줘"
        - Finding discussions about a specific topic
        - Looking for decisions or agreements
        - Searching for context that may be in replies

        DIFFERENCE FROM search_messages:
        - search_messages: Only searches parent messages
        - search_threads: Searches parent AND all replies

        EXAMPLE:
        - Query "결정" finds threads where someone said "결정됨" in a reply

        MATCHING:
        - Full-text search in message content
        - Case-insensitive
        - Highlights matched text in response
    `,
    inputSchema: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "Search keywords. Searches in all thread messages."
            },
            room_id: {
                type: "string",
                description: "Limit search to specific room (optional)"
            },
            participant: {
                type: "string",
                description: "Filter by user who participated in thread"
            },
            time_range: {
                type: "string",
                default: "1m",
                description: "Time range: 1d, 7d, 1w, 1m"
            },
            min_replies: {
                type: "number",
                default: 1,
                description: "Minimum replies to qualify as discussion"
            },
            limit: {
                type: "number",
                default: 10,
                maximum: 30
            }
        },
        required: ["query"]
    }
}
```

#### 5.2.7 rocketchat_lookup_user

```typescript
{
    name: "rocketchat_lookup_user",
    description: `
        Find user by name, username, or email.
        Converts user-friendly names to IDs.

        USE WHEN:
        - User mentions someone by name ("김철수")
        - Need user ID for filtering or DM
        - Looking up user details

        MATCHING:
        - Exact match on username, email, ID
        - Fuzzy match on display name, real name
        - Case-insensitive

        RETURNS:
        - user_id: For use in other tools
        - username: Login name
        - display_name: Shown in messages
        - status: online/away/offline
    `,
    inputSchema: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "User name, username, or email to search"
            }
        },
        required: ["query"]
    }
}
```

#### 5.2.8 rocketchat_parse_url

```typescript
{
    name: "rocketchat_parse_url",
    description: `
        Parse a Rocket.Chat URL to extract room and message IDs.

        USE WHEN:
        - User shares a message link
        - Need to access a specific message from URL
        - Want to get context around a linked message

        SUPPORTED URL FORMATS:
        - https://chat.example.com/channel/general?msg=abc123
        - https://chat.example.com/group/private-team?msg=xyz789
        - https://chat.example.com/direct/user123?msg=msg456

        RETURNS:
        - room_id: Channel/Room ID
        - room_type: "channel" | "group" | "direct"
        - message_id: Message ID (if present)
        - is_thread: Whether message is part of thread

        NEXT STEPS:
        - Get context: rocketchat_get_messages(room_id, around=message_id)
        - Get thread: rocketchat_get_thread(message_id)
    `,
    inputSchema: {
        type: "object",
        properties: {
            url: {
                type: "string",
                description: "Rocket.Chat message or channel URL"
            }
        },
        required: ["url"]
    }
}
```

### 5.3 전송 도구 상세

#### 5.3.1 rocketchat_send_message

```typescript
{
    name: "rocketchat_send_message",
    description: `
        Send a message to a channel.

        REQUIRES:
        - Write permissions enabled (ROCKETCHAT_WRITE_ENABLED=true)
        - Room in allowed list (if whitelist configured)

        SAFETY:
        - @all, @here mentions are automatically neutralized
        - Message length limited to 4000 characters

        RETURNS:
        - message_id: For replies or reactions
        - permalink: Direct link to message
        - timestamp: When sent
    `,
    inputSchema: {
        type: "object",
        properties: {
            room_id: {
                type: "string",
                description: "Room ID from rocketchat_search_channels"
            },
            text: {
                type: "string",
                description: "Message content (markdown supported)"
            },
            alias: {
                type: "string",
                description: "Display name override (optional)"
            }
        },
        required: ["room_id", "text"]
    }
}
```

#### 5.3.2 rocketchat_reply_thread

```typescript
{
    name: "rocketchat_reply_thread",
    description: `
        Reply to an existing thread.

        USE WHEN:
        - Continuing a discussion
        - Responding to a question
        - Adding information to existing topic

        REQUIRES:
        - Write permissions enabled
        - Valid thread_id from previous tool results

        RETURNS:
        - message_id: New reply ID
        - permalink: Direct link
        - thread_id: Parent thread ID
    `,
    inputSchema: {
        type: "object",
        properties: {
            room_id: {
                type: "string",
                description: "Room containing the thread"
            },
            thread_id: {
                type: "string",
                description: "Parent message ID (tmid)"
            },
            text: {
                type: "string",
                description: "Reply content"
            }
        },
        required: ["room_id", "thread_id", "text"]
    }
}
```

#### 5.3.3 rocketchat_message_user

```typescript
{
    name: "rocketchat_message_user",
    description: `
        Send a direct message to a user by name.

        ★ INTEGRATED TOOL: Combines user lookup + DM creation + message sending.

        USE WHEN:
        - "김철수에게 메시지 보내줘"
        - Need to DM someone without knowing their ID
        - Quick direct communication

        ACCEPTS USER IDENTIFIER:
        - Display name: "김철수"
        - Username: "kim.cheolsu"
        - Email: "kim@example.com"
        - User ID: "user123"

        REQUIRES:
        - Write permissions enabled

        RETURNS:
        - dm_room_id: DM channel ID (for follow-up)
        - message_id: Sent message ID
        - user: Resolved user info
    `,
    inputSchema: {
        type: "object",
        properties: {
            user: {
                type: "string",
                description: "User identifier: name, username, email, or ID"
            },
            text: {
                type: "string",
                description: "Message content"
            }
        },
        required: ["user", "text"]
    }
}
```

---

## 6. 권장 도구 명세

### 6.1 개요

```
┌─────────────────────────────────────────────────────────────────┐
│                      권장 도구 목록 (5개)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  지식 활용 도구                                                  │
│  ├── rocketchat_find_decisions     결정사항 탐색                 │
│  └── rocketchat_get_channel_summary 채널 논의 요약               │
│                                                                  │
│  부가 기능                                                       │
│  ├── rocketchat_add_reaction       이모지 반응 추가              │
│  ├── rocketchat_get_user_info      사용자 상세 정보              │
│  └── rocketchat_list_users         사용자 목록                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 상세 명세

#### 6.2.1 rocketchat_find_decisions

```typescript
{
    name: "rocketchat_find_decisions",
    description: `
        Find messages that likely contain decisions or agreements.

        HOW IT WORKS:
        - Searches for decision keywords: "결정", "확정", "합의", "동의",
          "agreed", "decided", "finalized", "approved", "go with"
        - Prioritizes messages with high reaction counts (agreement signals)
        - Looks in threads where discussions concluded

        USE WHEN:
        - "이번 달 결정된 사항들 정리해줘"
        - "API 버전 관련 최종 결정이 뭐였지?"
        - Auditing past decisions

        NOTE: Uses heuristics. May include false positives.
        Always verify by reading the thread context.
    `,
    inputSchema: {
        type: "object",
        properties: {
            room_id: {
                type: "string",
                description: "Limit to specific room (optional)"
            },
            time_range: {
                type: "string",
                default: "1m",
                description: "Time range: 1d, 7d, 1w, 1m"
            },
            keywords: {
                type: "array",
                items: { type: "string" },
                description: "Additional keywords to search"
            },
            min_reactions: {
                type: "number",
                default: 0,
                description: "Minimum reactions (higher = more likely agreed upon)"
            }
        },
        required: ["time_range"]
    }
}
```

#### 6.2.2 rocketchat_get_channel_summary

```typescript
{
    name: "rocketchat_get_channel_summary",
    description: `
        Get a high-level summary of channel activity.

        USE WHEN:
        - "이번 주 개발팀 논의사항 정리해줘"
        - Understanding what a channel discusses
        - Onboarding to a new channel

        RETURNS:
        - Active threads with brief summaries
        - Top participants
        - Message volume trends
        - Potential decisions (flagged messages)
        - Open questions (messages ending with ?)

        NOTE: High-level overview, not full content.
        Use get_thread for detailed content.
    `,
    inputSchema: {
        type: "object",
        properties: {
            room_id: {
                type: "string",
                description: "Room ID"
            },
            time_range: {
                type: "string",
                default: "7d",
                description: "Time range for summary"
            },
            focus: {
                type: "string",
                enum: ["all", "decisions", "questions", "active_threads"],
                default: "all",
                description: "Focus area for summary"
            }
        },
        required: ["room_id"]
    }
}
```

---

## 7. 스키마 설계 기준

### 7.1 파라미터 설명 레벨

모든 파라미터는 Level 3 이상의 설명을 제공해야 함:

```typescript
// Level 3 (최소 기준)
room_id: {
    type: "string",
    description: `
        Room ID for the channel.

        FORMAT: 17-character alphanumeric or "GENERAL"
        EXAMPLE: "hGE7sBz8WW4JiFxPy"

        HOW TO GET:
        - Use rocketchat_search_channels(query="채널명")
        - Extract from URL using rocketchat_parse_url
    `
}

// Level 4 (권장)
room_id: {
    type: "string",
    description: `
        Unique identifier for the room/channel.

        FORMAT: 17-character alphanumeric string
        EXAMPLES: "hGE7sBz8WW4JiFxPy", "GENERAL"

        HOW TO GET:
        - By name: rocketchat_search_channels(query="개발팀")
        - From URL: rocketchat_parse_url(url="https://...")
        - From list: rocketchat_list_channels()

        NOTE: This is the internal ID, not the channel name.
        Channel names like "#general" must be converted to IDs first.
    `,
    pattern: "^[a-zA-Z0-9]{17}$|^GENERAL$"
}
```

### 7.2 시간 표현식 표준

```typescript
time_range: {
    type: "string",
    description: `
        Time range for message retrieval.

        FORMATS SUPPORTED:
        - Relative: "1d" (today), "7d" (7 days), "1w" (1 week), "1m" (1 month)
        - Absolute: "2024-01-01" to "2024-01-15" (ISO 8601)

        RELATIVE TIME EXPLAINED:
        - "1d" → Today since midnight
        - "7d" → Last 7 days since midnight
        - "1w" → Same as "7d"
        - "1m" → Last 30 days

        DEFAULT: "1d" (today's messages)

        EXAMPLES:
        - "1d" for today's activity
        - "7d" for weekly review
        - "1m" for monthly summary
    `,
    default: "1d",
    pattern: "^(\\d+[dwm]|\\d{4}-\\d{2}-\\d{2})$"
}
```

### 7.3 필수 describe 요소

| 요소 | 설명 | 필수 |
|------|------|:----:|
| FORMAT | 값의 형태/패턴 | ✓ |
| EXAMPLE | 실제 값 예시 | ✓ |
| HOW TO GET | 값을 얻는 방법 | ✓ |
| DEFAULT | 기본값 (있는 경우) | △ |
| NOTE | 주의사항/흔한 실수 | △ |

---

## 8. 응답 설계 기준

### 8.1 자기 설명적 응답 구조

모든 응답은 다음 구조를 따름:

```typescript
interface MCPResponse<T> {
    // 1. 결과 요약
    success: boolean;
    summary: string;  // 한 줄 요약

    // 2. 실제 데이터
    data: T;

    // 3. 메타데이터
    metadata: {
        total_count?: number;
        returned_count: number;
        truncated: boolean;
        time_range?: { from: string; to: string };
        next_cursor?: string;
    };

    // 4. 다음 액션 가이드
    next_actions: Array<{
        description: string;
        tool: string;
        example_params: Record<string, any>;
    }>;

    // 5. 에러 정보 (실패 시)
    error?: {
        code: string;
        what: string;
        why: string;
        how: string[];
    };
}
```

### 8.2 응답 포맷 예시

#### 쓰레드 검색 결과

```markdown
## Result
Found 5 threads about "농협 은행" in the last 30 days

## Threads

### 1. 농협 API 연동 방식 논의 (가장 활발)
- **Channel**: #개발팀
- **Started by**: 김철수 (2024-01-08)
- **Replies**: 23 | **Participants**: 5
- **Last activity**: 2024-01-10 14:30

**Topic**: 농협 은행 API 연동 시 OAuth 방식 vs API Key 방식
**Key participants**: 김철수(8), 이영희(6), 박민수(5)

**Matched in reply**: "...OAuth 방식으로 **결정**했습니다. 보안 요구사항 때문에..."

---

### 2. 농협 테스트 계정 발급
- **Channel**: #인프라
- **Started by**: 박지훈 (2024-01-05)
- **Replies**: 8

**Topic**: 농협 테스트 환경 계정 발급 요청

---

[3 more threads...]

## Metadata
- Time range: 2023-12-11 to 2024-01-10
- Showing 5 of 5 threads
- Search included thread replies

## Next Actions
- View full thread: `rocketchat_get_thread(thread_id="msg_abc123", room_id="room_xyz")`
- Find decisions: `rocketchat_find_decisions(time_range="1m", keywords=["농협"])`
- Search in specific channel: `rocketchat_search_threads(query="농협", room_id="개발팀_id")`
```

#### 에러 응답

```markdown
## Error
Cannot find channel "개발팀"

## Reason (Why)
- No channel found with name "개발팀"
- Searched in: public channels, private groups (where you are member)
- Possible causes:
  - Channel name might be spelled differently
  - Channel might be private and you're not a member
  - Channel might have been archived

## Similar Channels Found
1. "개발팀-프론트" (room_id: abc123)
2. "개발팀-백엔드" (room_id: xyz789)
3. "개발-인프라" (room_id: def456)

## How to Fix
1. Try one of the similar channels above
2. Use `rocketchat_list_channels()` to see all available channels
3. Ask a team member for the exact channel name
4. Check if you need to be invited to the channel
```

---

## 9. 안전성 요건

### 9.1 쓰기 보호 설정

```bash
# 환경 변수 설정

# 쓰기 완전 비활성화 (기본값, 가장 안전)
ROCKETCHAT_WRITE_ENABLED=""

# 모든 채널에서 쓰기 허용
ROCKETCHAT_WRITE_ENABLED="true"

# 특정 채널만 허용 (Whitelist)
ROCKETCHAT_WRITE_ROOMS="GENERAL,hGE7sBz8WW4JiFxPy,yZm3kQhNwR7XbVcFp"

# 특정 채널만 제외 (Blacklist)
ROCKETCHAT_WRITE_ROOMS="!GENERAL,!announcement"
```

### 9.2 멘션 보호

```typescript
class MessageSanitizer {
    private static readonly DANGEROUS_MENTIONS = [
        '@all', '@here', '@channel', '@everyone'
    ];

    static sanitize(text: string): { text: string; warnings: string[] } {
        const warnings: string[] = [];
        let sanitized = text;

        for (const mention of this.DANGEROUS_MENTIONS) {
            if (sanitized.toLowerCase().includes(mention.toLowerCase())) {
                sanitized = sanitized.replace(
                    new RegExp(mention, 'gi'),
                    `[${mention}]`  // 무력화
                );
                warnings.push(
                    `Dangerous mention "${mention}" was neutralized to prevent mass notification.`
                );
            }
        }

        return { text: sanitized, warnings };
    }
}
```

### 9.3 메시지 크기 제한

```typescript
const MESSAGE_LIMITS = {
    MAX_LENGTH: 4000,      // 최대 메시지 길이
    TRUNCATE_SUFFIX: '... [truncated]'
};

function enforceMessageLimit(text: string): { text: string; truncated: boolean } {
    if (text.length <= MESSAGE_LIMITS.MAX_LENGTH) {
        return { text, truncated: false };
    }

    const truncatedText = text.substring(0, MESSAGE_LIMITS.MAX_LENGTH - MESSAGE_LIMITS.TRUNCATE_SUFFIX.length)
        + MESSAGE_LIMITS.TRUNCATE_SUFFIX;

    return { text: truncatedText, truncated: true };
}
```

---

## 10. 성능 요건

### 10.1 토큰 오버플로 방지

```typescript
class TokenCounter {
    private static readonly MAX_RESPONSE_CHARS = 100000;  // ~25,000 토큰
    private static readonly SAFETY_BUFFER = 4000;

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
}
```

### 10.2 캐싱 전략

| 데이터 | TTL | 캐싱 방식 |
|--------|-----|----------|
| 채널 목록 | 5분 | LRU |
| 채널 정보 | 5분 | LRU |
| 사용자 목록 | 30분 | LRU |
| 사용자 정보 | 30분 | LRU |
| 메시지 | 캐시 안함 | - |
| 쓰레드 | 캐시 안함 | - |

### 10.3 페이지네이션

```typescript
// 커서 기반 페이지네이션
interface PaginationParams {
    limit: number;
    offset?: number;
    cursor?: string;
}

interface PaginatedResponse<T> {
    items: T[];
    pagination: {
        total: number;
        count: number;
        offset: number;
        has_more: boolean;
        next_cursor?: string;
    };
}
```

---

## 11. 아키텍처 설계

### 11.1 디렉토리 구조

```
src/
├── index.ts                    # MCP 서버 진입점
├── server.ts                   # MCP 서버 설정
│
├── tools/                      # 도구 정의
│   ├── channels.ts             # 채널 관련 도구
│   ├── messages.ts             # 메시지 관련 도구
│   ├── threads.ts              # 쓰레드 관련 도구 ★
│   ├── users.ts                # 사용자 관련 도구
│   ├── search.ts               # 검색 관련 도구 ★
│   └── index.ts                # 도구 등록
│
├── api/                        # Rocket.Chat API 클라이언트
│   ├── client.ts               # HTTP 클라이언트
│   ├── channels.ts             # 채널 API
│   ├── messages.ts             # 메시지 API
│   ├── threads.ts              # 쓰레드 API
│   ├── users.ts                # 사용자 API
│   └── types.ts                # API 타입 정의
│
├── services/                   # 비즈니스 로직
│   ├── channel.service.ts
│   ├── message.service.ts
│   ├── thread.service.ts
│   ├── user.service.ts
│   └── search.service.ts
│
├── formatters/                 # 응답 포맷터
│   ├── message.formatter.ts
│   ├── thread.formatter.ts
│   ├── channel.formatter.ts
│   └── error.formatter.ts
│
├── utils/                      # 유틸리티
│   ├── token-counter.ts        # 토큰 제한
│   ├── time-parser.ts          # 시간 표현식 파싱
│   ├── url-parser.ts           # URL 파싱
│   ├── sanitizer.ts            # 메시지 정화
│   └── cache.ts                # LRU 캐시
│
├── guards/                     # 안전 장치
│   ├── write-guard.ts          # 쓰기 보호
│   └── mention-guard.ts        # 멘션 보호
│
└── config/                     # 설정
    └── config.ts               # 환경 변수 로드
```

### 11.2 핵심 컴포넌트

```
┌─────────────────────────────────────────────────────────────────┐
│                      MCP Server Architecture                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Tool Handlers                         │    │
│  │  ├── ChannelTools (list, search)                        │    │
│  │  ├── MessageTools (get, send)                           │    │
│  │  ├── ThreadTools (list, get, search, reply) ★           │    │
│  │  └── UserTools (lookup, message)                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                     Services                             │    │
│  │  ├── ChannelService                                     │    │
│  │  ├── MessageService                                     │    │
│  │  ├── ThreadService ★                                    │    │
│  │  ├── UserService                                        │    │
│  │  └── SearchService ★                                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    API Client                            │    │
│  │  └── RocketChatClient                                   │    │
│  │      ├── channels.*                                     │    │
│  │      ├── groups.*                                       │    │
│  │      ├── chat.* (threads)                               │    │
│  │      ├── users.*                                        │    │
│  │      └── im.*                                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Utilities                              │    │
│  │  ├── TokenCounter (응답 크기 제한)                       │    │
│  │  ├── TimeParser (시간 표현식)                            │    │
│  │  ├── UrlParser (URL 파싱)                               │    │
│  │  ├── WriteGuard (쓰기 보호)                             │    │
│  │  ├── Sanitizer (멘션 정화)                              │    │
│  │  └── Cache (LRU 캐시)                                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. 구현 우선순위

### 12.1 Phase 1: 핵심 조회 (MVP)

```
우선순위 1 - 지식 조회 기본 기능
├── rocketchat_list_channels
├── rocketchat_search_channels
├── rocketchat_get_messages
├── rocketchat_list_threads ★
├── rocketchat_get_thread
└── rocketchat_lookup_user

기반 인프라
├── API 클라이언트
├── 시간 표현식 파싱
├── 토큰 제한
└── 응답 포맷터
```

### 12.2 Phase 2: 고급 검색

```
우선순위 2 - 지식 검색 고도화
├── rocketchat_search_threads ★ (핵심)
├── rocketchat_parse_url
└── rocketchat_find_decisions

추가 인프라
├── URL 파서
├── 검색 서비스
└── 캐싱
```

### 12.3 Phase 3: 메시지 전송

```
우선순위 3 - 쓰기 기능
├── rocketchat_send_message
├── rocketchat_reply_thread
└── rocketchat_message_user

추가 인프라
├── 쓰기 보호 (WriteGuard)
├── 멘션 정화 (Sanitizer)
└── 채널 화이트리스트
```

### 12.4 Phase 4: 부가 기능

```
우선순위 4 - 편의 기능
├── rocketchat_get_channel_summary
├── rocketchat_add_reaction
├── rocketchat_get_user_info
└── rocketchat_list_users
```

---

## 체크리스트

### 필수 도구 체크리스트

| 도구 | 설명 | Phase | 상태 |
|------|------|:-----:|:----:|
| `list_channels` | 채널 목록 | 1 | ☐ |
| `search_channels` | 채널 검색 | 1 | ☐ |
| `get_messages` | 메시지 조회 | 1 | ☐ |
| `list_threads` ★ | 쓰레드 목록 | 1 | ☐ |
| `get_thread` | 쓰레드 조회 | 1 | ☐ |
| `lookup_user` | 사용자 검색 | 1 | ☐ |
| `search_threads` ★ | 쓰레드 검색 | 2 | ☐ |
| `parse_url` | URL 파싱 | 2 | ☐ |
| `send_message` | 메시지 전송 | 3 | ☐ |
| `reply_thread` | 쓰레드 답장 | 3 | ☐ |
| `message_user` | DM 전송 | 3 | ☐ |

### 인프라 체크리스트

| 컴포넌트 | 설명 | Phase | 상태 |
|----------|------|:-----:|:----:|
| API Client | HTTP 클라이언트 | 1 | ☐ |
| TimeParser | 시간 표현식 | 1 | ☐ |
| TokenCounter | 응답 크기 제한 | 1 | ☐ |
| ResponseFormatter | 마크다운 포맷 | 1 | ☐ |
| UrlParser | URL 파싱 | 2 | ☐ |
| SearchService | 쓰레드 검색 | 2 | ☐ |
| LRUCache | 캐싱 | 2 | ☐ |
| WriteGuard | 쓰기 보호 | 3 | ☐ |
| Sanitizer | 멘션 정화 | 3 | ☐ |

---

## 결론

이 요건사항에 따라 Rocket.Chat MCP를 구현하면:

1. **지식 조회 최적화**: 쓰레드 답장까지 검색, 시간 범위 필터, 결정사항 추적
2. **효율적 워크플로우**: API 호출 최소화, 토큰 효율적, 자기 설명적 응답
3. **안전한 운영**: 쓰기 기본 비활성화, 멘션 보호, 채널 제한
4. **확장 가능**: Clean Architecture, 테스트 용이, 단계별 구현

**핵심 차별점**: 기존 Slack MCP에 없는 `list_threads`와 `search_threads` 도구를 통해 "논의사항", "협의사항", "결정사항"을 효과적으로 조회할 수 있음.
