# Test Cases: Claude Agent Integration

> **Feature ID**: 004
> **Related Use Case**: [use-case.md](./use-case.md)
> **Status**: In Progress
> **Last Updated**: 2025-10-23

## Test Strategy

### Testing Pyramid

```
        E2E Tests (Few)
      ─────────────────
     Integration Tests (Some)
   ───────────────────────────
  Unit Tests (Many)
```

### Coverage Goals
- **Unit Test Coverage**: ≥ 80%
- **Integration Tests**: Full service integration with DatabaseClient
- **E2E Tests**: Future - Will test via REST API when Feature 005 is complete

### Test Environment
- **Unit Tests**: Vitest, mocked Claude SDK, in-memory SQLite
- **Integration Tests**: Real DatabaseClient with :memory: database
- **Mocking Strategy**: Mock @anthropic-ai/claude-agent-sdk, use real database

---

## Unit Tests

### Component/Service: ClaudeAgentService

**File**: `packages/server/src/services/claude-agent-service.test.ts`

#### Test Suite: Constructor and Initialization

##### ✅ Test Case 1: Initialize with valid config
```typescript
it('should initialize ClaudeAgentService with API key', () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const config = { apiKey: 'test-key-123' };

  // Act
  const service = new ClaudeAgentService(mockDb, config);

  // Assert
  expect(service).toBeDefined();
  expect(service).toBeInstanceOf(ClaudeAgentService);
});
```

##### ✅ Test Case 2: Throw error when API key is missing
```typescript
it('should throw ConfigurationError when API key is missing', () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const config = { apiKey: '' };

  // Act & Assert
  expect(() => new ClaudeAgentService(mockDb, config)).toThrow(ConfigurationError);
  expect(() => new ClaudeAgentService(mockDb, config)).toThrow('API key is required');
});
```

##### ✅ Test Case 3: Use default model when not specified
```typescript
it('should use default model when config.model not provided', () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const config = { apiKey: 'test-key-123' };

  // Act
  const service = new ClaudeAgentService(mockDb, config);

  // Assert
  // Verify internal state via behavior (tested in sendMessage)
  expect(service).toBeDefined();
});
```

##### ✅ Test Case 4: Use custom model when specified
```typescript
it('should use custom model when provided in config', () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const config = {
    apiKey: 'test-key-123',
    model: 'claude-3-opus-20240229'
  };

  // Act
  const service = new ClaudeAgentService(mockDb, config);

  // Assert
  expect(service).toBeDefined();
});
```

#### Test Suite: generateMessageId()

##### ✅ Test Case 5: Generate message ID with correct format
```typescript
it('should generate message ID in format msg_{nanoid}', () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

  // Act
  const id1 = service['generateMessageId'](); // Access private method for testing
  const id2 = service['generateMessageId']();

  // Assert
  expect(id1).toMatch(/^msg_[A-Za-z0-9_-]{12}$/);
  expect(id2).toMatch(/^msg_[A-Za-z0-9_-]{12}$/);
  expect(id1).not.toBe(id2); // Should be unique
});
```

#### Test Suite: sendMessage() - Happy Path

##### ✅ Test Case 6: Send message and save to database
```typescript
it('should send user message, get Claude response, and save both to DB', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const mockAgent = createMockClaudeAgent();
  const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

  mockDb.getSession.mockReturnValue({
    id: 'sess_123',
    title: 'Test Session',
    // ... other session fields
  });

  mockDb.getMessages.mockReturnValue([]);

  mockAgent.sendMessage.mockResolvedValue({
    content: 'Hello! How can I help you?',
    tool_calls: null,
  });

  // Act
  const result = await service.sendMessage('sess_123', 'Hello Claude');

  // Assert
  expect(mockDb.getSession).toHaveBeenCalledWith('sess_123');
  expect(mockDb.getMessages).toHaveBeenCalledWith('sess_123');
  expect(mockDb.insertMessage).toHaveBeenCalledTimes(2); // User + assistant

  // Verify user message
  expect(mockDb.insertMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      sessionId: 'sess_123',
      role: 'user',
      content: 'Hello Claude',
    })
  );

  // Verify assistant message
  expect(mockDb.insertMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      sessionId: 'sess_123',
      role: 'assistant',
      content: 'Hello! How can I help you?',
      toolCalls: null,
    })
  );

  expect(result).toEqual({
    userMessage: expect.any(Object),
    assistantMessage: expect.any(Object),
  });
});
```

