/**
 * Session Store
 *
 * Zustand store for managing session state
 */

import type { Session } from '@/services/api/types';
import { create } from 'zustand';

interface SessionStore {
  // State
  sessions: Session[];
  activeSessionId: string | null;
  error: string | null;

  // Actions
  setSessions: (sessions: Session[]) => void;
  setActiveSessionId: (id: string | null) => void;
  setError: (error: string | null) => void;
  addSession: (session: Session) => void;
  updateSession: (session: Session) => void;
  removeSession: (id: string) => void;

  // Getters
  getActiveSession: () => Session | null;
  getSortedSessions: () => Session[];
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  // Initial state
  sessions: [],
  activeSessionId: null,
  error: null,

  // Actions
  setSessions: (sessions: Session[]) =>
    set({
      sessions,
      error: null,
    }),

  setActiveSessionId: (id: string | null) =>
    set({
      activeSessionId: id,
    }),

  setError: (error: string | null) =>
    set({
      error,
    }),

  addSession: (session: Session) =>
    set((state) => ({
      sessions: [session, ...state.sessions],
    })),

  updateSession: (session: Session) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === session.id ? session : s)),
    })),

  removeSession: (id: string) =>
    set((state) => {
      const newState: Partial<SessionStore> = {
        sessions: state.sessions.filter((s) => s.id !== id),
      };

      // Clear active session ID if the removed session was active
      if (state.activeSessionId === id) {
        newState.activeSessionId = null;
      }

      return newState;
    }),

  // Getters
  getActiveSession: () => {
    const state = get();
    if (!state.activeSessionId) return null;
    return state.sessions.find((s) => s.id === state.activeSessionId) || null;
  },

  getSortedSessions: () => {
    const state = get();
    return [...state.sessions].sort((a, b) => b.updatedAt - a.updatedAt);
  },
}));
