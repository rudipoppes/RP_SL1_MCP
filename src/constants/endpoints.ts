/**
 * Application constants and endpoint definitions
 * Centralized for maintainability and consistency
 */

export const RESTOREPOINT_ENDPOINTS = {
  // Device Management
  DEVICES: '/devices',
  DEVICE_BY_ID: (id: string): string => `/devices/${id}`,
  DEVICE_GROUPS: '/device-groups',
  DEVICE_GROUP_BY_ID: (id: string): string => `/device-groups/${id}`,
  
  // Backup Operations
  BACKUPS: '/backups',
  BACKUP_BY_ID: (id: string): string => `/backups/${id}`,
  BACKUP_EXECUTE: '/backups/execute',
  BACKUP_STATUS: (taskId: string): string => `/backups/status/${taskId}`,
  
  // Restore Operations
  RESTORES: '/restores',
  RESTORE_BY_ID: (id: string): string => `/restores/${id}`,
  RESTORE_EXECUTE: '/restores/execute',
  RESTORE_STATUS: (taskId: string): string => `/restores/status/${taskId}`,
  
  // Command Operations
  COMMANDS: '/commands',
  COMMAND_BY_ID: (id: string): string => `/commands/${id}`,
  COMMAND_EXECUTE: '/commands/execute',
  COMMAND_STATUS: (taskId: string): string => `/commands/status/${taskId}`,
  COMMAND_SCHEDULE: '/commands/schedule',
  COMMAND_OUTPUT: (taskId: string): string => `/commands/output/${taskId}`,
  
  // Agent Management
  AGENTS: '/agents',
  AGENT_BY_ID: (id: string): string => `/agents/${id}`,
  AGENT_STATUS: (id: string): string => `/agents/${id}/status`,
  AGENT_DEBUG: (id: string): string => `/agents/${id}/debug`,
  
  // System Administration
  USERS: '/users',
  USER_BY_ID: (id: string): string => `/users/${id}`,
  LICENSES: '/licenses',
  SYSTEM_STATUS: '/system/status',
  SYSTEM_MAINTENANCE: '/system/maintenance',
  
  // Logs and Monitoring
  LOGS: '/logs',
  LOGS_FILTER: '/logs/filter',
  
  // Authentication
  LOGIN: '/login',
  LOGOUT: '/logout',
  TOKEN_REFRESH: '/token/refresh',
} as const;

export const HTTP_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  NETWORK_CONNECTION_FAILED: 504,
} as const;

export const API_CONSTANTS = {
  // HTTP API Server Configuration
  SERVER_NAME: 'RP_SL1_API',
  SERVER_VERSION: '2.0.0',
  DEFAULT_PORT: 3000,
  DEFAULT_HOST: '0.0.0.0',
  
  // CORS Configuration
  CORS: {
    ALLOWED_ORIGINS: ['http://localhost:3001', 'http://localhost:3002', 'http://localhost:4001'] as string[],
    ALLOWED_METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    ALLOWED_HEADERS: ['Content-Type', 'Authorization', 'X-Request-ID'],
  },
  
  // Rate Limiting
  RATE_LIMIT: {
    WINDOW_MS: 60000, // 1 minute
    MAX_REQUESTS: 1000, // 1000 requests per minute
  },
  
  // Task Management
  DEFAULT_TASK_TIMEOUT: 3600000, // 1 hour
  MAX_CONCURRENT_TASKS: 10,
  TASK_CLEANUP_INTERVAL: 300000, // 5 minutes
  
  // Retry Configuration
  DEFAULT_RETRY_ATTEMPTS: 3,
  DEFAULT_RETRY_DELAY: 1000, // 1 second
  MAX_RETRY_DELAY: 30000, // 30 seconds
  
  // API Response Limits
  MAX_RESPONSE_SIZE: 10485760, // 10MB
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 1000,
  
  // Security Headers
  SECURITY: {
    HELMET_CONFIG: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
    },
  },
} as const;

export const TASK_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  TIMEOUT: 'timeout',
} as const;

export const DEVICE_TYPES = {
  UNKNOWN: 'unknown',
  CISCO_IOS: 'cisco-ios',
  CISCO_NXOS: 'cisco-nxos',
  CISCO_ASA: 'cisco-asa',
  PALO_ALTO: 'palo-alto',
  FORTINET: 'fortinet',
  JUNIPER: 'juniper',
  LINUX: 'linux',
  WINDOWS: 'windows',
  ARUBA: 'aruba',
} as const;

export const BACKUP_TYPES = {
  FULL: 'full',
  INCREMENTAL: 'incremental',
  CONFIG_ONLY: 'config-only',
  RUNNING_CONFIG: 'running-config',
  STARTUP_CONFIG: 'startup-config',
} as const;

export const COMMAND_TYPES = {
  SHOW: 'show',
  CONFIGURE: 'configure',
  EXECUTE: 'execute',
  CUSTOM: 'custom',
} as const;

export type TaskStatus = typeof TASK_STATUS[keyof typeof TASK_STATUS];
export type DeviceType = typeof DEVICE_TYPES[keyof typeof DEVICE_TYPES];
export type BackupType = typeof BACKUP_TYPES[keyof typeof BACKUP_TYPES];
export type CommandType = typeof COMMAND_TYPES[keyof typeof COMMAND_TYPES];