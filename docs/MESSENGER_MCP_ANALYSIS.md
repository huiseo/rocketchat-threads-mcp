# 메시지 기반 협업 플랫폼 MCP 설계를 위한 심층 비교 분석

> Playwright MCP 모범 사례를 기준으로 5개 Slack MCP 구현체를 **AI Agent의 실제 사용 시나리오** 관점에서 분석

---

## 목차

1. [분석 배경 및 목적](#1-분석-배경-및-목적)
2. [메시지 협업 플랫폼의 핵심 사용 시나리오](#2-메시지-협업-플랫폼의-핵심-사용-시나리오)
3. [Playwright MCP에서 배울 점](#3-playwright-mcp에서-배울-점)
4. [5개 Slack MCP 개요](#4-5개-slack-mcp-개요)
5. [시나리오별 상세 비교](#5-시나리오별-상세-비교)
6. [도구 스키마 설계 비교](#6-도구-스키마-설계-비교)
7. [응답 설계 비교](#7-응답-설계-비교)
8. [에러 처리 비교](#8-에러-처리-비교)
9. [안전성 및 운영 비교](#9-안전성-및-운영-비교)
10. [종합 평가](#10-종합-평가)
11. [Rocket.Chat MCP 설계 권장사항](#11-rocketchat-mcp-설계-권장사항)

---

## 1. 분석 배경 및 목적

### 1.1 메시지 기반 협업 플랫폼이란?

메시지 기반 협업 플랫폼(Slack, Rocket.Chat, MS Teams 등)은 다음 특징을 가진다:

```
┌─────────────────────────────────────────────────────────────────┐
│                   메시지 협업 플랫폼 구조                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  채널/방(Channel/Room)                                          │
│  ├── 공개 채널: 모든 구성원 접근 가능                             │
│  ├── 비공개 채널: 초대된 구성원만                                 │
│  └── DM(Direct Message): 1:1 또는 그룹 메시지                    │
│                                                                  │
│  메시지(Message)                                                 │
│  ├── 일반 메시지: 채널에 게시                                    │
│  ├── 쓰레드 답장: 특정 메시지에 대한 대화                         │
│  ├── 리액션: 이모지로 반응                                       │
│  └── 멘션: @사용자, @channel, @here                             │
│                                                                  │
│  사용자(User)                                                    │
│  ├── 프로필: 이름, 이메일, 상태                                  │
│  └── 역할: 관리자, 일반 사용자                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 왜 AI Agent 관점이 중요한가?

MCP는 단순한 API 래퍼가 아니다. **AI Agent가 사람처럼 협업 플랫폼을 활용**할 수 있어야 한다.

| 사람의 사용 패턴 | AI Agent에게 필요한 것 |
|-----------------|---------------------|
| "어제 개발팀에서 뭐 얘기했지?" | 시간 범위 + 채널 필터링 기능 |
| "김철수가 보낸 링크 찾아줘" | 사용자 + 콘텐츠 검색 |
| "이 쓰레드 맥락이 뭐야?" | 쓰레드 전체 조회 + 참여자 정보 |
| "이 메시지 공유할 URL 줘" | 메시지 → 퍼머링크 변환 |
| "급한 건 DM 보내고, 일반 건 채널에" | 맥락 기반 채널 선택 |

---

## 2. 메시지 협업 플랫폼의 핵심 사용 시나리오

### 2.1 읽기 시나리오 (Read)

#### 시나리오 R1: 최근 대화 맥락 파악

```
사용자: "개발팀 채널에서 오늘 논의된 내용 요약해줘"

AI Agent 작업 흐름:
1. 채널 ID 확인 (이름 → ID 변환 필요)
2. 오늘 날짜 범위의 메시지 조회
3. 쓰레드가 있으면 쓰레드 내용도 조회
4. 요약 제공
```

**필요한 도구 기능:**
- 채널 이름 → ID 검색/변환
- 시간 범위 지정 메시지 조회
- 쓰레드 조회

#### 시나리오 R2: 특정 정보 검색

```
사용자: "지난주 김철수가 공유한 API 문서 링크 찾아줘"

AI Agent 작업 흐름:
1. 사용자 검색 (김철수 → user_id)
2. 시간 범위 + 사용자 + 키워드 조합 검색
3. 결과에서 링크 추출
```

**필요한 도구 기능:**
- 사용자 이름/이메일 → ID 변환
- 복합 조건 메시지 검색
- 결과에 퍼머링크 포함

#### 시나리오 R3: 쓰레드 맥락 이해

```
사용자: "이 링크의 대화 내용 알려줘: https://message.thinkpool.com/channel/..."

AI Agent 작업 흐름:
1. URL 파싱 → 채널 ID, 메시지 ID 추출
2. 해당 메시지 조회
3. 쓰레드가 있으면 전체 쓰레드 조회
4. 맥락 설명
```

**필요한 도구 기능:**
- URL 파싱
- 단일 메시지 조회
- 쓰레드 전체 조회

### 2.2 쓰기 시나리오 (Write)

#### 시나리오 W1: 채널에 메시지 전송

```
사용자: "개발팀 채널에 '오늘 배포 완료' 메시지 보내줘"

AI Agent 작업 흐름:
1. 채널 확인 (이름 → ID)
2. 메시지 전송
3. 성공 확인 및 퍼머링크 반환
```

**필요한 도구 기능:**
- 채널 이름 → ID 변환
- 메시지 전송
- 결과에 메시지 ID, 퍼머링크 포함

#### 시나리오 W2: 쓰레드 답장

```
사용자: "방금 그 메시지에 답장해줘"

AI Agent 작업 흐름:
1. 이전 맥락에서 메시지 ID 확인
2. 쓰레드 답장 전송
3. 성공 확인
```

**필요한 도구 기능:**
- 쓰레드 답장 (thread_ts/tmid 필요)
- 이전 도구 결과에서 ID 활용 가능해야 함

#### 시나리오 W3: 특정 사용자에게 DM

```
사용자: "김철수에게 회의 참석 요청 DM 보내줘"

AI Agent 작업 흐름:
1. 사용자 검색 (김철수 → user_id)
2. DM 채널 열기/조회
3. 메시지 전송
```

**필요한 도구 기능:**
- 사용자 검색
- DM 채널 자동 열기
- 또는 user_id로 직접 DM 전송

### 2.3 복합 시나리오

#### 시나리오 C1: 정보 수집 후 공유

```
사용자: "오늘 논의된 주요 결정사항을 정리해서 공지 채널에 올려줘"

AI Agent 작업 흐름:
1. 여러 채널의 오늘 메시지 조회
2. 주요 결정사항 추출/요약
3. 공지 채널에 포맷팅된 메시지 게시
```

---

## 3. Playwright MCP에서 배울 점

Playwright MCP는 웹 브라우저 자동화용이지만, **AI Agent의 도구 사용 관점**에서 메신저 MCP에 적용할 핵심 원칙이 있다.

### 3.1 적용 가능한 원칙

| Playwright 원칙 | 메신저 MCP 적용 |
|----------------|----------------|
| **ref 시스템** (요소 식별자) | 채널/메시지/사용자 ID의 명확한 제공 |
| **스냅샷** (현재 상태) | 응답에 현재 채널/쓰레드 상태 포함 |
| **자기 설명적 응답** | "메시지 전송됨" + 다음 가능한 액션 안내 |
| **What-Why-How 에러** | 실패 원인 + 해결 방법 제시 |
| **토큰 효율성** | 응답 크기 제한, 페이지네이션 |

### 3.2 적용하지 않아도 되는 부분

| Playwright 기능 | 메신저에서는 |
|----------------|-------------|
| 비전 모드 (스크린샷) | 불필요 - 텍스트 기반 |
| 브라우저 탭 관리 | 불필요 - 상태 덜 복잡 |
| 파일 다운로드/업로드 | 선택적 - 파일 공유 기능 |
| 네트워크 모니터링 | 불필요 |

### 3.3 핵심 원칙: 결정론적 참조

```
┌─────────────────────────────────────────────────────────────────┐
│ Playwright: 요소 참조                                            │
│                                                                  │
│   CSS 셀렉터 추측: "button.submit" → 실패할 수 있음               │
│   ref 사용: ref="e5" → 100% 정확                                 │
├─────────────────────────────────────────────────────────────────┤
│ 메신저 MCP: 채널/사용자 참조                                      │
│                                                                  │
│   이름 추측: "개발팀" → 여러 개 있을 수 있음                       │
│   ID 사용: channel_id="C01234" → 100% 정확                       │
│                                                                  │
│   BUT: 사용자는 이름으로 말함 → 이름→ID 변환 도구 필요             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. 5개 Slack MCP 개요

| MCP | 언어 | 도구 수 | 핵심 특징 |
|-----|------|--------|----------|
| **korotovsky-slack** | Go | 5개 | 시간 표현식(1d, 7w), CSV 출력, 쓰기 보호 |
| **zencoderai-slack** | TypeScript | 8개 | 공식 유지관리, 단순 구조 |
| **mcp-official** | TypeScript | 6개 | Anthropic 아카이브(참고용) |
| **dennison-slack** | TypeScript | 14개 | 토큰 제한, LRU 캐시, Enhanced 도구 |
| **lbeatu-slack** | TypeScript | 7개 | Clean Architecture, URL 파싱, Result 패턴 |

---

## 5. 시나리오별 상세 비교

### 5.1 시나리오 R1: 최근 대화 맥락 파악

> "개발팀 채널에서 오늘 논의된 내용 요약해줘"

#### 채널 이름 → ID 변환

| MCP | 지원 | 방법 |
|-----|------|------|
| **korotovsky** | O | `#개발팀` 또는 `@사용자`를 ID로 자동 변환 |
| **zencoderai** | X | channel_id만 받음, 별도 list 후 매칭 필요 |
| **dennison** | O | searchChannels - fuzzy 검색으로 이름 → ID 변환 |
| **lbeatu** | O | getChannelByReference - URL, 이름, ID 모두 처리 |
| **mcp-official** | X | channel_id만 받음 |

**korotovsky 실제 코드:**
```go
// 채널명을 ID로 자동 변환
if strings.HasPrefix(channel, "#") || strings.HasPrefix(channel, "@") {
    channelsMaps := ch.apiProvider.ProvideChannelsMaps()
    chn, ok := channelsMaps.ChannelsInv[channel]  // #general → C01234
    if !ok {
        return nil, fmt.Errorf("channel %q not found", channel)
    }
    channel = channelsMaps.Channels[chn].ID
}
```

**dennison 실제 코드:**
```typescript
async searchChannels(query: string): Promise<{ channels: ChannelSearchResult[]; truncated: boolean }> {
    // fuzzy 매칭: 이름, 토픽, 목적에서 검색
    const queryLower = query.toLowerCase();
    const matches = result.channels.filter(channel => {
        const name = channel.name?.toLowerCase() || '';
        const topic = channel.topic?.value?.toLowerCase() || '';
        const purpose = channel.purpose?.value?.toLowerCase() || '';
        return name.includes(queryLower) || topic.includes(queryLower) || purpose.includes(queryLower);
    });
    // 토큰 제한 적용
    const { items, truncated } = TokenCounter.truncateToFit(matches);
    return { channels: items, truncated };
}
```

#### 시간 범위 지정

| MCP | 지원 | 표현 방식 |
|-----|------|----------|
| **korotovsky** | O | `1d`(1일), `7d`(7일), `1w`(1주), `1m`(1달) |
| **zencoderai** | X | 최근 N개 메시지만 (limit) |
| **dennison** | X | 최근 N개 메시지만 (limit) |
| **lbeatu** | X | 최근 N개 메시지만 (limit) |
| **mcp-official** | X | 최근 N개 메시지만 (limit) |

**korotovsky 시간 표현식 파싱:**
```go
// "1d" → 오늘 자정부터 지금까지
// "7d" → 7일 전 자정부터 지금까지
func limitByExpression(limit string) (slackLimit int, oldest, latest string, err error) {
    suffix := limit[len(limit)-1]  // 'd', 'w', 'm'
    n, _ := strconv.Atoi(limit[:len(limit)-1])

    now := time.Now()
    startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)

    switch suffix {
    case 'd':
        oldestTime = startOfToday.AddDate(0, 0, -n+1)
    case 'w':
        oldestTime = startOfToday.AddDate(0, 0, -n*7+1)
    case 'm':
        oldestTime = startOfToday.AddDate(0, -n, 0)
    }

    return 100, fmt.Sprintf("%d.000000", oldestTime.Unix()), fmt.Sprintf("%d.000000", now.Unix()), nil
}
```

**시나리오 R1 평가:** korotovsky가 시간 범위 지정에서 가장 유용함. AI가 "오늘", "지난주"를 자연스럽게 표현 가능.

### 5.2 시나리오 R2: 특정 정보 검색

> "지난주 김철수가 공유한 API 문서 링크 찾아줘"

#### 사용자 이름 → ID 변환

| MCP | 지원 | 방법 |
|-----|------|------|
| **korotovsky** | O | `@사용자명`을 ID로 자동 변환 |
| **zencoderai** | X | get_users 후 수동 매칭 |
| **dennison** | O | lookupUser - 이름, 이메일, 표시명으로 검색 |
| **lbeatu** | X | 사용자 검색 도구 없음 |
| **mcp-official** | X | user_id만 받음 |

**dennison lookupUser 실제 코드:**
```typescript
async lookupUser(query: string): Promise<UserSearchResult | null> {
    const queryLower = query.toLowerCase();

    // 1. 정확히 일치하는 사용자 먼저
    let user = result.members.find(u =>
        u.name?.toLowerCase() === queryLower ||
        u.profile?.email?.toLowerCase() === queryLower ||
        u.id === query
    );

    // 2. 없으면 fuzzy 매칭
    if (!user) {
        user = result.members.find(u => {
            const username = u.name?.toLowerCase() || '';
            const realName = u.real_name?.toLowerCase() || '';
            const displayName = u.profile?.display_name?.toLowerCase() || '';
            return username.includes(queryLower) || realName.includes(queryLower) || displayName.includes(queryLower);
        });
    }

    // 3. DM 채널도 함께 반환 (bonus!)
    let dmChannelId = await this.getDMChannel(user.id);

    return {
        id: user.id,
        username: user.name,
        dm_channel_id: dmChannelId  // DM 보내기에 바로 활용 가능
    };
}
```

#### 메시지 검색

| MCP | 지원 | 필터 옵션 |
|-----|------|----------|
| **korotovsky** | O | 채널, 사용자, 날짜, 쓰레드 필터 |
| **zencoderai** | X | 검색 기능 없음 |
| **dennison** | O | 채널, 사용자 필터 |
| **lbeatu** | X | 검색 기능 없음 |
| **mcp-official** | X | 검색 기능 없음 |

**korotovsky 검색 필터 옵션:**
```go
// 지원하는 필터들
filter_threads_only    // 쓰레드만
filter_in_channel      // 특정 채널
filter_in_im_or_mpim   // DM/그룹DM
filter_users_with      // 특정 사용자와의 대화
filter_users_from      // 특정 사용자가 보낸
filter_date_before     // 이전 날짜
filter_date_after      // 이후 날짜
filter_date_on         // 특정 날짜
filter_date_during     // 기간
```

**시나리오 R2 평가:** korotovsky가 검색에서 가장 강력함. dennison도 기본 검색 지원.

### 5.3 시나리오 R3: URL 파싱

> "이 링크의 대화 내용 알려줘: https://workspace.slack.com/archives/C123/p1234567890123456"

| MCP | URL 파싱 | 자동 조회 |
|-----|---------|----------|
| **korotovsky** | X | X |
| **zencoderai** | X | X |
| **dennison** | O | O (getChannelByReference) |
| **lbeatu** | O | O (채널+메시지+쓰레드 자동 조회) |
| **mcp-official** | X | X |

**dennison URL 파싱:**
```typescript
parseChannelUrl(url: string): { channel_id?: string; message_ts?: string } {
    // https://WORKSPACE.slack.com/archives/CHANNEL_ID/pMESSAGE_TS
    const match = url.match(/\/archives\/([A-Z0-9]+)(?:\/p(\d+))?/);
    if (match) {
        const channelId = match[1];
        // p1234567890123456 → 1234567890.123456 (timestamp 변환)
        const messageTs = match[2] ? `${match[2].slice(0, 10)}.${match[2].slice(10)}` : undefined;
        return { channel_id: channelId, message_ts: messageTs };
    }
    return {};
}
```

**시나리오 R3 평가:** URL 파싱은 실제 협업에서 매우 자주 사용됨. dennison과 lbeatu가 지원.

### 5.4 시나리오 W3: DM 전송

> "김철수에게 회의 참석 요청 DM 보내줘"

| MCP | 사용자 검색 | DM 채널 열기 | 통합 도구 |
|-----|-----------|------------|----------|
| **korotovsky** | O | X (별도) | X |
| **zencoderai** | X | X | X |
| **dennison** | O | O (자동) | O (messageUser) |
| **lbeatu** | X | X | X |
| **mcp-official** | X | X | X |

**dennison messageUser (통합 도구):**
```typescript
async messageUser(userQuery: string, text: string): Promise<{
    ok: boolean;
    channel?: string;
    ts?: string;
    error?: string;
}> {
    // 1. 사용자 검색
    const user = await this.lookupUser(userQuery);
    if (!user) {
        return { ok: false, error: `User not found: ${userQuery}` };
    }

    // 2. DM 채널 열기 (없으면 생성)
    let dmChannelId = user.dm_channel_id;
    if (!dmChannelId) {
        const dmResult = await this.client.conversations.open({ users: user.id });
        dmChannelId = dmResult.channel.id;
    }

    // 3. 메시지 전송
    const result = await this.postMessage(dmChannelId, text);
    return { ok: result.ok, channel: dmChannelId, ts: result.ts };
}
```

**시나리오 W3 평가:** dennison의 messageUser는 "이름으로 DM 보내기"를 한 번에 처리. 다른 MCP는 3단계 필요.

---

## 6. 도구 스키마 설계 비교

### 6.1 파라미터 설명 품질

#### channel_id 파라미터 비교

```typescript
// korotovsky (Go) - 설명 없음
"channel_id": { type: "string" }

// zencoderai - 기본 설명
channel_id: z.string().describe("The ID of the channel")

// dennison (Enhanced) - 상세 설명
channel_id: {
    type: "string",
    description:
        "Channel ID (not name). " +
        "Format: C[A-Z0-9]+ for public channels, " +
        "G[A-Z0-9]+ for private channels, " +
        "D[A-Z0-9]+ for DMs. " +
        "Get from slack_list_channels.",
    pattern: "^[CGDW][A-Z0-9]+$"
}
```

**AI Agent 관점 차이:**

| 설명 수준 | AI가 이해하는 것 | 문제 |
|----------|-----------------|------|
| 없음 | "문자열을 넣으면 되겠지" | 채널명을 넣어서 실패 |
| 기본 | "채널 ID를 넣어야 함" | 어떻게 얻는지 모름 |
| 상세 | "C로 시작하는 ID, list에서 얻음" | 정확히 사용 가능 |

#### thread_ts 파라미터 비교

```typescript
// mcp-official - 설명 없음
thread_ts: { type: "string" }

// zencoderai - 변환 방법까지 설명
thread_ts: z.string().describe(
    "The timestamp of the parent message in the format '1234567890.123456'. " +
    "Timestamps in the format without the period can be converted by adding " +
    "the period such that 6 numbers come after it."
)

// dennison - 정규식까지
thread_ts: {
    type: "string",
    description:
        "Parent message timestamp. Format: '1234567890.123456'. " +
        "This is the 'ts' field from any message.",
    pattern: "^\\d{10}\\.\\d{6}$"
}
```

### 6.2 도구 설명 품질

#### get_channel_history 도구 비교

```typescript
// 나쁜 예 (mcp-official)
description: "Get recent messages from a channel"

// 좋은 예 (dennison)
description:
    "Retrieve recent messages from a channel. " +
    "Use to understand recent conversation context. " +
    "Returns messages in reverse chronological order (newest first). " +
    "For thread replies, use slack_get_thread_replies instead."
```

**좋은 도구 설명의 요소:**
1. 무엇을 하는가
2. 언제 사용하는가 (use case)
3. 결과 형태 (순서, 형식)
4. 다른 도구와의 관계

---

## 7. 응답 설계 비교

### 7.1 메시지 전송 후 응답

#### 시나리오: 채널에 메시지 전송 성공

**korotovsky (CSV 형식):**
```csv
msgID,userID,userName,realName,channelID,text,time
1704931200.123456,U123,bot,Bot,C456,Hello,2024-01-11T12:00:00Z
```

**zencoderai (Raw JSON):**
```json
{
  "ok": true,
  "channel": "C01234ABCDE",
  "ts": "1704931200.123456",
  "message": {
    "type": "message",
    "text": "Hello",
    "user": "U123",
    "ts": "1704931200.123456"
  }
}
```

**lbeatu (구조화된 마크다운):**
```markdown
Message posted successfully!

Channel: <#C01234ABCDE>
Timestamp: 1704931200.123456
Content: Hello

Tip: To reply to this message, use thread_ts="1704931200.123456"
```

**이상적인 응답 (Playwright 스타일 적용):**
```markdown
## Result
Message sent to #general

## Message Details
- ID: 1704931200.123456
- Channel: #general (C01234ABCDE)
- Time: 2024-01-11 12:00:00

## Next Actions
- Reply to this message: `slack_reply_to_thread(thread_ts="1704931200.123456")`
- Add reaction: `slack_add_reaction(timestamp="1704931200.123456")`
- View in Slack: https://workspace.slack.com/archives/C01234ABCDE/p1704931200123456
```

### 7.2 자기 설명적 응답 평가

| MCP | 결과 명확성 | 현재 상태 | 다음 액션 가이드 | 점수 |
|-----|-----------|----------|----------------|------|
| korotovsky | O (CSV) | X | X | 1/3 |
| zencoderai | O (JSON) | 일부 | X | 1.5/3 |
| dennison | O (JSON) | O | X | 2/3 |
| lbeatu | O (마크다운) | O | O (일부) | 2.5/3 |
| mcp-official | O (JSON) | 일부 | X | 1.5/3 |

---

## 8. 에러 처리 비교

### 8.1 에러 시나리오: 채널을 찾을 수 없음

**korotovsky:**
```go
return nil, fmt.Errorf("channel %q not found in synced cache. Try to remove old cache file and restart MCP Server", channel)
```
- What: 채널을 찾을 수 없음
- Why: 캐시에 없음 (일부)
- How: 캐시 삭제 후 재시작

**zencoderai:**
```typescript
return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
```
- What: 에러 메시지
- Why: 없음
- How: 없음

**dennison:**
```typescript
throw new Error(`Invalid channel ID format: ${args.channel_id}`);
```
- What: 형식 오류
- Why: 없음
- How: 없음

**이상적인 에러 (What-Why-How):**
```markdown
## Error
Cannot find channel "개발팀"

## Reason
- No channel found with name "개발팀"
- Searched in: public channels, private channels (where bot is member)
- Similar channels found: "개발팀-프론트" (C123), "개발팀-백엔드" (C456)

## Solution
1. Use `slack_list_channels` to see available channels
2. Check if the channel is private and bot is not a member
3. Try one of the similar channels above
```

### 8.2 에러 처리 종합 평가

| MCP | What | Why | How | 유사 항목 제안 | 점수 |
|-----|------|-----|-----|--------------|------|
| korotovsky | O | 일부 | O | X | 2.5/4 |
| zencoderai | O | X | X | X | 1/4 |
| dennison | O | X | X | X | 1/4 |
| lbeatu | O | X | X | X | 1/4 |
| mcp-official | O | X | X | X | 1/4 |

---

## 9. 안전성 및 운영 비교

### 9.1 쓰기 작업 보호

| MCP | 기본 쓰기 | 채널 제한 | 위험 멘션 차단 |
|-----|----------|----------|--------------|
| **korotovsky** | 비활성화 | O (화이트/블랙리스트) | X |
| zencoderai | 활성화 | X | X |
| **dennison** | 활성화 | X | O (@channel, @here) |
| lbeatu | 활성화 | X | X |
| mcp-official | 활성화 | X | X |

**korotovsky 쓰기 보호 설정:**
```bash
# 기본: 쓰기 비활성화 (가장 안전)
SLACK_MCP_ADD_MESSAGE_TOOL=""

# 전체 활성화
SLACK_MCP_ADD_MESSAGE_TOOL=true

# 특정 채널만 허용
SLACK_MCP_ADD_MESSAGE_TOOL=C123,C456

# 특정 채널만 제외
SLACK_MCP_ADD_MESSAGE_TOOL=!C789
```

**dennison 위험 멘션 차단:**
```typescript
class MessageSanitizer {
    private static readonly DANGEROUS_MENTIONS = ['@channel', '@here', '@everyone'];

    static sanitize(text: string): string {
        let sanitized = text;
        for (const mention of this.DANGEROUS_MENTIONS) {
            // @channel → [@channel] (무력화)
            sanitized = sanitized.replace(new RegExp(mention, 'gi'), `[${mention}]`);
        }
        return sanitized;
    }
}
```

### 9.2 토큰 오버플로 방지

| MCP | 응답 크기 제한 | 자동 truncate | 페이지네이션 |
|-----|-------------|--------------|-------------|
| korotovsky | X | X | O (cursor) |
| zencoderai | X | X | O (cursor) |
| **dennison** | O (25,000자) | O | O (cursor) |
| lbeatu | X | X | O (cursor) |
| mcp-official | X | X | O (cursor) |

**dennison TokenCounter:**
```typescript
class TokenCounter {
    private static readonly MAX_TOKENS = 25000;
    private static readonly CHARS_PER_TOKEN = 4;  // 근사치

    static truncateToFit<T>(items: T[]): { items: T[], truncated: boolean } {
        let totalTokens = 0;
        const safeItems: T[] = [];
        const maxTokens = this.MAX_TOKENS - 1000;  // 안전 버퍼

        for (const item of items) {
            const itemTokens = Math.ceil(JSON.stringify(item).length / 4);
            if (totalTokens + itemTokens > maxTokens) {
                return { items: safeItems, truncated: true };
            }
            safeItems.push(item);
            totalTokens += itemTokens;
        }
        return { items: safeItems, truncated: false };
    }
}
```

**AI Agent 관점에서의 의미:**
- 응답이 너무 크면 LLM 컨텍스트 소진 또는 오류
- 자동 truncate로 안정적 동작 보장
- `truncated: true`로 더 있음을 알림 → 페이지네이션 유도

### 9.3 캐싱

| MCP | 캐싱 | 방식 | TTL |
|-----|------|------|-----|
| korotovsky | O | 파일 + 메모리 | 설정 가능 |
| zencoderai | X | - | - |
| dennison | O | LRU | 5분 |
| lbeatu | O | TTL | 30분 |
| mcp-official | X | - | - |

---

## 10. 종합 평가

### 10.1 시나리오별 지원 평가

| 시나리오 | korotovsky | zencoderai | dennison | lbeatu | mcp-official |
|---------|------------|------------|----------|--------|--------------|
| R1: 채널 맥락 파악 | 5 | 2 | 4 | 3 | 2 |
| R2: 정보 검색 | 5 | 1 | 4 | 1 | 1 |
| R3: URL 파싱 | 1 | 1 | 5 | 5 | 1 |
| W1: 메시지 전송 | 3 | 3 | 4 | 3 | 3 |
| W2: 쓰레드 답장 | 3 | 4 | 4 | 4 | 3 |
| W3: DM 전송 | 2 | 1 | 5 | 2 | 1 |
| **총점 (30점)** | **19** | **12** | **26** | **18** | **11** |

### 10.2 품질 요소별 평가

| 요소 | korotovsky | zencoderai | dennison | lbeatu | mcp-official |
|------|------------|------------|----------|--------|--------------|
| 스키마 설명 품질 | 2 | 3 | 5 | 4 | 2 |
| 응답 자기설명성 | 2 | 2 | 3 | 4 | 2 |
| 에러 처리 | 3 | 1 | 2 | 2 | 1 |
| 안전성 | 5 | 1 | 4 | 2 | 1 |
| 토큰 효율성 | 2 | 2 | 5 | 3 | 2 |
| 아키텍처 | 4 | 3 | 4 | 5 | 2 |
| **총점 (30점)** | **18** | **12** | **23** | **20** | **10** |

### 10.3 최종 종합 평가

| 순위 | MCP | 시나리오 | 품질 | 총점 | 핵심 강점 |
|------|-----|---------|------|------|----------|
| 1 | **dennison-slack** | 26 | 23 | **49** | 통합 도구(DM, 검색, URL), 토큰 제어, 스키마 품질 |
| 2 | **korotovsky-slack** | 19 | 18 | **37** | 시간 표현식(1d, 7w), 검색 필터, 쓰기 보호 |
| 3 | **lbeatu-slack** | 18 | 20 | **38** | Clean Architecture, URL 파싱, 응답 설계 |
| 4 | zencoderai-slack | 12 | 12 | **24** | 공식 유지관리, 단순함 |
| 5 | mcp-official | 11 | 10 | **21** | 참고용 |

### 10.4 각 MCP에서 채택할 패턴

| 패턴 | 출처 | 설명 |
|------|------|------|
| 시간 표현식 | korotovsky | `1d`, `7d`, `1w`, `1m` 형식으로 시간 범위 지정 |
| 채널/사용자 검색 | dennison | fuzzy 매칭으로 이름 → ID 변환 |
| URL 파싱 | dennison/lbeatu | 메시지 URL에서 채널/메시지 ID 추출 |
| DM 통합 도구 | dennison | messageUser(이름, 텍스트)로 한 번에 DM 전송 |
| 토큰 제한 | dennison | TokenCounter로 응답 크기 자동 제어 |
| 쓰기 보호 | korotovsky | 기본 비활성화, 화이트리스트 |
| 위험 멘션 차단 | dennison | @all, @here, @channel 무력화 |
| Result 패턴 | lbeatu | { success, data?, error? } 통일된 응답 |
| 자기설명적 응답 | lbeatu + Playwright | 결과 + 상태 + 다음 액션 가이드 |
| Clean Architecture | lbeatu | 레이어 분리, DI, 테스트 용이성 |

---

## 11. Rocket.Chat MCP 설계 권장사항

### 11.1 시나리오 우선순위

```
필수 지원 시나리오:
├── R1: 채널 메시지 히스토리 조회 (시간 범위)
├── R3: URL → 채널/메시지 파싱
├── W1: 채널에 메시지 전송
└── W2: 쓰레드 답장

권장 지원 시나리오:
├── R2: 메시지 검색 (사용자, 키워드)
├── W3: 사용자에게 DM
└── C1: 복합 작업 (조회 + 전송)
```

### 11.2 권장 도구 목록

```typescript
// 읽기 도구 (기본 활성화)
rocketchat_list_channels      // 채널 목록
rocketchat_search_channels    // 채널 검색 (이름→ID) [dennison 패턴]
rocketchat_get_messages       // 메시지 히스토리 (시간 범위 지원) [korotovsky 패턴]
rocketchat_get_thread         // 쓰레드 조회
rocketchat_search_messages    // 메시지 검색 [korotovsky 패턴]
rocketchat_get_users          // 사용자 목록
rocketchat_lookup_user        // 사용자 검색 (이름→ID) [dennison 패턴]
rocketchat_parse_url          // URL 파싱 [dennison/lbeatu 패턴]

// 쓰기 도구 (opt-in)
rocketchat_send_message       // 메시지 전송
rocketchat_reply_thread       // 쓰레드 답장
rocketchat_add_reaction       // 리액션 추가
rocketchat_message_user       // DM 전송 (이름으로) [dennison 패턴]
```

### 11.3 응답 포맷 예시

```typescript
// 메시지 전송 성공 응답 [Playwright + lbeatu 스타일]
function formatSendMessageResponse(result: SendResult): string {
    return `
## Result
Message sent to #${result.room.name}

## Message
- ID: ${result.message._id}
- Room: ${result.room.name} (${result.room._id})
- Time: ${formatTime(result.message.ts)}
- Text: ${truncate(result.message.msg, 100)}

## Next Actions
- Reply to this thread: \`rocketchat_reply_thread(thread_id="${result.message._id}")\`
- Add reaction: \`rocketchat_add_reaction(message_id="${result.message._id}", emoji="thumbsup")\`
- View thread: \`rocketchat_get_thread(thread_id="${result.message._id}")\`

## Link
${result.message.permalink}
    `.trim();
}
```

### 11.4 핵심 코드 패턴

```typescript
// 1. 시간 표현식 파싱 [korotovsky 스타일]
function parseTimeExpression(expr: string): { oldest: Date; latest: Date } {
    const match = expr.match(/^(\d+)([dwm])$/);
    if (!match) throw new Error(`Invalid time expression: ${expr}`);

    const [, num, unit] = match;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (unit) {
        case 'd': return { oldest: addDays(startOfToday, -parseInt(num) + 1), latest: now };
        case 'w': return { oldest: addDays(startOfToday, -parseInt(num) * 7 + 1), latest: now };
        case 'm': return { oldest: addMonths(startOfToday, -parseInt(num)), latest: now };
    }
}

// 2. 이름→ID 통합 검색 [dennison 스타일]
async function lookupChannel(query: string): Promise<Room | null> {
    // URL이면 파싱
    if (query.startsWith('http')) {
        return this.parseUrl(query).then(r => this.getRoom(r.roomId));
    }
    // ID 형식이면 직접 조회
    if (/^[a-zA-Z0-9]{17}$/.test(query)) {
        return this.getRoom(query);
    }
    // 이름이면 검색
    const results = await this.searchRooms(query);
    return results[0] || null;
}

// 3. 토큰 제한 [dennison 스타일]
class ResponseBuilder {
    private static readonly MAX_CHARS = 100000;  // ~25,000 토큰

    static truncate<T>(items: T[]): { items: T[]; truncated: boolean } {
        let totalSize = 0;
        const safe: T[] = [];

        for (const item of items) {
            const size = JSON.stringify(item).length;
            if (totalSize + size > this.MAX_CHARS) {
                return { items: safe, truncated: true };
            }
            safe.push(item);
            totalSize += size;
        }
        return { items: safe, truncated: false };
    }
}

// 4. 쓰기 보호 [korotovsky 스타일]
class WriteGuard {
    private readonly enabled: boolean;
    private readonly allowedRooms: Set<string>;
    private readonly blockedRooms: Set<string>;

    constructor() {
        const config = process.env.ROCKETCHAT_WRITE_ROOMS || '';
        if (!config) {
            this.enabled = false;
        } else if (config === 'true' || config === '1') {
            this.enabled = true;
            this.allowedRooms = new Set();  // 모든 방 허용
        } else {
            this.enabled = true;
            // !ROOM_ID → 블랙리스트, ROOM_ID → 화이트리스트
            // ...
        }
    }

    canWrite(roomId: string): boolean {
        if (!this.enabled) return false;
        if (this.blockedRooms.has(roomId)) return false;
        if (this.allowedRooms.size === 0) return true;
        return this.allowedRooms.has(roomId);
    }
}
```

---

## 결론

### 메시지 협업 플랫폼 MCP의 핵심 원칙

1. **이름→ID 변환 필수**: 사용자는 이름으로 말하지만, API는 ID가 필요함
2. **시간 범위 지원**: "오늘", "지난주"를 표현할 수 있어야 함
3. **URL 파싱**: 협업에서 링크 공유가 매우 빈번함
4. **통합 도구**: DM은 사용자 검색 + 채널 열기 + 전송을 한 번에
5. **자기 설명적 응답**: 결과 + 다음 가능한 액션
6. **안전 기본**: 쓰기는 opt-in, 위험 멘션은 차단
7. **토큰 효율**: 응답 크기 제한으로 안정적 동작

### 벤치마크

| 영역 | 최고 구현체 | 채택 이유 |
|------|-----------|----------|
| 시간 쿼리 | korotovsky | `1d`, `7d` 자연스러운 표현식 |
| 통합 도구 | dennison | messageUser, searchChannels 한 번에 처리 |
| URL 파싱 | dennison/lbeatu | 링크 기반 워크플로 지원 |
| 스키마 품질 | dennison | 상세한 describe(), pattern, 예시 |
| 응답 설계 | lbeatu | 구조화된 마크다운, 다음 액션 안내 |
| 안전성 | korotovsky | 기본 쓰기 비활성화, 화이트리스트 |
| 토큰 제어 | dennison | TokenCounter로 자동 truncate |
| 아키텍처 | lbeatu | Clean Architecture, 테스트 용이 |
