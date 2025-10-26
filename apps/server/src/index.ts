// Claude Code Manager - Backend API Server

import { homedir } from 'node:os';
import { join } from 'node:path';

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

// Development server - auto-start when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const { createServer, startServer } = await import('./server.js');

  const dbPath = process.env.DATABASE_PATH || join(homedir(), '.claude-code-manager', 'data', 'sessions.db');
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const host = process.env.HOST || '0.0.0.0';

  console.log('🚀 Starting Claude Code Manager Backend...');
  console.log(`📁 Database: ${dbPath}`);
  console.log(`🌐 Server: http://${host}:${port}`);
  console.log('');

  const server = await createServer({
    databasePath: dbPath,
    port,
    host,
    logLevel: 'info',
    corsOrigin: true, // Allow all origins in development
  });

  const url = await startServer(server, { databasePath: dbPath, port, host });
  console.log(`✅ Server listening on ${url}`);
  console.log('');
  console.log('Press Ctrl+C to stop');
}
