/**
 * List Devices Tool
 * Provides functionality to list and filter devices from Restorepoint
 */

import type { McpTool, McpResult } from '../../types/mcp-tools.js';
import { ERROR_CODES, RestorepointError } from '../../constants/error-codes.js';
import { InputValidator, DeviceSchemas } from '../../utils/validators.js';
import { Logger } from '../../utils/logger.js';
import type { ApiClient } from '../../auth/api-client.js';

/**
 * Handle list devices request
 */
export async function handleListDevices(args: unknown, apiClient: ApiClient): Promise<McpResult> {
  const timer = Logger.startTimer('ListDevices', 'handle');
  
  try {
    // Validate input parameters
    const validation = InputValidator.validate(
      DeviceSchemas.listDevices,
      args
    );

    if (!validation.isValid) {
      throw new RestorepointError(
        ERROR_CODES.VALIDATION_INVALID_INPUT,
        `Invalid input: ${validation.errors.join(', ')}`
      );
    }

    const params = validation.data as any;
    Logger.logWithContext('info', 'Listing devices', 'ListDevices', {
      limit: params.limit,
      offset: params.offset,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
      hasFilter: !!params.filter,
    });

    // Build query parameters
    const queryParams: Record<string, string> = {
      limit: params.limit.toString(),
      offset: params.offset.toString(),
    };

    if (params.sortBy) {
      queryParams.sortBy = params.sortBy;
      queryParams.sortOrder = params.sortOrder;
    }

    // Apply filters
    if (params.filter) {
      if (params.filter.type) {
        queryParams.type = params.filter.type;
      }
      if (params.filter.enabled !== undefined) {
        queryParams.enabled = params.filter.enabled.toString();
      }
      if (params.filter.searchTerm) {
        queryParams.search = params.filter.searchTerm;
      }
    }

    // Make actual API call
    const response = await apiClient.get('/devices', {
      params: queryParams,
    });

    if (!response.success) {
      throw new RestorepointError(
        ERROR_CODES.NETWORK_SERVER_ERROR,
        response.message || 'Failed to fetch devices from Restorepoint API'
      );
    }

    timer();

    // The actual devices API returns the data directly according to swagger
    const devicesData = response.data as any;
    const deviceCount = Array.isArray(devicesData?.data) ? devicesData.data.length : 0;
    const totalDevices = devicesData?.total || 0;

    Logger.logWithContext('info', 'Devices listed successfully', 'ListDevices', {
      deviceCount,
      total: totalDevices,
    });

    return {
      success: true,
      data: devicesData,
      message: `Successfully listed ${deviceCount} devices`,
    };

  } catch (error) {
    timer();

    Logger.logWithContext('error', 'Failed to list devices', 'ListDevices', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    if (error instanceof RestorepointError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      };
    }

    return {
      success: false,
      error: {
        code: ERROR_CODES.SYSTEM_INTERNAL_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
    };
  }
}