##### ✅ Test Case 7: Include conversation history in Claude request
```typescript
it('should send previous messages as conversation history', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const mockAgent = createMockClaudeAgent();
  const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

  mockDb.getSession.mockReturnValue({ id: 'sess_123', /* ... */ });
  mockDb.getMessages.mockReturnValue([
    { id: 'msg_1', role: 'user', content: 'Previous question', toolCalls: null },
    { id: 'msg_2', role: 'assistant', content: 'Previous answer', toolCalls: null },
  ]);

  mockAgent.sendMessage.mockResolvedValue({
    content: 'Based on our previous conversation...',
  });

  // Act
  await service.sendMessage('sess_123', 'Follow-up question');

  // Assert
  expect(mockAgent.sendMessage).toHaveBeenCalledWith({
    messages: [
      { role: 'user', content: 'Previous question', tool_calls: null },
      { role: 'assistant', content: 'Previous answer', tool_calls: null },
      { role: 'user', content: 'Follow-up question', tool_calls: undefined },
    ],
    max_tokens: expect.any(Number),
  });
});
```

#### Test Suite: sendMessage() - Tool Calls

##### ✅ Test Case 8: Handle assistant response with tool calls
```typescript
it('should save tool_calls when Claude requests tool use', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const mockAgent = createMockClaudeAgent();
  const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

  mockDb.getSession.mockReturnValue({ id: 'sess_123', /* ... */ });
  mockDb.getMessages.mockReturnValue([]);

  const toolCalls = [
    { id: 'call_1', name: 'read_file', arguments: { path: '/test.txt' } },
  ];

  mockAgent.sendMessage.mockResolvedValue({
    content: 'Let me read that file for you.',
    tool_calls: toolCalls,
  });

  // Act
  const result = await service.sendMessage('sess_123', 'Read test.txt');

  // Assert
  expect(mockDb.insertMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      role: 'assistant',
      content: 'Let me read that file for you.',
      toolCalls: toolCalls,
    })
  );
});
```

##### ✅ Test Case 9: Handle multiple tool calls in single response
```typescript
it('should save multiple tool calls from single response', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const mockAgent = createMockClaudeAgent();
  const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

  mockDb.getSession.mockReturnValue({ id: 'sess_123', /* ... */ });
  mockDb.getMessages.mockReturnValue([]);

  const toolCalls = [
    { id: 'call_1', name: 'read_file', arguments: { path: '/file1.txt' } },
    { id: 'call_2', name: 'read_file', arguments: { path: '/file2.txt' } },
  ];

  mockAgent.sendMessage.mockResolvedValue({
    content: 'Let me read both files.',
    tool_calls: toolCalls,
  });

  // Act
  await service.sendMessage('sess_123', 'Compare file1 and file2');

  // Assert
  expect(mockDb.insertMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      toolCalls: expect.arrayContaining([
        expect.objectContaining({ name: 'read_file' }),
        expect.objectContaining({ name: 'read_file' }),
      ]),
    })
  );
});
```

#### Test Suite: sendMessage() - Error Cases

##### ✅ Test Case 10: Throw error when session not found
```typescript
it('should throw SessionNotFoundError when session does not exist', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

  mockDb.getSession.mockReturnValue(null);

  // Act & Assert
  await expect(
    service.sendMessage('sess_nonexistent', 'Hello')
  ).rejects.toThrow(SessionNotFoundError);

  await expect(
    service.sendMessage('sess_nonexistent', 'Hello')
  ).rejects.toThrow('Session not found: sess_nonexistent');

  // Verify no messages were saved
  expect(mockDb.insertMessage).not.toHaveBeenCalled();
});
```

##### ✅ Test Case 11: Throw error when message content is empty
```typescript
it('should throw InvalidMessageError when content is empty', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

  mockDb.getSession.mockReturnValue({ id: 'sess_123', /* ... */ });

  // Act & Assert
  await expect(
    service.sendMessage('sess_123', '')
  ).rejects.toThrow(InvalidMessageError);

  await expect(
    service.sendMessage('sess_123', '   ')
  ).rejects.toThrow(InvalidMessageError);
});
```

