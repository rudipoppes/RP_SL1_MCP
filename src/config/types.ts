/**
 * Configuration type definitions for RP_SL1_MCP
 * Follows strict TypeScript standards with comprehensive validation
 */

export interface RestorepointConfig {
  readonly serverUrl: string;
  readonly apiVersion: 'v1' | 'v2';
  readonly token: string;
  readonly timeout: number;
  readonly retryAttempts: number;
  readonly retryDelay: number;
}

export interface McpConfig {
  readonly serverName: string;
  readonly version: string;
  readonly logLevel: 'error' | 'warn' | 'info' | 'debug';
  readonly maxConcurrentTasks: number;
}

export interface AsyncConfig {
  readonly maxConcurrentTasks: number;
  readonly taskTimeout: number;
  readonly cleanupInterval: number;
}

export interface AppConfig {
  readonly restorepoint: RestorepointConfig;
  readonly mcp: McpConfig;
  readonly async: AsyncConfig;
}

export interface ConfigValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

interface PartialRestorepointConfig {
  readonly apiVersion?: 'v1' | 'v2';
  readonly timeout?: number;
  readonly retryAttempts?: number;
  readonly retryDelay?: number;
}

interface PartialMcpConfig {
  readonly logLevel?: 'error' | 'warn' | 'info' | 'debug';
  readonly maxConcurrentTasks?: number;
}

interface PartialAsyncConfig {
  readonly maxConcurrentTasks?: number;
  readonly taskTimeout?: number;
  readonly cleanupInterval?: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  restorepoint: {
    apiVersion: 'v2' as const,
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
  },
  mcp: {
    logLevel: 'info' as const,
    maxConcurrentTasks: 10,
  },
  async: {
    maxConcurrentTasks: 10,
    taskTimeout: 3600000,
    cleanupInterval: 300000,
  },
} as const;