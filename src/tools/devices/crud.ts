/**
 * Device CRUD Operations (Create, Update, Delete)
 * Professional implementations following enterprise standards
 * Real API integration with Restorepoint servers
 */

import type { McpResult } from '../../types/mcp-tools.js';
import { Logger } from '../../utils/logger.js';
import { ApiClient } from '../../auth/api-client.js';
import { RESTOREPOINT_ENDPOINTS } from '../../constants/endpoints.js';
import { ERROR_CODES, RestorepointError } from '../../constants/error-codes.js';
import type { Device, DeviceCreateRequest, DeviceUpdateRequest, DeviceResponse } from '../../types/restorepoint-api.js';

/**
 * Handle create_device tool with validation and real API integration
 */
export const handleCreateDevice = async (args: unknown, apiClient: ApiClient): Promise<McpResult> => {
  const timer = Logger.startTimer('DeviceTools', 'createDevice');
  
  try {
    const {
      name,
      type,
      ipAddress,
      hostname,
      credentials,
      description,
      enabled = true
    } = args as {
      name: string;
      type: string;
      ipAddress?: string;
      hostname?: string;
      credentials: { username: string; password: string };
      description?: string;
      enabled?: boolean;
    };

    // Input validation
    if (!name || !type || !credentials) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_MISSING_FIELD,
          message: 'Device name, type, and credentials are required',
          timestamp: new Date().toISOString(),
        },
      };
    }

    if (name.trim().length === 0 || name.length > 200) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
          message: 'Device name must be 1-200 characters',
          timestamp: new Date().toISOString(),
        },
      };
    }

    if (type.trim().length === 0) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
          message: 'Device type is required',
          timestamp: new Date().toISOString(),
        },
      };
    }

    if (!credentials.username || !credentials.password) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_MISSING_FIELD,
          message: 'Both username and password are required in credentials',
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Validate IP address format if provided
    if (ipAddress && !isValidIpAddress(ipAddress)) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
          message: 'Invalid IP address format',
          timestamp: new Date().toISOString(),
        },
      };
    }

    if (hostname && hostname.length > 253) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_OUT_OF_RANGE,
          message: 'Hostname must be 253 characters or less',
          timestamp: new Date().toISOString(),
        },
      };
    }

    if (description && description.length > 500) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_OUT_OF_RANGE,
          message: 'Description must be 500 characters or less',
          timestamp: new Date().toISOString(),
        },
      };
    }

    Logger.logWithContext('info', 'Creating new device via Restorepoint API', 'DeviceTools', {
      name,
      type,
      ipAddress,
      hostname,
      enabled,
      hasCredentials: !!credentials,
    });

    // Prepare device creation request
    const deviceRequest: DeviceCreateRequest = {
      name: name.trim(),
      type: type.trim().toLowerCase(),
      ipAddress: ipAddress?.trim(),
      hostname: hostname?.trim(),
      credentials: {
        username: credentials.username.trim(),
        password: credentials.password, // Password will be sent securely
      },
      description: description?.trim(),
      enabled,
    };

    // Make API request to create device
    const response = await apiClient.post<DeviceResponse>(
      RESTOREPOINT_ENDPOINTS.DEVICES,
      deviceRequest
    );

    if (!response.success || !response.data) {
      // Handle specific error cases
      if (response.message?.toLowerCase().includes('already exists') ||
          response.errors?.duplicate) {
        return {
          success: false,
          error: {
            code: ERROR_CODES.DEVICE_INVALID_TYPE,
            message: `Device with name '${name}' or IP '${ipAddress}' already exists`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      if (response.message?.toLowerCase().includes('invalid type') ||
          response.errors?.invalidType) {
        return {
          success: false,
          error: {
            code: ERROR_CODES.DEVICE_INVALID_TYPE,
            message: `Invalid device type: ${type}. Supported types include: cisco-ios, cisco-nxos, linux, windows, palo-alto, etc.`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      throw new RestorepointError(
        ERROR_CODES.NETWORK_SERVER_ERROR,
        response.message || 'Failed to create device in Restorepoint',
        response.errors ? Object.keys(response.errors).length : 0
      );
    }

    const device = (response.data as any)?.device || response.data;

    timer();

    Logger.logWithContext('info', 'Device created successfully via API', 'DeviceTools', {
      deviceId: device.id,
      deviceName: device.name,
      deviceType: device.type,
      status: device.status,
    });

    return {
      success: true,
      data: device,
      message: `Successfully created device: ${device.name} (${device.id})`,
    };

  } catch (error) {
    timer();
    
    // Log the error with context
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const deviceName = (args as any).name || 'unknown';
    
    Logger.logWithContext('error', 'Failed to create device via API', 'DeviceTools', {
      deviceName,
      error: errorMessage,
      errorType: error instanceof RestorepointError ? 'RestorepointError' : 'Unknown',
    });

    // Return structured error response
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
        message: `Failed to create device: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      },
    };
  }
};

/**
 * Handle update_device tool with partial updates via API
 */
export const handleUpdateDevice = async (args: unknown, apiClient: ApiClient): Promise<McpResult> => {
  const timer = Logger.startTimer('DeviceTools', 'updateDevice');
  
  try {
    const { 
      deviceId, 
      name, 
      type, 
      ipAddress, 
      hostname, 
      credentials, 
      description, 
      enabled 
    } = args as {
      deviceId: string;
      name?: string;
      type?: string;
      ipAddress?: string;
      hostname?: string;
      credentials?: { username?: string; password?: string };
      description?: string;
      enabled?: boolean;
    };

    // Input validation
    if (!deviceId || deviceId.trim().length === 0) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_MISSING_FIELD,
          message: 'Device ID is required',
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Validate updates
    if (name && (name.trim().length === 0 || name.length > 200)) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
          message: 'Device name must be 1-200 characters',
          timestamp: new Date().toISOString(),
        },
      };
    }

    if (type && type.trim().length === 0) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
          message: 'Device type cannot be empty',
          timestamp: new Date().toISOString(),
        },
      };
    }

    if (ipAddress && !isValidIpAddress(ipAddress)) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
          message: 'Invalid IP address format',
          timestamp: new Date().toISOString(),
        },
      };
    }

    if (hostname && hostname.length > 253) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_OUT_OF_RANGE,
          message: 'Hostname must be 253 characters or less',
          timestamp: new Date().toISOString(),
        },
      };
    }

    if (description && description.length > 500) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_OUT_OF_RANGE,
          message: 'Description must be 500 characters or less',
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Check if at least one field is being updated
    const hasUpdates = !!(name || type || ipAddress || hostname || credentials || description !== undefined || enabled !== undefined);
    if (!hasUpdates) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_INVALID_INPUT,
          message: 'At least one field must be provided for update',
          timestamp: new Date().toISOString(),
        },
      };
    }

    Logger.logWithContext('info', 'Updating device via Restorepoint API', 'DeviceTools', {
      deviceId,
      updates: { name, type, ipAddress, hostname, hasCredentials: !!credentials, hasDescription: description !== undefined, enabled },
    });

    // Prepare update request with only provided fields
    const updateRequest: any = {};
    
    if (name !== undefined) updateRequest.name = name.trim();
    if (type !== undefined) updateRequest.type = type.trim().toLowerCase();
    if (ipAddress !== undefined) updateRequest.ipAddress = ipAddress.trim();
    if (hostname !== undefined) updateRequest.hostname = hostname.trim();
    if (credentials !== undefined) {
      updateRequest.credentials = {};
      if (credentials.username !== undefined) updateRequest.credentials.username = credentials.username.trim();
      if (credentials.password !== undefined) updateRequest.credentials.password = credentials.password;
    }
    if (description !== undefined) updateRequest.description = description?.trim();
    if (enabled !== undefined) updateRequest.enabled = enabled;

    // Make API request to update device
    const response = await apiClient.put<DeviceResponse>(
      RESTOREPOINT_ENDPOINTS.DEVICE_BY_ID(deviceId.trim()),
      updateRequest
    );

    if (!response.success || !response.data) {
      // Handle specific 404 case for device not found
      if (response.message?.toLowerCase().includes('not found') ||
          response.errors?.notFound) {
        return {
          success: false,
          error: {
            code: ERROR_CODES.DEVICE_NOT_FOUND,
            message: `Device with ID '${deviceId}' not found`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      throw new RestorepointError(
        ERROR_CODES.NETWORK_SERVER_ERROR,
        response.message || `Failed to update device: ${deviceId}`,
        response.errors ? Object.keys(response.errors).length : 0
      );
    }

    const device = (response.data as any)?.device || response.data;

    timer();

    Logger.logWithContext('info', 'Device updated successfully via API', 'DeviceTools', {
      deviceId: device.id,
      deviceName: device.name,
      updates: { name, type, ipAddress, hostname },
    });

    return {
      success: true,
      data: device,
      message: `Successfully updated device: ${device.name} (${device.id})`,
    };

  } catch (error) {
    timer();
    
    // Log the error with context
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const deviceId = (args as any).deviceId || 'unknown';
    
    Logger.logWithContext('error', 'Failed to update device via API', 'DeviceTools', {
      deviceId,
      error: errorMessage,
      errorType: error instanceof RestorepointError ? 'RestorepointError' : 'Unknown',
    });

    // Return structured error response
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
        message: `Failed to update device: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      },
    };
  }
};

/**
 * Handle delete_device tool with safety checks via API
 */
export const handleDeleteDevice = async (args: unknown, apiClient: ApiClient): Promise<McpResult> => {
  const timer = Logger.startTimer('DeviceTools', 'deleteDevice');
  
  try {
    const { deviceId, force = false } = args as { 
      deviceId: string; 
      force?: boolean; 
    };

    // Input validation
    if (!deviceId || deviceId.trim().length === 0) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_MISSING_FIELD,
          message: 'Device ID is required',
          timestamp: new Date().toISOString(),
        },
      };
    }

    Logger.logWithContext('info', 'Deleting device via Restorepoint API', 'DeviceTools', {
      deviceId: deviceId.trim(),
      force,
    });

    // Build query parameters
    const queryParams = new URLSearchParams({
      force: force.toString(),
    });

    // Make API request to delete device
    const response = await apiClient.delete<DeviceResponse>(
      `${RESTOREPOINT_ENDPOINTS.DEVICE_BY_ID(deviceId.trim())}?${queryParams.toString()}`
    );

    if (!response.success || !response.data) {
      // Handle specific 404 case for device not found
      if (response.message?.toLowerCase().includes('not found') ||
          response.errors?.notFound) {
        return {
          success: false,
          error: {
            code: ERROR_CODES.DEVICE_NOT_FOUND,
            message: `Device with ID '${deviceId}' not found`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Handle case where device has backups and force=false
      if (response.message?.toLowerCase().includes('backups') ||
          response.errors?.hasBackups) {
        return {
          success: false,
          error: {
            code: ERROR_CODES.BACKUP_IN_PROGRESS,
            message: `Cannot delete device with existing backups. Use force=true to override.`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      throw new RestorepointError(
        ERROR_CODES.NETWORK_SERVER_ERROR,
        response.message || `Failed to delete device: ${deviceId}`,
        response.errors ? Object.keys(response.errors).length : 0
      );
    }

    const device = (response.data as any)?.device || response.data;

    timer();

    Logger.logWithContext('info', 'Device deleted successfully via API', 'DeviceTools', {
      deviceId: device.id,
      deviceName: device.name,
      force,
    });

    return {
      success: true,
      data: {
        deviceId: device.id,
        deviceName: device.name,
        deletedAt: new Date().toISOString(),
      },
      message: `Successfully deleted device: ${device.name} (${device.id})`,
    };

  } catch (error) {
    timer();
    
    // Log the error with context
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const deviceId = (args as any).deviceId || 'unknown';
    
    Logger.logWithContext('error', 'Failed to delete device via API', 'DeviceTools', {
      deviceId,
      error: errorMessage,
      errorType: error instanceof RestorepointError ? 'RestorepointError' : 'Unknown',
    });

    // Return structured error response
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
        message: `Failed to delete device: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      },
    };
  }
};

/**
 * Validate IP address format using regex
 */
function isValidIpAddress(ip: string): boolean {
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip);
}