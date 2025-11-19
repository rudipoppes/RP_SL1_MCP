/**
 * MCP tool definitions following Model Context Protocol standards
 * Provides type-safe interfaces for tool registration and execution
 */

import type { DeviceId, BackupId, TaskId, AgentId, CommandId } from './restorepoint-api.js';

/**
 * Base MCP tool interface
 */
export interface McpTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: McpInputSchema;
}

/**
 * MCP input schema interface
 */
export interface McpInputSchema {
  readonly type: 'object';
  readonly properties: Record<string, McpProperty>;
  readonly required?: readonly string[];
}

/**
 * MCP property definition
 */
export interface McpProperty {
  readonly type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  readonly description?: string;
  readonly items?: McpProperty; // For array types
  readonly properties?: Record<string, McpProperty>; // For object types
  readonly enum?: readonly string[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly format?: string;
  readonly default?: unknown;
  readonly minItems?: number;
  readonly maxItems?: number;
}

/**
 * Tool execution context
 */
export interface McpContext {
  readonly toolName: string;
  readonly requestId?: string;
  readonly timestamp: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Tool execution result
 */
export interface McpResult<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly message?: string;
  readonly metadata?: Record<string, unknown>;
  readonly error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp?: string;
  };
}

/**
 * Device management tools
 */
export interface ListDevicesTool extends McpTool {
  readonly name: 'list_devices';
  readonly description: 'List all devices with optional filtering and pagination';
  readonly inputSchema: McpInputSchema & {
    readonly properties: {
      readonly limit?: McpProperty & { type: 'number'; minimum: 1; maximum: 1000; default: 50 };
      readonly offset?: McpProperty & { type: 'number'; minimum: 0; default: 0 };
      readonly sortBy?: McpProperty & { 
        type: 'string'; 
        enum: readonly ['name', 'type', 'ipAddress', 'hostname', 'createdAt', 'updatedAt']; 
      };
      readonly sortOrder?: McpProperty & { type: 'string'; enum: readonly ['asc', 'desc']; default: 'desc' };
      readonly filter?: McpProperty & { type: 'object'; properties: {
        readonly type?: McpProperty & { type: 'string' };
        readonly enabled?: McpProperty & { type: 'boolean' };
        readonly searchTerm?: McpProperty & { type: 'string' };
      }};
    };
  };
}

export interface GetDeviceTool extends McpTool {
  readonly name: 'get_device';
  readonly description: 'Get detailed information about a specific device';
  readonly inputSchema: McpInputSchema & {
    readonly required: readonly ['deviceId'];
    readonly properties: {
      readonly deviceId: McpProperty & { 
        type: 'string'; 
        description: 'Unique identifier of the device';
        minLength: 1;
      };
      readonly includeConnections?: McpProperty & { 
        type: 'boolean'; 
        default: false;
        description: 'Include device connection information';
      };
    };
  };
}

export interface CreateDeviceTool extends McpTool {
  readonly name: 'create_device';
  readonly description: 'Create a new device in Restorepoint. Use get_device_requirements tool first to see exactly what is required and supported device types.';
  readonly inputSchema: McpInputSchema & {
    readonly required: readonly ['name', 'type', 'credentials'];
    readonly properties: {
      readonly name: McpProperty & { 
        type: 'string'; 
        description: 'Name of the device (1-200 characters)';
        minLength: 1;
        maxLength: 200;
      };
      readonly type: McpProperty & { 
        type: 'string'; 
        description: 'Device type identifier. Use get_device_requirements to see all supported types (e.g., cisco-ios, palo-alto, linux, windows)';
        minLength: 1;
        enum: readonly ['cisco-ios', 'cisco-nxos', 'palo-alto', 'fortinet', 'linux', 'windows', 'juniper', 'arista'];
      };
      readonly ipAddress?: McpProperty & { 
        type: 'string'; 
        description: 'IP address of the device (use either ipAddress or hostname, not both)';
        pattern: '^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$';
      };
      readonly hostname?: McpProperty & { 
        type: 'string'; 
        description: 'Hostname of the device (use either hostname or ipAddress, not both)';
        maxLength: 253;
      };
      readonly credentials: McpProperty & { 
        type: 'object'; 
        description: 'Device access credentials with username and password';
        properties: {
          readonly username: McpProperty & { type: 'string'; description: 'Username for device access' };
          readonly password: McpProperty & { type: 'string'; description: 'Password for device access' };
        }; 
        required: readonly ['username', 'password'];
      };
      readonly description?: McpProperty & { 
        type: 'string'; 
        description: 'Optional device description (max 500 characters)';
        maxLength: 500;
      };
      readonly enabled?: McpProperty & { 
        type: 'boolean'; 
        default: true;
        description: 'Whether the device is enabled for monitoring and backups';
      };
    };
  };
}

