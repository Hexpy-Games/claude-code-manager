/**
 * Message Routes
 *
 * Endpoints:
 * - GET /sessions/:id/messages - Get all messages for session
 * - POST /sessions/:id/messages - Send message to Claude
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sendMessageSchema, sessionIdSchema, type SendMessageRequest } from '../schemas/index.js';

export async function messagesRoutes(fastify: FastifyInstance) {
  /**
   * GET /sessions/:id/messages - Get all messages for session
   */
  fastify.get<{ Params: { id: string } }>('/sessions/:id/messages', async (request, reply) => {
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

    // Verify session exists
    const session = await fastify.sessionManager.getSession(id);
    if (!session) {
      return reply.status(404).send({
        error: 'SessionNotFoundError',
        message: `Session not found: ${id}`,
        statusCode: 404,
      });
    }

    // Get messages from database
    const messages = fastify.db.getMessages(id);

    return reply.send({ data: { messages } });
  });

  /**
   * POST /sessions/:id/messages - Send message to Claude
   */
  fastify.post<{ Params: { id: string }; Body: SendMessageRequest }>(
    '/sessions/:id/messages',
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
      const validationResult = sendMessageSchema.safeParse(request.body);
      if (!validationResult.success) {
        return reply.status(400).send({
          error: 'ValidationError',
          message: 'Request validation failed',
          statusCode: 400,
          issues: validationResult.error.issues,
        });
      }

      const { content } = validationResult.data;

      // Send message via ClaudeAgentService
      const result = await fastify.claudeAgent.sendMessage(id, content);

      return reply.send({
        data: {
          userMessage: result.userMessage,
          assistantMessage: result.assistantMessage,
        },
      });
    },
  );
}
