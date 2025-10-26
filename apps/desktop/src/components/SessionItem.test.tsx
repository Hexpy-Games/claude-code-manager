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
    render(<SessionItem session={mockSession} isActive={false} onSwitch={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Test Session')).toBeInTheDocument();
  });

  it('should render root directory', () => {
    render(<SessionItem session={mockSession} isActive={false} onSwitch={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/\/test\/path/)).toBeInTheDocument();
  });

  it('should render as Item component with correct data attributes', () => {
    const { container } = render(
      <SessionItem session={mockSession} isActive={false} onSwitch={vi.fn()} onDelete={vi.fn()} />
    );

    const itemElement = container.querySelector('[data-slot="item"]');
    expect(itemElement).toBeInTheDocument();
  });

  it('should show active state through background styling only (no badge)', () => {
    const { container } = render(
      <SessionItem session={mockSession} isActive={true} onSwitch={vi.fn()} onDelete={vi.fn()} />
    );

    // Active state shown via background color, not a badge
    const activeIndicator = screen.queryByText(/active/i);
    expect(activeIndicator).not.toBeInTheDocument();

    // Verify background styling is applied
    const itemElement = container.querySelector('[data-slot="item"]');
    expect(itemElement?.className).toContain('bg-primary/10');
  });

  it('should apply hover styling for inactive items', () => {
    const { container } = render(
      <SessionItem session={mockSession} isActive={false} onSwitch={vi.fn()} onDelete={vi.fn()} />
    );

    const itemElement = container.querySelector('[data-slot="item"]');
    expect(itemElement?.className).toContain('hover:bg-muted/50');
  });

  it('should call onSwitch when item clicked and not active', async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();

    const { container } = render(
      <SessionItem session={mockSession} isActive={false} onSwitch={onSwitch} onDelete={vi.fn()} />
    );

    const itemElement = container.querySelector('[data-slot="item"]');
    if (itemElement) {
      await user.click(itemElement);
      expect(onSwitch).toHaveBeenCalledWith(mockSession.id);
    }
  });

  it('should not call onSwitch when clicked and already active', async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();

    const { container } = render(
      <SessionItem session={mockSession} isActive={true} onSwitch={onSwitch} onDelete={vi.fn()} />
    );

    const itemElement = container.querySelector('[data-slot="item"]');
    if (itemElement) {
      await user.click(itemElement);
      expect(onSwitch).not.toHaveBeenCalled();
    }
  });

  it('should render dropdown menu button', () => {
    render(<SessionItem session={mockSession} isActive={false} onSwitch={vi.fn()} onDelete={vi.fn()} />);

    // Look for the dropdown menu trigger button
    const menuButton = screen.getByRole('button', { expanded: false });
    expect(menuButton).toBeInTheDocument();
  });

  it('should call onDelete when delete menu item clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    render(<SessionItem session={mockSession} isActive={false} onSwitch={vi.fn()} onDelete={onDelete} />);

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

    render(<SessionItem session={mockSession} isActive={false} onSwitch={onSwitch} onDelete={vi.fn()} />);

    // Click dropdown menu button should not trigger onSwitch
    const menuButton = screen.getByRole('button', { expanded: false });
    await user.click(menuButton);

    expect(onSwitch).not.toHaveBeenCalled();
  });
});