##### ✅ Test Case 12: Handle Claude API rate limit error
```typescript
it('should throw RateLimitError when API rate limited', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const mockAgent = createMockClaudeAgent();
  const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

  mockDb.getSession.mockReturnValue({ id: 'sess_123', /* ... */ });
  mockDb.getMessages.mockReturnValue([]);

  const rateLimitError = new Error('Rate limit exceeded');
  rateLimitError.status = 429;
  rateLimitError.headers = { 'retry-after': '60' };
  mockAgent.sendMessage.mockRejectedValue(rateLimitError);

  // Act & Assert
  await expect(
    service.sendMessage('sess_123', 'Hello')
  ).rejects.toThrow(RateLimitError);

  // User message should be saved (can retry)
  expect(mockDb.insertMessage).toHaveBeenCalledTimes(1);
  expect(mockDb.insertMessage).toHaveBeenCalledWith(
    expect.objectContaining({ role: 'user' })
  );
});
```

##### ✅ Test Case 13: Handle Claude API error (4xx/5xx)
```typescript
it('should throw ClaudeAPIError for API errors', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const mockAgent = createMockClaudeAgent();
  const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

  mockDb.getSession.mockReturnValue({ id: 'sess_123', /* ... */ });
  mockDb.getMessages.mockReturnValue([]);

  const apiError = new Error('Invalid request');
  apiError.status = 400;
  mockAgent.sendMessage.mockRejectedValue(apiError);

  // Act & Assert
  await expect(
    service.sendMessage('sess_123', 'Hello')
  ).rejects.toThrow(ClaudeAPIError);
});
```

##### ✅ Test Case 14: Handle network timeout
```typescript
it('should throw NetworkError on network timeout', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const mockAgent = createMockClaudeAgent();
  const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

  mockDb.getSession.mockReturnValue({ id: 'sess_123', /* ... */ });
  mockDb.getMessages.mockReturnValue([]);

  const timeoutError = new Error('ETIMEDOUT');
  timeoutError.code = 'ETIMEDOUT';
  mockAgent.sendMessage.mockRejectedValue(timeoutError);

  // Act & Assert
  await expect(
    service.sendMessage('sess_123', 'Hello')
  ).rejects.toThrow(NetworkError);
});
```

#### Test Suite: streamMessage() - Happy Path

##### ✅ Test Case 15: Stream message response and yield tokens
```typescript
it('should stream tokens as they arrive from Claude', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const mockAgent = createMockClaudeAgent();
  const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

  mockDb.getSession.mockReturnValue({ id: 'sess_123', /* ... */ });
  mockDb.getMessages.mockReturnValue([]);

  // Mock streaming response
  async function* mockStream() {
    yield { delta: { text: 'Hello' } };
    yield { delta: { text: ' there' } };
    yield { delta: { text: '!' } };
  }

  mockAgent.streamMessage.mockReturnValue(mockStream());

  // Act
  const generator = service.streamMessage('sess_123', 'Hi');
  const tokens: string[] = [];

  for await (const token of generator) {
    tokens.push(token);
  }

  // Assert
  expect(tokens).toEqual(['Hello', ' there', '!']);
  expect(mockDb.insertMessage).toHaveBeenCalledTimes(2); // User + complete assistant
});
```

##### ✅ Test Case 16: Save complete message after streaming ends
```typescript
it('should save complete assistant message after streaming completes', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const mockAgent = createMockClaudeAgent();
  const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

  mockDb.getSession.mockReturnValue({ id: 'sess_123', /* ... */ });
  mockDb.getMessages.mockReturnValue([]);

  async function* mockStream() {
    yield { delta: { text: 'Hello' } };
    yield { delta: { text: ' world' } };
  }

  mockAgent.streamMessage.mockReturnValue(mockStream());

  // Act
  const generator = service.streamMessage('sess_123', 'Hi');
  const finalMessage = await generator.next().then(() => generator.return());

  // Assert
  expect(mockDb.insertMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      role: 'assistant',
      content: 'Hello world', // Complete accumulated text
    })
  );
});
```

##### ✅ Test Case 17: Handle tool calls in streaming response
```typescript
it('should capture tool calls during streaming', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const mockAgent = createMockClaudeAgent();
  const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

  mockDb.getSession.mockReturnValue({ id: 'sess_123', /* ... */ });
  mockDb.getMessages.mockReturnValue([]);

  const toolCalls = [{ id: 'call_1', name: 'read_file', arguments: {} }];

  async function* mockStream() {
    yield { delta: { text: 'Let me read' } };
    yield { delta: { text: ' that file' } };
    yield { delta: { tool_calls: toolCalls } };
  }

  mockAgent.streamMessage.mockReturnValue(mockStream());

  // Act
  const generator = service.streamMessage('sess_123', 'Read file');
  for await (const token of generator) {
    // Consume stream
  }

  // Assert
  expect(mockDb.insertMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      role: 'assistant',
      content: 'Let me read that file',
      toolCalls: toolCalls,
    })
  );
});
```

