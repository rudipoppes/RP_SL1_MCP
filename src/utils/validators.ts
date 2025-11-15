import { z } from 'zod';
import type { RestorepointError } from '../constants/error-codes.js';
import { ERROR_CODES, RestorepointError as RestorepointErrorClass } from '../constants/error-codes.js';

/**
 * Input validation utilities using Zod schemas
 * Provides comprehensive validation with detailed error messages
 */

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly data?: unknown;
}

/**
 * Device ID schema
 */
const deviceIdSchema = z.string()
  .min(1, 'Device ID is required')
  .max(100, 'Device ID must be 100 characters or less')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Device ID can only contain alphanumeric characters, hyphens, and underscores');

/**
 * Common validation schemas
 */
export const CommonSchemas = {
  // Identifiers
  deviceId: deviceIdSchema,

  taskId: z.string()
    .min(1, 'Task ID is required')
    .max(100, 'Task ID must be 100 characters or less')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Task ID can only contain alphanumeric characters, hyphens, and underscores'),

  backupId: z.string()
    .min(1, 'Backup ID is required')
    .max(100, 'Backup ID must be 100 characters or less'),

  agentId: z.string()
    .min(1, 'Agent ID is required')
    .max(100, 'Agent ID must be 100 characters or less'),

  // Names and descriptions
  backupName: z.string()
    .min(1, 'Backup name is required')
    .max(200, 'Backup name must be 200 characters or less')
    .regex(/^[a-zA-Z0-9\s_-]+$/, 'Backup name can only contain alphanumeric characters, spaces, hyphens, and underscores'),

  deviceName: z.string()
    .min(1, 'Device name is required')
    .max(200, 'Device name must be 200 characters or less'),

  commandText: z.string()
    .min(1, 'Command text is required')
    .max(10000, 'Command text must be 10,000 characters or less'),

  // Pagination
  limit: z.number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(1000, 'Limit cannot exceed 1000'),

  offset: z.number()
    .int('Offset must be an integer')
    .min(0, 'Offset must be non-negative'),

  // Time values
  timeoutMs: z.number()
    .int('Timeout must be an integer')
    .min(1000, 'Timeout must be at least 1000ms')
    .max(3600000, 'Timeout cannot exceed 1 hour'),

  // URLs and IP addresses
  ipAddress: z.string()
    .regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, 'Invalid IPv4 address format'),

  hostname: z.string()
    .min(1, 'Hostname is required')
    .max(253, 'Hostname must be 253 characters or less')
    .regex(/^[a-zA-Z0-9.-]+$/, 'Hostname can only contain alphanumeric characters, hyphens, and dots'),

  // Arrays
  deviceIds: z.array(deviceIdSchema)
    .min(1, 'At least one device ID is required')
    .max(100, 'Cannot process more than 100 devices at once'),

  // Enums
  logLevel: z.enum(['error', 'warn', 'info', 'debug'], {
    errorMap: (issue, ctx) => ({
      message: 'Log level must be one of: error, warn, info, debug',
    }),
  }),

  sortOrder: z.enum(['asc', 'desc'], {
    errorMap: (issue, ctx) => ({
      message: 'Sort order must be either "asc" or "desc"',
    }),
  }),
} as const;

/**
 * Device-specific schemas
 */
export const DeviceSchemas = {
  createDevice: z.object({
    name: CommonSchemas.deviceName,
    type: z.string().min(1, 'Device type is required'),
    ipAddress: CommonSchemas.ipAddress.optional(),
    hostname: CommonSchemas.hostname.optional(),
    credentials: z.object({
      username: z.string().min(1, 'Username is required'),
      password: z.string().min(1, 'Password is required'),
    }),
    description: z.string().max(500, 'Description must be 500 characters or less').optional(),
    enabled: z.boolean().default(true),
  }),

  updateDevice: z.object({
    name: CommonSchemas.deviceName.optional(),
    type: z.string().min(1, 'Device type is required').optional(),
    ipAddress: CommonSchemas.ipAddress.optional(),
    hostname: CommonSchemas.hostname.optional(),
    credentials: z.object({
      username: z.string().min(1, 'Username is required'),
      password: z.string().min(1, 'Password is required'),
    }).optional(),
    description: z.string().max(500, 'Description must be 500 characters or less').optional(),
    enabled: z.boolean().optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  }),

  listDevices: z.object({
    limit: CommonSchemas.limit.default(50),
    offset: CommonSchemas.offset.default(0),
    sortBy: z.enum(['name', 'type', 'ipAddress', 'hostname', 'createdAt', 'updatedAt']).optional(),
    sortOrder: CommonSchemas.sortOrder.default('desc'),
    filter: z.object({
      type: z.string().optional(),
      enabled: z.boolean().optional(),
      searchTerm: z.string().max(100, 'Search term must be 100 characters or less').optional(),
    }).optional(),
  }),
} as const;

/**
 * Backup-specific schemas
 */