export interface GetDeviceRequirementsTool extends McpTool {
  readonly name: 'get_device_requirements';
  readonly description: 'Get comprehensive device creation requirements including supported device types, required fields, protocols, and examples';
  readonly inputSchema: McpInputSchema & {
    readonly properties: {
      readonly deviceType?: McpProperty & { 
        type: 'string'; 
        description: 'Optional: Get detailed requirements for a specific device type. Leave empty to see all supported types.';
        enum: readonly ['cisco-ios', 'cisco-nxos', 'palo-alto', 'fortinet', 'linux', 'windows', 'juniper', 'arista'];
      };
      readonly includeExamples?: McpProperty & { 
        type: 'boolean'; 
        default: true;
        description: 'Include example device configurations';
      };
      readonly includeValidation?: McpProperty & { 
        type: 'boolean'; 
        default: false;
        description: 'Include validation of a sample request (requires request parameter)';
      };
      readonly request?: McpProperty & { 
        type: 'object'; 
        description: 'Optional: Device creation request to validate when includeValidation=true';
        properties: {
          readonly name?: McpProperty & { type: 'string' };
          readonly type?: McpProperty & { type: 'string' };
          readonly ipAddress?: McpProperty & { type: 'string' };
          readonly hostname?: McpProperty & { type: 'string' };
          readonly credentials?: McpProperty & { type: 'object'; properties: {
            readonly username?: McpProperty & { type: 'string' };
            readonly password?: McpProperty & { type: 'string' };
          }};
          readonly description?: McpProperty & { type: 'string' };
          readonly enabled?: McpProperty & { type: 'boolean' };
        };
      };
    };
  };
}

export interface ValidateDeviceRequestTool extends McpTool {
  readonly name: 'validate_device_request';
  readonly description: 'Validate a device creation request before submitting to create_device. Returns detailed validation errors and recommendations.';
  readonly inputSchema: McpInputSchema & {
    readonly required: readonly ['request'];
    readonly properties: {
      readonly request: McpProperty & { 
        type: 'object'; 
        description: 'Device creation request to validate';
        properties: {
          readonly name?: McpProperty & { type: 'string'; description: 'Device name' };
          readonly type?: McpProperty & { type: 'string'; description: 'Device type' };
          readonly ipAddress?: McpProperty & { type: 'string'; description: 'IP address' };
          readonly hostname?: McpProperty & { type: 'string'; description: 'Hostname' };
          readonly credentials?: McpProperty & { type: 'object'; properties: {
            readonly username?: McpProperty & { type: 'string'; description: 'Username' };
            readonly password?: McpProperty & { type: 'string'; description: 'Password' };
          }};
          readonly description?: McpProperty & { type: 'string'; description: 'Description' };
          readonly enabled?: McpProperty & { type: 'boolean'; description: 'Enabled status' };
        };
      };
    };
  };
}

