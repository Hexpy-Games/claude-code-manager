/**
 * Session Store Tests
 *
 * Tests for Zustand session store state management
 */

import type { Session } from '@/services/api/types';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSessionStore } from './sessionStore';

describe('sessionStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useSessionStore());
    act(() => {
      result.current.setSessions([]);
      result.current.setActiveSessionId(null);
      result.current.setError(null);
    });
  });

  describe('initial state', () => {
    it('should have empty sessions array', () => {
      const { result } = renderHook(() => useSessionStore());
      expect(result.current.sessions).toEqual([]);
    });

    it('should have null active session ID', () => {
      const { result } = renderHook(() => useSessionStore());
      expect(result.current.activeSessionId).toBeNull();
    });

    it('should have null error', () => {
      const { result } = renderHook(() => useSessionStore());
      expect(result.current.error).toBeNull();
    });
  });

  describe('setSessions', () => {
    it('should set sessions array', () => {
      const { result } = renderHook(() => useSessionStore());
      const mockSessions: Session[] = [
        {
          id: 'sess_123',
          title: 'Test Session',
          rootDirectory: '/test',
          branchName: 'session/test',
          baseBranch: 'main',
          gitStatus: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastMessageAt: null,
          metadata: null,
          isActive: true,
        },
      ];

      act(() => {
        result.current.setSessions(mockSessions);
      });

      expect(result.current.sessions).toEqual(mockSessions);
    });

    it('should clear error when setting sessions', () => {
      const { result } = renderHook(() => useSessionStore());

      act(() => {
        result.current.setError('Test error');
        result.current.setSessions([]);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('setActiveSessionId', () => {
    it('should set active session ID', () => {
      const { result } = renderHook(() => useSessionStore());

      act(() => {
        result.current.setActiveSessionId('sess_123');
      });

      expect(result.current.activeSessionId).toBe('sess_123');
    });

    it('should allow setting to null', () => {
      const { result } = renderHook(() => useSessionStore());

      act(() => {
        result.current.setActiveSessionId('sess_123');
        result.current.setActiveSessionId(null);
      });

      expect(result.current.activeSessionId).toBeNull();
    });
  });

  describe('setError', () => {
    it('should set error message', () => {
      const { result } = renderHook(() => useSessionStore());

      act(() => {
        result.current.setError('Test error');
      });

      expect(result.current.error).toBe('Test error');
    });

    it('should allow clearing error', () => {
      const { result } = renderHook(() => useSessionStore());

      act(() => {
        result.current.setError('Test error');
        result.current.setError(null);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('addSession', () => {
    it('should add session to array', () => {
      const { result } = renderHook(() => useSessionStore());
      const newSession: Session = {
        id: 'sess_new',
        title: 'New Session',
        rootDirectory: '/new',
        branchName: 'session/new',
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: null,
        metadata: null,
        isActive: false,
      };

      act(() => {
        result.current.addSession(newSession);
      });

      expect(result.current.sessions).toContainEqual(newSession);
    });

    it('should add to beginning of array', () => {
      const { result } = renderHook(() => useSessionStore());
      const existingSession: Session = {
        id: 'sess_existing',
        title: 'Existing',
        rootDirectory: '/existing',
        branchName: 'session/existing',
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: null,
        metadata: null,
        isActive: false,
      };

      const newSession: Session = {
        id: 'sess_new',
        title: 'New',
        rootDirectory: '/new',
        branchName: 'session/new',
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: null,
        metadata: null,
        isActive: false,
      };

      act(() => {
        result.current.setSessions([existingSession]);
        result.current.addSession(newSession);
      });

      expect(result.current.sessions[0]).toEqual(newSession);
    });
  });

  describe('updateSession', () => {
    it('should update existing session', () => {
      const { result } = renderHook(() => useSessionStore());
      const session: Session = {
        id: 'sess_123',
        title: 'Original',
        rootDirectory: '/test',
        branchName: 'session/test',
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: null,
        metadata: null,
        isActive: false,
      };

      const updatedSession: Session = {
        ...session,
        title: 'Updated',
      };

      act(() => {
        result.current.setSessions([session]);
        result.current.updateSession(updatedSession);
      });

      expect(result.current.sessions[0].title).toBe('Updated');
    });

    it('should not add session if not found', () => {
      const { result } = renderHook(() => useSessionStore());
      const session: Session = {
        id: 'sess_nonexistent',
        title: 'Does not exist',
        rootDirectory: '/test',
        branchName: 'session/test',
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: null,
        metadata: null,
        isActive: false,
      };

      act(() => {
        result.current.updateSession(session);
      });

      expect(result.current.sessions).toHaveLength(0);
    });
  });

  describe('removeSession', () => {
    it('should remove session by ID', () => {
      const { result } = renderHook(() => useSessionStore());
      const session: Session = {
        id: 'sess_123',
        title: 'Test',
        rootDirectory: '/test',
        branchName: 'session/test',
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: null,
        metadata: null,
        isActive: false,
      };

      act(() => {
        result.current.setSessions([session]);
        result.current.removeSession('sess_123');
      });

      expect(result.current.sessions).toHaveLength(0);
    });

    it('should not error if session not found', () => {
      const { result } = renderHook(() => useSessionStore());

      act(() => {
        result.current.removeSession('nonexistent');
      });

      expect(result.current.sessions).toHaveLength(0);
    });

    it('should clear active session ID if removed session was active', () => {
      const { result } = renderHook(() => useSessionStore());
      const session: Session = {
        id: 'sess_123',
        title: 'Test',
        rootDirectory: '/test',
        branchName: 'session/test',
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: null,
        metadata: null,
        isActive: false,
      };

      act(() => {
        result.current.setSessions([session]);
        result.current.setActiveSessionId('sess_123');
        result.current.removeSession('sess_123');
      });

      expect(result.current.activeSessionId).toBeNull();
    });
  });

  describe('getActiveSession', () => {
    it('should return active session', () => {
      const { result } = renderHook(() => useSessionStore());
      const sessions: Session[] = [
        {
          id: 'sess_1',
          title: 'Session 1',
          rootDirectory: '/test1',
          branchName: 'session/test1',
          baseBranch: 'main',
          gitStatus: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastMessageAt: null,
          metadata: null,
          isActive: false,
        },
        {
          id: 'sess_2',
          title: 'Session 2',
          rootDirectory: '/test2',
          branchName: 'session/test2',
          baseBranch: 'main',
          gitStatus: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastMessageAt: null,
          metadata: null,
          isActive: true,
        },
      ];

      act(() => {
        result.current.setSessions(sessions);
        result.current.setActiveSessionId('sess_2');
      });

      const activeSession = result.current.getActiveSession();
      expect(activeSession?.id).toBe('sess_2');
    });

    it('should return null if no active session', () => {
      const { result } = renderHook(() => useSessionStore());

      const activeSession = result.current.getActiveSession();
      expect(activeSession).toBeNull();
    });
  });

  describe('getSortedSessions', () => {
    it('should return sessions sorted by updatedAt descending', () => {
      const { result } = renderHook(() => useSessionStore());
      const now = Date.now();
      const sessions: Session[] = [
        {
          id: 'sess_1',
          title: 'Oldest',
          rootDirectory: '/test1',
          branchName: 'session/test1',
          baseBranch: 'main',
          gitStatus: null,
          createdAt: now - 3000,
          updatedAt: now - 3000,
          lastMessageAt: null,
          metadata: null,
          isActive: false,
        },
        {
          id: 'sess_2',
          title: 'Newest',
          rootDirectory: '/test2',
          branchName: 'session/test2',
          baseBranch: 'main',
          gitStatus: null,
          createdAt: now,
          updatedAt: now,
          lastMessageAt: null,
          metadata: null,
          isActive: false,
        },
        {
          id: 'sess_3',
          title: 'Middle',
          rootDirectory: '/test3',
          branchName: 'session/test3',
          baseBranch: 'main',
          gitStatus: null,
          createdAt: now - 1000,
          updatedAt: now - 1000,
          lastMessageAt: null,
          metadata: null,
          isActive: false,
        },
      ];

      act(() => {
        result.current.setSessions(sessions);
      });

      const sorted = result.current.getSortedSessions();
      expect(sorted[0].title).toBe('Newest');
      expect(sorted[1].title).toBe('Middle');
      expect(sorted[2].title).toBe('Oldest');
    });

    it('should return empty array if no sessions', () => {
      const { result } = renderHook(() => useSessionStore());

      const sorted = result.current.getSortedSessions();
      expect(sorted).toEqual([]);
    });
  });
});
