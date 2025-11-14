/**
 * Error codes and messages for consistent error handling
 * Centralized for maintainability and localization support
 */

export const ERROR_CODES = {
  // Configuration Errors (1000-1099)
  CONFIG_NOT_FOUND: 'CONFIG_NOT_FOUND',
  CONFIG_INVALID: 'CONFIG_INVALID',
  CONFIG_MISSING_REQUIRED: 'CONFIG_MISSING_REQUIRED',
  
  // Authentication Errors (1100-1199)
  AUTH_MISSING_TOKEN: 'AUTH_MISSING_TOKEN',
  AUTH_INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  
  // Network Errors (1200-1299)
  NETWORK_CONNECTION_FAILED: 'NETWORK_CONNECTION_FAILED',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_RATE_LIMITED: 'NETWORK_RATE_LIMITED',
  NETWORK_SERVER_ERROR: 'NETWORK_SERVER_ERROR',
  NETWORK_UNAVAILABLE: 'NETWORK_UNAVAILABLE',
  
  // Validation Errors (1300-1399)
  VALIDATION_INVALID_INPUT: 'VALIDATION_INVALID_INPUT',
  VALIDATION_MISSING_FIELD: 'VALIDATION_MISSING_FIELD',
  VALIDATION_INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',
  VALIDATION_OUT_OF_RANGE: 'VALIDATION_OUT_OF_RANGE',
  
  // Task Management Errors (1400-1499)
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  TASK_ALREADY_RUNNING: 'TASK_ALREADY_RUNNING',
  TASK_FAILED: 'TASK_FAILED',
  TASK_TIMEOUT: 'TASK_TIMEOUT',
  TASK_CANCELLED: 'TASK_CANCELLED',
  TASK_LIMIT_EXCEEDED: 'TASK_LIMIT_EXCEEDED',
  
  // Device Errors (1500-1599)
  DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
  DEVICE_UNAVAILABLE: 'DEVICE_UNAVAILABLE',
  DEVICE_CONNECTION_FAILED: 'DEVICE_CONNECTION_FAILED',
  DEVICE_INVALID_TYPE: 'DEVICE_INVALID_TYPE',
  
  // Backup Errors (1600-1699)
  BACKUP_NOT_FOUND: 'BACKUP_NOT_FOUND',
  BACKUP_FAILED: 'BACKUP_FAILED',
  BACKUP_CORRUPTED: 'BACKUP_CORRUPTED',
  BACKUP_IN_PROGRESS: 'BACKUP_IN_PROGRESS',
  
  // Command Errors (1700-1799)
  COMMAND_NOT_FOUND: 'COMMAND_NOT_FOUND',
  COMMAND_FAILED: 'COMMAND_FAILED',
  COMMAND_TIMEOUT: 'COMMAND_TIMEOUT',
  COMMAND_PERMISSION_DENIED: 'COMMAND_PERMISSION_DENIED',
  
  // MCP Server Errors (1800-1899)
  MCP_SERVER_ERROR: 'MCP_SERVER_ERROR',
  MCP_PROTOCOL_ERROR: 'MCP_PROTOCOL_ERROR',
  MCP_TOOL_NOT_FOUND: 'MCP_TOOL_NOT_FOUND',
  MCP_INVALID_REQUEST: 'MCP_INVALID_REQUEST',
  
  // System Errors (1900-1999)
  SYSTEM_INTERNAL_ERROR: 'SYSTEM_INTERNAL_ERROR',
  SYSTEM_MEMORY_ERROR: 'SYSTEM_MEMORY_ERROR',
  SYSTEM_DISK_ERROR: 'SYSTEM_DISK_ERROR',
  SYSTEM_MAINTENANCE_MODE: 'SYSTEM_MAINTENANCE_MODE',
} as const;

