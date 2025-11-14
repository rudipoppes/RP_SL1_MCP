/**
 * Unit Tests for Configuration
 */

import { ConfigManager } from '../../src/config/index';
import { promises as fs } from 'fs';

// Mock fs promises
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}));

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    configManager = ConfigManager.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ConfigManager.getInstance();
      const instance2 = ConfigManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      const validConfig = {
        restorepoint: {
          serverUrl: 'https://restorepoint.example.com',
          apiVersion: 'v2',
          token: 'test-token',
          timeout: 30000,
          retryAttempts: 3,
          retryDelay: 1000,
        },
        mcp: {
          serverName: 'Test-Server',
          version: '1.0.0',
          logLevel: 'info',
          maxConcurrentTasks: 10,
        },
        async: {
          maxConcurrentTasks: 10,
          taskTimeout: 3600000,
          cleanupInterval: 300000,
        },
      };

      const result = configManager.validateConfig(validConfig);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing required sections', () => {
      const invalidConfig = {
        restorepoint: {
          serverUrl: 'https://example.com',
        },
        // Missing mcp section
      };

      const result = configManager.validateConfig(invalidConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('MCP configuration is required');
    });

    it('should reject invalid server URL', () => {
      const invalidConfig = {
        restorepoint: {
          serverUrl: 'not-a-url',
          apiVersion: 'v2',
          token: 'test-token',
          timeout: 30000,
          retryAttempts: 3,
          retryDelay: 1000,
        },
        mcp: {
          serverName: 'Test-Server',
          version: '1.0.0',
          logLevel: 'info',
          maxConcurrentTasks: 10,
        },
      };

      const result = configManager.validateConfig(invalidConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('serverUrl'))).toBe(true);
    });

    it('should accept valid enum values', () => {
      const validConfig = {
        restorepoint: {
          serverUrl: 'https://example.com',
          apiVersion: 'v1', // Valid enum value
          token: 'test-token',
        },
        mcp: {
          serverName: 'Test',
          version: '1.0.0',
          logLevel: 'debug', // Valid enum value
          maxConcurrentTasks: 10,
        },
      };

      const result = configManager.validateConfig(validConfig);
      
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid enum values', () => {
      const invalidConfig = {
        restorepoint: {
          serverUrl: 'https://example.com',
          apiVersion: 'v3', // Invalid enum value
          token: 'test-token',
        },
        mcp: {
          serverName: 'Test',
          version: '1.0.0',
          logLevel: 'invalid', // Invalid enum value
          maxConcurrentTasks: 10,
        },
      };

      const result = configManager.validateConfig(invalidConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should add warnings for potentially problematic values', () => {
      const configWithWarnings = {
        restorepoint: {
          serverUrl: 'https://example.com',
          apiVersion: 'v2',
          token: 'test-token',
          timeout: 1000, // Very low timeout
          retryAttempts: 10, // High retry count
        },
        mcp: {
          serverName: 'Test',
          version: '1.0.0',
          logLevel: 'info',
          maxConcurrentTasks: 10,
        },
      };

      const result = configManager.validateConfig(configWithWarnings);
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('Timeout value is very low'))).toBe(true);
    });
  });

  describe('loadConfig', () => {
    it('should load and validate configuration file', async () => {
      const validConfig = {
        restorepoint: {
          serverUrl: 'https://example.com',
          apiVersion: 'v2',
          token: 'test-token',
        },
        mcp: {
          serverName: 'Test-Server',
          version: '1.0.0',
          logLevel: 'info',
          maxConcurrentTasks: 10,
        },
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(validConfig));

      const config = await configManager.loadConfig();

      expect(config.restorepoint.serverUrl).toBe('https://example.com');
      expect(config.mcp.serverName).toBe('Test-Server');
    });

    it('should throw error for invalid configuration', async () => {
      const invalidConfig = {
        restorepoint: {
          // Missing required fields
        },
        mcp: {
          serverName: 'Test',
        },
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));

      await expect(configManager.loadConfig()).rejects.toThrow('Configuration validation failed');
    });
  });
});