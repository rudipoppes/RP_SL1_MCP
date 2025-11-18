/**
 * Command Execution Tools Implementation
 * Real API integration with Restorepoint servers
 */

import type { McpResult } from '../../types/mcp-tools.js';
import { Logger } from '../../utils/logger.js';
import { ApiClient } from '../../auth/api-client.js';
import { RESTOREPOINT_ENDPOINTS } from '../../constants/endpoints.js';
import { ERROR_CODES, RestorepointError } from '../../constants/error-codes.js';
import type { CommandListResponse, CommandResponse } from '../../types/restorepoint-api.js';

/**
 * Handle list_commands tool with real API integration
 */
export const handleListCommands = async (args: unknown, apiClient: ApiClient): Promise<McpResult> => {
  const timer = Logger.startTimer('CommandTools', 'listCommands');
  
  try {
    const { 
      limit = 50, 
      offset = 0, 
      sortBy = 'Created', 
      sortOrder = 'desc',
      deviceId,
      status
    } = args as { 
      limit?: number; 
      offset?: number; 
      sortBy?: string; 
      sortOrder?: string;
      deviceId?: string;
      status?: string;
    };

    // Input validation
    if (limit < 1 || limit > 1000) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_OUT_OF_RANGE,
          message: 'Limit must be between 1 and 1000',
          timestamp: new Date().toISOString(),
        },
      };
    }

    if (offset < 0) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_OUT_OF_RANGE,
          message: 'Offset must be non-negative',
          timestamp: new Date().toISOString(),
        },
      };
    }

    Logger.logWithContext('info', 'Fetching commands from Restorepoint API', 'CommandTools', {
      limit, offset, sortBy, sortOrder, deviceId, status
    });

    // Build query parameters
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      sort: sortBy,
      order: sortOrder,
    });

    // Add filters if provided
    if (deviceId) queryParams.append('deviceId', deviceId);
    if (status) queryParams.append('status', status);

    // Make API request to get commands
    const response = await apiClient.get<CommandListResponse>(
      `${RESTOREPOINT_ENDPOINTS.COMMANDS}?${queryParams.toString()}`
    );

    if (!response.success || !response.data) {
      throw new RestorepointError(
        ERROR_CODES.NETWORK_SERVER_ERROR,
        response.message || 'Failed to retrieve commands from Restorepoint',
        response.errors ? Object.keys(response.errors).length : 0
      );
    }

    const commandData = response.data as any;
    const commands = commandData.data || [];
    const total = commandData.metadata?.total || commandData.total || commands.length;

    timer();

    Logger.logWithContext('info', 'Commands retrieved successfully from API', 'CommandTools', {
      returned: commands.length,
      total,
      limit,
      offset,
    });

    return {
      success: true,
      data: commands,
      metadata: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
        totalPages: Math.ceil(total / limit),
      },
      message: `Successfully retrieved ${commands.length} of ${total} commands`,
    };

  } catch (error) {
    timer();
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    Logger.logWithContext('error', 'Failed to retrieve commands from API', 'CommandTools', {
      error: errorMessage,
      errorType: error instanceof RestorepointError ? 'RestorepointError' : 'Unknown',
    });

    if (error instanceof RestorepointError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          timestamp: error.timestamp.toISOString(),
        },
      };
    }

    return {
      success: false,
      error: {
        code: ERROR_CODES.NETWORK_CONNECTION_FAILED,
        message: `Failed to retrieve commands: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      },
    };
  }
};

/**
 * Handle get_command tool with real API integration
 */
export const handleGetCommand = async (args: unknown, apiClient: ApiClient): Promise<McpResult> => {
  const timer = Logger.startTimer('CommandTools', 'getCommand');
  
  try {
    const { commandId } = args as { 
      commandId: string; 
    };

    if (!commandId || commandId.trim().length === 0) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_MISSING_FIELD,
          message: 'Command ID is required',
          timestamp: new Date().toISOString(),
        },
      };
    }

    Logger.logWithContext('info', 'Fetching command details from Restorepoint API', 'CommandTools', {
      commandId: commandId.trim(),
    });

    // Make API request to get command details
    const response = await apiClient.get<CommandResponse>(
      RESTOREPOINT_ENDPOINTS.COMMAND_BY_ID(commandId.trim())
    );

    if (!response.success || !response.data) {
      if (response.message?.toLowerCase().includes('not found') ||
          response.errors?.notFound) {
        return {
          success: false,
          error: {
            code: ERROR_CODES.COMMAND_NOT_FOUND,
            message: `Command with ID '${commandId}' not found`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      throw new RestorepointError(
        ERROR_CODES.NETWORK_SERVER_ERROR,
        response.message || `Failed to retrieve command details for command: ${commandId}`,
        response.errors ? Object.keys(response.errors).length : 0
      );
    }

    const command = (response.data as any)?.data || response.data;

    timer();

    Logger.logWithContext('info', 'Command details retrieved successfully from API', 'CommandTools', {
      commandId: (command as any)?.id || 'unknown',
      deviceId: (command as any)?.deviceIds?.[0] || 'unknown',
      status: (command as any)?.status || 'unknown',
    });

    return {
      success: true,
      data: command,
      message: `Successfully retrieved command details for command: ${commandId}`,
    };

  } catch (error) {
    timer();
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const commandId = (args as any).commandId || 'unknown';
    
    Logger.logWithContext('error', 'Failed to retrieve command details from API', 'CommandTools', {
      commandId,
      error: errorMessage,
      errorType: error instanceof RestorepointError ? 'RestorepointError' : 'Unknown',
    });

    if (error instanceof RestorepointError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          timestamp: error.timestamp.toISOString(),
        },
      };
    }

    return {
      success: false,
      error: {
        code: ERROR_CODES.NETWORK_CONNECTION_FAILED,
        message: `Failed to retrieve command details: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      },
    };
  }
};