export interface UpdateDeviceTool extends McpTool {
  readonly name: 'update_device';
  readonly description: 'Update an existing device';
  readonly inputSchema: McpInputSchema & {
    readonly required: readonly ['deviceId'];
    readonly properties: {
      readonly deviceId: McpProperty & { 
        type: 'string'; 
        description: 'Unique identifier of the device to update';
        minLength: 1;
      };
      readonly name?: McpProperty & { 
        type: 'string'; 
        description: 'New name for the device';
        maxLength: 200;
      };
      readonly type?: McpProperty & { 
        type: 'string'; 
        description: 'New device type';
        minLength: 1;
      };
      readonly ipAddress?: McpProperty & { 
        type: 'string'; 
        description: 'New IP address';
        pattern: '^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$';
      };
      readonly hostname?: McpProperty & { 
        type: 'string'; 
        description: 'New hostname';
        maxLength: 253;
      };
      readonly credentials?: McpProperty & { type: 'object'; properties: {
        readonly username: McpProperty & { type: 'string' };
        readonly password: McpProperty & { type: 'string' };
      }};
      readonly description?: McpProperty & { 
        type: 'string'; 
        description: 'New description';
        maxLength: 500;
      };
      readonly enabled?: McpProperty & { 
        type: 'boolean'; 
        description: 'Enable or disable the device';
      };
    };
  };
}

export interface DeleteDeviceTool extends McpTool {
  readonly name: 'delete_device';
  readonly description: 'Delete a device from Restorepoint';
  readonly inputSchema: McpInputSchema & {
    readonly required: readonly ['deviceId'];
    readonly properties: {
      readonly deviceId: McpProperty & { 
        type: 'string'; 
        description: 'Unique identifier of the device to delete';
        minLength: 1;
      };
      readonly force?: McpProperty & { 
        type: 'boolean'; 
        default: false;
        description: 'Force deletion even if device has backups';
      };
    };
  };
}

/**
 * Backup management tools
 */
export interface CreateBackupTool extends McpTool {
  readonly name: 'create_backup';
  readonly description: 'Start backup for specified devices (async operation)';
  readonly inputSchema: McpInputSchema & {
    readonly required: readonly ['deviceIds'];
    readonly properties: {
      readonly deviceIds: McpProperty & { 
        type: 'array'; 
        description: 'List of device IDs to backup';
        items: McpProperty & { type: 'string'; minLength: 1 };
        minItems: 1;
        maxItems: 100;
      };
      readonly backupName?: McpProperty & { 
        type: 'string'; 
        description: 'Name for the backup job';
        maxLength: 200;
      };
      readonly backupType?: McpProperty & { 
        type: 'string'; 
        enum: readonly ['full', 'incremental', 'config-only'];
        default: 'full';
        description: 'Type of backup to perform';
      };
      readonly description?: McpProperty & { 
        type: 'string'; 
        description: 'Description of the backup';
        maxLength: 1000;
      };
      readonly priority?: McpProperty & { 
        type: 'string'; 
        enum: readonly ['low', 'normal', 'high'];
        default: 'normal';
        description: 'Priority of the backup job';
      };
    };
  };
}

export interface GetBackupStatusTool extends McpTool {
  readonly name: 'get_backup_status';
  readonly description: 'Check status of backup task';
  readonly inputSchema: McpInputSchema & {
    readonly required: readonly ['taskId'];
    readonly properties: {
      readonly taskId: McpProperty & { 
        type: 'string'; 
        description: 'Task ID returned from create_backup';
        minLength: 1;
      };
      readonly includeDetails?: McpProperty & { 
        type: 'boolean'; 
        default: false;
        description: 'Include detailed progress information';
      };
    };
  };
}

export interface ListBackupsTool extends McpTool {
  readonly name: 'list_backups';
  readonly description: 'List backups with optional filtering and pagination';
  readonly inputSchema: McpInputSchema & {
    readonly properties: {
      readonly limit?: McpProperty & { type: 'number'; minimum: 1; maximum: 1000; default: 50 };
      readonly offset?: McpProperty & { type: 'number'; minimum: 0; default: 0 };
      readonly sortBy?: McpProperty & { 
        type: 'string'; 
        enum: readonly ['backupName', 'createdAt', 'deviceCount', 'status']; 
      };
      readonly sortOrder?: McpProperty & { type: 'string'; enum: readonly ['asc', 'desc']; default: 'desc' };
      readonly filter?: McpProperty & { type: 'object'; properties: {
        readonly deviceId?: McpProperty & { type: 'string' };
        readonly status?: McpProperty & { 
          type: 'string'; 
          enum: readonly ['completed', 'failed', 'in_progress']; 
        };
        readonly dateFrom?: McpProperty & { type: 'string'; format: 'date-time' };
        readonly dateTo?: McpProperty & { type: 'string'; format: 'date-time' };
      }};
    };
  };
}

