# Feature 006: WebSocket Streaming - Test Cases

**Feature ID**: 006
**Feature Name**: WebSocket Streaming
**Date**: 2025-10-23

## Test Overview

This document outlines comprehensive test cases for the WebSocket streaming feature, covering connection lifecycle, message handling, streaming, error scenarios, and resource management.

---

## Connection Tests

### TC-006-001: Establish WebSocket Connection
**Priority**: High
**Type**: Integration

**Setup**:
- Create a test session in database
- Start Fastify server with WebSocket support

**Steps**:
1. Connect to `ws://localhost:PORT/api/sessions/{sessionId}/stream`
2. Wait for connection acknowledgment

**Expected Result**:
- Connection established (readyState = OPEN)
- Receive message: `{ type: 'connected', sessionId: string }`
- sessionId matches the connection URL

**Cleanup**: Close connection

---

### TC-006-002: Reject Connection for Invalid Session
**Priority**: High
**Type**: Integration

**Setup**:
- Start Fastify server with WebSocket support
- Use non-existent session ID

**Steps**:
1. Attempt to connect to `ws://localhost:PORT/api/sessions/invalid_id/stream`
2. Wait for connection close

**Expected Result**:
- Connection closes with code 4404
- Close reason: "Session not found"
- No server-side resources leaked

**Cleanup**: None needed

---

### TC-006-003: Handle Multiple Concurrent Connections
**Priority**: Medium
**Type**: Integration

**Setup**:
- Create two test sessions
- Start Fastify server

**Steps**:
1. Open WebSocket to session 1
2. Open WebSocket to session 2
3. Verify both connections acknowledged
4. Send message to session 1
5. Send message to session 2

**Expected Result**:
- Both connections established successfully
- Each connection receives only its own messages
- No cross-contamination between sessions

**Cleanup**: Close both connections

---

### TC-006-004: Reconnect After Disconnect
**Priority**: Medium
**Type**: Integration

**Setup**:
- Create test session
- Establish initial connection

**Steps**:
1. Connect to session stream
2. Close connection
3. Wait 1 second
4. Reconnect to same session stream

**Expected Result**:
- First connection succeeds
- Connection closes cleanly
- Second connection succeeds
- Both connections receive acknowledgment

**Cleanup**: Close final connection

---

## Message Handling Tests

### TC-006-005: Send Valid Message
**Priority**: High
**Type**: Integration

**Steps**:
1. Connect to session stream
2. Send: `{ type: 'message', content: 'Hello' }`
3. Wait for response

**Expected Result**:
- Message accepted
- Receive content_chunk messages
- Receive done message with stopReason
- No error messages

**Cleanup**: Close connection

---

### TC-006-006: Reject Message with Missing Content
**Priority**: High
**Type**: Integration

**Steps**:
1. Connect to session stream
2. Send: `{ type: 'message' }` (no content)

**Expected Result**:
- Receive error message: `{ type: 'error', error: 'InvalidMessage', message: 'Message content is required' }`
- Connection remains open
- Can send valid message afterward

**Cleanup**: Close connection

---

### TC-006-007: Reject Message with Invalid Type
**Priority**: Medium
**Type**: Integration

**Steps**:
1. Connect to session stream
2. Send: `{ type: 'invalid', content: 'Hello' }`

**Expected Result**:
- Receive error message indicating invalid message type
- Connection remains open

**Cleanup**: Close connection

---

### TC-006-008: Reject Malformed JSON
**Priority**: Medium
**Type**: Integration

**Steps**:
1. Connect to session stream
2. Send raw string: `{invalid json}`

**Expected Result**:
- Receive error message about JSON parsing
- Connection remains open

**Cleanup**: Close connection

---

### TC-006-009: Handle Empty Message Content
**Priority**: Medium
**Type**: Integration

**Steps**:
1. Connect to session stream
2. Send: `{ type: 'message', content: '' }`

**Expected Result**:
- Receive error message: content cannot be empty
- Connection remains open

**Cleanup**: Close connection

---

### TC-006-010: Handle Very Long Message
**Priority**: Low
**Type**: Integration

**Steps**:
1. Connect to session stream
2. Send message with 10,000 character content

**Expected Result**:
- Message accepted and processed
- Streaming response received
- No truncation or corruption

**Cleanup**: Close connection

---

## Streaming Tests

### TC-006-011: Stream Simple Response
**Priority**: High
**Type**: Integration

**Setup**:
- Mock ClaudeAgentService to return simple streaming response

**Steps**:
1. Connect to session stream
2. Send message
3. Collect all streamed chunks

**Expected Result**:
- Receive multiple content_chunk messages
- Each chunk has `type: 'content_chunk'`, `content: string`, `index: number`
- Indexes are sequential starting from 0
- Receive final `{ type: 'done' }` message
- Complete content matches expected response

**Cleanup**: Close connection