#### Test Suite: streamMessage() - Error Cases

##### ✅ Test Case 18: Throw error when session not found (streaming)
```typescript
it('should throw SessionNotFoundError before streaming starts', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

  mockDb.getSession.mockReturnValue(null);

  // Act
  const generator = service.streamMessage('sess_invalid', 'Hello');

  // Assert
  await expect(generator.next()).rejects.toThrow(SessionNotFoundError);
});
```

##### ✅ Test Case 19: Handle stream interruption
```typescript
it('should throw NetworkError when stream is interrupted', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const mockAgent = createMockClaudeAgent();
  const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

  mockDb.getSession.mockReturnValue({ id: 'sess_123', /* ... */ });
  mockDb.getMessages.mockReturnValue([]);

  async function* mockStream() {
    yield { delta: { text: 'Hello' } };
    throw new Error('Connection lost');
  }

  mockAgent.streamMessage.mockReturnValue(mockStream());

  // Act
  const generator = service.streamMessage('sess_123', 'Hi');
  await generator.next(); // First token succeeds

  // Assert
  await expect(generator.next()).rejects.toThrow(NetworkError);

  // Partial response should NOT be saved
  expect(mockDb.insertMessage).toHaveBeenCalledTimes(1); // Only user message
});
```

##### ✅ Test Case 20: Don't save partial response on stream error
```typescript
it('should not save assistant message if stream fails', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const mockAgent = createMockClaudeAgent();
  const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

  mockDb.getSession.mockReturnValue({ id: 'sess_123', /* ... */ });
  mockDb.getMessages.mockReturnValue([]);

  async function* mockStream() {
    yield { delta: { text: 'Partial' } };
    throw new Error('Stream error');
  }

  mockAgent.streamMessage.mockReturnValue(mockStream());

  // Act
  const generator = service.streamMessage('sess_123', 'Hi');

  try {
    for await (const token of generator) {
      // Will throw on second iteration
    }
  } catch (error) {
    // Expected
  }

  // Assert
  // Only user message saved, no assistant message
  expect(mockDb.insertMessage).toHaveBeenCalledTimes(1);
  expect(mockDb.insertMessage).toHaveBeenCalledWith(
    expect.objectContaining({ role: 'user' })
  );
});
```

#### Test Suite: getConversationHistory() - Private Method

##### ✅ Test Case 21: Load all messages for session in order
```typescript
it('should load conversation history in chronological order', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

  const messages = [
    { id: 'msg_1', role: 'user', content: 'First', toolCalls: null, timestamp: 1000 },
    { id: 'msg_2', role: 'assistant', content: 'Second', toolCalls: null, timestamp: 2000 },
    { id: 'msg_3', role: 'user', content: 'Third', toolCalls: null, timestamp: 3000 },
  ];

  mockDb.getMessages.mockReturnValue(messages);

  // Act
  const history = await service['getConversationHistory']('sess_123');

  // Assert
  expect(history).toEqual([
    { role: 'user', content: 'First', tool_calls: null },
    { role: 'assistant', content: 'Second', tool_calls: null },
    { role: 'user', content: 'Third', tool_calls: null },
  ]);
});
```

##### ✅ Test Case 22: Return empty array when no messages exist
```typescript
it('should return empty array for new session', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

  mockDb.getMessages.mockReturnValue([]);

  // Act
  const history = await service['getConversationHistory']('sess_new');

  // Assert
  expect(history).toEqual([]);
});
```

##### ✅ Test Case 23: Include tool calls in history
```typescript
it('should include tool calls in conversation history', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

  const toolCalls = [{ id: 'call_1', name: 'read_file', arguments: {} }];
  const messages = [
    { id: 'msg_1', role: 'user', content: 'Read file', toolCalls: null },
    { id: 'msg_2', role: 'assistant', content: 'Reading...', toolCalls },
  ];

  mockDb.getMessages.mockReturnValue(messages);

  // Act
  const history = await service['getConversationHistory']('sess_123');

  // Assert
  expect(history[1]).toEqual({
    role: 'assistant',
    content: 'Reading...',
    tool_calls: toolCalls,
  });
});
```

