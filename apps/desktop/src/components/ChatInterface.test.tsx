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
});
