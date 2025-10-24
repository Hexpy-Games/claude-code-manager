/**
 * ChatInterface Component
 *
 * Main chat interface container with header and loading states
 */

import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import type { RestClient } from '@/services/api/rest-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';

interface ChatInterfaceProps {
  sessionId: string | null;
  client: RestClient;
}

export function ChatInterface({ sessionId, client }: ChatInterfaceProps) {
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', sessionId],
    queryFn: () => (sessionId ? client.getMessages(sessionId) : []),
    enabled: !!sessionId,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => {
      if (!sessionId) throw new Error('No session selected');
      return client.sendMessage(sessionId, content);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', sessionId] });
    },
  });

  if (!sessionId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
        <MessageCircle className="h-16 w-16 mb-4 opacity-20" />
        <p className="text-lg font-medium">No Session Selected</p>
        <p className="text-sm mt-2">Select a session from the sidebar to start chatting</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="p-4 shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Chat</h2>
        </div>
        <Separator />
      </div>

      {/* Messages Area */}
      {isLoading ? (
        <div className="flex-1 p-4 space-y-4">
          <div className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-20 w-3/4" />
          </div>
          <div className="flex gap-3 justify-end">
            <Skeleton className="h-20 w-3/4" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-32 w-3/4" />
          </div>
        </div>
      ) : (
        <MessageList messages={messages} />
      )}

      {/* Message Input */}
      <MessageInput onSend={(msg) => sendMutation.mutate(msg)} disabled={sendMutation.isPending} />
    </div>
  );
}
