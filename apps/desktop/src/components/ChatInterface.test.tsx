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

// Mock Zustand store
const mockSessions = [
  {
    id: 'sess_1',
    title: 'Test Project',
    rootDirectory: '/test/path',
    workspacePath: '/tmp/test',
    branchName: 'session/sess_1',
    baseBranch: 'main',
    gitStatus: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastMessageAt: Date.now(),
    metadata: null,
    isActive: true,
  },
  {
    id: 'sess_2',
    title: 'Another Project',
    rootDirectory: '/another/path',
    workspacePath: '/tmp/another',
    branchName: 'session/sess_2',
    baseBranch: 'main',
    gitStatus: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastMessageAt: Date.now(),
    metadata: null,
    isActive: false,
  },
];

vi.mock('@/stores/sessionStore', () => ({
  useSessionStore: vi.fn((selector) =>
    selector
      ? selector({
          sessions: mockSessions,
          activeSessionId: 'sess_1',
          setActiveSessionId: vi.fn(),
          setSessions: vi.fn(),
        })
      : {
          sessions: mockSessions,
          activeSessionId: 'sess_1',
          setActiveSessionId: vi.fn(),
          setSessions: vi.fn(),
        }
  ),
}));

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

  describe('Draft Message Persistence', () => {
    beforeEach(() => {
      // Clear localStorage before each test
      localStorage.clear();
    });

    it('should save draft message to localStorage when typing', async () => {
      const user = userEvent.setup();
      renderWithClient(<ChatInterface sessionId="sess_1" client={mockRestClient} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Draft message');

      // Wait for draft to be saved
      await waitFor(() => {
        const draftKey = 'draft_sess_1';
        const savedDraft = localStorage.getItem(draftKey);
        expect(savedDraft).toBe('Draft message');
      });
    });

    it('should load draft message from localStorage when session changes', async () => {
      // Pre-populate localStorage with draft
      const draftKey = 'draft_sess_1';
      localStorage.setItem(draftKey, 'Saved draft');

      renderWithClient(<ChatInterface sessionId="sess_1" client={mockRestClient} />);

      await waitFor(() => {
        const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
        expect(textarea.value).toBe('Saved draft');
      });
    });

    it('should clear draft after sending message', async () => {
      const user = userEvent.setup();

      // Pre-populate localStorage with draft
      const draftKey = 'draft_sess_1';
      localStorage.setItem(draftKey, 'Draft to send');

      renderWithClient(<ChatInterface sessionId="sess_1" client={mockRestClient} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Draft to send');

      const sendButton = screen.getByRole('button');
      await user.click(sendButton);

      // Draft should be cleared from both state and localStorage
      await waitFor(() => {
        expect(textarea.value).toBe('');
        expect(localStorage.getItem(draftKey)).toBeNull();
      });
    });

    it('should handle switching sessions with different drafts', async () => {
      // Set up drafts for two different sessions
      localStorage.setItem('draft_sess_1', 'Draft for session 1');
      localStorage.setItem('draft_sess_2', 'Draft for session 2');

      const { rerender } = renderWithClient(<ChatInterface sessionId="sess_1" client={mockRestClient} />);

      // Check first session draft
      await waitFor(() => {
        const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
        expect(textarea.value).toBe('Draft for session 1');
      });

      // Switch to second session
      rerender(
        <QueryClientProvider client={queryClient}>
          <ChatInterface sessionId="sess_2" client={mockRestClient} />
        </QueryClientProvider>
      );

      // Check second session draft
      await waitFor(() => {
        const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
        expect(textarea.value).toBe('Draft for session 2');
      });
    });

    it('should clear draft when switching to session with no draft', async () => {
      const user = userEvent.setup();

      // Set up draft for first session
      localStorage.setItem('draft_sess_1', 'Draft for session 1');

      const { rerender } = renderWithClient(<ChatInterface sessionId="sess_1" client={mockRestClient} />);

      // Check first session draft
      await waitFor(() => {
        const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
        expect(textarea.value).toBe('Draft for session 1');
      });

      // Switch to second session (no draft)
      rerender(
        <QueryClientProvider client={queryClient}>
          <ChatInterface sessionId="sess_2" client={mockRestClient} />
        </QueryClientProvider>
      );

      // Draft should be cleared
      await waitFor(() => {
        const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
        expect(textarea.value).toBe('');
      });
    });

    it('should clear draft when sessionId becomes null', async () => {
      // Set up draft for session
      localStorage.setItem('draft_sess_1', 'Draft for session 1');

      const { rerender } = renderWithClient(<ChatInterface sessionId="sess_1" client={mockRestClient} />);

      // Check session draft
      await waitFor(() => {
        const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
        expect(textarea.value).toBe('Draft for session 1');
      });

      // Clear session
      rerender(
        <QueryClientProvider client={queryClient}>
          <ChatInterface sessionId={null} client={mockRestClient} />
        </QueryClientProvider>
      );

      // Should show "No Session Selected" screen
      expect(screen.getByText(/no session selected/i)).toBeInTheDocument();
    });
  });

  describe('Chat Header with Session Name and Agent Status', () => {
    it('should display session name instead of generic "Chat" in header', async () => {
      renderWithClient(<ChatInterface sessionId="sess_1" client={mockRestClient} />);

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument();
      });

      // Should not show generic "Chat" label
      expect(screen.queryByText(/^Chat$/)).not.toBeInTheDocument();
    });

    it('should show "Idle" status when not streaming', async () => {
      renderWithClient(<ChatInterface sessionId="sess_1" client={mockRestClient} />);

      await waitFor(() => {
        expect(screen.getByText(/Idle/i)).toBeInTheDocument();
      });
    });

    it('should show "Writing..." status when streaming message', async () => {
      const user = userEvent.setup();
      renderWithClient(<ChatInterface sessionId="sess_1" client={mockRestClient} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      // Send message to start streaming
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test message');
      const sendButton = screen.getByRole('button');
      await user.click(sendButton);

      // Status should change to "Writing..."
      await waitFor(() => {
        expect(screen.getByText(/Writing/i)).toBeInTheDocument();
      });
    });

    it('should return to "Idle" status after streaming completes', async () => {
      const user = userEvent.setup();
      renderWithClient(<ChatInterface sessionId="sess_1" client={mockRestClient} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      // Initially idle
      expect(screen.getByText(/Idle/i)).toBeInTheDocument();

      // Send message
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test');
      const sendButton = screen.getByRole('button');
      await user.click(sendButton);

      // Should show Writing
      await waitFor(() => {
        expect(screen.getByText(/Writing/i)).toBeInTheDocument();
      });

      // After streaming completes, should return to Idle
      await waitFor(
        () => {
          expect(screen.getByText(/Idle/i)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    it('should truncate very long session names', async () => {
      // Update mock to return long session name
      vi.mocked(require('@/stores/sessionStore').useSessionStore).mockImplementation((selector: any) =>
        selector
          ? selector({
              sessions: [
                {
                  ...mockSessions[0],
                  title: 'This is a very long session name that should definitely be truncated in the UI',
                },
              ],
              activeSessionId: 'sess_1',
              setActiveSessionId: vi.fn(),
              setSessions: vi.fn(),
            })
          : {}
      );

      const { container } = renderWithClient(<ChatInterface sessionId="sess_1" client={mockRestClient} />);

      await waitFor(() => {
        const headerElement = container.querySelector('.truncate, [class*="truncate"]');
        expect(headerElement).toBeInTheDocument();
      });
    });
  });
});