---

### TC-006-012: Stream Response with Tool Calls
**Priority**: High
**Type**: Integration

**Setup**:
- Mock ClaudeAgentService to return response with tool use

**Steps**:
1. Connect to session stream
2. Send message requiring tool use
3. Collect all events

**Expected Result**:
- Receive tool_use message: `{ type: 'tool_use', tool: string, toolUseId: string, input: any }`
- Receive tool_result message: `{ type: 'tool_result', toolUseId: string, content: any }`
- Receive content_chunk messages
- Receive done message
- All events in correct order

**Cleanup**: Close connection

---

### TC-006-013: Stream Multiple Content Chunks
**Priority**: High
**Type**: Integration

**Setup**:
- Mock ClaudeAgentService to stream 50+ chunks

**Steps**:
1. Connect to session stream
2. Send message
3. Count received chunks

**Expected Result**:
- All chunks received
- No chunks lost or duplicated
- Indexes sequential
- Correct order maintained

**Cleanup**: Close connection

---

### TC-006-014: Stream with Usage Information
**Priority**: Medium
**Type**: Integration

**Steps**:
1. Connect to session stream
2. Send message
3. Wait for completion

**Expected Result**:
- Done message includes usage: `{ inputTokens: number, outputTokens: number }`
- Token counts are positive numbers

**Cleanup**: Close connection

---

### TC-006-015: Handle Streaming Interruption
**Priority**: Medium
**Type**: Integration

**Setup**:
- Mock ClaudeAgentService to throw error mid-stream

**Steps**:
1. Connect to session stream
2. Send message
3. Simulate error after 5 chunks

**Expected Result**:
- Receive first 5 chunks successfully
- Receive error message: `{ type: 'error', error: string, message: string }`
- Connection remains open for new messages

**Cleanup**: Close connection

---

## Error Handling Tests

### TC-006-016: Handle Claude API Error
**Priority**: High
**Type**: Integration

**Setup**:
- Mock ClaudeAgentService.streamMessage() to throw error

**Steps**:
1. Connect to session stream
2. Send message
3. Trigger API error

**Expected Result**:
- Receive error message with appropriate error type
- Error message includes helpful description
- Connection remains open

**Cleanup**: Close connection

---

### TC-006-017: Handle Database Error
**Priority**: Medium
**Type**: Integration

**Setup**:
- Mock database to fail when saving message

**Steps**:
1. Connect to session stream
2. Send message
3. Allow streaming to complete
4. Trigger database error on save

**Expected Result**:
- Streaming completes successfully
- Error logged but not sent to client (message already delivered)
- Or: error sent after done message

**Cleanup**: Close connection

---

### TC-006-018: Handle Session Deleted During Streaming
**Priority**: Low
**Type**: Integration

**Steps**:
1. Connect to session stream
2. Send message
3. Delete session from database while streaming

**Expected Result**:
- Current streaming completes
- Subsequent messages fail with session not found

**Cleanup**: Close connection

---

### TC-006-019: Handle Rate Limit Error
**Priority**: Medium
**Type**: Integration

**Setup**:
- Mock Claude API to return rate limit error

**Steps**:
1. Connect to session stream
2. Send message
3. Trigger rate limit

**Expected Result**:
- Receive error message: `{ type: 'error', error: 'RateLimitError', message: string }`
- Error includes retry-after information if available

**Cleanup**: Close connection

---

## Resource Management Tests

### TC-006-020: Clean Up on Client Disconnect
**Priority**: High
**Type**: Integration

**Steps**:
1. Connect to session stream
2. Send message
3. Close connection immediately (before response completes)
4. Verify server resources cleaned up

**Expected Result**:
- No memory leaks
- Event listeners removed
- Database connections returned to pool
- No zombie processes

**Cleanup**: Verify cleanup complete

---

### TC-006-021: Clean Up on Server Close
**Priority**: Medium
**Type**: Integration

**Steps**:
1. Connect to session stream
2. Server initiates connection close
3. Wait for close event

**Expected Result**:
- Client receives close frame
- Close code and reason provided
- Resources cleaned up on both sides

**Cleanup**: None needed

---

### TC-006-022: Handle Connection Timeout
**Priority**: Medium
**Type**: Integration

**Setup**:
- Configure short idle timeout

**Steps**:
1. Connect to session stream
2. Wait without sending messages
3. Exceed timeout period

**Expected Result**:
- Connection closed by server
- Close reason indicates timeout
- Resources cleaned up

**Cleanup**: None needed

---

### TC-006-023: Prevent Memory Leaks with Many Connections
**Priority**: High
**Type**: Load Test

**Steps**:
1. Create 100 test sessions
2. Open connection to each
3. Send message to each
4. Close all connections
5. Measure memory usage

**Expected Result**:
- All connections handled successfully
- Memory returns to baseline after cleanup
- No retained references to closed connections

