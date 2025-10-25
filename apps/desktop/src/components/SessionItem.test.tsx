/**
 * SessionItem Component Tests
 */

import type { Session } from '@/services/api/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SessionItem } from './SessionItem';

describe('SessionItem', () => {
  const mockSession: Session = {
    id: 'sess_123',
    title: 'Test Session',
    rootDirectory: '/test/path',
      workspacePath: '/tmp/claude-sessions/test/path',
    branchName: 'session/test',
    baseBranch: 'main',
    gitStatus: null,
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 1800000,
    lastMessageAt: Date.now() - 1800000,
    metadata: null,
    isActive: false,
  };

  it('should render session title', () => {
    render(<SessionItem session={mockSession} onSwitch={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Test Session')).toBeInTheDocument();
  });

  it('should render root directory', () => {
    render(<SessionItem session={mockSession} onSwitch={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/\/test\/path/)).toBeInTheDocument();
  });

  it('should show active indicator when isActive is true', () => {
    const activeSession = { ...mockSession, isActive: true };
    render(<SessionItem session={activeSession} onSwitch={vi.fn()} onDelete={vi.fn()} />);

    const activeIndicator = screen.getByText(/active/i);
    expect(activeIndicator).toBeInTheDocument();
  });

  it('should not show active indicator when isActive is false', () => {
    render(<SessionItem session={mockSession} onSwitch={vi.fn()} onDelete={vi.fn()} />);

    const activeIndicator = screen.queryByText(/active/i);
    expect(activeIndicator).not.toBeInTheDocument();
  });

  it('should call onSwitch when card clicked and not active', async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();

    const { container } = render(<SessionItem session={mockSession} onSwitch={onSwitch} onDelete={vi.fn()} />);

    // Click the card (not the dropdown menu button)
    const card = container.querySelector('[class*="cursor-pointer"]');
    if (card) {
      await user.click(card);
      expect(onSwitch).toHaveBeenCalledWith(mockSession.id);
    }
  });

  it('should not call onSwitch when clicked and already active', async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();
    const activeSession = { ...mockSession, isActive: true };

    const { container } = render(<SessionItem session={activeSession} onSwitch={onSwitch} onDelete={vi.fn()} />);

    const card = container.querySelector('[class*="cursor-pointer"]');
    if (card) {
      await user.click(card);
      expect(onSwitch).not.toHaveBeenCalled();
    }
  });

  it('should render dropdown menu button', () => {
    render(<SessionItem session={mockSession} onSwitch={vi.fn()} onDelete={vi.fn()} />);

    // Look for the dropdown menu trigger button
    const menuButton = screen.getByRole('button', { expanded: false });
    expect(menuButton).toBeInTheDocument();
  });

  it('should call onDelete when delete menu item clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    render(<SessionItem session={mockSession} onSwitch={vi.fn()} onDelete={onDelete} />);

    // Open dropdown menu
    const menuButton = screen.getByRole('button', { expanded: false });
    await user.click(menuButton);

    // Click delete menu item
    const deleteMenuItem = await screen.findByRole('menuitem', { name: /delete session/i });
    await user.click(deleteMenuItem);

    expect(onDelete).toHaveBeenCalledWith(mockSession.id);
  });

  it('should stop propagation when dropdown menu clicked', async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();

    render(<SessionItem session={mockSession} onSwitch={onSwitch} onDelete={vi.fn()} />);

    // Click dropdown menu button should not trigger onSwitch
    const menuButton = screen.getByRole('button', { expanded: false });
    await user.click(menuButton);

    expect(onSwitch).not.toHaveBeenCalled();
  });
});