export const ERROR_MESSAGES = {
  // Configuration Errors
  [ERROR_CODES.CONFIG_NOT_FOUND]: 'Configuration file not found',
  [ERROR_CODES.CONFIG_INVALID]: 'Configuration file is invalid',
  [ERROR_CODES.CONFIG_MISSING_REQUIRED]: 'Required configuration field is missing',
  
  // Authentication Errors
  [ERROR_CODES.AUTH_MISSING_TOKEN]: 'Authentication token is required',
  [ERROR_CODES.AUTH_INVALID_TOKEN]: 'Invalid authentication token provided',
  [ERROR_CODES.AUTH_TOKEN_EXPIRED]: 'Authentication token has expired',
  [ERROR_CODES.AUTH_UNAUTHORIZED]: 'Unauthorized access',
  
  // Network Errors
  [ERROR_CODES.NETWORK_CONNECTION_FAILED]: 'Failed to connect to Restorepoint server',
  [ERROR_CODES.NETWORK_TIMEOUT]: 'Request timed out',
  [ERROR_CODES.NETWORK_RATE_LIMITED]: 'Rate limit exceeded, please try again later',
  [ERROR_CODES.NETWORK_SERVER_ERROR]: 'Restorepoint server error',
  [ERROR_CODES.NETWORK_UNAVAILABLE]: 'Restorepoint service is currently unavailable',
  
  // Validation Errors
  [ERROR_CODES.VALIDATION_INVALID_INPUT]: 'Invalid input provided',
  [ERROR_CODES.VALIDATION_MISSING_FIELD]: 'Required field is missing',
  [ERROR_CODES.VALIDATION_INVALID_FORMAT]: 'Invalid data format',
  [ERROR_CODES.VALIDATION_OUT_OF_RANGE]: 'Value is out of valid range',
  
  // Task Management Errors
  [ERROR_CODES.TASK_NOT_FOUND]: 'Task not found',
  [ERROR_CODES.TASK_ALREADY_RUNNING]: 'Task is already running',
  [ERROR_CODES.TASK_FAILED]: 'Task execution failed',
  [ERROR_CODES.TASK_TIMEOUT]: 'Task execution timed out',
  [ERROR_CODES.TASK_CANCELLED]: 'Task was cancelled',
  [ERROR_CODES.TASK_LIMIT_EXCEEDED]: 'Maximum concurrent task limit exceeded',
  
  // Device Errors
  [ERROR_CODES.DEVICE_NOT_FOUND]: 'Device not found',
  [ERROR_CODES.DEVICE_UNAVAILABLE]: 'Device is currently unavailable',
  [ERROR_CODES.DEVICE_CONNECTION_FAILED]: 'Failed to connect to device',
  [ERROR_CODES.DEVICE_INVALID_TYPE]: 'Invalid device type',
  
  // Backup Errors
  [ERROR_CODES.BACKUP_NOT_FOUND]: 'Backup not found',
  [ERROR_CODES.BACKUP_FAILED]: 'Backup operation failed',
  [ERROR_CODES.BACKUP_CORRUPTED]: 'Backup file is corrupted',
  [ERROR_CODES.BACKUP_IN_PROGRESS]: 'Backup operation is already in progress',
  
  // Command Errors
  [ERROR_CODES.COMMAND_NOT_FOUND]: 'Command not found',
  [ERROR_CODES.COMMAND_FAILED]: 'Command execution failed',
  [ERROR_CODES.COMMAND_TIMEOUT]: 'Command execution timed out',
  [ERROR_CODES.COMMAND_PERMISSION_DENIED]: 'Permission denied for command execution',
  
  // MCP Server Errors
  [ERROR_CODES.MCP_SERVER_ERROR]: 'MCP server internal error',
  [ERROR_CODES.MCP_PROTOCOL_ERROR]: 'MCP protocol error',
  [ERROR_CODES.MCP_TOOL_NOT_FOUND]: 'Requested tool not found',
  [ERROR_CODES.MCP_INVALID_REQUEST]: 'Invalid MCP request',
  
  // System Errors
  [ERROR_CODES.SYSTEM_INTERNAL_ERROR]: 'Internal system error',
  [ERROR_CODES.SYSTEM_MEMORY_ERROR]: 'System memory error',
  [ERROR_CODES.SYSTEM_DISK_ERROR]: 'System disk error',
  [ERROR_CODES.SYSTEM_MAINTENANCE_MODE]: 'System is in maintenance mode',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/**
 * Custom error class with structured error information
 */
export class RestorepointError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    code: ErrorCode,
    message?: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    const errorMessage = message || ERROR_MESSAGES[code] || 'Unknown error occurred';
    super(errorMessage);
    this.name = 'RestorepointError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RestorepointError);
    }
  }

  /**
   * Convert error to JSON representation
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }

  /**
   * Create error from HTTP response
   */
  public static fromHttpResponse(
    statusCode: number,
    responseBody?: unknown
  ): RestorepointError {
    let code: ErrorCode;
    let message: string;

    switch (statusCode) {
      case 400:
        code = ERROR_CODES.VALIDATION_INVALID_INPUT;
        message = 'Invalid request data';
        break;
      case 401:
        code = ERROR_CODES.AUTH_UNAUTHORIZED;
        message = 'Unauthorized access';
        break;
      case 403:
        code = ERROR_CODES.AUTH_UNAUTHORIZED;
        message = 'Access forbidden';
        break;
      case 404:
        code = ERROR_CODES.DEVICE_NOT_FOUND;
        message = 'Resource not found';
        break;
      case 429:
        code = ERROR_CODES.NETWORK_RATE_LIMITED;
        message = 'Rate limit exceeded';
        break;
      case 500:
        code = ERROR_CODES.NETWORK_SERVER_ERROR;
        message = 'Server error';
        break;
      case 503:
        code = ERROR_CODES.NETWORK_UNAVAILABLE;
        message = 'Service unavailable';
        break;
      default:
        code = ERROR_CODES.NETWORK_CONNECTION_FAILED;
        message = 'Network request failed';
    }

    // Try to extract detailed error message from response body
    if (responseBody && typeof responseBody === 'object') {
      const body = responseBody as Record<string, unknown>;
      if (body.message && typeof body.message === 'string') {
        message = body.message;
      }
    }

    return new RestorepointError(code, message, statusCode, responseBody as Record<string, unknown>);
  }
}