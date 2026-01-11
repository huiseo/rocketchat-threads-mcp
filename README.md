# Rocket.Chat Threads MCP

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io/)

[English](#english) | [한국어](#한국어) | [日本語](#日本語) | [中文](#中文)

---

## English

MCP (Model Context Protocol) server for Rocket.Chat with **full thread support** - search, list, and retrieve thread discussions.

### Why This MCP?

Unlike basic chat integrations, this MCP focuses on **thread-based conversations**:

| Feature | Basic MCP | Threads MCP |
|---------|-----------|---------------|
| Thread Support | No | Full (list/get/search) |
| Search Thread Replies | No | Yes |
| Time Filtering | No | 1d, 7d, 1w, 1m |
| Auth Method | Password | Token (secure) |
| Write Protection | Always on | Off by default |
| @all Prevention | No | Auto-blocked |
| Rate Limiting | No | Yes |
| Unit Tests | No | 231 tests |

### Features

- **Thread-Centric**: Threads as the unit of discussions and decisions
- **Deep Search**: Search within thread replies, not just parent messages
- **Time Filtering**: Filter by `1d`, `7d`, `1w`, `1m` or date ranges
- **Safe Writes**: Disabled by default, @mentions auto-neutralized
- **Type-Safe**: Full TypeScript with Zod validation

### Installation

```bash
git clone https://github.com/huiseo/rocketchat-threads-mcp.git
cd rocketchat-threads-mcp
npm install
npm run build
```

### Configuration

```env
ROCKETCHAT_URL=https://your-rocketchat-server.com
ROCKETCHAT_AUTH_TOKEN=your-auth-token
ROCKETCHAT_USER_ID=your-user-id

# Optional: Enable writes (disabled by default)
ROCKETCHAT_WRITE_ENABLED=true
ROCKETCHAT_WRITE_ROOMS=general,dev-team
```

### Claude Desktop Setup

Add to `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "rocketchat": {
      "command": "node",
      "args": ["/path/to/rocketchat-threads-mcp/dist/index.js"],
      "env": {
        "ROCKETCHAT_URL": "https://your-server.com",
        "ROCKETCHAT_AUTH_TOKEN": "your-token",
        "ROCKETCHAT_USER_ID": "your-user-id"
      }
    }
  }
}
```

### Available Tools

| Tool | Description |
|------|-------------|
| `rocketchat_list_channels` | List accessible channels |
| `rocketchat_search_channels` | Search channels by name |
| `rocketchat_get_channel_info` | Get channel details |
| `rocketchat_get_messages` | Get messages with time filtering |
| `rocketchat_search_messages` | Search message content |
| `rocketchat_get_message` | Get specific message |
| `rocketchat_list_threads` | List threads in channel |
| `rocketchat_get_thread` | Get thread with all replies |
| `rocketchat_search_threads` | Search within thread replies |
| `rocketchat_lookup_user` | Find user info |
| `rocketchat_list_users` | List users |
| `rocketchat_get_me` | Get current user |
| `rocketchat_send_message` | Send message (opt-in) |
| `rocketchat_react` | Add reaction (opt-in) |
| `rocketchat_get_write_status` | Check write permissions |

### Optional: OpenSearch Integration

This MCP works with or without OpenSearch on your Rocket.Chat server:

| Feature | Without OpenSearch | With OpenSearch |
|---------|-------------------|-----------------|
| Channel-specific search | ✅ Works | ✅ Works |
| Global search (no roomId) | ❌ Requires roomId | ✅ Works |
| Search highlighting | ❌ | ✅ `<mark>` tags |
| Multi-language search | Limited | ✅ Full support |

**How to check:** Try `rocketchat_search_messages` without roomId. If it works, OpenSearch is enabled.

**For server administrators:** To enable OpenSearch with Docker, see [rocketchat-enhanced](https://github.com/huiseo/rocketchat-enhanced) - a single Docker package with RocketChat + OpenSearch + real-time indexing.

---

## 한국어

Rocket.Chat용 MCP (Model Context Protocol) 서버 - AI 에이전트가 스레드, 토론, 결정 사항에서 **조직 지식을 검색**할 수 있게 합니다.

### 왜 이 MCP인가?

기본 채팅 연동과 달리, 이 MCP는 **지식 검색**에 초점을 맞춥니다:

| 기능 | 기본 MCP | Knowledge MCP |
|------|----------|---------------|
| 스레드 지원 | 없음 | 완전 지원 |
| 스레드 답글 검색 | 없음 | 지원 |
| 시간 필터링 | 없음 | 1d, 7d, 1w, 1m |
| 인증 방식 | 비밀번호 | 토큰 (보안) |
| 쓰기 보호 | 항상 켜짐 | 기본 꺼짐 |
| @all 차단 | 없음 | 자동 차단 |
| 속도 제한 | 없음 | 지원 |
| 유닛 테스트 | 없음 | 231개 |

### 주요 기능

- **스레드 중심**: 토론과 결정의 단위로서의 스레드
- **심층 검색**: 부모 메시지뿐 아니라 스레드 답글 내 검색
- **시간 필터링**: `1d`, `7d`, `1w`, `1m` 또는 날짜 범위로 필터
- **안전한 쓰기**: 기본 비활성화, @멘션 자동 중화
- **타입 안전**: Zod 검증을 포함한 완전한 TypeScript

### 설치

```bash
git clone https://github.com/huiseo/rocketchat-threads-mcp.git
cd rocketchat-threads-mcp
npm install
npm run build
```

### 설정

```env
ROCKETCHAT_URL=https://your-rocketchat-server.com
ROCKETCHAT_AUTH_TOKEN=your-auth-token
ROCKETCHAT_USER_ID=your-user-id

# 선택: 쓰기 활성화 (기본 비활성화)
ROCKETCHAT_WRITE_ENABLED=true
ROCKETCHAT_WRITE_ROOMS=general,dev-team
```

### 선택사항: OpenSearch 연동

이 MCP는 Rocket.Chat 서버에 OpenSearch가 있든 없든 작동합니다:

| 기능 | OpenSearch 없이 | OpenSearch 있음 |
|------|-----------------|-----------------|
| 채널별 검색 | ✅ 작동 | ✅ 작동 |
| 전역 검색 (roomId 없이) | ❌ roomId 필요 | ✅ 작동 |
| 검색 하이라이팅 | ❌ | ✅ `<mark>` 태그 |
| 다국어 검색 | 제한적 | ✅ 완전 지원 |

**확인 방법:** roomId 없이 `rocketchat_search_messages`를 실행해보세요. 작동하면 OpenSearch가 활성화된 것입니다.

**서버 관리자용:** Docker로 OpenSearch를 활성화하려면 [rocketchat-enhanced](https://github.com/huiseo/rocketchat-enhanced)를 참조하세요 - RocketChat + OpenSearch + 실시간 인덱싱이 포함된 단일 Docker 패키지입니다.

---

## 日本語

Rocket.Chat用MCP（Model Context Protocol）サーバー - AIエージェントがスレッド、議論、決定事項から**組織知識を検索**できるようにします。

### なぜこのMCPか？

基本的なチャット連携とは異なり、このMCPは**知識検索**に焦点を当てています：

| 機能 | 基本MCP | Knowledge MCP |
|------|---------|---------------|
| スレッドサポート | なし | 完全対応 |
| スレッド返信検索 | なし | 対応 |
| 時間フィルタリング | なし | 1d, 7d, 1w, 1m |
| 認証方式 | パスワード | トークン（安全） |
| 書き込み保護 | 常にオン | デフォルトオフ |
| @all ブロック | なし | 自動ブロック |
| レート制限 | なし | 対応 |
| ユニットテスト | なし | 231件 |

### 主な機能

- **スレッド中心**: 議論と決定の単位としてのスレッド
- **深層検索**: 親メッセージだけでなくスレッド返信内を検索
- **時間フィルタリング**: `1d`、`7d`、`1w`、`1m`または日付範囲でフィルタ
- **安全な書き込み**: デフォルト無効、@メンション自動無効化
- **型安全**: Zodバリデーションを含む完全なTypeScript

### インストール

```bash
git clone https://github.com/huiseo/rocketchat-threads-mcp.git
cd rocketchat-threads-mcp
npm install
npm run build
```

### オプション: OpenSearch連携

このMCPはRocket.ChatサーバーのOpenSearchの有無にかかわらず動作します：

| 機能 | OpenSearchなし | OpenSearchあり |
|------|----------------|----------------|
| チャンネル別検索 | ✅ 動作 | ✅ 動作 |
| グローバル検索（roomIdなし） | ❌ roomId必須 | ✅ 動作 |
| 検索ハイライト | ❌ | ✅ `<mark>`タグ |
| 多言語検索 | 制限あり | ✅ 完全対応 |

**確認方法:** roomIdなしで`rocketchat_search_messages`を実行してみてください。動作すればOpenSearchが有効です。

**サーバー管理者向け:** DockerでOpenSearchを有効にするには、[rocketchat-enhanced](https://github.com/huiseo/rocketchat-enhanced)を参照してください - RocketChat + OpenSearch + リアルタイムインデックスを含む単一Dockerパッケージです。

---

## 中文

Rocket.Chat的MCP（Model Context Protocol）服务器 - 使AI代理能够从线程、讨论和决策中**检索组织知识**。

### 为什么选择这个MCP？

与基本聊天集成不同，这个MCP专注于**知识检索**：

| 功能 | 基本MCP | Knowledge MCP |
|------|---------|---------------|
| 线程支持 | 无 | 完全支持 |
| 搜索线程回复 | 无 | 支持 |
| 时间过滤 | 无 | 1d, 7d, 1w, 1m |
| 认证方式 | 密码 | 令牌（安全） |
| 写入保护 | 始终开启 | 默认关闭 |
| @all 阻止 | 无 | 自动阻止 |
| 速率限制 | 无 | 支持 |
| 单元测试 | 无 | 231个 |

### 主要功能

- **线程中心**: 将线程作为讨论和决策的单位
- **深度搜索**: 不仅搜索父消息，还搜索线程回复
- **时间过滤**: 按`1d`、`7d`、`1w`、`1m`或日期范围过滤
- **安全写入**: 默认禁用，@提及自动中和
- **类型安全**: 包含Zod验证的完整TypeScript

### 安装

```bash
git clone https://github.com/huiseo/rocketchat-threads-mcp.git
cd rocketchat-threads-mcp
npm install
npm run build
```

### 可选：OpenSearch集成

此MCP无论Rocket.Chat服务器是否有OpenSearch都可以工作：

| 功能 | 无OpenSearch | 有OpenSearch |
|------|--------------|--------------|
| 频道内搜索 | ✅ 可用 | ✅ 可用 |
| 全局搜索（无roomId） | ❌ 需要roomId | ✅ 可用 |
| 搜索高亮 | ❌ | ✅ `<mark>`标签 |
| 多语言搜索 | 有限 | ✅ 完全支持 |

**检查方法：** 不带roomId运行`rocketchat_search_messages`。如果可以运行，说明OpenSearch已启用。

**服务器管理员：** 要使用Docker启用OpenSearch，请参阅[rocketchat-enhanced](https://github.com/huiseo/rocketchat-enhanced) - 包含RocketChat + OpenSearch + 实时索引的单一Docker包。

---

## Architecture

```
src/
├── index.ts              # Entry point
├── server.ts             # MCP server setup
├── tools/                # Tool definitions
│   ├── base.ts           # Type-safe tool registry
│   ├── channel-tools.ts
│   ├── message-tools.ts
│   ├── thread-tools.ts
│   ├── user-tools.ts
│   └── write-tools.ts
├── api/                  # Rocket.Chat API
│   ├── client.ts
│   ├── types.ts
│   └── schemas.ts        # Zod validation
├── guards/               # Safety guards
│   ├── write-guard.ts
│   ├── sanitizer.ts
│   ├── input-validator.ts
│   └── rate-limiter.ts
└── utils/
    ├── cache.ts
    ├── time-parser.ts
    └── token-counter.ts
```

## Development

```bash
npm install      # Install dependencies
npm run dev      # Development mode
npm run build    # Build
npm test         # Run 231 tests
npm run lint     # Lint
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [MCP (Model Context Protocol)](https://modelcontextprotocol.io/)
- [Rocket.Chat API](https://developer.rocket.chat/reference/api)