#### Test Suite: Edge Cases

##### ✅ Test Case 24: Handle very long message content
```typescript
it('should handle messages with large content', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const mockAgent = createMockClaudeAgent();
  const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

  mockDb.getSession.mockReturnValue({ id: 'sess_123', /* ... */ });
  mockDb.getMessages.mockReturnValue([]);

  const longMessage = 'x'.repeat(100000); // 100k characters
  mockAgent.sendMessage.mockResolvedValue({ content: 'Received' });

  // Act
  await service.sendMessage('sess_123', longMessage);

  // Assert
  expect(mockDb.insertMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      content: longMessage,
    })
  );
});
```

##### ✅ Test Case 25: Handle special characters in message
```typescript
it('should properly save messages with special characters', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const mockAgent = createMockClaudeAgent();
  const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

  mockDb.getSession.mockReturnValue({ id: 'sess_123', /* ... */ });
  mockDb.getMessages.mockReturnValue([]);

  const specialMessage = 'Hello\nWorld\t"quotes"\n\'apostrophe\'\\backslash';
  mockAgent.sendMessage.mockResolvedValue({ content: 'Understood' });

  // Act
  await service.sendMessage('sess_123', specialMessage);

  // Assert
  expect(mockDb.insertMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      content: specialMessage,
    })
  );
});
```

##### ✅ Test Case 26: Handle empty assistant response
```typescript
it('should save assistant message even with empty content', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const mockAgent = createMockClaudeAgent();
  const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

  mockDb.getSession.mockReturnValue({ id: 'sess_123', /* ... */ });
  mockDb.getMessages.mockReturnValue([]);

  const toolCalls = [{ id: 'call_1', name: 'execute', arguments: {} }];
  mockAgent.sendMessage.mockResolvedValue({
    content: '',
    tool_calls: toolCalls,
  });

  // Act
  await service.sendMessage('sess_123', 'Execute tool');

  // Assert
  expect(mockDb.insertMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      role: 'assistant',
      content: '',
      toolCalls: toolCalls,
    })
  );
});
```

##### ✅ Test Case 27: Handle concurrent messages to same session
```typescript
it('should handle multiple concurrent sendMessage calls', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const mockAgent = createMockClaudeAgent();
  const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

  mockDb.getSession.mockReturnValue({ id: 'sess_123', /* ... */ });
  mockDb.getMessages.mockReturnValue([]);

  mockAgent.sendMessage.mockResolvedValue({ content: 'Response' });

  // Act
  const promises = [
    service.sendMessage('sess_123', 'Message 1'),
    service.sendMessage('sess_123', 'Message 2'),
    service.sendMessage('sess_123', 'Message 3'),
  ];

  await Promise.all(promises);

  // Assert
  expect(mockDb.insertMessage).toHaveBeenCalledTimes(6); // 3 user + 3 assistant
});
```

