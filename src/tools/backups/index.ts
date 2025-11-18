/**
 * Backup Management Tools Implementation
 * Real API integration with Restorepoint servers
 */

import type { McpResult } from '../../types/mcp-tools.js';
import { Logger } from '../../utils/logger.js';
import { ApiClient } from '../../auth/api-client.js';
import { RESTOREPOINT_ENDPOINTS } from '../../constants/endpoints.js';
import { ERROR_CODES, RestorepointError } from '../../constants/error-codes.js';
import type { BackupListResponse, BackupResponse } from '../../types/restorepoint-api.js';

/**
 * Handle list_backups tool with real API integration
 */
export const handleListBackups = async (args: unknown, apiClient: ApiClient): Promise<McpResult> => {
  const timer = Logger.startTimer('BackupTools', 'listBackups');
  
  try {
    const { 
      limit = 50, 
      offset = 0, 
      sortBy = 'Created', 
      sortOrder = 'desc',
      deviceId,
      dateFrom,
      dateTo
    } = args as { 
      limit?: number; 
      offset?: number; 
      sortBy?: string; 
      sortOrder?: string;
      deviceId?: string;
      dateFrom?: string;
      dateTo?: string;
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

    Logger.logWithContext('info', 'Fetching backups from Restorepoint API', 'BackupTools', {
      limit, offset, sortBy, sortOrder, deviceId
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
    if (dateFrom) queryParams.append('dateFrom', dateFrom);
    if (dateTo) queryParams.append('dateTo', dateTo);

    // Make API request to get backups
    const response = await apiClient.get<BackupListResponse>(
      `${RESTOREPOINT_ENDPOINTS.BACKUPS}?${queryParams.toString()}`
    );

    if (!response.success || !response.data) {
      throw new RestorepointError(
        ERROR_CODES.NETWORK_SERVER_ERROR,
        response.message || 'Failed to retrieve backups from Restorepoint',
        response.errors ? Object.keys(response.errors).length : 0
      );
    }

    const backupData = response.data as any;
    const backups = Array.isArray(backupData) ? backupData : backupData.data || [];
    const total = backupData.metadata?.total || backupData.total || backups.length;

    timer();

    Logger.logWithContext('info', 'Backups retrieved successfully from API', 'BackupTools', {
      returned: backups.length,
      total,
      limit,
      offset,
    });

    return {
      success: true,
      data: backups,
      metadata: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
        totalPages: Math.ceil(total / limit),
      },
      message: `Successfully retrieved ${backups.length} of ${total} backups`,
    };

  } catch (error) {
    timer();
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    Logger.logWithContext('error', 'Failed to retrieve backups from API', 'BackupTools', {
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
        message: `Failed to retrieve backups: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      },
    };
  }
};

/**
 * Handle get_backup tool with real API integration
 */
export const handleGetBackup = async (args: unknown, apiClient: ApiClient): Promise<McpResult> => {
  const timer = Logger.startTimer('BackupTools', 'getBackup');
  
  try {
    const { backupId } = args as { 
      backupId: string; 
    };

    if (!backupId || backupId.trim().length === 0) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_MISSING_FIELD,
          message: 'Backup ID is required',
          timestamp: new Date().toISOString(),
        },
      };
    }

    Logger.logWithContext('info', 'Fetching backup details from Restorepoint API', 'BackupTools', {
      backupId: backupId.trim(),
    });

    // Make API request to get backup details
    const response = await apiClient.get<BackupResponse>(
      RESTOREPOINT_ENDPOINTS.BACKUP_BY_ID(backupId.trim())
    );

    if (!response.success || !response.data) {
      if (response.message?.toLowerCase().includes('not found') ||
          response.errors?.notFound) {
        return {
          success: false,
          error: {
            code: ERROR_CODES.BACKUP_NOT_FOUND,
            message: `Backup with ID '${backupId}' not found`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      throw new RestorepointError(
        ERROR_CODES.NETWORK_SERVER_ERROR,
        response.message || `Failed to retrieve backup details for backup: ${backupId}`,
        response.errors ? Object.keys(response.errors).length : 0
      );
    }

    const backup = (response.data as any)?.data || response.data;

    timer();

    Logger.logWithContext('info', 'Backup details retrieved successfully from API', 'BackupTools', {
      backupId: (backup as any)?.id || 'unknown',
      deviceId: (backup as any)?.deviceId || 'unknown',
      status: (backup as any)?.status || 'unknown',
    });

    return {
      success: true,
      data: backup,
      message: `Successfully retrieved backup details for backup: ${backupId}`,
    };

  } catch (error) {
    timer();
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const backupId = (args as any).backupId || 'unknown';
    
    Logger.logWithContext('error', 'Failed to retrieve backup details from API', 'BackupTools', {
      backupId,
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
        message: `Failed to retrieve backup details: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      },
    };
  }
};

/**
 * Handle create_backup tool with real API integration
 */
export const handleCreateBackup = async (args: unknown, apiClient: ApiClient): Promise<McpResult> => {
  const timer = Logger.startTimer('BackupTools', 'createBackup');
  
  try {
    const { deviceId, deviceIds, backupType = 'automatic' } = args as { 
      deviceId?: string | number;
      deviceIds?: (string | number)[];
      backupType?: string;
    };

    // Input validation
    const devicesToBackup = deviceIds || (deviceId ? [deviceId] : []);
    
    if (devicesToBackup.length === 0) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_MISSING_FIELD,
          message: 'Device ID or Device IDs are required to create backup',
          timestamp: new Date().toISOString(),
        },
      };
    }

    Logger.logWithContext('info', 'Creating backup via Restorepoint API', 'BackupTools', {
      deviceIds: devicesToBackup,
      backupType
    });

    // Build request payload
    const payload: any = {
      backupType,
      deviceIds: devicesToBackup.map(id => typeof id === 'string' ? parseInt(id, 10) : id)
    };

    // Make API request to create backup
    const response = await apiClient.post<any>(
      RESTOREPOINT_ENDPOINTS.DEVICE_BACKUPS_PERFORM,
      payload
    );

    if (!response.success) {
      throw new RestorepointError(
        ERROR_CODES.BACKUP_FAILED,
        response.message || 'Failed to create backup on Restorepoint',
        response.errors ? Object.keys(response.errors).length : 0
      );
    }

    const backupTask = response.data;

    timer();

    Logger.logWithContext('info', 'Backup creation initiated successfully', 'BackupTools', {
      taskId: backupTask?.id || backupTask?.taskId,
      deviceIds: devicesToBackup,
      backupType
    });

    return {
      success: true,
      data: backupTask,
      message: `Successfully initiated backup for ${devicesToBackup.length} device(s)`,
    };

  } catch (error) {
    timer();
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    Logger.logWithContext('error', 'Failed to create backup via API', 'BackupTools', {
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
        code: ERROR_CODES.BACKUP_FAILED,
        message: `Failed to create backup: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      },
    };
  }
};