/**
 * Git Operations Routes
 *
 * Endpoints:
 * - POST /sessions/:id/git/merge - Merge session branch into target branch
 * - GET /sessions/:id/git/conflicts - Check for merge conflicts
 * - DELETE /sessions/:id/git/branch - Delete session branch
 */

import { FastifyInstance } from 'fastify';
import {
  sessionIdSchema,
  mergeBranchSchema,
  checkConflictsQuerySchema,
  type MergeBranchRequest,
  type CheckConflictsQuery,
} from '../schemas/index.js';
import {
  NotGitRepoError,
  GitOperationError,
  BranchExistsError,
} from '../services/git-service.js';

export async function gitRoutes(fastify: FastifyInstance) {
  /**
   * POST /sessions/:id/git/merge - Merge session branch into target branch
   */
  fastify.post<{ Params: { id: string }; Body: MergeBranchRequest }>(
    '/sessions/:id/git/merge',
    async (request, reply) => {
      const { id } = request.params;

      // Validate session ID format
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
      const bodyValidation = mergeBranchSchema.safeParse(request.body);
      if (!bodyValidation.success) {
        return reply.status(400).send({
          error: 'ValidationError',
          message: 'Request validation failed',
          statusCode: 400,
          issues: bodyValidation.error.issues,
        });
      }

      const { targetBranch } = bodyValidation.data;

      try {
        // Get session
        const session = fastify.db.getSession(id);
        if (!session) {
          return reply.status(404).send({
            error: 'SessionNotFoundError',
            message: `Session not found: ${id}`,
            statusCode: 404,
          });
        }

        // Merge session branch into target branch
        await fastify.gitService.mergeBranch(
          session.branchName,
          targetBranch,
          session.rootDirectory,
        );

        return reply.send({ data: { success: true } });
      } catch (error: any) {
        // Handle specific Git errors
        if (error instanceof NotGitRepoError) {
          return reply.status(400).send({
            error: 'NotGitRepoError',
            message: error.message,
            statusCode: 400,
          });
        }

        if (error instanceof GitOperationError) {
          return reply.status(500).send({
            error: 'GitOperationError',
            message: error.message,
            statusCode: 500,
          });
        }

        // Unknown error
        return reply.status(500).send({
          error: 'InternalServerError',
          message: error.message || 'Unknown error occurred',
          statusCode: 500,
        });
      }
    },
  );

  /**
   * GET /sessions/:id/git/conflicts - Check for merge conflicts
   */
  fastify.get<{ Params: { id: string }; Querystring: CheckConflictsQuery }>(
    '/sessions/:id/git/conflicts',
    async (request, reply) => {
      const { id } = request.params;

      // Validate session ID format
      const idValidation = sessionIdSchema.safeParse(id);
      if (!idValidation.success) {
        return reply.status(400).send({
          error: 'ValidationError',
          message: 'Invalid session ID format',
          statusCode: 400,
          issues: idValidation.error.issues,
        });
      }

      // Validate query parameters
      const queryValidation = checkConflictsQuerySchema.safeParse(request.query);
      if (!queryValidation.success) {
        return reply.status(400).send({
          error: 'ValidationError',
          message: 'Invalid query parameters',
          statusCode: 400,
          issues: queryValidation.error.issues,
        });
      }

      const { targetBranch } = queryValidation.data;

      try {
        // Get session
        const session = fastify.db.getSession(id);
        if (!session) {
          return reply.status(404).send({
            error: 'SessionNotFoundError',
            message: `Session not found: ${id}`,
            statusCode: 404,
          });
        }

        // Check for conflicts
        const hasConflicts = await fastify.gitService.detectMergeConflicts(
          session.branchName,
          targetBranch,
          session.rootDirectory,
        );

        return reply.send({ data: { hasConflicts } });
      } catch (error: any) {
        // Handle specific Git errors
        if (error instanceof NotGitRepoError) {
          return reply.status(400).send({
            error: 'NotGitRepoError',
            message: error.message,
            statusCode: 400,
          });
        }

        if (error instanceof GitOperationError) {
          return reply.status(500).send({
            error: 'GitOperationError',
            message: error.message,
            statusCode: 500,
          });
        }

        // Unknown error
        return reply.status(500).send({
          error: 'InternalServerError',
          message: error.message || 'Unknown error occurred',
          statusCode: 500,
        });
      }
    },
  );

  /**
   * DELETE /sessions/:id/git/branch - Delete session branch
   */
  fastify.delete<{ Params: { id: string } }>(
    '/sessions/:id/git/branch',
    async (request, reply) => {
      const { id } = request.params;

      // Validate session ID format
      const idValidation = sessionIdSchema.safeParse(id);
      if (!idValidation.success) {
        return reply.status(400).send({
          error: 'ValidationError',
          message: 'Invalid session ID format',
          statusCode: 400,
          issues: idValidation.error.issues,
        });
      }

      try {
        // Get session
        const session = fastify.db.getSession(id);
        if (!session) {
          return reply.status(404).send({
            error: 'SessionNotFoundError',
            message: `Session not found: ${id}`,
            statusCode: 404,
          });
        }

        // Delete the branch
        await fastify.gitService.deleteBranch(session.branchName, session.rootDirectory);

        return reply.send({ data: { success: true } });
      } catch (error: any) {
        // Handle specific Git errors
        if (error instanceof NotGitRepoError) {
          return reply.status(400).send({
            error: 'NotGitRepoError',
            message: error.message,
            statusCode: 400,
          });
        }

        if (error instanceof GitOperationError) {
          return reply.status(500).send({
            error: 'GitOperationError',
            message: error.message,
            statusCode: 500,
          });
        }

        // Unknown error
        return reply.status(500).send({
          error: 'InternalServerError',
          message: error.message || 'Unknown error occurred',
          statusCode: 500,
        });
      }
    },
  );
}
