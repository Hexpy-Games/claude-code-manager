/**
 * MessageList Component Tests
 */

import type { Message } from '@/services/api/types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MessageList } from './MessageList';

describe('MessageList', () => {
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

  it('should differentiate user and assistant messages', () => {
    render(<MessageList messages={mockMessages} />);
    const userMsg = screen.getByText('Hello').closest('div')?.parentElement;
    const assistantMsg = screen.getByText('Hi there!').closest('div')?.parentElement;

    expect(userMsg).toHaveClass('justify-end');
    expect(assistantMsg).not.toHaveClass('justify-end');
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
});
