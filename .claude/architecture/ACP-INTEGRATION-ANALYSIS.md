# ACP Integration Analysis & Strategy

## 문서 개요

본 문서는 Claude Code Manager 프로젝트에서 현재 사용 중인 headless Claude CLI 방식에서 **Agent Client Protocol (ACP)** 기반 통합으로 전환하는 방안을 분석합니다.

**작성일**: 2025-10-26
**참고 자료**:
- [Agent Client Protocol 공식 문서](https://agentclientprotocol.com/overview/introduction)
- [Zed's claude-code-acp](https://github.com/zed-industries/claude-code-acp)
- [@zed-industries/agent-client-protocol SDK](https://www.npmjs.com/package/@zed-industries/agent-client-protocol)

---

## 1. 현재 아키텍처 분석

### 1.1 현재 구현 방식

**파일**: `apps/server/src/services/claude-code-client.ts`

```typescript
// 현재 방식: CLI를 subprocess로 spawn
const process = spawn('claude', args, {
  cwd: this.workingDirectory,
  stdio: ['pipe', 'pipe', 'pipe'],
});

// NDJSON 파싱으로 응답 처리
for await (const line of rl) {
  const msg = JSON.parse(line) as ClaudeCodeMessage;
  // ...
}
```

**특징**:
- Claude Code CLI를 `spawn()`으로 실행
- `--output-format stream-json`으로 NDJSON 출력
- `--resume <session-id>`로 세션 유지
- stdin/stdout/stderr로 통신

### 1.2 현재 방식의 한계

1. **불완전한 headless 지원**
   - Claude CLI의 headless 모드가 완전하지 않음 (사용자가 언급)
   - Tool call 정보가 출력에 포함되지 않음 (주석 참조: line 94, 252)
   - Stop reason 가시성 부족 (주석 참조: line 95)

2. **프로세스 관리 오버헤드**
   - 매 요청마다 새 프로세스 spawn
   - 타임아웃 관리 필요 (기본 5분)
   - 에러 핸들링 복잡 (ENOENT, exit code, stderr 파싱)

3. **기능 제약**
   - Tool call 정보 없음 (line 252: `toolCalls: null`)
   - 권한 관리 불가
   - MCP 서버 통합 불가
   - 파일 편집 리뷰 기능 없음

4. **디버깅 어려움**
   - CLI stderr 파싱으로 에러 감지
   - Rate limit, network error를 문자열 검색으로 판단 (line 185-196)

---

## 2. ACP (Agent Client Protocol) 개요

### 2.1 ACP란?

ACP는 **코드 에디터와 AI 코딩 에이전트 간의 표준 통신 프로토콜**입니다.

**핵심 특징**:
- **JSON-RPC over stdio**: 표준화된 메시징
- **MCP 통합**: Model Context Protocol과 호환
- **풍부한 기능**: Tool calls, diffs, 권한 관리, 파일 편집
- **에디터 독립적**: Zed, Neovim, Emacs, marimo 등 지원

### 2.2 ACP 아키텍처

```
┌─────────────────┐
│  ACP Client     │  (예: Zed, Claude Code Manager)
│  (우리 앱)      │
└────────┬────────┘
         │ JSON-RPC
         │ (stdio)
┌────────┴────────┐
│  ACP Agent      │  (예: claude-code-acp)
│  (프로토콜 어댑터)│
└────────┬────────┘
         │
┌────────┴────────┐
│ Claude Agent SDK│  (@anthropic-ai/claude-agent-sdk)
└────────┬────────┘
         │
┌────────┴────────┐
│  Anthropic API  │
└─────────────────┘
```

### 2.3 ACP vs 현재 방식 비교

| 항목 | 현재 (CLI spawn) | ACP 방식 |
|------|------------------|----------|
| **통신** | NDJSON (비표준) | JSON-RPC (표준) |
| **프로세스** | 매번 spawn | 장기 실행 |
| **Tool calls** | ❌ 없음 | ✅ 완전 지원 |
| **권한 관리** | ❌ 불가 | ✅ 4가지 모드 |
| **MCP 서버** | ❌ 불가 | ✅ 통합 |
| **파일 편집** | ❌ 제한적 | ✅ Diff 지원 |
| **에러 처리** | stderr 파싱 | 구조화된 응답 |
| **디버깅** | 어려움 | 용이함 |

---

## 3. Zed의 claude-code-acp 분석

### 3.1 패키지 구조

**npm 패키지**: `@zed-industries/claude-code-acp`

**주요 의존성**:
```json
{
  "@anthropic-ai/claude-agent-sdk": "0.1.26",
  "@anthropic-ai/claude-code": "2.0.26",
  "@agentclientprotocol/sdk": "0.5.1",  // 현재는 @zed-industries/agent-client-protocol
  "@modelcontextprotocol/sdk": "1.20.2",
  "express": "5.1.0"
}
```

### 3.2 핵심 구현

**파일 구조**:
```
claude-code-acp/
├── src/
│   ├── index.ts           # Entry point (환경 설정, stdout/stderr 라우팅)
│   ├── acp-agent.ts       # 핵심 ACP 에이전트 구현
│   └── ...
```

**acp-agent.ts 주요 기능**:

1. **세션 관리**:
   ```typescript
   interface SessionData {
     query: Query;  // Claude Agent SDK의 Query 객체
     inputStream: any;
     cancelled: boolean;
     permissionMode: PermissionMode;
   }
   ```

2. **권한 모드**:
   - `default`: 항상 물어봄
   - `acceptEdits`: 파일 편집 자동 승인
   - `plan`: 분석 전용
   - `bypassPermissions`: 모든 권한 자동 승인

3. **Tool 통합**:
   ```typescript
   // Tool call을 ACP notification으로 변환
   toAcpNotifications(contentBlocks: ContentBlock[]): ToolUse[]
   ```

4. **MCP 서버 지원**:
   - 클라이언트가 제공한 MCP 서버 자동 연결
   - 권한 관리용 별도 MCP 서버

5. **Claude SDK 통합**:
   ```typescript
   import { Query } from '@anthropic-ai/claude-agent-sdk';

   const query = new Query({
     model: 'claude-3-5-sonnet',
     permissionMode: session.permissionMode,
     // ...
   });
   ```

### 3.3 통신 흐름

```
Client → ACP Request (JSON-RPC)
         ↓
      acp-agent.ts (prompt 메서드)
         ↓
      promptToClaude() - 포맷 변환
         ↓
      Query.run() - Claude SDK
         ↓
      응답 스트리밍
         ↓
      ACP Response (JSON-RPC) → Client
```

---

## 4. 통합 전략

### 4.1 접근 방식 옵션

#### 옵션 A: claude-code-acp를 서브프로세스로 사용

**방법**:
```typescript
// ClaudeCodeClient를 ACP 클라이언트로 교체
import * as acp from "@zed-industries/agent-client-protocol";

const agentProcess = spawn('claude-code-acp', [], {
  env: { ANTHROPIC_API_KEY: apiKey }
});

const conn = new acp.ClientSideConnection(
  (_agent) => new ClaudeAcpClient(),
  Writable.toWeb(agentProcess.stdin),
  Readable.toWeb(agentProcess.stdout)
);
```

**장점**:
- ✅ 빠른 구현 (래퍼만 작성)
- ✅ Zed의 검증된 구현 활용
- ✅ 업데이트 자동 반영

**단점**:
- ❌ 여전히 프로세스 spawn
- ❌ 추가 의존성 (`claude-code-acp` 패키지)

#### 옵션 B: Claude Agent SDK 직접 사용

**방법**:
```typescript
import { Query } from '@anthropic-ai/claude-agent-sdk';

export class ClaudeAgentClient {
  async sendMessage(prompt: string, sessionId?: string) {
    const query = new Query({
      model: 'claude-3-5-sonnet',
      apiKey: this.apiKey,
      // ...
    });

    for await (const event of query.run(prompt)) {
      // 이벤트 처리
    }
  }
}
```

**장점**:
- ✅ 프로세스 spawn 불필요
- ✅ 직접 제어 가능
- ✅ 의존성 최소화
- ✅ 성능 최적화 가능

**단점**:
- ❌ 초기 구현 비용 높음
- ❌ ACP 프로토콜 구현 필요 (우리가 ACP 서버가 되려면)
- ❌ claude-code-acp의 기능 재구현 필요

#### 옵션 C: 하이브리드 접근

**방법**:
- 내부적으로 Claude Agent SDK 직접 사용
- ACP 프로토콜은 옵션으로 지원 (외부 클라이언트용)

**장점**:
- ✅ 유연성 최대화
- ✅ 외부 에디터 통합 가능 (Zed, Neovim 등이 우리 서버에 연결)

**단점**:
- ❌ 복잡도 증가
- ❌ 두 가지 방식 유지보수

### 4.2 권장 접근 방식

**1단계**: **옵션 A** (claude-code-acp 사용) - 단기 해결
- 현재 ClaudeCodeClient를 ACP 클라이언트로 교체
- 빠른 개선 효과
- Zed의 검증된 구현 활용

**2단계**: **옵션 B로 마이그레이션** - 장기 목표
- Claude Agent SDK 직접 통합
- 프로세스 오버헤드 제거
- 커스터마이징 자유도 확보

**이유**:
1. **점진적 개선**: 큰 리팩토링 없이 빠른 개선
2. **리스크 최소화**: 검증된 구현 먼저 사용
3. **학습 곡선**: ACP 사용하며 SDK 학습
4. **유연한 전환**: 필요시 옵션 B로 전환

---

## 5. 구현 계획

### 5.1 Phase 1: ACP 클라이언트 통합 (1-2주)

**목표**: claude-code-acp를 사용한 기본 통합

**작업**:
1. **의존성 추가**
   ```bash
   pnpm add @zed-industries/claude-code-acp
   pnpm add @zed-industries/agent-client-protocol
   ```

2. **새 클라이언트 구현**
   ```
   apps/server/src/services/
   ├── claude-acp-client.ts      # ACP 클라이언트 (새)
   ├── claude-code-client.ts     # 기존 CLI 클라이언트 (유지)
   └── claude-agent-service.ts   # 서비스 레이어 (수정)
   ```

3. **기능 구현**
   - ACP 세션 관리
   - 프롬프트 전송/스트리밍
   - Tool call 정보 저장
   - 에러 핸들링 개선

4. **테스트**
   - 단위 테스트 작성
   - 기존 기능 회귀 테스트
   - E2E 테스트 업데이트

5. **환경 변수 추가**
   ```env
   CLAUDE_INTEGRATION_MODE=acp  # 'cli' | 'acp'
   ```

### 5.2 Phase 2: 고급 기능 활용 (2-3주)

**목표**: ACP의 고급 기능 활용

**작업**:
1. **Tool Call 표시**
   - DB 스키마 확장 (tool_calls 컬럼 활용)
   - UI에 tool call 표시
   - Tool 실행 로그

2. **권한 관리**
   - 권한 모드 설정 UI
   - 파일 편집 자동 승인 옵션
   - 권한 요청 이력

3. **파일 편집 개선**
   - Diff 표시
   - 변경 사항 리뷰
   - 롤백 기능

4. **MCP 서버 통합**
   - MCP 서버 설정 관리
   - 커스텀 도구 추가
   - 외부 서비스 연결

### 5.3 Phase 3: SDK 직접 통합 (선택적, 4-6주)

**목표**: Claude Agent SDK 직접 사용으로 전환

**작업**:
1. **SDK 학습 & 프로토타입**
   - `@anthropic-ai/claude-agent-sdk` 문서 연구
   - 간단한 프로토타입 구현
   - 성능 벤치마크

2. **새 클라이언트 구현**
   ```
   apps/server/src/services/
   └── claude-sdk-client.ts      # SDK 직접 사용 (새)
   ```

3. **기능 패리티**
   - 모든 ACP 기능 재구현
   - 세션 관리 개선
   - Tool call 핸들링

4. **마이그레이션**
   - 점진적 전환 (feature flag)
   - 성능 모니터링
   - 기존 방식 제거

---

## 6. 기술적 세부사항

### 6.1 ACP 클라이언트 구현 예시

```typescript
// apps/server/src/services/claude-acp-client.ts

import * as acp from "@zed-industries/agent-client-protocol";
import { spawn } from "node:child_process";
import { Writable, Readable } from "node:stream";

export class ClaudeAcpClient {
  private connection: acp.ClientSideConnection | null = null;
  private agentProcess: ChildProcess | null = null;

  async initialize(apiKey: string) {
    // claude-code-acp 프로세스 시작
    this.agentProcess = spawn('claude-code-acp', [], {
      env: { ...process.env, ANTHROPIC_API_KEY: apiKey },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // ACP 연결 생성
    const input = Writable.toWeb(this.agentProcess.stdin!);
    const output = Readable.toWeb(this.agentProcess.stdout!);

    this.connection = new acp.ClientSideConnection(
      (_agent) => new AcpClientHandler(),
      input as WritableStream,
      output as ReadableStream
    );

    // 프로토콜 초기화
    await this.connection.initialize({
      protocolVersion: acp.PROTOCOL_VERSION,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: { run: true }
      }
    });
  }

  async sendMessage(prompt: string, sessionId?: string) {
    if (!this.connection) throw new Error('Not initialized');

    // 세션 생성 또는 재사용
    if (!sessionId) {
      const { sessionId: newSessionId } = await this.connection.newSession({
        cwd: process.cwd(),
        mcpServers: []
      });
      sessionId = newSessionId;
    }

    // 프롬프트 전송
    const result = await this.connection.prompt({
      sessionId,
      prompt: [{ type: "text", text: prompt }]
    });

    return {
      sessionId,
      content: this.extractContent(result),
      stopReason: result.stopReason,
      toolCalls: this.extractToolCalls(result)
    };
  }

  async *streamMessage(prompt: string, sessionId?: string) {
    // 스트리밍 구현
    // ACP는 notification을 통해 스트리밍 지원
  }

  private extractContent(result: acp.PromptResult): string {
    // result에서 텍스트 추출
    return result.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('');
  }

  private extractToolCalls(result: acp.PromptResult) {
    // result에서 tool call 정보 추출
    return result.content
      .filter(c => c.type === 'tool_use')
      .map(c => ({
        id: c.id,
        name: c.name,
        input: c.input
      }));
  }
}

// ACP 클라이언트 핸들러 (notification 처리)
class AcpClientHandler implements acp.Client {
  async requestPermission(request: acp.PermissionRequest) {
    // 권한 요청 처리
    return { allowed: true };
  }

  async showDiff(diff: acp.Diff) {
    // Diff 표시 (UI로 전달)
  }

  async updateTodo(todo: acp.TodoUpdate) {
    // TODO 업데이트
  }

  // ... 기타 핸들러
}
```

### 6.2 서비스 레이어 수정

```typescript
// apps/server/src/services/claude-agent-service.ts

export class ClaudeAgentService {
  private client: ClaudeCodeClient | ClaudeAcpClient;

  constructor(
    private readonly databaseClient: DatabaseClient,
    private readonly config: ClaudeAgentServiceConfig
  ) {
    // 환경 변수로 클라이언트 선택
    const mode = process.env.CLAUDE_INTEGRATION_MODE || 'cli';

    if (mode === 'acp') {
      this.client = new ClaudeAcpClient();
      await this.client.initialize(process.env.ANTHROPIC_API_KEY!);
    } else {
      this.client = new ClaudeCodeClient(config);
    }
  }

  async sendMessage(sessionId: string, content: string) {
    // ...
    const response = await this.client.sendMessage(content, claudeSessionId);

    // Tool calls 저장 (ACP만 지원)
    const assistantMessage = this.databaseClient.insertMessage({
      id: this.generateMessageId(),
      sessionId,
      role: 'assistant',
      content: response.content,
      toolCalls: response.toolCalls || null, // ← 이제 실제 데이터!
    });

    return { userMessage, assistantMessage };
  }
}
```

### 6.3 DB 스키마 활용

**기존 스키마** (이미 `tool_calls` 컬럼 있음!):
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls TEXT,  -- ← JSON array of tool calls
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

**Tool Calls 저장 형식**:
```json
[
  {
    "id": "toolu_01A09q90qw90lq917835lq9",
    "name": "write_file",
    "input": {
      "path": "/path/to/file.ts",
      "content": "..."
    }
  }
]
```

---

## 7. 마이그레이션 고려사항

### 7.1 호환성

**세션 마이그레이션**:
- 기존 CLI 세션 ID는 ACP와 비호환
- 새 메시지부터 ACP 세션 사용
- 기존 세션은 CLI로 계속 처리 (점진적 전환)

**API 호환성**:
- `ClaudeAgentService` 인터페이스 유지
- 클라이언트는 변경 불필요
- Feature flag로 전환

### 7.2 성능

**예상 개선**:
- CLI spawn 제거 → 초기 응답 속도 향상
- 장기 실행 프로세스 → 연결 재사용
- 구조화된 통신 → 파싱 오버헤드 감소

**벤치마크 필요**:
- 첫 메시지 응답 시간
- 스트리밍 레이턴시
- 메모리 사용량

### 7.3 보안

**고려사항**:
- API 키 관리: 환경 변수로 전달
- 권한 모드: 기본값 `default` (항상 물어봄)
- Root 권한: `bypassPermissions` 비활성화

---

## 8. 결론 및 권장사항

### 8.1 요약

| 항목 | 현재 (CLI) | 권장 (ACP) |
|------|-----------|-----------|
| **안정성** | ⚠️ 불완전한 headless | ✅ 프로덕션 검증 |
| **기능** | ⚠️ 제한적 | ✅ 풍부함 |
| **성능** | ⚠️ 프로세스 spawn | ✅ 장기 실행 |
| **디버깅** | ❌ 어려움 | ✅ 구조화된 응답 |
| **확장성** | ❌ 제약 많음 | ✅ MCP, 툴 통합 |

### 8.2 권장 로드맵

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1 (1-2주): claude-code-acp 통합                       │
│ - ACP 클라이언트 구현                                        │
│ - 기본 기능 패리티                                          │
│ - Feature flag 전환                                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 2 (2-3주): 고급 기능 활용                            │
│ - Tool call 표시                                            │
│ - 권한 관리                                                 │
│ - Diff/파일 편집 개선                                       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 3 (선택, 4-6주): SDK 직접 통합                       │
│ - Claude Agent SDK 직접 사용                                │
│ - 프로세스 오버헤드 제거                                    │
│ - 최적화 및 커스터마이징                                    │
└─────────────────────────────────────────────────────────────┘
```

### 8.3 즉시 실행 가능한 다음 단계

1. **Feature 문서 작성**
   ```bash
   /start-feature  # "ACP 통합" 기능 시작
   ```

2. **Use Case 정의**
   - `.claude/features/XXX-acp-integration/use-case.md`
   - 기대 동작, 성공 기준 정의

3. **Test Case 작성**
   - `.claude/features/XXX-acp-integration/test-case.md`
   - ACP 클라이언트 테스트 시나리오

4. **프로토타입 구현**
   - `claude-acp-client.ts` 기본 구현
   - 단일 메시지 전송 테스트

5. **점진적 롤아웃**
   - Feature flag 추가
   - 내부 테스트
   - 프로덕션 배포

---

## 9. 참고 자료

### 9.1 문서

- [ACP 공식 문서](https://agentclientprotocol.com/overview/introduction)
- [Claude Agent SDK 문서](https://docs.claude.com/en/docs/claude-code/sdk/sdk-overview)
- [ACP TypeScript SDK](https://www.npmjs.com/package/@zed-industries/agent-client-protocol)
- [MCP 프로토콜](https://modelcontextprotocol.io/)

### 9.2 코드 예제

- [claude-code-acp 소스](https://github.com/zed-industries/claude-code-acp)
- [ACP 예제](https://github.com/zed-industries/agent-client-protocol/tree/main/typescript/examples)
- [Gemini CLI Agent](https://github.com/google/gemini-cli-agent) (참고 구현)

### 9.3 내부 문서

- `CLAUDE.md` - 프로젝트 컨텍스트
- `.claude/development/GUIDELINES.md` - 개발 가이드라인
- `.claude/architecture/PROJECT-BLUEPRINT.md` - 프로젝트 청사진

---

**문서 종료**