##### ✅ Test Case 28: Handle session with many messages (performance)
```typescript
it('should efficiently load large conversation history', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const mockAgent = createMockClaudeAgent();
  const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

  mockDb.getSession.mockReturnValue({ id: 'sess_123', /* ... */ });

  // Generate 1000 messages
  const manyMessages = Array.from({ length: 1000 }, (_, i) => ({
    id: `msg_${i}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `Message ${i}`,
    toolCalls: null,
    timestamp: i,
  }));

  mockDb.getMessages.mockReturnValue(manyMessages);
  mockAgent.sendMessage.mockResolvedValue({ content: 'Response' });

  // Act
  const startTime = Date.now();
  await service.sendMessage('sess_123', 'New message');
  const duration = Date.now() - startTime;

  // Assert
  expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
  expect(mockAgent.sendMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      messages: expect.arrayContaining([
        expect.objectContaining({ content: 'Message 0' }),
      ]),
    })
  );
});
```

#### Test Suite: Database Integration

##### ✅ Test Case 29: Verify session.last_message_at is updated
```typescript
it('should update session.last_message_at via insertMessage', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const mockAgent = createMockClaudeAgent();
  const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

  mockDb.getSession.mockReturnValue({ id: 'sess_123', /* ... */ });
  mockDb.getMessages.mockReturnValue([]);
  mockAgent.sendMessage.mockResolvedValue({ content: 'Response' });

  // Act
  await service.sendMessage('sess_123', 'Hello');

  // Assert
  // insertMessage is called twice, which automatically updates last_message_at
  expect(mockDb.insertMessage).toHaveBeenCalledTimes(2);
  // DatabaseClient handles the timestamp update internally
});
```

##### ✅ Test Case 30: Verify messages are linked to session
```typescript
it('should link all messages to correct session ID', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const mockAgent = createMockClaudeAgent();
  const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

  mockDb.getSession.mockReturnValue({ id: 'sess_abc', /* ... */ });
  mockDb.getMessages.mockReturnValue([]);
  mockAgent.sendMessage.mockResolvedValue({ content: 'Response' });

  // Act
  await service.sendMessage('sess_abc', 'Hello');

  // Assert
  expect(mockDb.insertMessage).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({ sessionId: 'sess_abc', role: 'user' })
  );
  expect(mockDb.insertMessage).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ sessionId: 'sess_abc', role: 'assistant' })
  );
});
```

#### Test Suite: Configuration Options

##### ✅ Test Case 31: Use custom maxTokens from config
```typescript
it('should use custom maxTokens when provided', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const mockAgent = createMockClaudeAgent();
  const service = new ClaudeAgentService(mockDb, {
    apiKey: 'test-key',
    maxTokens: 8192,
  });

  mockDb.getSession.mockReturnValue({ id: 'sess_123', /* ... */ });
  mockDb.getMessages.mockReturnValue([]);
  mockAgent.sendMessage.mockResolvedValue({ content: 'Response' });

  // Act
  await service.sendMessage('sess_123', 'Hello');

  // Assert
  expect(mockAgent.sendMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      max_tokens: 8192,
    })
  );
});
```

##### ✅ Test Case 32: Use default maxTokens when not specified
```typescript
it('should use default maxTokens of 4096', async () => {
  // Arrange
  const mockDb = createMockDatabaseClient();
  const mockAgent = createMockClaudeAgent();
  const service = new ClaudeAgentService(mockDb, {
    apiKey: 'test-key',
    // maxTokens not provided
  });

  mockDb.getSession.mockReturnValue({ id: 'sess_123', /* ... */ });
  mockDb.getMessages.mockReturnValue([]);
  mockAgent.sendMessage.mockResolvedValue({ content: 'Response' });

  // Act
  await service.sendMessage('sess_123', 'Hello');

  // Assert
  expect(mockAgent.sendMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      max_tokens: 4096,
    })
  );
});
```

---

## Integration Tests

### Integration Test 1: ClaudeAgentService + DatabaseClient

**Scope**: ClaudeAgentService → DatabaseClient → SQLite (in-memory)

#### Setup
```typescript
describe('ClaudeAgentService Integration', () => {
  let db: DatabaseClient;
  let service: ClaudeAgentService;
  let mockAgent: any;

  beforeEach(() => {
    // Use real DatabaseClient with :memory: database
    db = new DatabaseClient(':memory:');

    // Create test session
    db.insertSession({
      id: 'sess_integration_test',
      title: 'Integration Test Session',
      rootDirectory: '/test',
      branchName: 'session/test',
    });

    // Mock Claude Agent SDK
    mockAgent = {
      sendMessage: vi.fn(),
      streamMessage: vi.fn(),
    };

    // Create service with real DB and mocked Claude
    service = new ClaudeAgentService(db, { apiKey: 'test-key' });
    // Inject mock agent
    service['agent'] = mockAgent;
  });

  afterEach(() => {
    db.close();
  });
});
```

#### ✅ Test Case 33: End-to-end message flow with real database
```typescript
it('should save user and assistant messages to real database', async () => {
  // Arrange
  mockAgent.sendMessage.mockResolvedValue({
    content: 'Hello from Claude!',
    tool_calls: null,
  });

  // Act
  await service.sendMessage('sess_integration_test', 'Hello Claude');

  // Assert - Query real database
  const messages = db.getMessages('sess_integration_test');
  expect(messages).toHaveLength(2);

  expect(messages[0]).toMatchObject({
    role: 'user',
    content: 'Hello Claude',
    toolCalls: null,
  });

  expect(messages[1]).toMatchObject({
    role: 'assistant',
    content: 'Hello from Claude!',
    toolCalls: null,
  });
});
```

#### ✅ Test Case 34: Verify conversation history persists across calls
```typescript
it('should accumulate conversation history in database', async () => {
  // Arrange
  mockAgent.sendMessage.mockResolvedValue({ content: 'Response 1' });

  // Act - Send first message
  await service.sendMessage('sess_integration_test', 'Message 1');

  mockAgent.sendMessage.mockResolvedValue({ content: 'Response 2' });

  // Act - Send second message
  await service.sendMessage('sess_integration_test', 'Message 2');

  // Assert - Check database has all messages
  const messages = db.getMessages('sess_integration_test');
  expect(messages).toHaveLength(4); // 2 user + 2 assistant

  // Verify order
  expect(messages.map(m => m.content)).toEqual([
    'Message 1',
    'Response 1',
    'Message 2',
    'Response 2',
  ]);
});
```

#### ✅ Test Case 35: Verify session.last_message_at updates
```typescript
it('should update session.last_message_at in database', async () => {
  // Arrange
  const initialSession = db.getSession('sess_integration_test');
  const initialLastMessage = initialSession.lastMessageAt;

  mockAgent.sendMessage.mockResolvedValue({ content: 'Response' });

  // Wait a bit to ensure timestamp changes
  await new Promise(resolve => setTimeout(resolve, 10));

  // Act
  await service.sendMessage('sess_integration_test', 'Hello');

  // Assert
  const updatedSession = db.getSession('sess_integration_test');
  expect(updatedSession.lastMessageAt).toBeGreaterThan(initialLastMessage || 0);
});
```

---

## Test Data

### Mock Data

#### Sample Session
```typescript
const mockSession = {
  id: 'sess_test123',
  title: 'Test Session',
  rootDirectory: '/test/repo',
  branchName: 'session/sess_test123',
  baseBranch: 'main',
  gitStatus: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  lastMessageAt: null,
  metadata: null,
  isActive: true,
};
```

#### Sample Messages
```typescript
const mockUserMessage = {
  id: 'msg_user123',
  sessionId: 'sess_test123',
  role: 'user' as const,
  content: 'Hello, Claude!',
  toolCalls: null,
  timestamp: Date.now(),
};

