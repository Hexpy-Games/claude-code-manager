/**
 * Session Routes
 *
 * Endpoints:
 * - POST /sessions - Create new session
 * - GET /sessions - List all sessions
 * - GET /sessions/:id - Get specific session
 * - PATCH /sessions/:id - Update session
 * - DELETE /sessions/:id - Delete session
 * - POST /sessions/:id/switch - Switch to session
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  createSessionSchema,
  updateSessionSchema,
  sessionIdSchema,
  deleteSessionQuerySchema,
  type CreateSessionRequest,
  type UpdateSessionRequest,
  type DeleteSessionQuery,
} from '../schemas/index.js';

export async function sessionsRoutes(fastify: FastifyInstance) {
  /**
   * POST /sessions - Create new session
   */
  fastify.post<{ Body: CreateSessionRequest }>('/sessions', async (request, reply) => {
    // Validate request body with Zod
    const validationResult = createSessionSchema.safeParse(request.body);
    if (!validationResult.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Request validation failed',
        statusCode: 400,
        issues: validationResult.error.issues,
      });
    }

    const { title, rootDirectory, baseBranch, metadata } = validationResult.data;

    const session = await fastify.sessionManager.createSession({
      title,
      rootDirectory,
      baseBranch,
      metadata,
    });

    return reply.status(201).send({ data: { session } });
  });

  /**
   * GET /sessions - List all sessions
   */
  fastify.get('/sessions', async (request, reply) => {
    const sessions = await fastify.sessionManager.listSessions();

    return reply.send({ data: { sessions } });
  });

  /**
   * GET /sessions/:id - Get specific session
   */
  fastify.get<{ Params: { id: string } }>('/sessions/:id', async (request, reply) => {
    const { id } = request.params;

    // Validate ID format
    const idValidation = sessionIdSchema.safeParse(id);
    if (!idValidation.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid session ID format',
        statusCode: 400,
        issues: idValidation.error.issues,
      });
    }

    const session = await fastify.sessionManager.getSession(id);

    if (!session) {
      return reply.status(404).send({
        error: 'SessionNotFoundError',
        message: `Session not found: ${id}`,
        statusCode: 404,
      });
    }

    return reply.send({ data: { session } });
  });

  /**
   * PATCH /sessions/:id - Update session
   */
  fastify.patch<{ Params: { id: string }; Body: UpdateSessionRequest }>(
    '/sessions/:id',
    async (request, reply) => {
      const { id } = request.params;

      // Validate ID format
      const idValidation = sessionIdSchema.safeParse(id);
      if (!idValidation.success) {
        return reply.status(400).send({
          error: 'ValidationError',
          message: 'Invalid session ID format',
          statusCode: 400,
          issues: idValidation.error.issues,
        });
      }

      // Validate request body
      const validationResult = updateSessionSchema.safeParse(request.body);
      if (!validationResult.success) {
        return reply.status(400).send({
          error: 'ValidationError',
          message: 'Request validation failed',
          statusCode: 400,
          issues: validationResult.error.issues,
        });
      }

      const session = await fastify.sessionManager.updateSession(id, validationResult.data);

      return reply.send({ data: { session } });
    },
  );

  /**
   * DELETE /sessions/:id - Delete session
   */
  fastify.delete<{ Params: { id: string }; Querystring: DeleteSessionQuery }>(
    '/sessions/:id',
    async (request, reply) => {
      const { id } = request.params;

      // Validate ID format
      const idValidation = sessionIdSchema.safeParse(id);
      if (!idValidation.success) {
        return reply.status(400).send({
          error: 'ValidationError',
          message: 'Invalid session ID format',
          statusCode: 400,
          issues: idValidation.error.issues,
        });
      }

      // Validate query
      const queryValidation = deleteSessionQuerySchema.safeParse(request.query);
      if (!queryValidation.success) {
        return reply.status(400).send({
          error: 'ValidationError',
          message: 'Invalid query parameters',
          statusCode: 400,
          issues: queryValidation.error.issues,
        });
      }

      const { deleteGitBranch } = queryValidation.data;

      await fastify.sessionManager.deleteSession(id, {
        deleteGitBranch: deleteGitBranch ?? false,
      });

      return reply.send({ data: { success: true } });
    },
  );

  /**
   * POST /sessions/:id/switch - Switch to session
   */
  fastify.post<{ Params: { id: string } }>('/sessions/:id/switch', async (request, reply) => {
    const { id } = request.params;

    // Validate ID format
    const idValidation = sessionIdSchema.safeParse(id);
    if (!idValidation.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid session ID format',
        statusCode: 400,
        issues: idValidation.error.issues,
      });
    }

    const session = await fastify.sessionManager.switchSession(id);

    return reply.send({ data: { session } });
  });
}
