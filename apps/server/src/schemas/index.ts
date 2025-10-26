/**
 * Zod Schemas for API Request/Response Validation
 */

import { z } from 'zod';

// ============================================================================
// Session Schemas
// ============================================================================

export const createSessionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  rootDirectory: z.string().min(1, 'Root directory is required'),
  baseBranch: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type CreateSessionRequest = z.infer<typeof createSessionSchema>;

export const updateSessionSchema = z.object({
  title: z
    .string()
    .min(1, 'Title must not be empty')
    .max(255, 'Title must be less than 255 characters')
    .optional(),
  metadata: z.record(z.any()).optional(),
});

export type UpdateSessionRequest = z.infer<typeof updateSessionSchema>;

export const sessionIdSchema = z
  .string()
  .regex(/^sess_[a-zA-Z0-9_-]{12}$/, 'Invalid session ID format');

export const deleteSessionQuerySchema = z.object({
  deleteGitBranch: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

export type DeleteSessionQuery = z.infer<typeof deleteSessionQuerySchema>;

// ============================================================================
// Message Schemas
// ============================================================================

export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message content is required'),
});

export type SendMessageRequest = z.infer<typeof sendMessageSchema>;

// ============================================================================
// Settings Schemas
// ============================================================================

export const settingKeySchema = z.string().min(1, 'Setting key is required');

export const setSettingSchema = z
  .object({
    value: z.any(),
  })
  .strict() // Require 'value' field to be present
  .refine((data) => 'value' in data, {
    message: 'value field is required',
  });

export type SetSettingRequest = z.infer<typeof setSettingSchema>;

// ============================================================================
// Git Operation Schemas
// ============================================================================

export const mergeBranchSchema = z.object({
  targetBranch: z.string().optional().default('main'),
});

export type MergeBranchRequest = z.infer<typeof mergeBranchSchema>;

export const checkConflictsQuerySchema = z.object({
  targetBranch: z.string().optional().default('main'),
});

export type CheckConflictsQuery = z.infer<typeof checkConflictsQuerySchema>;

// ============================================================================
// Response Schemas
// ============================================================================

export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
  issues: z.array(z.any()).optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const successResponseSchema = z.object({
  data: z.any(),
});

export type SuccessResponse = z.infer<typeof successResponseSchema>;
