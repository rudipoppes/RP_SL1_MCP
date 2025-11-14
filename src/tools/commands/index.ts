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
      sortBy = 'createdAt', 
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