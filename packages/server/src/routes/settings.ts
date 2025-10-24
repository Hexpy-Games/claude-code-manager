/**
 * Settings Routes
 *
 * Endpoints:
 * - GET /settings - Get all settings
 * - GET /settings/:key - Get setting value
 * - PUT /settings/:key - Set/update setting value
 * - DELETE /settings/:key - Delete setting
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { setSettingSchema, settingKeySchema, type SetSettingRequest } from '../schemas/index.js';

export async function settingsRoutes(fastify: FastifyInstance) {
  /**
   * GET /settings - Get all settings
   */
  fastify.get('/settings', async (request, reply) => {
    const settings = fastify.db.getAllSettings();

    return reply.send({
      data: { settings },
    });
  });

  /**
   * GET /settings/:key - Get setting value
   */
  fastify.get<{ Params: { key: string } }>('/settings/:key', async (request, reply) => {
    const { key } = request.params;

    // Validate key format
    const keyValidation = settingKeySchema.safeParse(key);
    if (!keyValidation.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid setting key',
        statusCode: 400,
        issues: keyValidation.error.issues,
      });
    }

    // Get setting from database
    const setting = fastify.db.getSetting(key);

    if (!setting) {
      return reply.status(404).send({
        error: 'SettingNotFoundError',
        message: `Setting not found: ${key}`,
        statusCode: 404,
      });
    }

    return reply.send({
      data: {
        key: setting.key,
        value: setting.value,
      },
    });
  });

  /**
   * PUT /settings/:key - Set/update setting value
   */
  fastify.put<{ Params: { key: string }; Body: SetSettingRequest }>(
    '/settings/:key',
    async (request, reply) => {
      const { key } = request.params;

      // Validate key format
      const keyValidation = settingKeySchema.safeParse(key);
      if (!keyValidation.success) {
        return reply.status(400).send({
          error: 'ValidationError',
          message: 'Invalid setting key',
          statusCode: 400,
          issues: keyValidation.error.issues,
        });
      }

      // Validate request body
      const validationResult = setSettingSchema.safeParse(request.body);
      if (!validationResult.success) {
        return reply.status(400).send({
          error: 'ValidationError',
          message: 'Request validation failed',
          statusCode: 400,
          issues: validationResult.error.issues,
        });
      }

      const { value } = validationResult.data;

      // Set setting in database (upsert)
      const setting = fastify.db.setSetting(key, value);

      return reply.send({
        data: {
          key: setting.key,
          value: setting.value,
        },
      });
    },
  );

  /**
   * DELETE /settings/:key - Delete setting
   */
  fastify.delete<{ Params: { key: string } }>('/settings/:key', async (request, reply) => {
    const { key } = request.params;

    // Validate key format
    const keyValidation = settingKeySchema.safeParse(key);
    if (!keyValidation.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid setting key',
        statusCode: 400,
        issues: keyValidation.error.issues,
      });
    }

    // Check if setting exists
    const setting = fastify.db.getSetting(key);
    if (!setting) {
      return reply.status(404).send({
        error: 'SettingNotFoundError',
        message: `Setting not found: ${key}`,
        statusCode: 404,
      });
    }

    // Delete the setting
    fastify.db.deleteSetting(key);

    return reply.send({
      data: { success: true },
    });
  });
}