/**
 * Handle execute_command tool with real API integration
 */
export const handleExecuteCommand = async (args: unknown, apiClient: ApiClient): Promise<McpResult> => {
  const timer = Logger.startTimer('CommandTools', 'executeCommand');
  
  try {
    const { deviceId, deviceIds, command, variables, commandType = 'ad-hoc' } = args as { 
      deviceId?: string | number;
      deviceIds?: (string | number)[];
      command: string;
      variables?: Record<string, string>;
      commandType?: string;
    };

    // Input validation
    const devicesToExecute = deviceIds || (deviceId ? [deviceId] : []);
    
    if (devicesToExecute.length === 0) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_MISSING_FIELD,
          message: 'Device ID or Device IDs are required to execute command',
          timestamp: new Date().toISOString(),
        },
      };
    }

    if (!command || command.trim().length === 0) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_MISSING_FIELD,
          message: 'Command is required',
          timestamp: new Date().toISOString(),
        },
      };
    }

    Logger.logWithContext('info', 'Executing command via Restorepoint API', 'CommandTools', {
      deviceIds: devicesToExecute,
      command: command.trim(),
      commandType,
      hasVariables: !!variables
    });

    // Build request payload
    const payload: any = {
      commandType,
      command: command.trim(),
      deviceIds: devicesToExecute.map(id => typeof id === 'string' ? parseInt(id, 10) : id)
    };

    // Add variables if provided
    if (variables && Object.keys(variables).length > 0) {
      payload.variables = variables;
    }

    // Make API request to execute command
    const response = await apiClient.post<any>(
      RESTOREPOINT_ENDPOINTS.COMMANDS_PERFORM,
      payload
    );

    if (!response.success) {
      throw new RestorepointError(
        ERROR_CODES.COMMAND_FAILED,
        response.message || 'Failed to execute command on Restorepoint',
        response.errors ? Object.keys(response.errors).length : 0
      );
    }

    const commandTask = response.data;

    timer();

    Logger.logWithContext('info', 'Command execution initiated successfully', 'CommandTools', {
      taskId: commandTask?.id || commandTask?.taskId,
      deviceIds: devicesToExecute,
      command: command.trim(),
      commandType
    });

    return {
      success: true,
      data: commandTask,
      message: `Successfully initiated command execution for ${devicesToExecute.length} device(s)`,
    };

  } catch (error) {
    timer();
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    Logger.logWithContext('error', 'Failed to execute command via API', 'CommandTools', {
      error: errorMessage,
      errorType: error instanceof RestorepointError ? 'RestorepointError' : 'Unknown',
    });

    if (error instanceof RestorepointError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          timestamp: error.timestamp.toISOString(),
        },
      };
    }

    return {
      success: false,
      error: {
        code: ERROR_CODES.COMMAND_FAILED,
        message: `Failed to execute command: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      },
    };
  }
};

/**
 * Handle get_task_status tool with real API integration
 */
export const handleGetTaskStatus = async (args: unknown, apiClient: ApiClient): Promise<McpResult> => {
  const timer = Logger.startTimer('CommandTools', 'getTaskStatus');
  
  try {
    const { taskId, taskType = 'command' } = args as { 
      taskId: string | number;
      taskType?: string;
    };

    if (!taskId || (typeof taskId === 'string' && taskId.trim().length === 0)) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_MISSING_FIELD,
          message: 'Task ID is required',
          timestamp: new Date().toISOString(),
        },
      };
    }

    const taskIdStr = typeof taskId === 'string' ? taskId.trim() : taskId.toString();

    Logger.logWithContext('info', 'Fetching task status from Restorepoint API', 'CommandTools', {
      taskId: taskIdStr,
      taskType
    });

    // Determine endpoint based on task type
    let endpoint: string;
    if (taskType === 'backup') {
      endpoint = RESTOREPOINT_ENDPOINTS.TASK_STATUS(taskIdStr);
    } else {
      endpoint = RESTOREPOINT_ENDPOINTS.COMMAND_BY_ID(taskIdStr);
    }

    // Make API request to get task status
    const response = await apiClient.get<any>(endpoint);

    if (!response.success || !response.data) {
      if (response.message?.toLowerCase().includes('not found') ||
          response.errors?.notFound) {
        return {
          success: false,
          error: {
            code: ERROR_CODES.TASK_NOT_FOUND,
            message: `Task with ID '${taskIdStr}' not found`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      throw new RestorepointError(
        ERROR_CODES.TASK_FAILED,
        response.message || `Failed to retrieve task status: ${taskIdStr}`,
        response.errors ? Object.keys(response.errors).length : 0
      );
    }

    const taskData = (response.data as any)?.data || response.data;

    timer();

    Logger.logWithContext('info', 'Task status retrieved successfully from API', 'CommandTools', {
      taskId: taskData?.id || taskIdStr,
      status: taskData?.status || 'unknown',
      progress: taskData?.progress || 0
    });

    return {
      success: true,
      data: taskData,
      message: `Successfully retrieved status for task: ${taskIdStr}`,
    };

  } catch (error) {
    timer();
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const taskId = (args as any).taskId || 'unknown';
    
    Logger.logWithContext('error', 'Failed to retrieve task status from API', 'CommandTools', {
      taskId,
      error: errorMessage,
      errorType: error instanceof RestorepointError ? 'RestorepointError' : 'Unknown',
    });

    if (error instanceof RestorepointError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          timestamp: error.timestamp.toISOString(),
        },
      };
    }

    return {
      success: false,
      error: {
        code: ERROR_CODES.TASK_FAILED,
        message: `Failed to retrieve task status: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      },
    };
  }
};