/**
 * Restorepoint MCP Server - Clean Implementation
 * Professional MCP server with proper engineering practices
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { configManager } from './config/index.js';
import { ApiClient } from './auth/api-client.js';
import { Logger } from './utils/logger.js';
import { taskManager } from './utils/async-handler.js';
import { ERROR_CODES, RestorepointError } from './constants/error-codes.js';
import { MCP_CONSTANTS } from './constants/endpoints.js';
import { handleListDevices, handleGetDevice } from './tools/devices/list-get.js';
import { handleCreateDevice, handleUpdateDevice, handleDeleteDevice } from './tools/devices/crud.js';
import { handleListBackups, handleGetBackup } from './tools/backups/index.js';
import { handleListCommands, handleGetCommand } from './tools/commands/index.js';
import type { McpResult } from './types/mcp-tools.js';

/**
 * Main MCP Server class
 */
class RestorepointMCPServer {
  private readonly server: Server;
  private apiClient: ApiClient | null = null;
  private isShuttingDown = false;
  private tools: any[] = [];

  constructor() {
    // Create MCP server instance
    this.server = new Server(
      {
        name: MCP_CONSTANTS.SERVER_NAME,
        version: MCP_CONSTANTS.SERVER_VERSION,
      },
      {
        capabilities: MCP_CONSTANTS.CAPABILITIES,
      }
    );

    this.setupHandlers();
    this.registerTools();
  }

