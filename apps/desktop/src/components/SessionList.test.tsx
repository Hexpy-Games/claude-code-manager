/**
 * SessionList Component Tests
 */

import { RestClient } from '@/services/api/rest-client';
import type { Session } from '@/services/api/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionList } from './SessionList';

// Mock RestClient
vi.mock('@/services/api/rest-client');

describe('SessionList', () => {
  let queryClient: QueryClient;
  let mockRestClient: RestClient;

  const mockSessions: Session[] = [
    {
      id: 'sess_1',
      title: 'Session 1',
      rootDirectory: '/test1',
      branchName: 'session/test1',
      baseBranch: 'main',
      gitStatus: null,
      createdAt: Date.now() - 3000,
      updatedAt: Date.now() - 3000,
      lastMessageAt: null,
      metadata: null,
      isActive: false,
    },
    {
      id: 'sess_2',
      title: 'Session 2',
      rootDirectory: '/test2',
      branchName: 'session/test2',
      baseBranch: 'main',
      gitStatus: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastMessageAt: null,
      metadata: null,
      isActive: true,
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockRestClient = new RestClient();
    vi.mocked(mockRestClient.listSessions).mockResolvedValue(mockSessions);
    vi.mocked(mockRestClient.switchSession).mockImplementation(async (id: string) => {
      const session = mockSessions.find((s) => s.id === id);
      if (!session) throw new Error('Session not found');
      return { ...session, isActive: true };
    });
    vi.mocked(mockRestClient.deleteSession).mockResolvedValue();
  });

  function renderWithClient(ui: React.ReactElement) {
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  }

  it('should render loading state initially', () => {
    const { container } = renderWithClient(<SessionList client={mockRestClient} />);
    // Check for skeleton loading states
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render sessions after loading', async () => {
    renderWithClient(<SessionList client={mockRestClient} />);

    await waitFor(() => {
      expect(screen.getByText('Session 1')).toBeInTheDocument();
    });

    expect(screen.getByText('Session 2')).toBeInTheDocument();
  });

  it('should render sessions sorted by updatedAt descending', async () => {
    renderWithClient(<SessionList client={mockRestClient} />);

    await waitFor(() => {
      expect(screen.getByText('Session 1')).toBeInTheDocument();
    });

    // Session 2 is newer, so check it appears before Session 1 in the DOM
    const session1Element = screen.getByText('Session 1');
    const session2Element = screen.getByText('Session 2');

    // Compare positions - Session 2 should come before Session 1 in document order
    expect(
      session2Element.compareDocumentPosition(session1Element) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('should render "New" button', async () => {
    renderWithClient(<SessionList client={mockRestClient} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /new/i })).toBeInTheDocument();
    });
  });

  it('should show empty state when no sessions', async () => {
    vi.mocked(mockRestClient.listSessions).mockResolvedValue([]);

    renderWithClient(<SessionList client={mockRestClient} />);

    await waitFor(() => {
      expect(screen.getByText(/no sessions/i)).toBeInTheDocument();
    });
  });

  it('should show error state when fetch fails', async () => {
    vi.mocked(mockRestClient.listSessions).mockRejectedValue(new Error('Network error'));

    renderWithClient(<SessionList client={mockRestClient} />);

    await waitFor(() => {
      expect(screen.getByText('Error loading sessions')).toBeInTheDocument();
    });
  });

  it('should call switchSession when session item clicked', async () => {
    const user = userEvent.setup();
    renderWithClient(<SessionList client={mockRestClient} />);

    await waitFor(() => {
      expect(screen.getByText('Session 1')).toBeInTheDocument();
    });

    // Click on Session 1 card (not active)
    const session1Card = screen.getByText('Session 1').closest('[class*="cursor-pointer"]');
    if (session1Card) {
      await user.click(session1Card);

      await waitFor(() => {
        expect(mockRestClient.switchSession).toHaveBeenCalledWith('sess_1');
      });
    }
  });

  it('should show confirmation dialog before delete', async () => {
    const user = userEvent.setup();
    renderWithClient(<SessionList client={mockRestClient} />);

    await waitFor(() => {
      expect(screen.getByText('Session 1')).toBeInTheDocument();
    });

    // Find and click the dropdown menu trigger button (first one, not expanded)
    const dropdownButtons = screen.getAllByRole('button', { expanded: false });
    await user.click(dropdownButtons[0]);

    // Click the delete menu item
    const deleteMenuItem = await screen.findByRole('menuitem', { name: /delete session/i });
    await user.click(deleteMenuItem);

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });
  });

  it('should delete session after confirmation', async () => {
    const user = userEvent.setup();
    renderWithClient(<SessionList client={mockRestClient} />);

    await waitFor(() => {
      expect(screen.getByText('Session 1')).toBeInTheDocument();
    });

    // Open dropdown menu
    const dropdownButtons = screen.getAllByRole('button', { expanded: false });
    await user.click(dropdownButtons[0]);

    // Click delete menu item
    const deleteMenuItem = await screen.findByRole('menuitem', { name: /delete session/i });
    await user.click(deleteMenuItem);

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /delete/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockRestClient.deleteSession).toHaveBeenCalledWith('sess_2', false);
    });
  });

  it('should cancel delete when cancel clicked', async () => {
    const user = userEvent.setup();
    renderWithClient(<SessionList client={mockRestClient} />);

    await waitFor(() => {
      expect(screen.getByText('Session 1')).toBeInTheDocument();
    });

    // Open dropdown menu
    const dropdownButtons = screen.getAllByRole('button', { expanded: false });
    await user.click(dropdownButtons[0]);

    // Click delete menu item
    const deleteMenuItem = await screen.findByRole('menuitem', { name: /delete session/i });
    await user.click(deleteMenuItem);

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    expect(mockRestClient.deleteSession).not.toHaveBeenCalled();
  });

  it('should refetch sessions after successful switch', async () => {
    const user = userEvent.setup();
    renderWithClient(<SessionList client={mockRestClient} />);

    await waitFor(() => {
      expect(screen.getByText('Session 1')).toBeInTheDocument();
    });

    // Clear the mock call count
    vi.clearAllMocks();

    // Click Session 1 card (not active)
    const session1Card = screen.getByText('Session 1').closest('[class*="cursor-pointer"]');
    if (session1Card) {
      await user.click(session1Card);

      await waitFor(() => {
        expect(mockRestClient.listSessions).toHaveBeenCalled();
      });
    }
  });

  it('should refetch sessions after successful delete', async () => {
    const user = userEvent.setup();
    renderWithClient(<SessionList client={mockRestClient} />);

    await waitFor(() => {
      expect(screen.getByText('Session 1')).toBeInTheDocument();
    });

    // Clear the mock call count
    vi.clearAllMocks();

    // Open dropdown menu
    const dropdownButtons = screen.getAllByRole('button', { expanded: false });
    await user.click(dropdownButtons[0]);

    // Click delete menu item
    const deleteMenuItem = await screen.findByRole('menuitem', { name: /delete session/i });
    await user.click(deleteMenuItem);

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /delete/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockRestClient.listSessions).toHaveBeenCalled();
    });
  });

  it('should open new session dialog when new button clicked', async () => {
    const user = userEvent.setup();
    renderWithClient(<SessionList client={mockRestClient} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /new/i })).toBeInTheDocument();
    });

    const newButton = screen.getByRole('button', { name: /new/i });
    await user.click(newButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
