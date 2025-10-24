// Database types for Claude Code Manager

export interface Session {
  id: string;
  title: string;
  rootDirectory: string;
  workspacePath: string;
  branchName: string;
  baseBranch: string;
  gitStatus: string | null;
  createdAt: number;
  updatedAt: number;
  lastMessageAt: number | null;
  metadata: Record<string, any> | null;
  isActive: boolean;
}

export interface InsertSession {
  id: string;
  title: string;
  rootDirectory: string;
  workspacePath: string;
  branchName: string;
  baseBranch?: string;
  gitStatus?: string | null;
  metadata?: Record<string, any> | null;
}

export interface UpdateSession {
  title?: string;
  gitStatus?: string | null;
  lastMessageAt?: number;
  metadata?: Record<string, any> | null;
  isActive?: boolean;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls: any[] | null;
  timestamp: number;
}

export interface InsertMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: any[] | null;
}

export interface SessionGitState {
  sessionId: string;
  currentCommit: string | null;
  uncommittedFiles: string[] | null;
  stashRef: string | null;
}

export interface Setting {
  key: string;
  value: any;
  scope: string | null;
  updatedAt: number;
}
