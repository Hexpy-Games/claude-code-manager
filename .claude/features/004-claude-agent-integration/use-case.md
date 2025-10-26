# Feature: Claude Agent Integration

> **Feature ID**: 004
> **Status**: In Progress
> **Owner**: Development Team
> **Created**: 2025-10-23
> **Updated**: 2025-10-23

## Overview

Implement a Claude Agent Service that integrates the Anthropic Claude Agent SDK to enable AI-powered conversations within sessions. This service handles sending messages to Claude, receiving responses, managing tool calls, and persisting all conversation data to the database.

## User Story

**As a** backend service layer
**I want** to send messages to Claude and receive intelligent responses
**So that** users can have AI-powered conversations that are persisted across sessions

## Acceptance Criteria

- [ ] **AC1**: ClaudeAgentService can send user messages to Claude API
- [ ] **AC2**: ClaudeAgentService receives and processes assistant responses
- [ ] **AC3**: All user messages are saved to database with unique message IDs
- [ ] **AC4**: All assistant responses are saved to database
- [ ] **AC5**: Message IDs follow format: `msg_{nanoid}`
- [ ] **AC6**: Service supports streaming responses via async generators
- [ ] **AC7**: Service handles tool calls from Claude
- [ ] **AC8**: Tool call data is stored in messages.tool_calls JSON field
- [ ] **AC9**: Session's last_message_at timestamp is updated after each message
- [ ] **AC10**: Service initializes Claude Agent SDK with API key from environment
- [ ] **AC11**: Service validates session exists before sending messages
- [ ] **AC12**: Service handles API errors gracefully
- [ ] **AC13**: Service handles network errors with retry logic
- [ ] **AC14**: Service validates message content before sending
- [ ] **AC15**: TypeScript strict mode compliance with full type safety

## Success Metrics

### Quantitative Metrics
- **Message sending**: < 2 seconds for non-streaming
- **Streaming latency**: First token < 1 second
- **Database persistence**: < 50ms per message
- **Test coverage**: ≥ 80%
- **API success rate**: > 99% (excluding rate limits)

### Qualitative Metrics
- Clear error messages for all failure scenarios
- Seamless integration with existing DatabaseClient
- Easy to extend with custom tools
- Reliable streaming with proper error handling

## User Flows

### Primary Flow 1: Send Message and Get Response

1. **Service sends message**
   - Calls `claudeAgentService.sendMessage(sessionId, messageContent)`
   - Service validates session exists

2. **Service saves user message**
   - Generates unique message ID: `msg_{nanoid()}`
   - Saves user message to database with role='user'
   - Updates session.last_message_at timestamp

3. **Service calls Claude API**
   - Initializes Claude Agent SDK
   - Sends message to Claude with conversation history
   - Receives complete response

4. **Service processes response**
   - Extracts assistant message content
   - Checks for tool calls in response
   - Generates message ID for assistant response

5. **Service saves assistant message**
   - Saves assistant message to database with role='assistant'
   - Stores tool_calls if present
   - Updates session.last_message_at timestamp
   - Returns complete Message object

### Primary Flow 2: Stream Message Response

1. **Service starts streaming**
   - Calls `claudeAgentService.streamMessage(sessionId, messageContent)`
   - Validates session and saves user message

2. **Service streams tokens**
   - Uses async generator to yield response chunks
   - Yields each token as it arrives from Claude
   - Accumulates full response text

3. **Service completes stream**
   - When stream ends, saves complete assistant message
   - Returns final Message object
   - Updates session timestamp

### Primary Flow 3: Handle Tool Calls

1. **Claude requests tool use**
   - Assistant response includes tool_calls array
   - Each tool call has: id, name, arguments

2. **Service stores tool calls**
   - Saves tool_calls in message.tool_calls JSON field
   - Message content describes tool usage

3. **Service returns response**
   - Returns message with tool_calls for processing
   - Higher-level service can execute tools and continue conversation

## Alternative Flows

### Alt Flow 1: Session Not Found

1. Service receives sendMessage request
2. Service queries database for session
3. Session doesn't exist
4. Service throws `SessionNotFoundError`
5. Caller handles error gracefully

### Alt Flow 2: API Key Missing

1. Service initializes Claude Agent SDK
2. ANTHROPIC_API_KEY not in environment
3. Service throws `ConfigurationError`
4. Application logs error and fails gracefully

### Alt Flow 3: API Rate Limit

1. Service sends message to Claude
2. Claude API returns 429 rate limit error
3. Service catches error and wraps in `RateLimitError`
4. Service includes retry-after information
5. Caller can retry after delay

