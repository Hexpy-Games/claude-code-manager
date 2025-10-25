/**
 * MessageList Component
 *
 * Displays messages in document-style layout (Claude.ai style)
 * Renders markdown content with code syntax highlighting
 */

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CodeBlock } from '@/components/ui/code-block';
import { CopyButton } from '@/components/ui/copy-button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Message } from '@/services/api/types';
import { Bot, Loader2, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { ToolCallDisplay } from './ToolCallDisplay';

interface MessageListProps {
  messages: Message[];
  streamingMessageId?: string;
  sessionId?: string | null;
}

// Custom markdown components for rendering
const markdownComponents: Components = {
  // Render code blocks with syntax highlighting
  code: ({ className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : 'text';
    const isInline = !className;

    if (!isInline && match) {
      // Block code with syntax highlighting
      return <CodeBlock code={String(children).replace(/\n$/, '')} language={language} />;
    }

    // Inline code
    return (
      <code
        className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono"
        {...props}
      >
        {children}
      </code>
    );
  },
  // Style other markdown elements
  p: ({ children }) => <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="list-disc mb-4 space-y-1 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal mb-4 space-y-1 pl-6">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
      {children}
    </a>
  ),
  h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 mt-6">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xl font-bold mb-3 mt-5">{children}</h2>,
  h3: ({ children }) => <h3 className="text-lg font-bold mb-2 mt-4">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-border pl-4 italic my-4">{children}</blockquote>
  ),
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
};

export function MessageList({ messages, streamingMessageId, sessionId }: MessageListProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUserScrollingRef = useRef(false);
  const scrollCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRestoringScrollRef = useRef(false);
  const scrollSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get the actual scrollable viewport element (Radix UI ScrollArea structure)
  const getScrollElement = (): HTMLElement | null => {
    if (!scrollAreaRef.current) return null;
    // Radix ScrollArea has a viewport div as the first child
    return scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
  };

  // Smart scroll function that respects user scrolling
  const scrollToBottom = (force = false) => {
    const scrollElement = getScrollElement();
    if (!scrollElement) return;

    // Don't auto-scroll if user is manually scrolling up (unless forced)
    if (!force && isUserScrollingRef.current) {
      console.log('[MessageList] Skipping auto-scroll - user is scrolling');
      return;
    }

    requestAnimationFrame(() => {
      const element = getScrollElement();
      if (element) {
        console.log('[MessageList] 📜 Scrolling to bottom');
        element.scrollTop = element.scrollHeight;
      }
    });
  };

  // Detect if user is manually scrolling and save scroll position
  const handleScroll = (event: Event) => {
    const scrollElement = event.target as HTMLElement;
    if (!scrollElement) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollElement;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // User is scrolling if they're more than 100px from bottom
    isUserScrollingRef.current = distanceFromBottom > 100;

    // Reset user scrolling flag after 2 seconds of no scroll activity
    if (scrollCheckTimeoutRef.current) {
      clearTimeout(scrollCheckTimeoutRef.current);
    }
    scrollCheckTimeoutRef.current = setTimeout(() => {
      // If we're near the bottom, re-enable auto-scroll
      if (distanceFromBottom < 100) {
        isUserScrollingRef.current = false;
      }
    }, 2000);

    // Save scroll position to localStorage (debounced to avoid excessive writes)
    // Don't save if we're currently restoring scroll position
    if (sessionId && !isRestoringScrollRef.current) {
      if (scrollSaveTimeoutRef.current) {
        clearTimeout(scrollSaveTimeoutRef.current);
      }
      scrollSaveTimeoutRef.current = setTimeout(() => {
        const scrollKey = `scroll_${sessionId}`;
        localStorage.setItem(scrollKey, String(scrollTop));
      }, 500); // Save after 500ms of no scrolling
    }
  };

  // Scenario 1: When user selects a session, restore scroll position or scroll to bottom
  useEffect(() => {
    if (sessionId && messages.length > 0) {
      const scrollKey = `scroll_${sessionId}`;
      const savedScrollPosition = localStorage.getItem(scrollKey);

      if (savedScrollPosition) {
        // Restore saved scroll position
        console.log('[MessageList] Session changed, restoring scroll position:', savedScrollPosition);
        isRestoringScrollRef.current = true;
        requestAnimationFrame(() => {
          const scrollElement = getScrollElement();
          if (scrollElement) {
            scrollElement.scrollTop = Number(savedScrollPosition);
            // Wait a bit before allowing scroll saves again
            setTimeout(() => {
              isRestoringScrollRef.current = false;
            }, 100);
          }
        });
      } else {
        // No saved position, scroll to bottom
        console.log('[MessageList] Session changed, scrolling to bottom');
        isUserScrollingRef.current = false; // Reset user scrolling flag
        scrollToBottom(true); // Force scroll on session change
      }
    }
  }, [sessionId]);

  // Scenario 2: When user enters a new message, scroll to it
  useEffect(() => {
    if (messages.length > 0) {
      console.log('[MessageList] New message added, scrolling to bottom');
      isUserScrollingRef.current = false; // Reset user scrolling flag
      scrollToBottom(true); // Force scroll for new messages
    }
  }, [messages.length]);

  // Scenario 3: When streaming response, automatically scroll to last part
  const lastMessageContent = messages[messages.length - 1]?.content;
  useEffect(() => {
    if (!streamingMessageId) return;

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Smooth scroll during streaming - respect user scrolling
    scrollTimeoutRef.current = setTimeout(() => {
      scrollToBottom(false); // Don't force during streaming
    }, 50); // Faster scroll updates during streaming

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [lastMessageContent, streamingMessageId]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>No messages yet. Start a conversation!</p>
      </div>
    );
  }

  // Attach scroll event listener to the viewport element
  useEffect(() => {
    const scrollElement = getScrollElement();
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll);
      console.log('[MessageList] Scroll event listener attached');
    }

    return () => {
      if (scrollElement) {
        scrollElement.removeEventListener('scroll', handleScroll);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (scrollCheckTimeoutRef.current) {
        clearTimeout(scrollCheckTimeoutRef.current);
      }
      if (scrollSaveTimeoutRef.current) {
        clearTimeout(scrollSaveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <ScrollArea className="flex-1" ref={scrollAreaRef}>
      <div className="flex flex-col">
        {messages.map((message) => {
          const isStreaming = message.id === streamingMessageId;
          const roleLabel = message.role === 'user' ? 'You' : 'Claude';

          return (
            <div
              key={message.id}
              data-message-id={message.id}
              className="w-full py-4 px-6 border-b border-border hover:bg-muted/30 transition-colors animate-in fade-in duration-300"
            >
              <div className="flex gap-3 items-start">
                <Avatar className="h-6 w-6 mt-1">
                  <AvatarFallback className={message.role === 'user' ? 'bg-primary' : 'bg-primary/10'}>
                    {message.role === 'user' ? (
                      <User className="h-3 w-3 text-primary-foreground" />
                    ) : isStreaming ? (
                      <Loader2 className="h-3 w-3 animate-spin" data-testid="streaming-indicator" />
                    ) : (
                      <Bot className="h-3 w-3" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">{roleLabel}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                      <CopyButton content={message.content} />
                    </div>
                  </div>
                  {message.content ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown
                        components={markdownComponents}
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeSanitize]}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : isStreaming ? (
                    <p className="text-muted-foreground italic">Claude is thinking...</p>
                  ) : null}
                  <ToolCallDisplay toolCalls={message.toolCalls} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
