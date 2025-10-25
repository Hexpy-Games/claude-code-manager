/**
 * MessageInput Component
 *
 * Message input with send button using shadcn/ui components
 * - Shows Send button when idle
 * - Shows Stop button when streaming (can be triggered via button or ESC key)
 */

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, StopCircle } from 'lucide-react';
import type React from 'react';
import { useState, useEffect } from 'react';

interface MessageInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled: boolean;
  isStreaming?: boolean;
}

export function MessageInput({ onSend, onStop, disabled, isStreaming = false }: MessageInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    const trimmed = message.trim();
    if (trimmed) {
      onSend(trimmed);
      setMessage('');
    }
  };

  const handleStop = () => {
    console.log('[MessageInput] 🛑 Stop button clicked');
    onStop?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // ESC to stop streaming (like Claude Code CLI)
    if (e.key === 'Escape' && isStreaming) {
      e.preventDefault();
      console.log('[MessageInput] ⌨️ ESC pressed - stopping stream');
      handleStop();
      return;
    }

    // Enter to send (Shift+Enter for new line)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming) {
        handleSend();
      }
    }
  };

  // Global ESC key handler (works even when textarea not focused)
  useEffect(() => {
    if (!isStreaming) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        console.log('[MessageInput] ⌨️ Global ESC pressed - stopping stream');
        handleStop();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isStreaming, onStop]);

  return (
    <div className="flex gap-2 p-4 border-t bg-background">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          isStreaming
            ? 'Streaming... Press ESC to stop'
            : 'Type a message... (Shift+Enter for new line, Enter to send)'
        }
        disabled={disabled && !isStreaming}
        className="flex-1 resize-none min-h-[60px] max-h-[200px]"
        rows={2}
      />
      {isStreaming ? (
        <Button
          onClick={handleStop}
          className="self-end bg-destructive hover:bg-destructive/90"
          size="icon"
          aria-label="Stop streaming"
          title="Stop streaming (ESC)"
        >
          <StopCircle className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          onClick={handleSend}
          disabled={disabled || !message.trim()}
          className="self-end"
          size="icon"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
