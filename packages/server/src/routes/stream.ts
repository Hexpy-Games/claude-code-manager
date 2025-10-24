/**
 * WebSocket Streaming Routes
 *
 * Endpoints:
 * - WS /sessions/:id/stream - Real-time streaming of Claude responses
 */

import type { FastifyInstance } from 'fastify';
import { sessionIdSchema } from '../schemas/index.js';
import {
  SessionNotFoundError,
  InvalidMessageError,
  RateLimitError,
  NetworkError,
  ClaudeAPIError,
} from '../services/claude-agent-service.js';

// WebSocket message types
interface ClientMessage {
  type: 'message' | 'ping';
  content?: string;
}

interface ServerMessage {
  type: 'connected' | 'content_chunk' | 'tool_use' | 'tool_result' | 'done' | 'error' | 'pong';
  [key: string]: any;
}

export async function streamRoutes(fastify: FastifyInstance) {
  /**
   * WebSocket endpoint for streaming Claude responses
   * WS /sessions/:id/stream
   */
  fastify.get<{ Params: { id: string } }>(
    '/sessions/:id/stream',
    { websocket: true },
    async (connection, request) => {
      const { id: sessionId } = request.params;

      // Validate session ID format
      const idValidation = sessionIdSchema.safeParse(sessionId);
      if (!idValidation.success) {
        connection.close(4400, 'Invalid session ID format');
        return;
      }

      // Verify session exists
      try {
        const session = await fastify.sessionManager.getSession(sessionId);
        if (!session) {
          connection.close(4404, 'Session not found');
          return;
        }
      } catch (error) {
        connection.close(4404, 'Session not found');
        return;
      }

      // Send connection acknowledgment
      const connectedMessage: ServerMessage = {
        type: 'connected',
        sessionId,
      };
      connection.send(JSON.stringify(connectedMessage));

      // Handle incoming messages
      connection.on('message', async (rawMessage: Buffer) => {
        try {
          // Parse client message
          const messageStr = rawMessage.toString('utf-8');
          let clientMessage: ClientMessage;

          try {
            clientMessage = JSON.parse(messageStr);
          } catch (error) {
            const errorMessage: ServerMessage = {
              type: 'error',
              error: 'InvalidJSON',
              message: 'Failed to parse JSON message',
              code: 'INVALID_JSON',
            };
            connection.send(JSON.stringify(errorMessage));
            return;
          }

          // Handle ping/pong
          if (clientMessage.type === 'ping') {
            const pongMessage: ServerMessage = {
              type: 'pong',
            };
            connection.send(JSON.stringify(pongMessage));
            return;
          }

          // Handle message type
          if (clientMessage.type !== 'message') {
            const errorMessage: ServerMessage = {
              type: 'error',
              error: 'InvalidMessageType',
              message: `Invalid message type: ${clientMessage.type}`,
              code: 'INVALID_MESSAGE_TYPE',
            };
            connection.send(JSON.stringify(errorMessage));
            return;
          }

          // Validate content
          if (!clientMessage.content || clientMessage.content.trim() === '') {
            const errorMessage: ServerMessage = {
              type: 'error',
              error: 'InvalidMessage',
              message: 'Message content is required',
              code: 'INVALID_MESSAGE',
            };
            connection.send(JSON.stringify(errorMessage));
            return;
          }

          // Stream response from Claude
          try {
            const stream = fastify.claudeAgent.streamMessage(sessionId, clientMessage.content);
            let index = 0;

            for await (const chunk of stream) {
              // Check if connection is still open
              if (connection.readyState !== connection.OPEN) {
                break;
              }

              // Send content chunk
              const chunkMessage: ServerMessage = {
                type: 'content_chunk',
                content: chunk,
                index: index++,
              };
              connection.send(JSON.stringify(chunkMessage));
            }

            // Send completion message
            if (connection.readyState === connection.OPEN) {
              const doneMessage: ServerMessage = {
                type: 'done',
                stopReason: 'end_turn',
              };
              connection.send(JSON.stringify(doneMessage));
            }
          } catch (error) {
            // Handle service errors
            let errorType = 'UnknownError';
            let errorMessage = 'An unknown error occurred';
            let errorCode = 'UNKNOWN_ERROR';

            if (error instanceof SessionNotFoundError) {
              errorType = 'SessionNotFoundError';
              errorMessage = error.message;
              errorCode = 'SESSION_NOT_FOUND';
            } else if (error instanceof InvalidMessageError) {
              errorType = 'InvalidMessageError';
              errorMessage = error.message;
              errorCode = 'INVALID_MESSAGE';
            } else if (error instanceof RateLimitError) {
              errorType = 'RateLimitError';
              errorMessage = error.message;
              errorCode = 'RATE_LIMIT';
            } else if (error instanceof NetworkError) {
              errorType = 'NetworkError';
              errorMessage = error.message;
              errorCode = 'NETWORK_ERROR';
            } else if (error instanceof ClaudeAPIError) {
              errorType = 'ClaudeAPIError';
              errorMessage = error.message;
              errorCode = 'CLAUDE_API_ERROR';
            } else if (error instanceof Error) {
              errorMessage = error.message;
            }

            const errorResponse: ServerMessage = {
              type: 'error',
              error: errorType,
              message: errorMessage,
              code: errorCode,
            };
            connection.send(JSON.stringify(errorResponse));
          }
        } catch (error) {
          // Catch-all for unexpected errors
          const errorMessage: ServerMessage = {
            type: 'error',
            error: 'InternalError',
            message: 'An internal error occurred',
            code: 'INTERNAL_ERROR',
          };
          connection.send(JSON.stringify(errorMessage));
        }
      });

      // Handle connection close
      connection.on('close', () => {
        // Clean up resources
        // No specific cleanup needed as Fastify handles this
        fastify.log.info(`WebSocket connection closed for session: ${sessionId}`);
      });

      // Handle connection errors
      connection.on('error', (error: Error) => {
        fastify.log.error({ err: error, sessionId }, 'WebSocket error');
      });
    }
  );
}