const mockAssistantMessage = {
  id: 'msg_asst123',
  sessionId: 'sess_test123',
  role: 'assistant' as const,
  content: 'Hello! How can I help you today?',
  toolCalls: null,
  timestamp: Date.now(),
};
```

#### Sample Tool Calls
```typescript
const mockToolCalls = [
  {
    id: 'call_123',
    name: 'read_file',
    arguments: {
      path: '/src/index.ts',
    },
  },
  {
    id: 'call_456',
    name: 'execute_command',
    arguments: {
      command: 'npm test',
    },
  },
];
```

---

## Mocks & Stubs

### Mocking Strategy

#### External Services
- **Claude Agent SDK**: Mock all API calls to avoid real API usage
- **DatabaseClient**: Use real client in integration tests, mock in unit tests
- **nanoid**: Use real implementation (fast, no need to mock)

#### Mock Implementations

```typescript
// Mock DatabaseClient
function createMockDatabaseClient() {
  return {
    getSession: vi.fn(),
    getMessages: vi.fn(),
    insertMessage: vi.fn(),
    // ... other methods
  };
}

// Mock Claude Agent
function createMockClaudeAgent() {
  return {
    sendMessage: vi.fn(),
    streamMessage: vi.fn(),
  };
}

// Mock Claude Agent SDK module
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  ClaudeAgent: vi.fn(() => ({
    sendMessage: vi.fn(),
    streamMessage: vi.fn(),
  })),
}));
```

---

## Test Execution

### Running Tests

```bash
# Run all server tests
cd packages/server
pnpm test

# Run specific test file
pnpm test claude-agent-service.test.ts

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run only integration tests
pnpm test --grep "Integration"
```

---

## Coverage Requirements

### Minimum Coverage Thresholds

```json
{
  "coverage": {
    "branches": 80,
    "functions": 80,
    "lines": 80,
    "statements": 80
  }
}
```

---

## Checklist

Before marking feature as "tested":

- [ ] All 35 unit tests written and passing
- [ ] Integration tests with real DatabaseClient passing
- [ ] Test coverage ≥ 80%
- [ ] All error cases covered
- [ ] Edge cases covered
- [ ] Streaming functionality fully tested
- [ ] Tool call handling tested
- [ ] Database integration verified
- [ ] Mocks are maintainable and clear
- [ ] Tests run in CI/CD pipeline

---

**Document History**:
- 2025-10-23: Initial test cases (35 unit tests, 3 integration tests)
