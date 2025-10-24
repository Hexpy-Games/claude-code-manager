/**
 * MessageList Component
 *
 * Displays list of messages with avatars and scroll area
 */

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Message } from '@/services/api/types';
import { Bot, User } from 'lucide-react';
import { ToolCallDisplay } from './ToolCallDisplay';

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>No messages yet. Start a conversation!</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn('flex gap-3', message.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            {message.role === 'assistant' && (
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            )}
            <div
              className={cn(
                'max-w-[80%] rounded-lg p-3',
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              )}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              <ToolCallDisplay toolCalls={message.toolCalls} />
              <p className="text-xs opacity-70 mt-2">
                {new Date(message.timestamp).toLocaleTimeString()}
              </p>
            </div>
            {message.role === 'user' && (
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary">
                  <User className="h-4 w-4 text-primary-foreground" />
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
