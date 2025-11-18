/**
 * Device Status Tool Implementation
 * Professional tool implementation following highest engineering standards
 * Provides device status information extracted from device data
 */

import type { McpResult } from '../../types/mcp-tools.js';
import { Logger } from '../../utils/logger.js';
import { ApiClient } from '../../auth/api-client.js';
import { RESTOREPOINT_ENDPOINTS } from '../../constants/endpoints.js';
import { ERROR_CODES, RestorepointError } from '../../constants/error-codes.js';

/**
 * Device status interface for structured response
 */
interface DeviceStatus {
  deviceId: string | number;
  deviceName: string;
  deviceType: string;
  ipAddress: string;
  status: string;
  backupStatus: string;
  lastBackupAttempt?: string;
  lastSuccessfulBackup?: string;
  uptime: number;
  isUp: boolean | null;
  monitorEnabled: boolean;
  state: string;
  complianceStatus: string;
  backupSize: number;
  additionalInfo: {
    manufacturer?: string;
    model?: string;
    firmware?: string;
    serial?: string;
    location?: string;
  };
}

/**
 * Handle get_status tool to retrieve device status information
 * Extracts status data from device information
 */
export const handleGetStatus = async (args: unknown, apiClient: ApiClient): Promise<McpResult> => {
  const timer = Logger.startTimer('DeviceTools', 'getStatus');
  
  try {
    // Handle different argument formats - could be string, object, or already parsed
    let parsedArgs: any = args;
    
    // If args is a string, parse it as JSON
    if (typeof args === 'string') {
      try {
        parsedArgs = JSON.parse(args);
      } catch (e) {
        return {
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
            message: 'Invalid arguments format',
            timestamp: new Date().toISOString(),
          },
        };
      }
    }
    
    // Extract device_id parameter with different naming conventions
    let deviceId: string | number | undefined;
    
    if (parsedArgs && typeof parsedArgs === 'object') {
      deviceId = parsedArgs.device_id || parsedArgs.deviceId || parsedArgs['device_id'];
    }

    // Input validation
    if (!deviceId || (typeof deviceId === 'string' && deviceId.trim().length === 0)) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_MISSING_FIELD,
          message: 'Device ID is required',
          timestamp: new Date().toISOString(),
        },
      };
    }

    Logger.logWithContext('info', 'Fetching device status from Restorepoint API', 'DeviceTools', {
      deviceId,
    });

    // First, try to get specific device details
    let deviceResponse: any;
    
    try {
      const response = await apiClient.get(
        `${RESTOREPOINT_ENDPOINTS.DEVICE_BY_ID(deviceId.toString())}`
      );
      
      if (!response.success || !response.data) {
        throw new RestorepointError(
          ERROR_CODES.DEVICE_NOT_FOUND,
          `Device with ID '${deviceId}' not found`,
          1
        );
      }
      
      deviceResponse = response.data;
      
    } catch (deviceError) {
      // If specific device lookup fails, fall back to listing all devices and finding the match
      Logger.logWithContext('warn', 'Specific device lookup failed, falling back to device list', 'DeviceTools', {
        deviceId,
        error: deviceError instanceof Error ? deviceError.message : 'Unknown error',
      });
      
      const listResponse = await apiClient.get(RESTOREPOINT_ENDPOINTS.DEVICES);
      
      if (!listResponse.success || !listResponse.data) {
        throw new RestorepointError(
          ERROR_CODES.NETWORK_SERVER_ERROR,
          'Failed to retrieve devices from Restorepoint',
          1
        );
      }
      
      const devices = Array.isArray(listResponse.data) ? listResponse.data : (listResponse.data as any).data || [];
      const device = devices.find((d: any) => 
        d.ID.toString() === deviceId.toString() || 
        d.Name === deviceId.toString()
      );
      
      if (!device) {
        return {
          success: false,
          error: {
            code: ERROR_CODES.DEVICE_NOT_FOUND,
            message: `Device with ID '${deviceId}' not found`,
            timestamp: new Date().toISOString(),
          },
        };
      }
      
      deviceResponse = device;
    }

    // Extract device from response (handle different response structures)
    const device = deviceResponse.device || deviceResponse.data || deviceResponse;

    // Extract status information in a structured format
    const status: DeviceStatus = {
      deviceId: device.ID || device.id,
      deviceName: device.Name || device.name || 'Unknown',
      deviceType: device.PluginName || device.type || 'Unknown',
      ipAddress: device.Address || device.ipAddress || 'Unknown',
      status: device.Status || device.status || 'Unknown',
      backupStatus: device.BackupStatus || device.backupStatus || 'Unknown',
      lastBackupAttempt: device.LastBackupAttempt || device.lastBackupAttempt,
      lastSuccessfulBackup: device.LastSuccessfulBackup || device.lastSuccessfulBackup,
      uptime: device.Uptime || device.uptime || -1,
      isUp: device.Up !== undefined ? device.Up : (device.isUp !== undefined ? device.isUp : null),
      monitorEnabled: device.Monitor?.Enabled || device.monitorEnabled || false,
      state: device.State || device.state || 'Unknown',
      complianceStatus: device.ComplianceStatus || device.complianceStatus || 'N/A',
      backupSize: device.BackupSize || device.backupSize || 0,
      additionalInfo: {
        manufacturer: device.AssetFields?.find((field: any) => field.Name === 'Manufacturer')?.Value,
        model: device.AssetFields?.find((field: any) => field.Name === 'Model')?.Value || device.Model,
        firmware: device.AssetFields?.find((field: any) => field.Name === 'Firmware')?.Value,
        serial: device.AssetFields?.find((field: any) => field.Name === 'Serial')?.Value,
        location: device.AssetFields?.find((field: any) => field.Name === 'Location')?.Value,
      }
    };

    timer();

    Logger.logWithContext('info', 'Device status retrieved successfully', 'DeviceTools', {
      deviceId: status.deviceId,
      deviceName: status.deviceName,
      status: status.status,
      backupStatus: status.backupStatus,
      isUp: status.isUp,
    });

    return {
      success: true,
      data: {
        device: status,
        statusSummary: {
          overall: status.status,
          connectivity: status.isUp === true ? 'Connected' : status.isUp === false ? 'Disconnected' : 'Unknown',
          backup: status.backupStatus,
          monitoring: status.monitorEnabled ? 'Enabled' : 'Disabled',
          lastBackup: status.lastSuccessfulBackup || 'Never',
        },
        health: {
          isHealthy: status.status === 'OK' && status.backupStatus === 'OK',
          issues: [
            ...(status.status !== 'OK' ? [`Device status: ${status.status}`] : []),
            ...(status.backupStatus !== 'OK' ? [`Backup status: ${status.backupStatus}`] : []),
            ...(status.isUp === false ? ['Device is down'] : []),
            ...(status.monitorEnabled === false ? ['Monitoring is disabled'] : []),
          ],
        }
      },
      message: `Successfully retrieved status for device: ${status.deviceName}`,
    };

  } catch (error) {
    timer();
    
    // Log the error with context
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const deviceId = (args as any).device_id || (args as any).deviceId || 'unknown';
    
    Logger.logWithContext('error', 'Failed to retrieve device status', 'DeviceTools', {
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
        message: `Failed to retrieve device status: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      },
    };
  }
};