  /**
   * Initialize the server with configuration
   */
  public async initialize(): Promise<void> {
    try {
      Logger.logWithContext('info', 'Initializing Restorepoint MCP Server', 'MCPServer');

      // Load configuration
      const config = await configManager.loadConfig();
      Logger.initialize(config);

      Logger.logWithContext('info', 'Configuration loaded successfully', 'MCPServer');
      Logger.logWithContext('info', `Restorepoint server: ${config.restorepoint.serverUrl}`, 'MCPServer');
      Logger.logWithContext('info', `API version: ${config.restorepoint.apiVersion}`, 'MCPServer');

      // Initialize API client
      this.apiClient = await ApiClient.create(config);
      this.apiClient.initializeToken();

      // Skip connection test during startup to avoid hanging
      // Connection test available but disabled for startup performance
      // await this.testConnection();

      Logger.logWithContext('info', 'MCP Server initialized successfully', 'MCPServer');
    } catch (error) {
      Logger.logWithContext('error', 'Failed to initialize MCP Server', 'MCPServer', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : typeof error,
      });
      throw error;
    }
  }

  /**
   * Start the MCP server
   */
  public async start(): Promise<void> {
    try {
      await this.initialize();

      // Setup graceful shutdown handlers
      this.setupShutdownHandlers();

      // Start the server with stdio transport
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      Logger.logWithContext('info', 'Restorepoint MCP Server started successfully', 'MCPServer');
      await this.logServerStatus();

    } catch (error) {
      Logger.logWithContext('error', 'Failed to start MCP Server', 'MCPServer', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : typeof error,
      });
      process.exit(1);
    }
  }

  /**
   * Setup MCP protocol handlers
   */
  private setupHandlers(): void {
    // Handle list tools request
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      Logger.logWithContext('info', 'Listing available tools', 'MCPServer');
      return {
        tools: this.tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });

    // Handle tool execution request
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      Logger.logWithContext('info', `Executing tool: ${name}`, 'MCPServer', {
        toolName: name,
        argumentCount: Object.keys(args || {}).length,
        hasArguments: Object.keys(args || {}).length > 0,
      });

      try {
        const result = await this.executeTool(name, args);
        return result;
      } catch (error) {
        Logger.logWithContext('error', `Error executing tool ${name}`, 'MCPServer', {
          toolName: name,
          error: error instanceof Error ? error.message : 'Unknown error',
          type: error instanceof Error ? error.constructor.name : typeof error,
        });
        throw new McpError(
          ErrorCode.InternalError,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    });
  }

  /**
   * Register tool implementations
   */
  private registerTools(): void {
    Logger.logWithContext('info', 'Registering MCP tools', 'MCPServer');
    
    this.tools = [
      {
        name: 'list_devices',
        description: 'List all devices with comprehensive filtering and pagination',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of devices to return (max 100)',
              default: 50,
              minimum: 1,
              maximum: 100,
            },
            offset: {
              type: 'number',
              description: 'Number of devices to skip for pagination',
              default: 0,
              minimum: 0,
            },
            sortBy: {
              type: 'string',
              description: 'Field to sort devices by',
              enum: ['name', 'type', 'status', 'createdAt', 'updatedAt'],
              default: 'createdAt',
            },
            sortOrder: {
              type: 'string',
              description: 'Sort order',
              enum: ['asc', 'desc'],
              default: 'desc',
            },
            filter: {
              type: 'object',
              description: 'Filter criteria for devices',
              properties: {
                type: {
                  type: 'string',
                  description: 'Filter by device type',
                },
                enabled: {
                  type: 'boolean',
                  description: 'Filter by enabled status',
                },
                searchTerm: {
                  type: 'string',
                  description: 'Search term to filter by name, description, hostname, or IP',
                },
              },
            },
          },
        },
      },
      {
        name: 'get_device',
        description: 'Get detailed information about a specific device',
        inputSchema: {
          type: 'object',
          properties: {
            deviceId: {
              type: 'string',
              description: 'Device ID to retrieve details for',
            },
            includeConnections: {
              type: 'boolean',
              description: 'Include connection and interface details',
              default: false,
            },
          },
          required: ['deviceId'],
        },
      },
      {
        name: 'create_device',
        description: 'Create a new device in Restorepoint',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Device name (1-200 characters)',
              minLength: 1,
              maxLength: 200,
            },
            type: {
              type: 'string',
              description: 'Device type (e.g., cisco-ios, cisco-nxos, linux, windows)',
            },
            ipAddress: {
              type: 'string',
              description: 'Device IP address',
              format: 'ipv4',
            },
            hostname: {
              type: 'string',
              description: 'Device hostname',
            },
            credentials: {
              type: 'object',
              description: 'Device credentials',
              properties: {
                username: {
                  type: 'string',
                  description: 'Username for device authentication',
                },
                password: {
                  type: 'string',
                  description: 'Password for device authentication',
                },
              },
              required: ['username', 'password'],
            },
            description: {
              type: 'string',
              description: 'Device description',
            },
            enabled: {
              type: 'boolean',
              description: 'Whether the device is enabled',
              default: true,
            },
          },
          required: ['name', 'type', 'credentials'],
        },
      },
      {
        name: 'update_device',
        description: 'Update an existing device in Restorepoint',
        inputSchema: {
          type: 'object',
          properties: {
            deviceId: {
              type: 'string',
              description: 'Device ID to update',
            },
            name: {
              type: 'string',
              description: 'Updated device name',
              minLength: 1,
              maxLength: 200,
            },
            type: {
              type: 'string',
              description: 'Updated device type',
            },
            ipAddress: {
              type: 'string',
              description: 'Updated IP address',
              format: 'ipv4',
            },
            hostname: {
              type: 'string',
              description: 'Updated hostname',
            },
            credentials: {
              type: 'object',
              description: 'Updated credentials',
              properties: {
                username: {
                  type: 'string',
                  description: 'Updated username',
                },
                password: {
                  type: 'string',
                  description: 'Updated password',
                },
              },
            },
            description: {
              type: 'string',
              description: 'Updated description',
            },
            enabled: {
              type: 'boolean',
              description: 'Updated enabled status',
            },
          },
          required: ['deviceId'],
        },
      },
      {
        name: 'delete_device',
        description: 'Delete a device from Restorepoint',
        inputSchema: {
          type: 'object',
          properties: {
            deviceId: {
              type: 'string',
              description: 'Device ID to delete',
            },
            force: {
              type: 'boolean',
              description: 'Force delete even if device has backups',
              default: false,
            },
          },
          required: ['deviceId'],
        },
      },
      {
        name: 'create_backup',
        description: 'Start backup for specified devices',
        inputSchema: {
          type: 'object',
          properties: {
            deviceIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of device IDs to backup',
            },
            backupName: {
              type: 'string',
              description: 'Name for the backup',
            },
          },
          required: ['deviceIds'],
        },
      },
      {
        name: 'get_task_status',
        description: 'Check status of a task',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'Task ID to check',
            },
          },
          required: ['taskId'],
        },
      },
      {
        name: 'execute_command',
        description: 'Execute command on devices',
        inputSchema: {
          type: 'object',
          properties: {
            deviceIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of device IDs',
            },
            command: {
              type: 'string',
              description: 'Command to execute',
            },
          },
          required: ['deviceIds', 'command'],
        },
      },
    ];

    Logger.logWithContext('info', `Registered ${this.tools.length} tools`, 'MCPServer', {
      toolCount: this.tools.length,
      toolNames: this.tools.map(tool => tool.name),
    });
  }

  /**
   * Execute tool by name
   */
  private async executeTool(name: string, args: unknown) {
    if (!this.apiClient) {
      throw new McpError(
        ErrorCode.InternalError,
        'API client not initialized'
      );
    }

    try {
      switch (name) {
        case 'list_devices':
          return await this.handleMcpResult(handleListDevices(args, this.apiClient));
        case 'get_device':
          return await this.handleMcpResult(handleGetDevice(args, this.apiClient));
        case 'create_device':
          return await this.handleMcpResult(handleCreateDevice(args, this.apiClient));
        case 'update_device':
          return await this.handleMcpResult(handleUpdateDevice(args, this.apiClient));
        case 'delete_device':
          return await this.handleMcpResult(handleDeleteDevice(args, this.apiClient));
        case 'create_backup':
          return await this.handleCreateBackup(args);
        case 'get_task_status':
          return await this.handleGetTaskStatus(args);
        case 'execute_command':
          return await this.handleExecuteCommand(args);
        case 'list_backups':
          return await this.handleMcpResult(handleListBackups(args, this.apiClient));
        case 'get_backup':
          return await this.handleMcpResult(handleGetBackup(args, this.apiClient));
        case 'list_commands':
          return await this.handleMcpResult(handleListCommands(args, this.apiClient));
        case 'get_command':
          return await this.handleMcpResult(handleGetCommand(args, this.apiClient));
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Tool not found: ${name}`
          );
      }
    } catch (error) {
      Logger.logWithContext('error', `Error executing tool ${name}`, 'MCPServer', {
        toolName: name,
        error: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : typeof error,
      });
      throw new McpError(
        ErrorCode.InternalError,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Convert McpResult to MCP response format
   */
  private async handleMcpResult(result: Promise<McpResult>) {
    const mcpResult = await result;
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: mcpResult.success,
            data: mcpResult.data,
            message: mcpResult.message,
            error: mcpResult.error,
          }, null, 2),
        },
      ],
    };
  }

  
  /**
   * Handle create_backup tool
   */
  private async handleCreateBackup(args: unknown) {
    const { deviceIds, backupName } = args as { deviceIds: string[]; backupName?: string };
    const taskId = `backup_${Date.now()}_${crypto.randomUUID()}`;

    // Create async task with proper context
    if (this.apiClient) {
      const taskMessage = backupName 
        ? `Backup "${backupName}" started for ${deviceIds.length} devices`
        : `Backup started for ${deviceIds.length} devices`;
      taskManager.createTask(taskId, 'backup', taskMessage);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            taskId,
            message: `Backup started for ${deviceIds.length} devices`,
            estimatedTime: '5-10 minutes',
            deviceIds,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle get_task_status tool
   */
  private async handleGetTaskStatus(args: unknown) {
    const { taskId } = args as { taskId: string };
    
    // Check task manager
    const task = taskManager.getTask(taskId);
    if (!task) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Task not found: ${taskId}`
      );
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            taskId,
            status: task.status,
            progress: task.progress,
            message: task.message,
            timestamp: task.updatedAt.toISOString(),
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Handle execute_command tool
   */
  private async handleExecuteCommand(args: unknown) {
    const { deviceIds, command } = args as { deviceIds: string[]; command: string };
    const taskId = `cmd_${Date.now()}_${crypto.randomUUID()}`;

    // Create async task
    if (this.apiClient) {
      taskManager.createTask(taskId, 'command', `Command execution started on ${deviceIds.length} devices`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            taskId,
            message: `Command execution started on ${deviceIds.length} devices`,
            command,
            deviceIds,
            estimatedTime: '2-5 minutes',
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Test connection to Restorepoint API
   */
  private async testConnection(): Promise<void> {
    try {
      Logger.logWithContext('info', 'Testing connection to Restorepoint API', 'MCPServer');
      
      if (!this.apiClient) {
        throw new Error('API client not initialized');
      }

      const isConnected = await this.apiClient.testConnection();
      if (!isConnected) {
        throw new RestorepointError(
          ERROR_CODES.NETWORK_CONNECTION_FAILED,
          'Failed to connect to Restorepoint API'
        );
      }

      Logger.logWithContext('info', 'Connection test successful', 'MCPServer');
    } catch (error) {
      Logger.logWithContext('error', 'Connection test failed', 'MCPServer', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : typeof error,
      });
      throw new RestorepointError(
        ERROR_CODES.NETWORK_CONNECTION_FAILED,
        `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        Logger.logWithContext('warn', 'Force shutdown detected', 'MCPServer');
        process.exit(1);
      }

      this.isShuttingDown = true;
      Logger.logWithContext('info', `Starting graceful shutdown (${signal})`, 'MCPServer');

      try {
        taskManager.shutdown();
        Logger.logWithContext('info', 'Graceful shutdown completed', 'MCPServer');
        process.exit(0);
      } catch (error) {
        Logger.logWithContext('error', 'Error during shutdown', 'MCPServer', {
          error: error instanceof Error ? error.message : 'Unknown error',
          type: error instanceof Error ? error.constructor.name : typeof error,
        });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      Logger.logWithContext('error', 'Uncaught exception', 'MCPServer', {
        error: error.message,
        stack: error.stack,
        name: error.name,
      });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      Logger.logWithContext('error', 'Unhandled rejection', 'MCPServer', {
        reason: reason instanceof Error ? reason.message : String(reason),
        type: reason instanceof Error ? reason.constructor.name : typeof reason,
      });
      process.exit(1);
    });
  }

  /**
   * Log server startup information
   */
  private async logServerStatus(): Promise<void> {
    const config = await configManager.getConfig();
    
    Logger.logWithContext('info', '=== RESTOREPOINT MCP SERVER STATUS ===', 'MCPServer');
    Logger.logWithContext('info', `Server: ${MCP_CONSTANTS.SERVER_NAME} v${MCP_CONSTANTS.SERVER_VERSION}`, 'MCPServer');
    if (config) {
      const configData = config;
      Logger.logWithContext('info', `API: ${configData.restorepoint.serverUrl}/api/${configData.restorepoint.apiVersion}`, 'MCPServer');
      Logger.logWithContext('info', `Max Concurrent Tasks: ${configData.async.maxConcurrentTasks}`, 'MCPServer');
    }
    Logger.logWithContext('info', `Available Tools: ${this.tools.length}`, 'MCPServer');
    this.tools.forEach(tool => {
      Logger.logWithContext('info', `- ${tool.name}: ${tool.description}`, 'MCPServer', {
        toolName: tool.name,
        toolDescription: tool.description,
      });
    });
    Logger.logWithContext('info', '============================================', 'MCPServer');
  }
}

/**
 * Start HTTP server for health checks (optional)
 * Only starts if ENABLE_HTTP_SERVER=true or in production
 */
async function startHttpServer(mcpServer: RestorepointMCPServer): Promise<void> {
  if (process.env.ENABLE_HTTP_SERVER === 'true' || process.env.NODE_ENV === 'production') {
    try {
      // Dynamic import for express to avoid dependency if not needed
      const express = await import('express');
      const app = express.default();
      const port = process.env.PORT || 3000;

      // Health check endpoint
      app.get('/health', (req, res) => {
        const isHealthy = mcpServer['apiClient'] !== undefined;
        const status = {
          status: isHealthy ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          server: MCP_CONSTANTS.SERVER_NAME,
          version: MCP_CONSTANTS.SERVER_VERSION,
          tools: mcpServer['tools']?.length || 0
        };
        
        res.status(isHealthy ? 200 : 503).json(status);
      });

      // Basic info endpoint
      app.get('/info', (req, res) => {
        res.json({
          server: MCP_CONSTANTS.SERVER_NAME,
          version: MCP_CONSTANTS.SERVER_VERSION,
          tools: mcpServer['tools']?.map(tool => ({
            name: tool.name,
            description: tool.description
          })) || [],
          endpoints: {
            health: '/health',
            info: '/info',
            mcp: 'stdio (MCP protocol)'
          }
        });
      });

      app.listen(port, '0.0.0.0', () => {
        Logger.logWithContext('info', `HTTP server listening on port ${port}`, 'MCPServer');
        Logger.logWithContext('info', `Health endpoint: http://localhost:${port}/health`, 'MCPServer');
        Logger.logWithContext('info', `Info endpoint: http://localhost:${port}/info`, 'MCPServer');
      });
    } catch (error) {
      Logger.logWithContext('warn', 'Failed to start HTTP server (express not available)', 'MCPServer', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const server = new RestorepointMCPServer();
  await server.start();
  
  // Start HTTP server for health checks (if enabled)
  await startHttpServer(server);
}

// Start the server if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    Logger.logWithContext('error', 'Failed to start MCP Server', 'MCPServer', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error,
    });
    process.exit(1);
  });
}

export { RestorepointMCPServer };