/**
 * Command execution tools
 */
export interface ExecuteCommandTool extends McpTool {
  readonly name: 'execute_command';
  readonly description: 'Execute command on specified devices (async operation)';
  readonly inputSchema: McpInputSchema & {
    readonly required: readonly ['deviceIds', 'command'];
    readonly properties: {
      readonly deviceIds: McpProperty & { 
        type: 'array'; 
        description: 'List of device IDs to execute command on';
        items: McpProperty & { type: 'string'; minLength: 1 };
        minItems: 1;
        maxItems: 100;
      };
      readonly command: McpProperty & { 
        type: 'string'; 
        description: 'Command to execute';
        minLength: 1;
        maxLength: 10000;
      };
      readonly commandType?: McpProperty & { 
        type: 'string'; 
        enum: readonly ['show', 'configure', 'execute', 'custom'];
        default: 'show';
        description: 'Type of command';
      };
      readonly timeout?: McpProperty & { 
        type: 'number'; 
        description: 'Command timeout in milliseconds';
        minimum: 1000;
        maximum: 300000;
        default: 30000;
      };
      readonly saveOutput?: McpProperty & { 
        type: 'boolean'; 
        default: true;
        description: 'Whether to save the command output';
      };
      readonly description?: McpProperty & { 
        type: 'string'; 
        description: 'Description of the command';
        maxLength: 500;
      };
    };
  };
}

export interface GetCommandStatusTool extends McpTool {
  readonly name: 'get_command_status';
  readonly description: 'Check status of command execution task';
  readonly inputSchema: McpInputSchema & {
    readonly required: readonly ['taskId'];
    readonly properties: {
      readonly taskId: McpProperty & { 
        type: 'string'; 
        description: 'Task ID returned from execute_command';
        minLength: 1;
      };
      readonly includeOutput?: McpProperty & { 
        type: 'boolean'; 
        default: false;
        description: 'Include command output in response';
      };
    };
  };
}

export interface ScheduleCommandTool extends McpTool {
  readonly name: 'schedule_command';
  readonly description: 'Schedule recurring command execution';
  readonly inputSchema: McpInputSchema & {
    readonly required: readonly ['deviceIds', 'command', 'schedule'];
    readonly properties: {
      readonly deviceIds: McpProperty & { 
        type: 'array'; 
        description: 'List of device IDs to execute command on';
        items: McpProperty & { type: 'string'; minLength: 1 };
        minItems: 1;
        maxItems: 100;
      };
      readonly command: McpProperty & { 
        type: 'string'; 
        description: 'Command to execute';
        minLength: 1;
        maxLength: 10000;
      };
      readonly schedule: McpProperty & { 
        type: 'string'; 
        description: 'Cron-like schedule expression';
        minLength: 1;
      };
      readonly commandType?: McpProperty & { 
        type: 'string'; 
        enum: readonly ['show', 'configure', 'execute', 'custom'];
        default: 'show';
        description: 'Type of command';
      };
      readonly enabled?: McpProperty & { 
        type: 'boolean'; 
        default: true;
        description: 'Whether the schedule is enabled';
      };
      readonly description?: McpProperty & { 
        type: 'string'; 
        description: 'Description of the scheduled command';
        maxLength: 500;
      };
    };
  };
}

export interface ListCommandsTool extends McpTool {
  readonly name: 'list_commands';
  readonly description: 'List command execution history with optional filtering';
  readonly inputSchema: McpInputSchema & {
    readonly properties: {
      readonly limit?: McpProperty & { type: 'number'; minimum: 1; maximum: 1000; default: 50 };
      readonly offset?: McpProperty & { type: 'number'; minimum: 0; default: 0 };
      readonly sortBy?: McpProperty & { 
        type: 'string'; 
        enum: readonly ['createdAt', 'command', 'status', 'deviceCount']; 
      };
      readonly sortOrder?: McpProperty & { type: 'string'; enum: readonly ['asc', 'desc']; default: 'desc' };
      readonly filter?: McpProperty & { type: 'object'; properties: {
        readonly deviceId?: McpProperty & { type: 'string' };
        readonly status?: McpProperty & { 
          type: 'string'; 
          enum: readonly ['completed', 'failed', 'in_progress', 'cancelled']; 
        };
        readonly commandType?: McpProperty & { 
          type: 'string'; 
          enum: readonly ['show', 'configure', 'execute', 'custom']; 
        };
      }};
    };
  };
}