### Alt Flow 4: Network Timeout

1. Service sends message to Claude
2. Network request times out
3. Service catches timeout error
4. Service wraps in `NetworkError`
5. User message is already saved (can retry)

### Alt Flow 5: Empty Message Content

1. Service receives empty message string
2. Service validates message content
3. Service throws `InvalidMessageError`
4. No database writes occur

## Edge Cases

### Edge Case 1: Message Content Exceeds Token Limit

- **Situation**: User sends extremely long message
- **Expected behavior**: Claude API returns error, service wraps and throws
- **Rationale**: Let Claude handle token limits, don't duplicate logic

### Edge Case 2: Tool Call with Invalid JSON

- **Situation**: Claude returns malformed tool call arguments
- **Expected behavior**: Store as-is, let tool executor handle validation
- **Rationale**: Service is transport layer, not validation layer

### Edge Case 3: Stream Interrupted Mid-Response

- **Situation**: Network drops during streaming response
- **Expected behavior**: Generator throws error, partial response not saved
- **Rationale**: Only save complete responses for consistency

### Edge Case 4: Concurrent Messages to Same Session

- **Situation**: Multiple messages sent simultaneously to one session
- **Expected behavior**: All messages processed, last_message_at = latest
- **Rationale**: SQLite handles concurrent writes, each gets unique timestamp

### Edge Case 5: Very Long Conversation History

- **Situation**: Session has hundreds of messages
- **Expected behavior**: Service loads all messages, may hit context limit
- **Rationale**: Context management is future feature, load all for now

### Edge Case 6: Assistant Returns Empty Content

- **Situation**: Claude returns response with empty content (only tool calls)
- **Expected behavior**: Store message with empty content, include tool_calls
- **Rationale**: Valid response type for tool-only interactions

## Dependencies

### Required Features
- [Feature 001]: Database Setup - Provides DatabaseClient
- [Feature 003]: Session Manager - Provides session validation

### External Dependencies
- @anthropic-ai/claude-agent-sdk - Claude API integration
- nanoid - Unique message ID generation
- better-sqlite3 - Database persistence (via DatabaseClient)

## Technical Notes

### Architecture Considerations

- ClaudeAgentService is stateless, uses DatabaseClient for persistence
- Depends on DatabaseClient via dependency injection
- All methods are async due to API calls
- Streaming uses async generators for memory efficiency
- Service does not execute tools, only returns tool calls

### API Design

```typescript
interface ClaudeAgentServiceConfig {
  apiKey: string;
  model?: string; // defaults to 'claude-3-5-sonnet-20241022'
  maxTokens?: number; // defaults to 4096
}

interface SendMessageResult {
  userMessage: Message;
  assistantMessage: Message;
}

class ClaudeAgentService {
  constructor(
    private databaseClient: DatabaseClient,
    private config: ClaudeAgentServiceConfig
  );

  // Send message and get complete response
  async sendMessage(
    sessionId: string,
    content: string
  ): Promise<SendMessageResult>;

  // Stream message response
  async *streamMessage(
    sessionId: string,
    content: string
  ): AsyncGenerator<string, Message, void>;

  // Get conversation history for session
  private async getConversationHistory(
    sessionId: string
  ): Promise<Message[]>;

  // Generate unique message ID
  private generateMessageId(): string;
}
```

### Message ID Generation

```typescript
import { nanoid } from 'nanoid';

function generateMessageId(): string {
  return `msg_${nanoid(12)}`;
}

// Example IDs:
// msg_V1StGXR8_Z5j
// msg_3bqc9KpLmN2w
// msg_xYz123AbC789
```

### Claude Agent SDK Integration

```typescript
import { ClaudeAgent } from '@anthropic-ai/claude-agent-sdk';

// Initialize agent
const agent = new ClaudeAgent({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
});

// Send message (non-streaming)
const response = await agent.sendMessage({
  messages: conversationHistory,
  max_tokens: 4096,
});

// Send message (streaming)
const stream = agent.streamMessage({
  messages: conversationHistory,
  max_tokens: 4096,
});

for await (const chunk of stream) {
  console.log(chunk.delta.text);
}
```

### Error Handling Strategy

```typescript
// Custom errors
class SessionNotFoundError extends Error {
  name = 'SessionNotFoundError';
}

class InvalidMessageError extends Error {
  name = 'InvalidMessageError';
}

class ConfigurationError extends Error {
  name = 'ConfigurationError';
}

class RateLimitError extends Error {
  name = 'RateLimitError';
  constructor(message: string, public retryAfter?: number) {
    super(message);
  }
}

class NetworkError extends Error {
  name = 'NetworkError';
}

class ClaudeAPIError extends Error {
  name = 'ClaudeAPIError';
  constructor(message: string, public statusCode?: number) {
    super(message);
  }
}
```

