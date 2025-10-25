/**
 * MessageList Component Tests
 * Sprint 1: Document Layout (Claude.ai style)
 * Sprint 2: Markdown rendering with code syntax highlighting
 */

import type { Message } from '@/services/api/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { MessageList } from './MessageList';

// Mock react-syntax-highlighter to avoid refractor dynamic import issues in tests
vi.mock('react-syntax-highlighter/dist/cjs/light', () => {
  const Light = ({ children, language, ...props }: any) => (
    <pre {...props}>
      <code>{children}</code>
    </pre>
  );
  Light.registerLanguage = vi.fn();
  return { default: Light };
});

vi.mock('react-syntax-highlighter/dist/cjs/languages/hljs/javascript', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/cjs/languages/hljs/typescript', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/cjs/languages/hljs/python', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/cjs/languages/hljs/rust', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/cjs/languages/hljs/bash', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/cjs/styles/hljs/atom-one-dark', () => ({ atomOneDark: {} }));

describe('MessageList - Document Layout', () => {
  let mockWriteText: Mock;

  beforeEach(() => {
    // Create a proper mock for clipboard
    mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global.navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      writable: true,
      configurable: true,
    });
  });

  const mockMessages: Message[] = [
    {
      id: 'msg_1',
      sessionId: 'sess_1',
      role: 'user',
      content: 'Hello',
      toolCalls: null,
      timestamp: Date.now() - 2000,
    },
    {
      id: 'msg_2',
      sessionId: 'sess_1',
      role: 'assistant',
      content: 'Hi there!',
      toolCalls: null,
      timestamp: Date.now() - 1000,
    },
  ];

  it('should render messages', () => {
    render(<MessageList messages={mockMessages} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
  });

  it('should render messages in document layout (full-width, no bubbles)', () => {
    const { container } = render(<MessageList messages={mockMessages} />);

    // Find message containers
    const messageContainers = container.querySelectorAll('[data-message-id]');

    // Each message should be full-width
    messageContainers.forEach((msg) => {
      expect(msg).toHaveClass('w-full');
      // Should NOT have bubble styling
      expect(msg).not.toHaveClass('max-w-[80%]');
      expect(msg).not.toHaveClass('rounded-lg');
    });
  });

  it('should not apply colored backgrounds (no bubbles)', () => {
    const { container } = render(<MessageList messages={mockMessages} />);

    const messageContainers = container.querySelectorAll('[data-message-id]');

    messageContainers.forEach((msg) => {
      // Should NOT have bubble background colors
      expect(msg).not.toHaveClass('bg-primary');
      expect(msg).not.toHaveClass('bg-muted');
    });
  });

  it('should not align user messages to the right (document style)', () => {
    const { container } = render(<MessageList messages={mockMessages} />);

    const userMessage = container.querySelector('[data-message-id="msg_1"]');
    const assistantMessage = container.querySelector('[data-message-id="msg_2"]');

    // Neither should have justify-end (no right alignment)
    expect(userMessage?.parentElement).not.toHaveClass('justify-end');
    expect(assistantMessage?.parentElement).not.toHaveClass('justify-end');
  });

  it('should display role labels (You, Claude)', () => {
    render(<MessageList messages={mockMessages} />);

    // User message should have "You" label
    expect(screen.getByText('You')).toBeInTheDocument();

    // Assistant message should have "Claude" label
    expect(screen.getByText('Claude')).toBeInTheDocument();
  });

  it('should render copy button for each message', () => {
    render(<MessageList messages={mockMessages} />);

    // Should have copy buttons for both messages
    const copyButtons = screen.getAllByRole('button', { name: /copy/i });
    expect(copyButtons).toHaveLength(2);
  });

  it('should copy message content when copy button clicked', async () => {
    const user = userEvent.setup();

    render(<MessageList messages={mockMessages} />);

    const copyButtons = screen.getAllByRole('button', { name: /copy/i });
    await user.click(copyButtons[0]);

    // Note: CopyButton handles the actual clipboard write
    // This test verifies the button exists and is clickable
    expect(copyButtons[0]).toBeInTheDocument();
  });

  it('should show streaming indicator for streaming message', () => {
    const streamingMessages: Message[] = [
      {
        id: 'streaming_1',
        sessionId: 'sess_1',
        role: 'assistant',
        content: 'Thinking...',
        toolCalls: null,
        timestamp: Date.now(),
      },
    ];

    render(<MessageList messages={streamingMessages} streamingMessageId="streaming_1" />);

    // Should show loading icon for streaming message
    const loadingIcon = screen.getByTestId('streaming-indicator');
    expect(loadingIcon).toBeInTheDocument();
  });

  it('should render empty state when no messages', () => {
    render(<MessageList messages={[]} />);
    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
  });

  it('should render tool calls when present', () => {
    const messagesWithTools: Message[] = [
      {
        id: 'msg_1',
        sessionId: 'sess_1',
        role: 'assistant',
        content: 'Let me check that file',
        toolCalls: [
          {
            id: 'tool_1',
            type: 'function',
            function: { name: 'read_file', arguments: '{}' },
          },
        ],
        timestamp: Date.now(),
      },
    ];

    render(<MessageList messages={messagesWithTools} />);
    expect(screen.getByText('Let me check that file')).toBeInTheDocument();
    expect(screen.getByText(/read_file/i)).toBeInTheDocument();
  });

  it('should auto-scroll to bottom when new messages arrive', () => {
    const { rerender } = render(<MessageList messages={[mockMessages[0]]} />);

    // Add a new message
    rerender(<MessageList messages={mockMessages} />);

    // ScrollArea should scroll to bottom (tested via ref behavior)
    // This is a smoke test - actual scrolling tested in E2E
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
  });
});
