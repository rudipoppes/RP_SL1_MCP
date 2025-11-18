/**
 * Device Management Tools Implementation
 * Professional tool implementations following highest engineering standards
 * Real API integration with Restorepoint servers
 */

import type { McpResult } from '../../types/mcp-tools.js';
import { Logger } from '../../utils/logger.js';
import { ApiClient } from '../../auth/api-client.js';
import { RESTOREPOINT_ENDPOINTS, HTTP_STATUS_CODES } from '../../constants/endpoints.js';
import { ERROR_CODES, RestorepointError } from '../../constants/error-codes.js';
import type { DeviceListResponse, DeviceResponse } from '../../types/restorepoint-api.js';

/**
 * Handle list_devices tool with comprehensive filtering and pagination
 * Real API integration with Restorepoint servers
 */
export const handleListDevices = async (args: unknown, apiClient: ApiClient): Promise<McpResult> => {
  const timer = Logger.startTimer('DeviceTools', 'listDevices');
  
  try {
    const { 
      limit = 50, 
      offset = 0, 
      filter 
    } = args as { 
      limit?: number; 
      offset?: number; 
      sortBy?: string; 
      sortOrder?: string;
      filter?: {
        type?: string;
        enabled?: boolean;
        searchTerm?: string;
      };
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

    Logger.logWithContext('info', 'Fetching devices from Restorepoint API', 'DeviceTools', {
      limit, offset, hasFilter: !!filter
    });

    // Build query parameters for API request (devices endpoint doesn't support sorting)
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    // Add filter parameters if provided
    if (filter?.type) {
      queryParams.append('type', filter.type);
    }
    if (filter?.enabled !== undefined) {
      queryParams.append('enabled', filter.enabled.toString());
    }
    if (filter?.searchTerm) {
      queryParams.append('search', filter.searchTerm);
    }

    // Make API request to Restorepoint
    const response = await apiClient.get<DeviceListResponse>(
      `${RESTOREPOINT_ENDPOINTS.DEVICES}?${queryParams.toString()}`
    );

    if (!response.success || !response.data) {
      throw new RestorepointError(
        ERROR_CODES.NETWORK_SERVER_ERROR,
        response.message || 'Failed to retrieve devices from Restorepoint',
        response.errors ? Object.keys(response.errors).length : 0
      );
    }

    // The API client transforms the response, but it's not working correctly for pagination
    // The actual response contains the device array directly
    const apiResponse = response.data as any;
    
    // Check if we got the raw device array (API client transform failed) or wrapped response
    if (Array.isArray(apiResponse)) {
      // We got the raw device array directly - extract devices from it
      const devices = apiResponse;
      const total = devices.length; // We don't have the total from metadata, so use array length
      
      timer();

      Logger.logWithContext('info', 'Devices retrieved successfully from API', 'DeviceTools', {
        returned: devices.length,
        total,
        limit,
        offset,
        hasFilter: !!filter,
      });

      return {
        success: true,
        data: devices,
        metadata: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
          totalPages: Math.ceil(total / limit),
          hasFilter: !!filter,
          filters: filter || {},
        },
        message: `Successfully retrieved ${devices.length} of ${total} devices`,
      };
    }
    
    // Normal wrapped response handling
    const devices = apiResponse.data || [];
    const total = apiResponse.metadata?.total || apiResponse.total || 0;
    const startIndex = apiResponse.metadata?.offset || offset;
    const endIndex = Math.min(startIndex + limit, total);

    timer();

    Logger.logWithContext('info', 'Devices retrieved successfully from API', 'DeviceTools', {
      returned: devices.length,
      total,
      limit,
      offset: startIndex,
      hasFilter: !!filter,
    });

    return {
      success: true,
      data: devices,
      metadata: {
        total,
        limit,
        offset: startIndex,
        hasMore: endIndex < total,
        totalPages: Math.ceil(total / limit),
        hasFilter: !!filter,
        filters: filter || {},
      },
      message: `Successfully retrieved ${devices.length} of ${total} devices`,
    };

  } catch (error) {
    timer();
    
    // Log the error with context
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    Logger.logWithContext('error', 'Failed to retrieve devices from API', 'DeviceTools', {
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
        message: `Failed to retrieve devices: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      },
    };
  }
};

/**
 * Handle get_device tool with comprehensive device details
 * Real API integration with Restorepoint servers
 */
export const handleGetDevice = async (args: unknown, apiClient: ApiClient): Promise<McpResult> => {
  const timer = Logger.startTimer('DeviceTools', 'getDevice');
  
  try {
    const { deviceId, includeConnections = false } = args as { 
      deviceId: string; 
      includeConnections?: boolean; 
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

    Logger.logWithContext('info', 'Fetching device details from Restorepoint API', 'DeviceTools', {
      deviceId,
      includeConnections,
    });

    // Build query parameters
    const queryParams = new URLSearchParams({
      includeConnections: includeConnections.toString(),
    });

    // Make API request to get device details
    const response = await apiClient.get<DeviceResponse>(
      `${RESTOREPOINT_ENDPOINTS.DEVICE_BY_ID(deviceId)}?${queryParams.toString()}`
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
        response.message || `Failed to retrieve device details for device: ${deviceId}`,
        response.errors ? Object.keys(response.errors).length : 0
      );
    }

    const device = (response.data as any)?.device || (response.data as any)?.data || response.data;

    timer();

    Logger.logWithContext('info', 'Device details retrieved successfully from API', 'DeviceTools', {
      deviceId: device.id,
      deviceName: device.name,
      deviceType: device.type,
      status: device.status,
    });

    return {
      success: true,
      data: device,
      message: `Successfully retrieved details for device: ${device.name}`,
    };

  } catch (error) {
    timer();
    
    // Log the error with context
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const deviceId = (args as any).deviceId || 'unknown';
    
    Logger.logWithContext('error', 'Failed to retrieve device details from API', 'DeviceTools', {
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
        message: `Failed to retrieve device details: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      },
    };
  }
};