### Database Integration

```typescript
// Save user message
const userMessage = await this.databaseClient.insertMessage({
  id: this.generateMessageId(),
  sessionId,
  role: 'user',
  content,
});

// Save assistant message
const assistantMessage = await this.databaseClient.insertMessage({
  id: this.generateMessageId(),
  sessionId,
  role: 'assistant',
  content: response.content,
  toolCalls: response.tool_calls || null,
});

// Note: insertMessage automatically updates session.last_message_at
```

### Streaming Implementation

```typescript
async *streamMessage(sessionId: string, content: string): AsyncGenerator<string, Message, void> {
  // Validate and save user message
  const session = await this.databaseClient.getSession(sessionId);
  if (!session) throw new SessionNotFoundError(`Session not found: ${sessionId}`);

  const userMessage = await this.databaseClient.insertMessage({
    id: this.generateMessageId(),
    sessionId,
    role: 'user',
    content,
  });

  // Stream response from Claude
  const stream = this.agent.streamMessage({
    messages: await this.getConversationHistory(sessionId),
    max_tokens: this.config.maxTokens,
  });

  let fullContent = '';
  let toolCalls: any[] | null = null;

  try {
    for await (const chunk of stream) {
      if (chunk.delta.text) {
        fullContent += chunk.delta.text;
        yield chunk.delta.text;
      }
      if (chunk.delta.tool_calls) {
        toolCalls = chunk.delta.tool_calls;
      }
    }
  } catch (error) {
    // Stream interrupted, don't save partial response
    throw new NetworkError('Stream interrupted');
  }

  // Save complete assistant message
  const assistantMessage = await this.databaseClient.insertMessage({
    id: this.generateMessageId(),
    sessionId,
    role: 'assistant',
    content: fullContent,
    toolCalls,
  });

  return assistantMessage;
}
```

### Conversation History Management

```typescript
private async getConversationHistory(sessionId: string): Promise<any[]> {
  const messages = await this.databaseClient.getMessages(sessionId);

  return messages.map(msg => ({
    role: msg.role,
    content: msg.content,
    tool_calls: msg.toolCalls,
  }));
}
```

## UI/UX Considerations

N/A - This is a backend service with no UI

## Non-Functional Requirements

### Performance
- Message sending: < 2 seconds (excluding Claude API time)
- Database persistence: < 50ms per message
- Streaming first token: < 1 second
- Message history loading: < 100ms

### Security
- API key stored in environment variable, never logged
- Validate all input parameters
- Sanitize error messages to avoid leaking API details
- Rate limit handling to avoid API abuse

### Reliability
- Graceful error handling for all API failures
- Network retry logic with exponential backoff
- Database operations are atomic
- Clear error messages for debugging
- Partial responses not saved (streaming)

## Open Questions

- [x] **Q1**: Should we implement automatic retry logic for network failures?
  - **Answer**: Yes, implement exponential backoff for transient errors

- [x] **Q2**: Should we limit conversation history length to manage context?
  - **Answer**: No, not in MVP. Load all messages, handle context in future feature

- [x] **Q3**: Should we support custom system prompts per session?
  - **Answer**: No, not in MVP. Add in future feature if needed

- [x] **Q4**: Should we validate tool call responses before sending back to Claude?
  - **Answer**: No, this service only transports tool calls, doesn't execute them

- [x] **Q5**: Should we support multiple Claude models?
  - **Answer**: Yes, make model configurable in ClaudeAgentServiceConfig

## Related Features

- [Feature 001]: Database Setup - Provides message persistence
- [Feature 003]: Session Manager - Provides session management
- [Feature 005]: REST API - Will expose message sending endpoints
- [Feature 006]: WebSocket Server - Will use streaming for real-time responses
- [Feature 007]: Tool System - Will execute tool calls returned by this service

## References

- [Anthropic Claude API Documentation](https://docs.anthropic.com/claude/reference)
- [Claude Agent SDK Documentation](https://github.com/anthropics/anthropic-sdk-typescript)
- [Streaming Responses Guide](https://docs.anthropic.com/claude/reference/streaming)
- [Tool Use (Function Calling)](https://docs.anthropic.com/claude/docs/tool-use)

---

**Document History**:
- 2025-10-23: Initial draft
