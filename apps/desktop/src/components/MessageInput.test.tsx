/**
 * MessageInput Component Tests
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MessageInput } from './MessageInput';

describe('MessageInput', () => {
  it('should render textarea', () => {
    render(<MessageInput onSend={vi.fn()} disabled={false} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should render send button', () => {
    render(<MessageInput onSend={vi.fn()} disabled={false} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should call onSend with message when send clicked', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<MessageInput onSend={onSend} disabled={false} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Hello world');

    const sendButton = screen.getByRole('button');
    await user.click(sendButton);

    expect(onSend).toHaveBeenCalledWith('Hello world');
  });

  it('should clear input after sending', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSend={vi.fn()} disabled={false} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.type(textarea, 'Hello world');

    const sendButton = screen.getByRole('button');
    await user.click(sendButton);

    expect(textarea.value).toBe('');
  });

  it('should not call onSend with empty message', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<MessageInput onSend={onSend} disabled={false} />);

    const sendButton = screen.getByRole('button');
    await user.click(sendButton);

    expect(onSend).not.toHaveBeenCalled();
  });

  it('should not call onSend with whitespace-only message', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<MessageInput onSend={onSend} disabled={false} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, '   ');

    const sendButton = screen.getByRole('button');
    await user.click(sendButton);

    expect(onSend).not.toHaveBeenCalled();
  });

  it('should disable textarea when disabled prop is true', () => {
    render(<MessageInput onSend={vi.fn()} disabled={true} />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('should disable send button when disabled prop is true', () => {
    render(<MessageInput onSend={vi.fn()} disabled={true} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should send message on Enter key', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<MessageInput onSend={onSend} disabled={false} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Hello world{Enter}');

    expect(onSend).toHaveBeenCalledWith('Hello world');
  });

  it('should not send on Shift+Enter', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<MessageInput onSend={onSend} disabled={false} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Line 1{Shift>}{Enter}{/Shift}Line 2');

    expect(onSend).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('Line 1\nLine 2');
  });

  it('should have placeholder text', () => {
    render(<MessageInput onSend={vi.fn()} disabled={false} />);
    expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument();
  });
});
