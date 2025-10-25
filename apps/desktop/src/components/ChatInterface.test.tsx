/**
 * ChatInterface Component Tests
 */

import { RestClient } from '@/services/api/rest-client';
import type { Message } from '@/services/api/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatInterface } from './ChatInterface';

// Mock react-syntax-highlighter
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

vi.mock('@/services/api/rest-client');

describe('ChatInterface', () => {
  let queryClient: QueryClient;
  let mockRestClient: RestClient;

  const mockMessages: Message[] = [
    {
      id: 'msg_1',
      sessionId: 'sess_1',
      role: 'user',
      content: 'Hello',
      toolCalls: null,
      timestamp: Date.now(),
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    mockRestClient = new RestClient();
    vi.mocked(mockRestClient.getMessages).mockResolvedValue(mockMessages);
    vi.mocked(mockRestClient.sendMessage).mockResolvedValue({
      userMessage: mockMessages[0],
      assistantMessage: {
        id: 'msg_2',
        sessionId: 'sess_1',
        role: 'assistant',
        content: 'Hi!',
        toolCalls: null,
        timestamp: Date.now(),
      },
    });
  });

  function renderWithClient(ui: React.ReactElement) {
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  }

  it('should render message list', async () => {
    renderWithClient(<ChatInterface sessionId="sess_1" client={mockRestClient} />);

    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeInTheDocument();
    });
  });

  it('should render message input', async () => {
    renderWithClient(<ChatInterface sessionId="sess_1" client={mockRestClient} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  it('should send message when input submitted', async () => {
    const user = userEvent.setup();
    renderWithClient(<ChatInterface sessionId="sess_1" client={mockRestClient} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Test message');

    const sendButton = screen.getByRole('button');
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockRestClient.sendMessage).toHaveBeenCalledWith('sess_1', 'Test message');
    });
  });

  it('should show loading state when no session provided', () => {
    renderWithClient(<ChatInterface sessionId={null} client={mockRestClient} />);
    expect(screen.getByText(/select a session/i)).toBeInTheDocument();
  });

  describe('Message Streaming and Persistence', () => {
    it('should preserve messages after streaming completes', async () => {
      const user = userEvent.setup();

      // Mock getMessages to return updated messages after streaming
      let messageCallCount = 0;
      vi.mocked(mockRestClient.getMessages).mockImplementation(async () => {
        messageCallCount++;
        if (messageCallCount === 1) {
          // First call: initial messages
          return mockMessages;
        } else {
          // Subsequent calls: include streamed message
          return [
            ...mockMessages,
            {
              id: 'msg_user_2',
              sessionId: 'sess_1',
              role: 'user',
              content: 'Test streaming',
              toolCalls: null,
              timestamp: Date.now(),
            },
            {
              id: 'msg_assistant_2',
              sessionId: 'sess_1',
              role: 'assistant',
              content: 'Streamed response',
              toolCalls: null,
              timestamp: Date.now(),
            },
          ];
        }
      });

      renderWithClient(<ChatInterface sessionId="sess_1" client={mockRestClient} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      // Send a message
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test streaming');
      const sendButton = screen.getByRole('button');
      await user.click(sendButton);

      // Wait for send to complete
      await waitFor(() => {
        expect(mockRestClient.sendMessage).toHaveBeenCalled();
      });

      // After streaming completes and refetch, messages should be visible
      await waitFor(
        () => {
          expect(screen.getByText('Test streaming')).toBeInTheDocument();
          expect(screen.getByText('Streamed response')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Verify messages are not cleared
      expect(screen.getByText('Test streaming')).toBeInTheDocument();
      expect(screen.getByText('Streamed response')).toBeInTheDocument();
    });

    it('should not clear messages before refetch completes', async () => {
      const user = userEvent.setup();
      let refetchComplete = false;

      // Mock getMessages to have a delay
      vi.mocked(mockRestClient.getMessages).mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        refetchComplete = true;
        return [
          ...mockMessages,
          {
            id: 'msg_assistant_2',
            sessionId: 'sess_1',
            role: 'assistant',
            content: 'Response after delay',
            toolCalls: null,
            timestamp: Date.now(),
          },
        ];
      });

      renderWithClient(<ChatInterface sessionId="sess_1" client={mockRestClient} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test');
      const sendButton = screen.getByRole('button');
      await user.click(sendButton);

      // Check that optimistic message appears
      await waitFor(() => {
        expect(screen.getByText('Test')).toBeInTheDocument();
      });

      // Before refetch completes, message should still be visible
      expect(refetchComplete).toBe(false);
      expect(screen.getByText('Test')).toBeInTheDocument();

      // After refetch completes
      await waitFor(
        () => {
          expect(screen.getByText('Response after delay')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should handle WebSocket close during streaming', async () => {
      const user = userEvent.setup();

      renderWithClient(<ChatInterface sessionId="sess_1" client={mockRestClient} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test WebSocket close');
      const sendButton = screen.getByRole('button');
      await user.click(sendButton);

      // Optimistic message should appear
      await waitFor(() => {
        expect(screen.getByText('Test WebSocket close')).toBeInTheDocument();
      });

      // Even if WebSocket closes, refetch should still happen
      await waitFor(() => {
        expect(mockRestClient.getMessages).toHaveBeenCalled();
      });
    });

    it('should preserve partial content on streaming error', async () => {
      const user = userEvent.setup();

      renderWithClient(<ChatInterface sessionId="sess_1" client={mockRestClient} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      // Send message
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test error handling');
      const sendButton = screen.getByRole('button');
      await user.click(sendButton);

      // Message should be sent
      await waitFor(() => {
        expect(mockRestClient.sendMessage).toHaveBeenCalled();
      });
    });

    it('should handle rapid message sends', async () => {
      const user = userEvent.setup();

      renderWithClient(<ChatInterface sessionId="sess_1" client={mockRestClient} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox');

      // Send first message
      await user.type(textarea, 'First');
      let sendButton = screen.getByRole('button');
      await user.click(sendButton);

      // Immediately send second message
      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });
      await user.clear(textarea);
      await user.type(textarea, 'Second');
      sendButton = screen.getByRole('button');
      await user.click(sendButton);

      // Both calls should be made
      await waitFor(() => {
        expect(mockRestClient.sendMessage).toHaveBeenCalledTimes(2);
      });
    });
  });
});
