/**
 * Restorepoint HTTP API Server - Simple Working Version
 * Basic HTTP REST API for Restorepoint operations
 */

import express from 'express';
import type { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

import { configManager } from './config/index.js';
import { ApiClient } from './auth/api-client.js';
import { Logger } from './utils/logger.js';
import { handleListDevices, handleGetDevice } from './tools/devices/list-get.js';
import { handleGetStatus } from './tools/devices/status.js';
import { handleCreateDevice, handleUpdateDevice, handleDeleteDevice } from './tools/devices/crud.js';
import { handleListBackups, handleGetBackup, handleCreateBackup } from './tools/backups/index.js';
import { handleListCommands, handleGetCommand, handleExecuteCommand, handleGetTaskStatus } from './tools/commands/index.js';
import type { McpResult } from './types/mcp-tools.js';

// Simple interfaces for now
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: string;
}

// Extend Request interface
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

class RestorepointHttpServer {
  private readonly app: Application;
  private apiClient: ApiClient | null = null;
  private isShuttingDown = false;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(cors({
      origin: ['http://localhost:3001', 'http://localhost:3002', 'http://localhost:4001'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
    }));

    const limiter = rateLimit({
      windowMs: 60000,
      max: 1000,
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.'
        }
      }
    });
    this.app.use(limiter);

    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    this.app.use((req: Request, res: Response, next) => {
      req.requestId = req.headers['x-request-id'] as string || Math.random().toString(36).substring(7);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      const isHealthy = !this.isShuttingDown;
      const status = {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        server: 'RP_SL1_API',
        version: '2.0.0',
        apiConnected: this.apiClient !== undefined
      };
      
      res.status(isHealthy ? 200 : 503).json({
        success: true,
        data: status,
        timestamp: new Date().toISOString()
      });
    });

    // Info endpoint
    this.app.get('/info', (req: Request, res: Response) => {
      const tools = [
        { name: 'list_devices', description: 'List all network devices' },
        { name: 'get_device', description: 'Get details of a specific device' },
        { name: 'get_status', description: 'Get device status information' },
        { name: 'create_device', description: 'Add a new device' },
        { name: 'update_device', description: 'Update device configuration' },
        { name: 'delete_device', description: 'Remove a device' },
        { name: 'list_backups', description: 'List backup history' },
        { name: 'get_backup', description: 'Get backup details' },
        { name: 'create_backup', description: 'Start backup operation' },
        { name: 'list_commands', description: 'List command execution history' },
        { name: 'get_command', description: 'Get command execution details' },
        { name: 'execute_command', description: 'Execute command on devices' },
        { name: 'get_task_status', description: 'Check task status' }
      ];
      
      res.json({
        success: true,
        data: {
          server: 'RP_SL1_API',
          version: '2.0.0',
          endpoints: {
            health: '/health',
            info: '/info',
            tools: '/tools',
            execute: '/tools/execute'
          },
          tools
        },
        timestamp: new Date().toISOString()
      });
    });

    // List tools endpoint
    this.app.get('/tools', (req: Request, res: Response) => {
      res.json({
        success: true,
        data: {
          message: 'Use POST /tools/execute to execute tools',
          availableTools: ['list_devices', 'get_device', 'get_status', 'create_device', 'update_device', 'delete_device', 'list_backups', 'get_backup', 'create_backup', 'list_commands', 'get_command', 'execute_command', 'get_task_status']
        },
        timestamp: new Date().toISOString()
      });
    });

    // Execute tool endpoint
    this.app.post('/tools/execute', async (req: Request, res: Response) => {
      const { tool, arguments: args = {} } = req.body;
      const requestId = req.requestId || 'unknown';

      try {
        if (!tool) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'MISSING_TOOL_NAME',
              message: 'Tool name is required'
            },
            timestamp: new Date().toISOString()
          });
        }

        if (!this.apiClient) {
          return res.status(503).json({
            success: false,
            error: {
              code: 'API_CLIENT_NOT_INITIALIZED',
              message: 'API client not available - Restorepoint connection failed'
            },
            timestamp: new Date().toISOString()
          });
        }

        
        let result: McpResult;

        // Execute the appropriate tool
        switch (tool) {
          case 'list_devices':
            result = await handleListDevices(args, this.apiClient);
            break;
          case 'get_device':
            result = await handleGetDevice(args, this.apiClient);
            break;
          case 'get_status':
            result = await handleGetStatus(args, this.apiClient);
            break;
          case 'create_device':
            result = await handleCreateDevice(args, this.apiClient);
            break;
          case 'update_device':
            result = await handleUpdateDevice(args, this.apiClient);
            break;
          case 'delete_device':
            result = await handleDeleteDevice(args, this.apiClient);
            break;
          case 'list_backups':
            result = await handleListBackups(args, this.apiClient);
            break;
          case 'get_backup':
            result = await handleGetBackup(args, this.apiClient);
            break;
          case 'list_commands':
            result = await handleListCommands(args, this.apiClient);
            break;
          case 'get_command':
            result = await handleGetCommand(args, this.apiClient);
            break;
          case 'create_backup':
            result = await handleCreateBackup(args, this.apiClient);
            break;
          case 'execute_command':
            result = await handleExecuteCommand(args, this.apiClient);
            break;
          case 'get_task_status':
            result = await handleGetTaskStatus(args, this.apiClient);
            break;
          default:
            throw new Error(`Tool not found: ${tool}`);
        }

        
        return res.json({
          success: true,
          data: result,
          timestamp: new Date().toISOString()
        });

      } catch (error: any) {
        
        return res.status(500).json({
          success: false,
          error: {
            code: 'TOOL_EXECUTION_ERROR',
            message: error.message || 'An unknown error occurred'
          },
          timestamp: new Date().toISOString()
        });
      }
    });

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Endpoint not found: ${req.method} ${req.originalUrl}`
        },
        timestamp: new Date().toISOString()
      });
    });

    // Error handler
    this.app.use((error: Error, req: Request, res: Response, next: any) => {
            
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred'
        },
        timestamp: new Date().toISOString()
      });
    });
  }

  public async initialize(): Promise<void> {
    try {
      const config = await configManager.loadConfig();
      Logger.initialize(config);

      // Create API client but don't block server startup on token initialization
      try {
        this.apiClient = await ApiClient.create(config);
        this.apiClient.initializeToken();
      } catch (apiError: any) {
        // Continue without API client - server can still respond to health checks
      }
    } catch (error: any) {
            throw error;
    }
  }

  public async start(): Promise<void> {
    try {
      await this.initialize();

      const port = Number(process.env.PORT) || 3000;
      const host = process.env.HOST || '0.0.0.0';

      this.app.listen(port, host, () => {
        // Server started successfully
      });

    } catch (error: any) {
            process.exit(1);
    }
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const server = new RestorepointHttpServer();
  await server.start();
}

// Start the server if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.exit(1);
  });
}

export { RestorepointHttpServer, main };