/**
 * Agent management tools
 */
export interface ListAgentsTool extends McpTool {
  readonly name: 'list_agents';
  readonly description: 'List all agents with their status';
  readonly inputSchema: McpInputSchema & {
    readonly properties: {
      readonly limit?: McpProperty & { type: 'number'; minimum: 1; maximum: 1000; default: 50 };
      readonly offset?: McpProperty & { type: 'number'; minimum: 0; default: 0 };
      readonly sortBy?: McpProperty & { 
        type: 'string'; 
        enum: readonly ['name', 'status', 'lastSeen', 'version']; 
      };
      readonly sortOrder?: McpProperty & { type: 'string'; enum: readonly ['asc', 'desc']; default: 'desc' };
      readonly status?: McpProperty & { 
        type: 'string'; 
        enum: readonly ['online', 'offline', 'connecting', 'error']; 
        description: 'Filter by agent status';
      };
    };
  };
}

export interface GetAgentTool extends McpTool {
  readonly name: 'get_agent';
  readonly description: 'Get detailed information about a specific agent';
  readonly inputSchema: McpInputSchema & {
    readonly required: readonly ['agentId'];
    readonly properties: {
      readonly agentId: McpProperty & { 
        type: 'string'; 
        description: 'Unique identifier of the agent';
        minLength: 1;
      };
      readonly includeDevices?: McpProperty & { 
        type: 'boolean'; 
        default: false;
        description: 'Include devices managed by this agent';
      };
      readonly includeStatus?: McpProperty & { 
        type: 'boolean'; 
        default: false;
        description: 'Include detailed agent status information';
      };
    };
  };
}

/**
 * System administration tools
 */
export interface GetSystemStatusTool extends McpTool {
  readonly name: 'get_system_status';
  readonly description: 'Get Restorepoint system status and health information';
  readonly inputSchema: McpInputSchema & {
    readonly properties: {
      readonly includeDetails?: McpProperty & { 
        type: 'boolean'; 
        default: false;
        description: 'Include detailed system information';
      };
      readonly includeMetrics?: McpProperty & { 
        type: 'boolean'; 
        default: false;
        description: 'Include system performance metrics';
      };
    };
  };
}

export interface GetLicensesTool extends McpTool {
  readonly name: 'get_licenses';
  readonly description: 'Get license information and usage';
  readonly inputSchema: McpInputSchema & {
    readonly properties: {
      readonly includeUsage?: McpProperty & { 
        type: 'boolean'; 
        default: false;
        description: 'Include license usage details';
      };
    };
  };
}

/**
 * Tool registry interface
 */
export interface ToolRegistry {
  readonly tools: readonly McpTool[];
  register(tool: McpTool): void;
  get(name: string): McpTool | undefined;
  list(): readonly McpTool[];
}

/**
 * Type guards for tool identification
 */
export const isDeviceTool = (tool: McpTool): tool is ListDevicesTool | GetDeviceTool | CreateDeviceTool | UpdateDeviceTool | DeleteDeviceTool => {
  return tool.name.includes('device');
};

export const isBackupTool = (tool: McpTool): tool is CreateBackupTool | GetBackupStatusTool | ListBackupsTool => {
  return tool.name.includes('backup');
};

export const isCommandTool = (tool: McpTool): tool is ExecuteCommandTool | GetCommandStatusTool | ScheduleCommandTool | ListCommandsTool => {
  return tool.name.includes('command');
};

export const isAgentTool = (tool: McpTool): tool is ListAgentsTool | GetAgentTool => {
  return tool.name.includes('agent');
};

export const isSystemTool = (tool: McpTool): tool is GetSystemStatusTool | GetLicensesTool => {
  return tool.name.includes('system') || tool.name.includes('license');
};