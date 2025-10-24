/**
 * MessageInput Component
 *
 * Message input with send button using shadcn/ui components
 */

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    const trimmed = message.trim();
    if (trimmed) {
      onSend(trimmed);
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-2 p-4 border-t bg-background">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message... (Shift+Enter for new line, Enter to send)"
        disabled={disabled}
        className="flex-1 resize-none min-h-[60px] max-h-[200px]"
        rows={2}
      />
      <Button
        onClick={handleSend}
        disabled={disabled || !message.trim()}
        className="self-end"
        size="icon"
        aria-label="Send"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
