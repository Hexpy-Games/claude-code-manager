/**
 * ChatInterface Component
 *
 * Main chat interface container with header and loading states
 */

import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import type { RestClient } from '@/services/api/rest-client';
import type { Message, StreamMessage } from '@/services/api/types';
import { WebSocketClient } from '@/services/api/websocket-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';

interface ChatInterfaceProps {
  sessionId: string | null;
  client: RestClient;
  wsBaseUrl?: string;
}

export function ChatInterface({ sessionId, client, wsBaseUrl = 'ws://localhost:3000/api' }: ChatInterfaceProps) {
  const queryClient = useQueryClient();
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<Message | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  const wsClientRef = useRef<WebSocketClient | null>(null);
  const streamingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStreamingRef = useRef(false);
  const streamingCompleteRef = useRef(false);
  const contentBufferRef = useRef('');
  const renderDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRenderTimeRef = useRef<number>(0);

  // Load draft message from localStorage when session changes
  useEffect(() => {
    if (!sessionId) {
      setDraftMessage('');
      return;
    }

    const draftKey = `draft_${sessionId}`;
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      setDraftMessage(savedDraft);
    } else {
      setDraftMessage('');
    }
  }, [sessionId]);

  // Save draft message to localStorage when it changes
  useEffect(() => {
    if (!sessionId) return;

    const draftKey = `draft_${sessionId}`;
    if (draftMessage) {
      localStorage.setItem(draftKey, draftMessage);
    } else {
      localStorage.removeItem(draftKey);
    }
  }, [draftMessage, sessionId]);

  // Helper function to clear streaming state and refresh
  const clearStreamingState = () => {
    isStreamingRef.current = false;
    setIsStreaming(false);
    streamingCompleteRef.current = false;
    contentBufferRef.current = '';
    lastRenderTimeRef.current = 0;

    // Clear any pending timers
    if (streamingTimeoutRef.current) {
      clearTimeout(streamingTimeoutRef.current);
      streamingTimeoutRef.current = null;
    }
    if (renderDebounceRef.current) {
      clearTimeout(renderDebounceRef.current);
      renderDebounceRef.current = null;
    }

    // Clear optimistic state
    setOptimisticMessages([]);
    setStreamingMessage(null);

    // Invalidate and refetch messages from server
    if (sessionId) {
      queryClient.invalidateQueries({ queryKey: ['messages', sessionId] });
    }
  };

  // Handle stop/interrupt streaming (like Claude Code CLI ESC/Ctrl+C)
  const handleStopStreaming = () => {
    if (!isStreamingRef.current) {
      return;
    }

    // Mark as complete to prevent further processing
    streamingCompleteRef.current = true;
    isStreamingRef.current = false;
    setIsStreaming(false);

    // Flush any remaining buffered content before stopping
    if (renderDebounceRef.current) {
      clearTimeout(renderDebounceRef.current);
      renderDebounceRef.current = null;
    }
    flushBufferAndUpdate();

    // Clear the timeout that would force a refresh
    if (streamingTimeoutRef.current) {
      clearTimeout(streamingTimeoutRef.current);
      streamingTimeoutRef.current = null;
    }

    // Disconnect WebSocket - server will stop streaming when connection closes
    if (wsClientRef.current) {
      wsClientRef.current.disconnect();
    }

    // Wait for backend to save partial content, then refetch to get saved version
    // DON'T clear optimistic messages yet - keep them visible!
    setTimeout(() => {
      if (sessionId) {
        // Get current server message count before refetch
        const currentServerMessages = queryClient.getQueryData<Message[]>(['messages', sessionId]) || [];
        const serverMessageCountBefore = currentServerMessages.length;

        queryClient.refetchQueries({ queryKey: ['messages', sessionId] }).then((results) => {
          // Get the refetched messages
          const refetchResult = results?.[0];
          const refetchedMessages = (refetchResult?.data as Message[]) || [];

          // Only clear optimistic state if server saved new messages (count increased)
          if (refetchedMessages.length > serverMessageCountBefore) {
            setOptimisticMessages([]);
            setStreamingMessage(null);
            contentBufferRef.current = '';
            lastRenderTimeRef.current = 0;
          }

          // Reconnect WebSocket for next message
          const wsClient = wsClientRef.current;
          if (wsClient && sessionId) {
            wsClient.connect(sessionId).catch((error) => {
              console.error('[ChatInterface] Failed to reconnect WebSocket:', error);
            });
          }
        }).catch((error) => {
          console.error('[ChatInterface] Refetch failed after interrupt:', error);
          // Even if refetch fails, reconnect WebSocket
          const wsClient = wsClientRef.current;
          if (wsClient && sessionId) {
            wsClient.connect(sessionId).catch((err) => {
              console.error('[ChatInterface] Failed to reconnect WebSocket:', err);
            });
          }
        });
      }
    }, 1000); // Longer delay (1 second) to ensure backend has time to save
  };

  // Flush buffer and update UI with final content
  const flushBufferAndUpdate = () => {
    const finalContent = contentBufferRef.current;
    if (!finalContent) return;

    setStreamingMessage((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        content: finalContent,
      };
    });
  };

  // Initialize WebSocket client
  useEffect(() => {
    if (!sessionId) return;

    const wsClient = new WebSocketClient({
      baseUrl: wsBaseUrl,
    });

    wsClient.onMessage((msg: StreamMessage) => {
      if (msg.type === 'content_chunk' && msg.content) {
        // Append to buffer
        contentBufferRef.current += msg.content;

        // Throttle rendering: update immediately if 100ms has passed, otherwise debounce for 16ms
        const now = Date.now();
        const timeSinceLastRender = now - lastRenderTimeRef.current;
        const shouldRenderImmediately = timeSinceLastRender >= 100;

        if (renderDebounceRef.current) {
          clearTimeout(renderDebounceRef.current);
        }

        if (shouldRenderImmediately) {
          lastRenderTimeRef.current = now;
          flushBufferAndUpdate();
        } else {
          renderDebounceRef.current = setTimeout(() => {
            lastRenderTimeRef.current = Date.now();
            flushBufferAndUpdate();
          }, 16); // ~60fps debounce
        }
      } else if (msg.type === 'done') {
        console.log('[ChatInterface] Received done event from WebSocket');

        // Mark streaming as complete
        streamingCompleteRef.current = true;

        // Flush any remaining content immediately
        if (renderDebounceRef.current) {
          clearTimeout(renderDebounceRef.current);
          renderDebounceRef.current = null;
        }
        flushBufferAndUpdate();

        // Refetch messages from server to get saved versions
        console.log('[ChatInterface] Streaming complete, refreshing messages from server');
        if (sessionId) {
          queryClient.invalidateQueries({ queryKey: ['messages', sessionId] }).then(() => {
            console.log('[ChatInterface] Messages refetched, clearing optimistic state');

            // Clear optimistic state after successful refetch
            setOptimisticMessages([]);
            setStreamingMessage(null);
            isStreamingRef.current = false;
            setIsStreaming(false);
            streamingCompleteRef.current = false;
            contentBufferRef.current = '';
            lastRenderTimeRef.current = 0;

            // Clear timeouts
            if (streamingTimeoutRef.current) {
              clearTimeout(streamingTimeoutRef.current);
              streamingTimeoutRef.current = null;
            }
          });
        }
      } else if (msg.type === 'error') {
        // Handle error
        console.error('[ChatInterface] Streaming error:', msg.message);
        streamingCompleteRef.current = true;

        // Save partial content if it exists
        flushBufferAndUpdate();

        // Clear after showing error
        setTimeout(() => clearStreamingState(), 1000);
      }
    });

    // Handle WebSocket close
    wsClient.onClose((code, reason) => {
      console.log(`[ChatInterface] WebSocket closed: ${code} - ${reason}`);

      // Only force refresh if we were streaming AND it didn't complete normally
      if (isStreamingRef.current && !streamingCompleteRef.current) {
        console.log('[ChatInterface] WebSocket closed during streaming, forcing refresh');
        clearStreamingState();
      }
    });

    // Handle WebSocket errors
    wsClient.onError((error) => {
      console.error('[ChatInterface] WebSocket error:', error);
    });

    console.log(`[ChatInterface] 🔌 Connecting WebSocket to session: ${sessionId}`);
    wsClient.connect(sessionId).then(() => {
      console.log('[ChatInterface] ✅ WebSocket connection established');
    }).catch((error) => {
      console.error('[ChatInterface] ❌ WebSocket connection failed:', error);
    });

    wsClientRef.current = wsClient;

    return () => {
      wsClient.disconnect();
      // Clear any pending timeouts
      if (streamingTimeoutRef.current) {
        clearTimeout(streamingTimeoutRef.current);
        streamingTimeoutRef.current = null;
      }
      if (renderDebounceRef.current) {
        clearTimeout(renderDebounceRef.current);
        renderDebounceRef.current = null;
      }
    };
  }, [sessionId, wsBaseUrl, queryClient]);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', sessionId],
    queryFn: () => (sessionId ? client.getMessages(sessionId) : []),
    enabled: !!sessionId,
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!sessionId) throw new Error('No session selected');
      if (!wsClientRef.current?.isConnected()) {
        throw new Error('WebSocket not connected');
      }

      // Reset streaming state and clear any previous optimistic messages from interrupted streams
      isStreamingRef.current = true;
      setIsStreaming(true);
      streamingCompleteRef.current = false;
      contentBufferRef.current = '';
      lastRenderTimeRef.current = 0;
      console.log('[ChatInterface] Sending message via WebSocket');
      console.log('[ChatInterface] Clearing any previous optimistic messages');

      // Clear previous optimistic messages and streaming message from interrupted streams
      setOptimisticMessages([]);
      setStreamingMessage(null);

      // Add optimistic user message immediately
      const optimisticUserMessage: Message = {
        id: `temp-${Date.now()}`,
        sessionId,
        role: 'user',
        content,
        toolCalls: null,
        timestamp: Date.now(),
      };
      setOptimisticMessages([optimisticUserMessage]);

      // Start streaming assistant response
      const streamingAssistantMessage: Message = {
        id: `streaming-${Date.now()}`,
        sessionId,
        role: 'assistant',
        content: '',
        toolCalls: null,
        timestamp: Date.now(),
      };
      console.log('[ChatInterface] 🤖 Creating streaming assistant message with id:', streamingAssistantMessage.id);
      setStreamingMessage(streamingAssistantMessage);
      console.log('[ChatInterface] ✅ Streaming message state set');

      // Set timeout to force refresh if streaming takes too long (60 seconds)
      streamingTimeoutRef.current = setTimeout(() => {
        console.warn('[ChatInterface] Streaming timeout reached, forcing refresh');
        streamingCompleteRef.current = true;
        clearStreamingState();
      }, 60000);

      // Send message via WebSocket (not HTTP!)
      console.log('[ChatInterface] 📤 Sending message via WebSocket:', content.substring(0, 100));
      wsClientRef.current.sendMessage(content);
      console.log('[ChatInterface] ✅ WebSocket send called successfully');

      // Return a promise that resolves when done
      return new Promise((resolve) => {
        // The mutation will complete when WebSocket 'done' event fires
        // For now, resolve immediately since WebSocket handles everything
        resolve({ success: true });
      });
    },
    onSuccess: async () => {
      console.log('[ChatInterface] Message sent via WebSocket, waiting for response stream');
      // Message sent via WebSocket
      // Response will come as streaming chunks
      // Wait for 'done' event before clearing optimistic state
    },
    onError: (error) => {
      console.error('[ChatInterface] Message send failed:', error);

      // IMPORTANT: Even on timeout/error, refetch messages from server
      // Backend might have succeeded even if HTTP request timed out
      if (sessionId) {
        console.log('[ChatInterface] Error occurred, but refetching to check if backend succeeded');
        queryClient.invalidateQueries({ queryKey: ['messages', sessionId] }).then(() => {
          console.log('[ChatInterface] Messages refetched after error');
        });
      }

      // Clear optimistic state after refetch starts
      setTimeout(() => {
        isStreamingRef.current = false;
        setIsStreaming(false);
        streamingCompleteRef.current = false;
        contentBufferRef.current = '';
        lastRenderTimeRef.current = 0;
        setOptimisticMessages([]);
        setStreamingMessage(null);
        if (streamingTimeoutRef.current) {
          clearTimeout(streamingTimeoutRef.current);
          streamingTimeoutRef.current = null;
        }
        if (renderDebounceRef.current) {
          clearTimeout(renderDebounceRef.current);
          renderDebounceRef.current = null;
        }
      }, 500); // Small delay to let refetch complete
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
        <MessageList
          messages={[...messages, ...optimisticMessages, ...(streamingMessage ? [streamingMessage] : [])]}
          streamingMessageId={streamingMessage?.id}
          sessionId={sessionId}
        />
      )}

      {/* Message Input */}
      <MessageInput
        value={draftMessage}
        onChange={setDraftMessage}
        onSend={(msg) => {
          sendMutation.mutate(msg);
          setDraftMessage(''); // Clear draft after sending
        }}
        onStop={handleStopStreaming}
        disabled={sendMutation.isPending}
        isStreaming={isStreaming}
      />
    </div>
  );
}
