/**
 * MSW (Mock Service Worker) Handlers
 *
 * HTTP request handlers for mocking the backend API in tests.
 */

import type {
  CreateSessionRequest,
  Message,
  Session,
  Setting,
  UpdateSessionRequest,
} from '@/services/api/types';
import { http, HttpResponse } from 'msw';

// Mock data
const mockSessions: Session[] = [
  {
    id: 'sess_test123',
    title: 'Test Session',
    rootDirectory: '/test/repo',
    branchName: 'claude-sess_test123',
    baseBranch: 'main',
    gitStatus: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastMessageAt: null,
    metadata: null,
    isActive: true,
  },
];

const mockMessages: Message[] = [
  {
    id: 'msg_001',
    sessionId: 'sess_test123',
    role: 'user',
    content: 'Hello',
    toolCalls: null,
    timestamp: Date.now(),
  },
];

const mockSettings: Setting[] = [
  {
    key: 'api.baseUrl',
    value: 'http://localhost:3000',
    scope: null,
    updatedAt: Date.now(),
  },
];

export const handlers = [
  // Session Management
  http.post('/api/sessions', async ({ request }) => {
    const body = (await request.json()) as CreateSessionRequest;
    const session: Session = {
      id: 'sess_new123',
      title: body.title,
      rootDirectory: body.rootDirectory,
      branchName: 'claude-sess_new123',
      baseBranch: body.baseBranch || 'main',
      gitStatus: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastMessageAt: null,
      metadata: body.metadata || null,
      isActive: false,
    };
    return HttpResponse.json({ data: { session } });
  }),

  http.get('/api/sessions', () => {
    return HttpResponse.json({ data: { sessions: mockSessions } });
  }),

  http.get('/api/sessions/:id', ({ params }) => {
    const { id } = params;
    if (id === 'sess_notfound') {
      return HttpResponse.json(
        {
          error: 'NotFoundError',
          message: 'Session not found',
          statusCode: 404,
        },
        { status: 404 }
      );
    }
    const session = mockSessions.find((s) => s.id === id) || mockSessions[0];
    return HttpResponse.json({ data: { session } });
  }),

  http.patch('/api/sessions/:id', async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as UpdateSessionRequest;
    const session = mockSessions.find((s) => s.id === id) || mockSessions[0];
    const updated: Session = {
      ...session,
      ...body,
      updatedAt: Date.now(),
    };
    return HttpResponse.json({ data: { session: updated } });
  }),

  http.delete('/api/sessions/:id', ({ params, request }) => {
    const { id } = params;
    const url = new URL(request.url);
    const deleteGitBranch = url.searchParams.get('deleteGitBranch');

    if (id === 'sess_notfound') {
      return HttpResponse.json(
        {
          error: 'NotFoundError',
          message: 'Session not found',
          statusCode: 404,
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      data: {
        message: 'Session deleted',
        deletedGitBranch: deleteGitBranch === 'true',
      },
    });
  }),

  http.post('/api/sessions/:id/switch', ({ params }) => {
    const { id } = params;
    if (id === 'sess_notfound') {
      return HttpResponse.json(
        {
          error: 'NotFoundError',
          message: 'Session not found',
          statusCode: 404,
        },
        { status: 404 }
      );
    }
    const session = mockSessions.find((s) => s.id === id) || mockSessions[0];
    return HttpResponse.json({ data: { session: { ...session, isActive: true } } });
  }),

  // Message Management
  http.get('/api/sessions/:sessionId/messages', ({ params }) => {
    const { sessionId } = params;
    const messages = mockMessages.filter((m) => m.sessionId === sessionId);
    return HttpResponse.json({ data: { messages } });
  }),

  http.post('/api/sessions/:sessionId/messages', async ({ params, request }) => {
    const { sessionId } = params;
    const body = (await request.json()) as { content: string };

    if (!body.content || body.content.trim() === '') {
      return HttpResponse.json(
        {
          error: 'ValidationError',
          message: 'Message content is required',
          statusCode: 400,
          issues: [{ field: 'content', message: 'Content cannot be empty' }],
        },
        { status: 400 }
      );
    }

    const userMessage: Message = {
      id: 'msg_user001',
      sessionId: sessionId as string,
      role: 'user',
      content: body.content,
      toolCalls: null,
      timestamp: Date.now(),
    };

    const assistantMessage: Message = {
      id: 'msg_assistant001',
      sessionId: sessionId as string,
      role: 'assistant',
      content: 'Response from assistant',
      toolCalls: null,
      timestamp: Date.now() + 100,
    };

    return HttpResponse.json({
      data: {
        userMessage,
        assistantMessage,
      },
    });
  }),

  // Settings Management
  http.get('/api/settings', () => {
    return HttpResponse.json({ data: { settings: mockSettings } });
  }),

  http.get('/api/settings/:key', ({ params }) => {
    const { key } = params;
    const setting = mockSettings.find((s) => s.key === key);

    if (!setting) {
      return HttpResponse.json(
        {
          error: 'NotFoundError',
          message: 'Setting not found',
          statusCode: 404,
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      data: {
        key: setting.key,
        value: setting.value,
      },
    });
  }),

  http.put('/api/settings/:key', async ({ params, request }) => {
    const { key } = params;
    const body = (await request.json()) as { value: unknown };

    return HttpResponse.json({
      data: {
        key: key as string,
        value: body.value,
      },
    });
  }),

  http.delete('/api/settings/:key', ({ params }) => {
    const { key } = params;

    if (key === 'nonexistent') {
      return HttpResponse.json(
        {
          error: 'NotFoundError',
          message: 'Setting not found',
          statusCode: 404,
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({ data: { message: 'Setting deleted' } });
  }),

  // Git Operations
  http.post('/api/sessions/:sessionId/git/merge', async ({ params, request }) => {
    const { sessionId } = params;
    let targetBranch = 'main';

    try {
      const body = (await request.json()) as { targetBranch?: string };
      targetBranch = body.targetBranch || 'main';
    } catch {
      // Body might be empty, use default
    }

    if (sessionId === 'sess_conflict') {
      return HttpResponse.json(
        {
          error: 'GitError',
          message: 'Merge conflict detected',
          statusCode: 409,
        },
        { status: 409 }
      );
    }

    return HttpResponse.json({
      data: {
        message: 'Merge successful',
        targetBranch,
      },
    });
  }),

  http.get('/api/sessions/:sessionId/git/conflicts', ({ params, request }) => {
    const { sessionId } = params;
    const url = new URL(request.url);
    const targetBranch = url.searchParams.get('targetBranch');

    const hasConflicts = sessionId === 'sess_conflict';

    return HttpResponse.json({
      data: {
        hasConflicts,
        targetBranch: targetBranch || 'main',
      },
    });
  }),

  http.delete('/api/sessions/:sessionId/git/branch', ({ params }) => {
    const { sessionId } = params;

    if (sessionId === 'sess_notfound') {
      return HttpResponse.json(
        {
          error: 'NotFoundError',
          message: 'Session not found',
          statusCode: 404,
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({ data: { message: 'Branch deleted' } });
  }),

  // Health Check
  http.get('/api/health', () => {
    return HttpResponse.json({ data: { status: 'ok' } });
  }),

  // Network error simulation
  http.get('/api/network-error', () => {
    return HttpResponse.error();
  }),

  // Timeout simulation (delayed response)
  http.get('/api/timeout', async () => {
    await new Promise((resolve) => setTimeout(resolve, 60000));
    return HttpResponse.json({ data: { status: 'ok' } });
  }),
];
