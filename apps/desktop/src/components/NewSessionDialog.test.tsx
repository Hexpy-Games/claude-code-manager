/**
 * NewSessionDialog Component Tests
 */

import { RestClient } from '@/services/api/rest-client';
import type { Session } from '@/services/api/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewSessionDialog } from './NewSessionDialog';

vi.mock('@/services/api/rest-client');

describe('NewSessionDialog', () => {
  let queryClient: QueryClient;
  let mockRestClient: RestClient;
  const mockOnOpenChange = vi.fn();

  const mockSession: Session = {
    id: 'sess_new',
    title: 'New Session',
    rootDirectory: '/test/path',
      workspacePath: '/tmp/claude-sessions/test/path',
    branchName: 'session/new',
    baseBranch: 'main',
    gitStatus: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastMessageAt: null,
    metadata: null,
    isActive: false,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockRestClient = new RestClient();
    vi.mocked(mockRestClient.createSession).mockResolvedValue(mockSession);
    mockOnOpenChange.mockClear();
  });

  function renderWithClient(ui: React.ReactElement) {
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  }

  it('should not render when closed', () => {
    renderWithClient(
      <NewSessionDialog open={false} onOpenChange={mockOnOpenChange} client={mockRestClient} />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render when open', () => {
    renderWithClient(
      <NewSessionDialog open={true} onOpenChange={mockOnOpenChange} client={mockRestClient} />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/new session/i)).toBeInTheDocument();
  });

  it('should render title input field', () => {
    renderWithClient(
      <NewSessionDialog open={true} onOpenChange={mockOnOpenChange} client={mockRestClient} />
    );

    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
  });

  it('should render root directory input field', () => {
    renderWithClient(
      <NewSessionDialog open={true} onOpenChange={mockOnOpenChange} client={mockRestClient} />
    );

    expect(screen.getByLabelText(/root directory/i)).toBeInTheDocument();
  });

  it('should render optional base branch input field', () => {
    renderWithClient(
      <NewSessionDialog open={true} onOpenChange={mockOnOpenChange} client={mockRestClient} />
    );

    expect(screen.getByLabelText(/base branch/i)).toBeInTheDocument();
  });

  it('should render create and cancel buttons', () => {
    renderWithClient(
      <NewSessionDialog open={true} onOpenChange={mockOnOpenChange} client={mockRestClient} />
    );

    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('should call onOpenChange(false) when cancel clicked', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <NewSessionDialog open={true} onOpenChange={mockOnOpenChange} client={mockRestClient} />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('should show validation error when title is empty', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <NewSessionDialog open={true} onOpenChange={mockOnOpenChange} client={mockRestClient} />
    );

    const createButton = screen.getByRole('button', { name: /create/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
    });
  });

  it('should show validation error when root directory is empty', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <NewSessionDialog open={true} onOpenChange={mockOnOpenChange} client={mockRestClient} />
    );

    const titleInput = screen.getByLabelText(/title/i);
    await user.type(titleInput, 'Test Session');

    const createButton = screen.getByRole('button', { name: /create/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/root directory is required/i)).toBeInTheDocument();
    });
  });

  it('should create session with valid input', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <NewSessionDialog open={true} onOpenChange={mockOnOpenChange} client={mockRestClient} />
    );

    const titleInput = screen.getByLabelText(/title/i);
    const directoryInput = screen.getByLabelText(/root directory/i);

    await user.type(titleInput, 'Test Session');
    await user.type(directoryInput, '/test/path');

    const createButton = screen.getByRole('button', { name: /create/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(mockRestClient.createSession).toHaveBeenCalledWith({
        title: 'Test Session',
        rootDirectory: '/test/path',
        baseBranch: undefined,
      });
    });
  });

  it('should include base branch when provided', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <NewSessionDialog open={true} onOpenChange={mockOnOpenChange} client={mockRestClient} />
    );

    const titleInput = screen.getByLabelText(/title/i);
    const directoryInput = screen.getByLabelText(/root directory/i);
    const branchInput = screen.getByLabelText(/base branch/i);

    await user.type(titleInput, 'Test Session');
    await user.type(directoryInput, '/test/path');
    await user.type(branchInput, 'develop');

    const createButton = screen.getByRole('button', { name: /create/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(mockRestClient.createSession).toHaveBeenCalledWith({
        title: 'Test Session',
        rootDirectory: '/test/path',
        baseBranch: 'develop',
      });
    });
  });

  it('should close dialog after successful creation', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <NewSessionDialog open={true} onOpenChange={mockOnOpenChange} client={mockRestClient} />
    );

    const titleInput = screen.getByLabelText(/title/i);
    const directoryInput = screen.getByLabelText(/root directory/i);

    await user.type(titleInput, 'Test Session');
    await user.type(directoryInput, '/test/path');

    const createButton = screen.getByRole('button', { name: /create/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('should reset form after successful creation', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithClient(
      <NewSessionDialog open={true} onOpenChange={mockOnOpenChange} client={mockRestClient} />
    );

    const titleInput = screen.getByLabelText(/title/i);
    const directoryInput = screen.getByLabelText(/root directory/i);

    await user.type(titleInput, 'Test Session');
    await user.type(directoryInput, '/test/path');

    const createButton = screen.getByRole('button', { name: /create/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    // Reopen dialog
    rerender(
      <QueryClientProvider client={queryClient}>
        <NewSessionDialog open={true} onOpenChange={mockOnOpenChange} client={mockRestClient} />
      </QueryClientProvider>
    );

    const newTitleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
    const newDirectoryInput = screen.getByLabelText(/root directory/i) as HTMLInputElement;

    expect(newTitleInput.value).toBe('');
    expect(newDirectoryInput.value).toBe('');
  });

  it('should show error message on creation failure', async () => {
    const user = userEvent.setup();
    vi.mocked(mockRestClient.createSession).mockRejectedValue(
      new Error('Failed to create session')
    );

    renderWithClient(
      <NewSessionDialog open={true} onOpenChange={mockOnOpenChange} client={mockRestClient} />
    );

    const titleInput = screen.getByLabelText(/title/i);
    const directoryInput = screen.getByLabelText(/root directory/i);

    await user.type(titleInput, 'Test Session');
    await user.type(directoryInput, '/test/path');

    const createButton = screen.getByRole('button', { name: /create/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to create session/i)).toBeInTheDocument();
    });
  });

  it('should disable create button while creating', async () => {
    const user = userEvent.setup();
    vi.mocked(mockRestClient.createSession).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockSession), 1000))
    );

    renderWithClient(
      <NewSessionDialog open={true} onOpenChange={mockOnOpenChange} client={mockRestClient} />
    );

    const titleInput = screen.getByLabelText(/title/i);
    const directoryInput = screen.getByLabelText(/root directory/i);

    await user.type(titleInput, 'Test Session');
    await user.type(directoryInput, '/test/path');

    const createButton = screen.getByRole('button', { name: /create/i });
    await user.click(createButton);

    expect(createButton).toBeDisabled();
  });
});
