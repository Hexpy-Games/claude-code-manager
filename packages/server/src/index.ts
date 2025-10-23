// Claude Code Manager - Backend API Server

// Export server
export { createServer, startServer } from './server.js';
export type { ServerConfig } from './server.js';

// Export database
export { DatabaseClient } from './db/client.js';
export type {
  Session,
  InsertSession,
  UpdateSession,
  Message,
  InsertMessage,
  Setting,
} from './db/types.js';

// Export services
export { GitService } from './services/git-service.js';
export { SessionManager } from './services/session-manager.js';
export { ClaudeAgentService } from './services/claude-agent-service.js';
export type { ClaudeAgentServiceConfig } from './services/claude-agent-service.js';

// Export schemas
export * from './schemas/index.js';