export const BackupSchemas = {
  createBackup: z.object({
    deviceIds: CommonSchemas.deviceIds,
    backupName: CommonSchemas.backupName,
    backupType: z.enum(['full', 'incremental', 'config-only']).default('full'),
    description: z.string().max(1000, 'Description must be 1000 characters or less').optional(),
    priority: z.enum(['low', 'normal', 'high']).default('normal'),
  }),

  restoreBackup: z.object({
    backupId: CommonSchemas.backupId,
    deviceIds: CommonSchemas.deviceIds.optional(),
    restoreType: z.enum(['full', 'config-only']).default('full'),
    confirmRestore: z.boolean().default(false),
  }),

  listBackups: z.object({
    limit: CommonSchemas.limit.default(50),
    offset: CommonSchemas.offset.default(0),
    sortBy: z.enum(['backupName', 'createdAt', 'deviceCount', 'status']).optional(),
    sortOrder: CommonSchemas.sortOrder.default('desc'),
    filter: z.object({
      deviceId: CommonSchemas.deviceId.optional(),
      status: z.enum(['completed', 'failed', 'in_progress']).optional(),
      dateFrom: z.string().datetime().optional(),
      dateTo: z.string().datetime().optional(),
    }).optional(),
  }),

  backupStatus: z.object({
    taskId: CommonSchemas.taskId,
  }),
} as const;

/**
 * Command-specific schemas
 */
export const CommandSchemas = {
  executeCommand: z.object({
    deviceIds: CommonSchemas.deviceIds,
    command: CommonSchemas.commandText,
    commandType: z.enum(['show', 'configure', 'execute', 'custom']).default('show'),
    timeout: CommonSchemas.timeoutMs.default(30000),
    saveOutput: z.boolean().default(true),
    description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  }),

  scheduleCommand: z.object({
    deviceIds: CommonSchemas.deviceIds,
    command: CommonSchemas.commandText,
    schedule: z.string().min(1, 'Schedule expression is required'),
    commandType: z.enum(['show', 'configure', 'execute', 'custom']).default('show'),
    enabled: z.boolean().default(true),
    description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  }),

  commandStatus: z.object({
    taskId: CommonSchemas.taskId,
  }),

  listCommands: z.object({
    limit: CommonSchemas.limit.default(50),
    offset: CommonSchemas.offset.default(0),
    sortBy: z.enum(['createdAt', 'command', 'status', 'deviceCount']).optional(),
    sortOrder: CommonSchemas.sortOrder.default('desc'),
    filter: z.object({
      deviceId: CommonSchemas.deviceId.optional(),
      status: z.enum(['completed', 'failed', 'in_progress', 'cancelled']).optional(),
      commandType: z.enum(['show', 'configure', 'execute', 'custom']).optional(),
    }).optional(),
  }),
} as const;

/**
 * Validation utility class
 */
export class InputValidator {
  /**
   * Validate input data against a schema
   */
  public static validate<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult {
    try {
      const result = schema.parse(data);
      return {
        isValid: true,
        errors: [],
        data: result,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        return {
          isValid: false,
          errors,
        };
      }

      return {
        isValid: false,
        errors: ['Validation error: ' + (error instanceof Error ? error.message : 'Unknown error')],
      };
    }
  }

  /**
   * Validate and throw error if invalid
   */
  public static validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
    const result = this.validate(schema, data);
    if (!result.isValid) {
      throw new RestorepointErrorClass(
        ERROR_CODES.VALIDATION_INVALID_INPUT,
        `Validation failed: ${result.errors.join(', ')}`
      );
    }
    return result.data as T;
  }

  /**
   * Validate required fields
   */
  public static validateRequiredFields(
    data: Record<string, unknown>,
    requiredFields: readonly string[]
  ): ValidationResult {
    const errors: string[] = [];

    for (const field of requiredFields) {
      if (!(field in data) || data[field] === null || data[field] === undefined || data[field] === '') {
        errors.push(`${field}: Required field is missing or empty`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate array field
   */
  public static validateArray(
    data: unknown,
    fieldName: string,
    minLength: number = 1,
    maxLength: number = 100
  ): ValidationResult {
    const errors: string[] = [];

    if (!Array.isArray(data)) {
      errors.push(`${fieldName}: Must be an array`);
    } else {
      if (data.length < minLength) {
        errors.push(`${fieldName}: Array must contain at least ${minLength} item(s)`);
      }
      if (data.length > maxLength) {
        errors.push(`${fieldName}: Array cannot contain more than ${maxLength} item(s)`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Sanitize string input
   */
  public static sanitizeString(input: unknown): string {
    if (typeof input !== 'string') {
      return '';
    }
    return input.trim().replace(/[<>]/g, '');
  }

  /**
   * Validate IP address format
   */
  public static validateIpAddress(ip: string): boolean {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  }

  /**
   * Validate hostname format
   */
  public static validateHostname(hostname: string): boolean {
    const hostnameRegex = /^[a-zA-Z0-9.-]+$/;
    return hostnameRegex.test(hostname) && hostname.length <= 253;
  }
}