**Cleanup**: Close all connections

---

## Integration Tests

### TC-006-024: End-to-End Message Flow
**Priority**: High
**Type**: End-to-End

**Steps**:
1. Create new session via REST API
2. Connect to session stream
3. Send message via WebSocket
4. Receive complete streaming response
5. Fetch session history via REST API
6. Verify message saved

**Expected Result**:
- Session created successfully
- WebSocket connection established
- Message streamed in real-time
- Message persisted in database
- History includes user message and assistant response

**Cleanup**: Close connection, delete session

---

### TC-006-025: Multiple Messages in Same Session
**Priority**: High
**Type**: Integration

**Steps**:
1. Connect to session stream
2. Send message 1
3. Wait for complete response
4. Send message 2
5. Wait for complete response
6. Send message 3
7. Fetch session history

**Expected Result**:
- All three messages processed successfully
- Responses streamed independently
- History contains all six messages (3 user, 3 assistant)
- Messages in correct chronological order

**Cleanup**: Close connection

---

### TC-006-026: Ping-Pong Keep-Alive
**Priority**: Low
**Type**: Integration

**Steps**:
1. Connect to session stream
2. Send: `{ type: 'ping' }`
3. Wait for response

**Expected Result**:
- Receive: `{ type: 'pong' }`
- Connection remains alive
- Can send messages normally after ping/pong

**Cleanup**: Close connection

---

### TC-006-027: Concurrent Messages to Same Session
**Priority**: Medium
**Type**: Integration

**Steps**:
1. Connect to session stream
2. Send message 1
3. Immediately send message 2 (before message 1 completes)

**Expected Result**:
- Messages queued and processed sequentially
- OR: Second message rejected with "busy" error
- No response mixing or corruption
- Both messages eventually processed

**Cleanup**: Close connection

---

### TC-006-028: Large Response Streaming
**Priority**: Medium
**Type**: Performance

**Setup**:
- Mock Claude API to return very long response (10,000+ tokens)

**Steps**:
1. Connect to session stream
2. Send message requesting long response
3. Measure time to first chunk
4. Measure total streaming time
5. Verify all content received

**Expected Result**:
- First chunk arrives quickly (<1s)
- Streaming is smooth and continuous
- No buffering delays
- Complete response received
- Streaming faster than if waiting for complete response

**Cleanup**: Close connection

---

## Edge Cases

### TC-006-029: Close Connection During Tool Execution
**Priority**: Medium
**Type**: Integration

**Setup**:
- Mock long-running tool execution

**Steps**:
1. Connect to session stream
2. Send message that triggers tool use
3. Close connection while tool is executing

**Expected Result**:
- Tool execution cancelled or allowed to complete
- Resources cleaned up
- No orphaned processes

**Cleanup**: Verify cleanup complete

---

### TC-006-030: Unicode and Special Characters
**Priority**: Low
**Type**: Integration

**Steps**:
1. Connect to session stream
2. Send message with Unicode: `{ type: 'message', content: '你好 👋 émojis' }`
3. Receive response

**Expected Result**:
- Message processed correctly
- Unicode preserved in database
- Response may contain Unicode
- No encoding issues

**Cleanup**: Close connection

---

## Test Coverage Goals

- **Unit Test Coverage**: 80%+ of stream.ts code
- **Integration Test Coverage**: All major flows tested
- **Error Scenarios**: All error types tested
- **Resource Management**: No memory leaks detected
- **Performance**: Streaming latency <100ms for first chunk

---

## Test Environment Setup

### Prerequisites
- PostgreSQL database with test schema
- Anthropic API key (or mock for tests)
- Node.js environment with WebSocket support

### Test Utilities
```typescript
// Helper to create WebSocket client
async function createWSClient(sessionId: string): Promise<WebSocket>

// Helper to wait for specific message type
async function waitForMessage(ws: WebSocket, type: string): Promise<any>

// Helper to collect all streaming chunks
async function collectStream(ws: WebSocket): Promise<any[]>

// Helper to cleanup test resources
async function cleanupTest(ws: WebSocket, sessionId: string): Promise<void>
```

---

## Test Execution Strategy

### Unit Tests
- Run with `npm test -- stream.test.ts`
- Mock all external dependencies
- Fast execution (<100ms per test)

### Integration Tests
- Run with real database (test schema)
- Mock Claude API for predictable responses
- Moderate execution time (<1s per test)

### Load Tests
- Run separately with `npm run test:load`
- Measure performance and resource usage
- Longer execution time (minutes)

---

## Success Criteria

- All 30+ test cases pass
- 80%+ code coverage on stream.ts
- No memory leaks detected
- No race conditions or timing issues
- Performance targets met:
  - Connection establishment: <50ms
  - First chunk latency: <100ms
  - Streaming throughput: 1000+ chunks/second
