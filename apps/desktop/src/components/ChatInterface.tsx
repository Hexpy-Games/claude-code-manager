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
import { useSessionStore } from '@/stores/sessionStore';
import { DEBOUNCE_TIMES } from '@/constants/timings';
import { getStorageItem, setStorageItem, removeStorageItem, sanitizeDraft } from '@/utils/storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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

  // Get session data from store
  const session = useSessionStore((state) =>
    state.sessions.find((s) => s.id === sessionId)
  );

  // Determine agent status
  const agentStatus = isStreaming ? 'Writing...' : 'Idle';

  // Load draft message from localStorage when session changes
  useEffect(() => {
    if (!sessionId) {
      setDraftMessage('');
      return;
    }

    const draftKey = `draft_${sessionId}`;
    const savedDraft = getStorageItem(draftKey);
    if (savedDraft) {
      setDraftMessage(savedDraft);
    } else {
      setDraftMessage('');
    }
  }, [sessionId]);

  // Save draft message to localStorage when it changes (with sanitization)
  useEffect(() => {
    if (!sessionId) return;

    const draftKey = `draft_${sessionId}`;
    if (draftMessage) {
      const sanitized = sanitizeDraft(draftMessage);
      setStorageItem(draftKey, sanitized);
    } else {
      removeStorageItem(draftKey);
    }
  }, [draftMessage, sessionId]);

  // Helper function to clear streaming state and refresh
  const clearStreamingState = useCallback(() => {
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
  }, [sessionId, queryClient]);

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
            wsClient.connect(sessionId).catch(() => {
              // WebSocket reconnection failed - will retry on next message
            });
          }
        }).catch(() => {
          // Refetch failed after interrupt - will retry on next action
          // Even if refetch fails, reconnect WebSocket
          const wsClient = wsClientRef.current;
          if (wsClient && sessionId) {
            wsClient.connect(sessionId).catch(() => {
              // WebSocket reconnection failed - will retry on next message
            });
          }
        });
      }
    }, DEBOUNCE_TIMES.INTERRUPT_REFETCH_DELAY_MS);
  };

  // Flush buffer and update UI with final content
  const flushBufferAndUpdate = useCallback(() => {
    const finalContent = contentBufferRef.current;
    if (!finalContent) return;

    setStreamingMessage((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        content: finalContent,
      };
    });
  }, []);

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

        // Throttle rendering: update immediately if MIN_RENDER_INTERVAL_MS has passed, otherwise debounce
        const now = Date.now();
        const timeSinceLastRender = now - lastRenderTimeRef.current;
        const shouldRenderImmediately = timeSinceLastRender >= DEBOUNCE_TIMES.MIN_RENDER_INTERVAL_MS;

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
          }, DEBOUNCE_TIMES.RENDER_THROTTLE_MS); // ~60fps debounce
        }
      } else if (msg.type === 'done') {
        // Mark streaming as complete
        streamingCompleteRef.current = true;

        // Flush any remaining content immediately
        if (renderDebounceRef.current) {
          clearTimeout(renderDebounceRef.current);
          renderDebounceRef.current = null;
        }
        flushBufferAndUpdate();

        // Refetch messages from server to get saved versions
        if (sessionId) {
          queryClient.invalidateQueries({ queryKey: ['messages', sessionId] }).then(() => {

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
        // Handle streaming error
        streamingCompleteRef.current = true;

        // Save partial content if it exists
        flushBufferAndUpdate();

        // Clear after showing error
        setTimeout(() => clearStreamingState(), DEBOUNCE_TIMES.INTERRUPT_REFETCH_DELAY_MS);
      }
    });

    // Handle WebSocket close
    wsClient.onClose(() => {
      // Only force refresh if we were streaming AND it didn't complete normally
      if (isStreamingRef.current && !streamingCompleteRef.current) {
        clearStreamingState();
      }
    });

    // Handle WebSocket errors
    wsClient.onError(() => {
      // WebSocket error - will be handled by reconnection logic
    });

    // Connect WebSocket to session
    wsClient.connect(sessionId).catch(() => {
      // WebSocket connection failed - will retry on next message
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
  }, [sessionId, wsBaseUrl, queryClient, clearStreamingState, flushBufferAndUpdate]);

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
      setStreamingMessage(streamingAssistantMessage);

      // Set timeout to force refresh if streaming takes too long
      streamingTimeoutRef.current = setTimeout(() => {
        streamingCompleteRef.current = true;
        clearStreamingState();
      }, DEBOUNCE_TIMES.STREAMING_TIMEOUT_MS);

      // Send message via WebSocket (not HTTP!)
      wsClientRef.current.sendMessage(content);

      // Return a promise that resolves when done
      return new Promise((resolve) => {
        // The mutation will complete when WebSocket 'done' event fires
        // For now, resolve immediately since WebSocket handles everything
        resolve({ success: true });
      });
    },
    onSuccess: async () => {
      // Message sent via WebSocket
      // Response will come as streaming chunks
      // Wait for 'done' event before clearing optimistic state
    },
    onError: () => {
      // IMPORTANT: Even on timeout/error, refetch messages from server
      // Backend might have succeeded even if HTTP request timed out
      if (sessionId) {
        queryClient.invalidateQueries({ queryKey: ['messages', sessionId] });
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
      }, DEBOUNCE_TIMES.REFETCH_CLEAR_DELAY_MS);
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
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <MessageCircle className="h-5 w-5 text-primary shrink-0" />
            <h2 className="text-lg font-semibold truncate">
              {session?.title || 'No Session'}
            </h2>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {agentStatus}
          </span>
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
