/**
 * Fastify Server Setup
 *
 * Creates and configures the Fastify server with:
 * - CORS support
 * - Service injection (DatabaseClient, SessionManager, ClaudeAgentService)
 * - Route registration
 * - Error handling
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { DatabaseClient } from './db/client.js';
import { GitService } from './services/git-service.js';
import { SessionManager } from './services/session-manager.js';
import { ClaudeAgentService, ConfigurationError } from './services/claude-agent-service.js';
import { sessionsRoutes } from './routes/sessions.js';
import { messagesRoutes } from './routes/messages.js';
import { settingsRoutes } from './routes/settings.js';

// Extend Fastify instance with custom properties
declare module 'fastify' {
  interface FastifyInstance {
    db: DatabaseClient;
    sessionManager: SessionManager;
    claudeAgent: ClaudeAgentService;
  }
}

/**
 * Server configuration
 */
export interface ServerConfig {
  port?: number;
  host?: string;
  databasePath: string;
  claudeApiKey: string;
  logLevel?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  corsOrigin?: string | string[] | boolean;
}

/**
 * Create and configure Fastify server
 */
export async function createServer(config: ServerConfig): Promise<FastifyInstance> {
  // Validate required config
  if (!config.databasePath) {
    throw new Error('databasePath is required in ServerConfig');
  }
  if (!config.claudeApiKey) {
    throw new Error('claudeApiKey is required in ServerConfig');
  }

  // Create Fastify instance
  const fastify = Fastify({
    logger: {
      level: config.logLevel || 'info',
      transport:
        process.env.NODE_ENV !== 'test'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                ignore: 'pid,hostname',
                translateTime: 'HH:MM:ss.l',
              },
            }
          : undefined,
    },
  });

  // Register CORS plugin
  await fastify.register(cors, {
    origin: config.corsOrigin ?? true, // Allow all origins in development
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Initialize services
  const db = new DatabaseClient(config.databasePath);
  const git = new GitService();
  const sessionManager = new SessionManager(db, git);
  const claudeAgent = new ClaudeAgentService(db, {
    apiKey: config.claudeApiKey,
  });

  // Decorate Fastify instance with services
  fastify.decorate('db', db);
  fastify.decorate('sessionManager', sessionManager);
  fastify.decorate('claudeAgent', claudeAgent);

  // Register error handler
  fastify.setErrorHandler((error, request, reply) => {
    // Log error
    request.log.error(error);

    // Validation errors from Fastify/Zod
    if (error.validation) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Request validation failed',
        statusCode: 400,
        issues: error.validation,
      });
    }

    // Known service errors
    const errorMap: Record<string, number> = {
      SessionNotFoundError: 404,
      InvalidSessionDataError: 400,
      SessionAlreadyExistsError: 409,
      NotGitRepoError: 400,
      BranchExistsError: 409,
      GitOperationError: 500,
      InvalidMessageError: 400,
      ConfigurationError: 500,
      RateLimitError: 429,
      NetworkError: 503,
      ClaudeAPIError: 502,
    };

    const statusCode = errorMap[error.name] || 500;

    // For rate limit errors, include retry-after header
    if (error.name === 'RateLimitError' && (error as any).retryAfter) {
      reply.header('Retry-After', (error as any).retryAfter.toString());
    }

    return reply.status(statusCode).send({
      error: error.name || 'InternalServerError',
      message: statusCode === 500 ? 'An internal server error occurred' : error.message,
      statusCode,
    });
  });

  // Register routes
  await fastify.register(sessionsRoutes, { prefix: '/api' });
  await fastify.register(messagesRoutes, { prefix: '/api' });
  await fastify.register(settingsRoutes, { prefix: '/api' });

  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    return reply.send({ status: 'ok' });
  });

  return fastify;
}

/**
 * Start server on specified port
 */
export async function startServer(
  server: FastifyInstance,
  config: ServerConfig,
): Promise<string> {
  const port = config.port || 3000;
  const host = config.host || '0.0.0.0';

  try {
    await server.listen({ port, host });
    return `http://${host}:${port}`;
  } catch (error) {
    server.log.error(error);
    throw error;
  }
}
