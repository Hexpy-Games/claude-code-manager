/**
 * SessionList Component Tests
 */

import { RestClient } from '@/services/api/rest-client';
import type { Session } from '@/services/api/types';
import { useSessionStore } from '@/stores/sessionStore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionList } from './SessionList';

// Mock RestClient
vi.mock('@/services/api/rest-client');

// Mock @tanstack/react-virtual for testing
// In tests, we don't have real viewport dimensions, so we render all items
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 88,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        start: index * 88,
        size: 88,
        end: (index + 1) * 88,
        key: index,
      })),
  }),
}));

describe('SessionList', () => {
  let queryClient: QueryClient;
  let mockRestClient: RestClient;
  let mockSessions: Session[];

  const createMockSessions = (): Session[] => [
    {
      id: 'sess_1',
      title: 'Session 1',
      rootDirectory: '/test1',
      workspacePath: '/tmp/claude-sessions/sess_1/test1',
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
      workspacePath: '/tmp/claude-sessions/sess_2/test2',
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
    // Reset mock sessions for each test
    mockSessions = createMockSessions();

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockRestClient = new RestClient();
    vi.mocked(mockRestClient.listSessions).mockImplementation(async () => mockSessions);
    vi.mocked(mockRestClient.switchSession).mockImplementation(async (id: string) => {
      const session = mockSessions.find((s) => s.id === id);
      if (!session) throw new Error('Session not found');
      return { ...session, isActive: true };
    });
    vi.mocked(mockRestClient.deleteSession).mockImplementation(async (id: string) => {
      // Actually remove the session from the array
      const index = mockSessions.findIndex((s) => s.id === id);
      if (index !== -1) {
        mockSessions.splice(index, 1);
      }
    });

    // Reset store state to initial values
    const store = useSessionStore.getState();
    store.setActiveSessionId(null);
    store.setSessions([]);
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

  it('should clear active session when deleting active session', async () => {
    const user = userEvent.setup();
    const { result } = renderHook(() => useSessionStore());

    renderWithClient(<SessionList client={mockRestClient} />);

    await waitFor(() => {
      expect(screen.getByText('Session 2')).toBeInTheDocument();
    });

    // Session 2 is active (isActive: true in mockSessions)
    // Open dropdown for Session 2 (the second item in the list after sorting)
    const dropdownButtons = screen.getAllByRole('button', { expanded: false });
    await user.click(dropdownButtons[0]);

    // Click delete
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

    // Active session should be cleared
    await waitFor(() => {
      expect(result.current.activeSessionId).toBeNull();
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

  describe('Virtual Scrolling', () => {
    it('should use virtual scrolling for large session lists', async () => {
      // Create 100 sessions to test virtual scrolling
      const largeMockSessions: Session[] = Array.from({ length: 100 }, (_, i) => ({
        id: `sess_${i}`,
        title: `Session ${i}`,
        rootDirectory: `/test${i}`,
        workspacePath: `/tmp/claude-sessions/sess_${i}/test${i}`,
        branchName: `session/test${i}`,
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now() - i * 1000,
        updatedAt: Date.now() - i * 1000,
        lastMessageAt: null,
        metadata: null,
        isActive: i === 0,
      }));

      vi.mocked(mockRestClient.listSessions).mockResolvedValue(largeMockSessions);

      const { container } = renderWithClient(<SessionList client={mockRestClient} />);

      await waitFor(() => {
        expect(screen.getByText('Session 0')).toBeInTheDocument();
      });

      // Verify virtual scrolling attributes are present
      // All items should have data-index for virtual positioning
      const allSessionItems = container.querySelectorAll('[data-index]');
      expect(allSessionItems.length).toBeGreaterThan(0);

      // Verify first item has correct virtual scrolling attributes
      const firstItem = container.querySelector('[data-index="0"]');
      expect(firstItem).toBeInTheDocument();
      expect(firstItem).toHaveAttribute('data-index', '0');
    });

    it('should have virtual list container with proper height', async () => {
      const largeMockSessions: Session[] = Array.from({ length: 50 }, (_, i) => ({
        id: `sess_${i}`,
        title: `Session ${i}`,
        rootDirectory: `/test${i}`,
        workspacePath: `/tmp/claude-sessions/sess_${i}/test${i}`,
        branchName: `session/test${i}`,
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now() - i * 1000,
        updatedAt: Date.now() - i * 1000,
        lastMessageAt: null,
        metadata: null,
        isActive: i === 0,
      }));

      vi.mocked(mockRestClient.listSessions).mockResolvedValue(largeMockSessions);

      const { container } = renderWithClient(<SessionList client={mockRestClient} />);

      await waitFor(() => {
        expect(screen.getByText('Session 0')).toBeInTheDocument();
      });

      // Virtual list should have a container with calculated total height
      const virtualContainer = container.querySelector('[style*="height"]');
      expect(virtualContainer).toBeInTheDocument();
    });

    it('should render items with virtual positioning', async () => {
      const largeMockSessions: Session[] = Array.from({ length: 30 }, (_, i) => ({
        id: `sess_${i}`,
        title: `Session ${i}`,
        rootDirectory: `/test${i}`,
        workspacePath: `/tmp/claude-sessions/sess_${i}/test${i}`,
        branchName: `session/test${i}`,
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now() - i * 1000,
        updatedAt: Date.now() - i * 1000,
        lastMessageAt: null,
        metadata: null,
        isActive: i === 0,
      }));

      vi.mocked(mockRestClient.listSessions).mockResolvedValue(largeMockSessions);

      const { container } = renderWithClient(<SessionList client={mockRestClient} />);

      await waitFor(() => {
        expect(screen.getByText('Session 0')).toBeInTheDocument();
      });

      // Virtual items should have transform style for positioning
      const virtualItems = container.querySelectorAll('[style*="transform"]');
      expect(virtualItems.length).toBeGreaterThan(0);
    });

    it('should maintain functionality with small lists', async () => {
      // Virtual scrolling should not break functionality with small lists
      renderWithClient(<SessionList client={mockRestClient} />);

      await waitFor(() => {
        expect(screen.getByText('Session 1')).toBeInTheDocument();
      });

      // Both sessions should be visible
      expect(screen.getByText('Session 1')).toBeInTheDocument();
      expect(screen.getByText('Session 2')).toBeInTheDocument();
    });
  });
});
