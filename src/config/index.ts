import { promises as fs } from 'fs';
import { resolve } from 'path';
import { z } from 'zod';
import type { AppConfig, ConfigValidationResult, RestorepointConfig, McpConfig, AsyncConfig } from './types.js';

/**
 * Zod schemas for configuration validation
 */
const RestorepointConfigSchema = z.object({
  serverUrl: z.string().url().min(1, 'Server URL is required'),
  apiVersion: z.enum(['v1', 'v2']).default('v2'),
  token: z.string().min(1, 'Token is required'),
  timeout: z.number().int().min(1000).max(300000).default(30000),
  retryAttempts: z.number().int().min(0).max(10).default(3),
  retryDelay: z.number().int().min(100).max(60000).default(1000),
});

const McpConfigSchema = z.object({
  serverName: z.string()
    .min(1, 'Server name is required')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Server name can only contain alphanumeric characters, hyphens, and underscores'),
  version: z.string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version must be in semver format (x.y.z)'),
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  maxConcurrentTasks: z.number().int().min(1).max(100).default(10),
});

const AsyncConfigSchema = z.object({
  maxConcurrentTasks: z.number().int().min(1).max(100).default(10),
  taskTimeout: z.number().int().min(60000).max(86400000).default(3600000),
  cleanupInterval: z.number().int().min(10000).max(3600000).default(300000),
});

const AppConfigSchema = z.object({
  restorepoint: RestorepointConfigSchema,
  mcp: McpConfigSchema,
  async: AsyncConfigSchema.optional().default({}),
});

/**
 * Configuration loader and validator
 * Follows enterprise-grade patterns with comprehensive error handling
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private _config: AppConfig | null = null;
  private readonly configPath: string;

  private constructor(configPath?: string) {
    this.configPath = configPath || this.getDefaultConfigPath();
  }

  /**
   * Singleton pattern implementation
   */
  public static getInstance(configPath?: string): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(configPath);
    }
    return ConfigManager.instance;
  }

  /**
   * Load configuration from file with validation
   */
  public async loadConfig(): Promise<AppConfig> {
    try {
      const configData = await this.readConfigFile();
      const validationResult = this.validateConfig(configData);

      if (!validationResult.isValid) {
        throw new Error(`Configuration validation failed:\n${validationResult.errors.join('\n')}`);
      }

      // Apply defaults and parse with Zod
      this._config = AppConfigSchema.parse(configData);
      
      
      return this._config;
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current configuration (loads if not already loaded)
   */
  public async getConfig(): Promise<AppConfig> {
    if (!this._config) {
      await this.loadConfig();
    }
    return this._config!;
  }

  /**
   * Reload configuration from file
   */
  public async reloadConfig(): Promise<AppConfig> {
    this._config = null;
    return this.loadConfig();
  }

  /**
   * Validate configuration without applying defaults
   */
  public validateConfig(configData: unknown): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic structure validation
      if (!configData || typeof configData !== 'object') {
        errors.push('Configuration must be a valid object');
        return { isValid: false, errors, warnings };
      }

      const data = configData as Record<string, unknown>;

      // Validate restorepoint section
      if (!data.restorepoint) {
        errors.push('Restorepoint configuration is required');
      } else if (typeof data.restorepoint !== 'object') {
        errors.push('Restorepoint configuration must be an object');
      }

      // Validate mcp section
      if (!data.mcp) {
        errors.push('MCP configuration is required');
      } else if (typeof data.mcp !== 'object') {
        errors.push('MCP configuration must be an object');
      }

      // Try Zod validation for detailed errors
      const result = AppConfigSchema.safeParse(data);
      if (!result.success) {
        errors.push(...result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`));
      }

      // Add warnings for potentially problematic values
      if (data.restorepoint && typeof data.restorepoint === 'object') {
        const rp = data.restorepoint as Record<string, unknown>;
        if (rp.timeout && typeof rp.timeout === 'number' && rp.timeout < 5000) {
          warnings.push('Timeout value is very low, may cause request failures');
        }
        if (rp.retryAttempts && typeof rp.retryAttempts === 'number' && rp.retryAttempts > 5) {
          warnings.push('High retry count may cause long delays on failures');
        }
      }

      return { isValid: errors.length === 0, errors, warnings };
    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { isValid: false, errors, warnings };
    }
  }

  /**
   * Read configuration file from disk
   */
  private async readConfigFile(): Promise<unknown> {
    try {
      const configContent = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(configContent);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new Error(`Configuration file not found: ${this.configPath}`);
      }
      throw new Error(`Failed to read configuration file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get default configuration file path
   */
  private getDefaultConfigPath(): string {
    // Check for common config file locations
    const possiblePaths = [
      resolve(process.cwd(), 'config.json'),
      resolve(process.cwd(), 'src', 'config.json'),
      resolve(process.cwd(), 'config', 'config.json'),
    ];

    for (const path of possiblePaths) {
      // For now, default to the first option
      // In production, we might want to check existence
    }

    return possiblePaths[0];
  }
}

/**
 * Export singleton instance for convenience
 */
export const configManager = ConfigManager.getInstance();