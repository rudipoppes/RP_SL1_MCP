/**
 * Device Requirements Tool Handler
 * Provides accurate device creation requirements to prevent misinformation
 */

import type { McpResult } from '../../types/mcp-tools.js';
import { Logger } from '../../utils/logger.js';
import { 
  getDeviceCreationRequirements, 
  getDeviceTypeInfo, 
  getSupportedDeviceTypes,
  validateDeviceRequest 
} from './requirements.js';

/**
 * Handle get_device_requirements tool request
 */
export const handleGetDeviceRequirements = async (args: unknown): Promise<McpResult> => {
  const timer = Logger.startTimer('DeviceTools', 'getDeviceRequirements');
  
  try {
    const { deviceType, includeExamples = true, includeValidation = false, request } = args as {
      deviceType?: string;
      includeExamples?: boolean;
      includeValidation?: boolean;
      request?: any;
    };

    Logger.logWithContext('info', 'Fetching device creation requirements', 'DeviceTools', {
      deviceType,
      includeExamples,
      includeValidation,
      hasRequest: !!request
    });

    // If a specific device type is requested, return detailed info for that type
    if (deviceType) {
      const typeInfo = getDeviceTypeInfo(deviceType);
      if (!typeInfo) {
        return {
          success: false,
          error: {
            code: 'DEVICE_TYPE_NOT_FOUND',
            message: `Device type '${deviceType}' is not supported. Use the tool without parameters to see all supported types.`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      timer();

      return {
        success: true,
        data: {
          deviceType: typeInfo,
          requirements: {
            requiredFields: ['name', 'credentials', 'address'],
            supportedProtocols: typeInfo.supportedProtocols,
            defaultProtocol: typeInfo.defaultProtocol,
            fieldDescriptions: {
              name: 'Human-readable name for the device (1-200 characters)',
              credentials: 'Device access credentials with username and password',
              address: 'Network address (IP address or hostname)',
              protocol: `Connection protocol (${typeInfo.supportedProtocols.join(', ')})`,
              description: 'Optional device description (max 500 characters)',
              enabled: 'Whether device monitoring and backups are enabled (default: true)'
            }
          }
        },
        message: `Device requirements for ${typeInfo.displayName} (${typeInfo.pluginKey})`,
      };
    }

    // Return comprehensive requirements for all device types
    const requirements = getDeviceCreationRequirements();

    // Build response data
    const responseData: any = {
      summary: {
        requiredFields: requirements.requiredFields,
        supportedDeviceTypes: requirements.supportedDeviceTypes.map(type => ({
          key: type.pluginKey,
          name: type.displayName,
          category: type.category,
          protocols: type.supportedProtocols
        })),
        supportedProtocols: requirements.supportedProtocols
      },
      fieldDescriptions: requirements.fieldDescriptions
    };

    // Include examples if requested
    if (includeExamples) {
      responseData.examples = requirements.examples;
    }

    // Include categorized device types
    responseData.deviceTypesByCategory = getSupportedDeviceTypes();

    // Validate a request if provided
    if (includeValidation && request) {
      const validation = validateDeviceRequest(request);
      responseData.validation = validation;
    }

    timer();

    Logger.logWithContext('info', 'Device requirements retrieved successfully', 'DeviceTools', {
      deviceTypeCount: requirements.supportedDeviceTypes.length,
      protocolCount: requirements.supportedProtocols.length
    });

    return {
      success: true,
      data: responseData,
      message: 'Device creation requirements retrieved successfully',
    };

  } catch (error) {
    timer();
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    Logger.logWithContext('error', 'Failed to retrieve device requirements', 'DeviceTools', {
      error: errorMessage,
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
    });

    return {
      success: false,
      error: {
        code: 'REQUIREMENTS_FETCH_FAILED',
        message: `Failed to retrieve device requirements: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      },
    };
  }
};

/**
 * Handle validate_device_request tool request
 */
export const handleValidateDeviceRequest = async (args: unknown): Promise<McpResult> => {
  const timer = Logger.startTimer('DeviceTools', 'validateDeviceRequest');
  
  try {
    const { request } = args as { request: any };

    if (!request) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_MISSING_REQUEST',
          message: 'Request object is required for validation',
          timestamp: new Date().toISOString(),
        },
      };
    }

    Logger.logWithContext('info', 'Validating device creation request', 'DeviceTools', {
      hasName: !!request.name,
      hasType: !!request.type,
      hasCredentials: !!request.credentials,
      hasAddress: !!(request.ipAddress || request.hostname)
    });

    const validation = validateDeviceRequest(request);

    // If validation passes and device type is specified, add type-specific info
    let deviceTypeInfo = null;
    if (validation.isValid && request.type) {
      deviceTypeInfo = getDeviceTypeInfo(request.type);
    }

    timer();

    const resultMessage = validation.isValid 
      ? 'Device creation request is valid'
      : `Device creation request has ${validation.errors.length} validation error(s)`;

    return {
      success: true,
      data: {
        isValid: validation.isValid,
        errors: validation.errors,
        deviceTypeInfo: deviceTypeInfo,
        recommendation: validation.isValid 
          ? 'You can proceed with creating this device using the create_device tool'
          : 'Please fix the validation errors before creating the device'
      },
      message: resultMessage,
    };

  } catch (error) {
    timer();
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    Logger.logWithContext('error', 'Failed to validate device request', 'DeviceTools', {
      error: errorMessage,
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
    });

    return {
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: `Failed to validate device request: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      },
    };
  }
};