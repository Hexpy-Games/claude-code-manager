/**
 * CopyButton Component Tests
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { CopyButton } from './copy-button';

describe('CopyButton', () => {
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

  it('should render copy button', () => {
    render(<CopyButton content="Test content" />);
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  it('should have accessible button with copy label', () => {
    render(<CopyButton content="Test content" />);

    const button = screen.getByRole('button', { name: /copy/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Copy');
  });

  it('should show checkmark after copying', async () => {
    const user = userEvent.setup();

    render(<CopyButton content="Test" />);

    const button = screen.getByRole('button', { name: /copy/i });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument();
    });
  });
});
