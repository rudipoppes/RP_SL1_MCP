/**
 * Device Requirements Utilities
 * Provides accurate device creation requirements and validation utilities
 */

import { Logger } from '../../utils/logger.js';

/**
 * Device type information with supported protocols and required fields
 */
export interface DeviceTypeInfo {
  readonly pluginKey: string;
  readonly displayName: string;
  readonly category: string;
  readonly supportedProtocols: readonly string[];
  readonly defaultProtocol: string;
  readonly requiredFields: readonly string[];
  readonly optionalFields: readonly string[];
  readonly description: string;
}

/**
 * Complete device creation requirements response
 */
export interface DeviceCreationRequirements {
  readonly requiredFields: readonly string[];
  readonly supportedDeviceTypes: readonly DeviceTypeInfo[];
  readonly supportedProtocols: readonly string[];
  readonly examples: {
    readonly cisco_ios: any;
    readonly palo_alto: any;
    readonly linux: any;
    readonly windows: any;
  };
  readonly fieldDescriptions: Record<string, string>;
}

/**
 * Comprehensive device type mapping with accurate information
 */
export const DEVICE_TYPES: Record<string, DeviceTypeInfo> = {
  'cisco-ios': {
    pluginKey: 'cisco_ios',
    displayName: 'Cisco IOS',
    category: 'Network Switch/Router',
    supportedProtocols: ['SSH', 'Telnet'],
    defaultProtocol: 'SSH',
    requiredFields: ['name', 'credentials', 'address'],
    optionalFields: ['description', 'enabled', 'monitor'],
    description: 'Cisco IOS switches and routers running IOS software'
  },
  'cisco-nxos': {
    pluginKey: 'cisco_nxos',
    displayName: 'Cisco Nexus NX-OS',
    category: 'Network Switch',
    supportedProtocols: ['SSH', 'Telnet'],
    defaultProtocol: 'SSH',
    requiredFields: ['name', 'credentials', 'address'],
    optionalFields: ['description', 'enabled', 'monitor'],
    description: 'Cisco Nexus data center switches running NX-OS'
  },
  'palo-alto': {
    pluginKey: 'palo_alto',
    displayName: 'Palo Alto Networks',
    category: 'Firewall',
    supportedProtocols: ['HTTPS'],
    defaultProtocol: 'HTTPS',
    requiredFields: ['name', 'credentials', 'address'],
    optionalFields: ['description', 'enabled', 'monitor', 'backup_port'],
    description: 'Palo Alto Networks next-generation firewalls'
  },
  'fortinet': {
    pluginKey: 'fortinet_fortigate',
    displayName: 'Fortinet FortiGate',
    category: 'Firewall',
    supportedProtocols: ['HTTPS', 'SSH'],
    defaultProtocol: 'HTTPS',
    requiredFields: ['name', 'credentials', 'address'],
    optionalFields: ['description', 'enabled', 'monitor', 'backup_port'],
    description: 'Fortinet FortiGate firewall appliances'
  },
  'linux': {
    pluginKey: 'linux',
    displayName: 'Linux Server',
    category: 'Server',
    supportedProtocols: ['SSH'],
    defaultProtocol: 'SSH',
    requiredFields: ['name', 'credentials', 'address'],
    optionalFields: ['description', 'enabled', 'monitor'],
    description: 'Linux servers and workstations'
  },
  'windows': {
    pluginKey: 'windows',
    displayName: 'Windows Server',
    category: 'Server',
    supportedProtocols: ['WinRM', 'HTTPS'],
    defaultProtocol: 'WinRM',
    requiredFields: ['name', 'credentials', 'address'],
    optionalFields: ['description', 'enabled', 'monitor', 'winrm_port'],
    description: 'Windows servers with WinRM enabled'
  },
  'juniper': {
    pluginKey: 'juniper_junos',
    displayName: 'Juniper Junos',
    category: 'Network Switch/Router',
    supportedProtocols: ['SSH', 'Telnet'],
    defaultProtocol: 'SSH',
    requiredFields: ['name', 'credentials', 'address'],
    optionalFields: ['description', 'enabled', 'monitor'],
    description: 'Juniper network devices running Junos OS'
  },
  'arista': {
    pluginKey: 'arista_eos',
    displayName: 'Arista EOS',
    category: 'Network Switch',
    supportedProtocols: ['SSH', 'Telnet'],
    defaultProtocol: 'SSH',
    requiredFields: ['name', 'credentials', 'address'],
    optionalFields: ['description', 'enabled', 'monitor'],
    description: 'Arista network switches running EOS'
  }
};

/**
 * Get device creation requirements with comprehensive information
 */
export function getDeviceCreationRequirements(): DeviceCreationRequirements {
  Logger.logWithContext('info', 'Generating device creation requirements', 'DeviceRequirements', {});

  const deviceTypes = Object.values(DEVICE_TYPES);
  const allProtocols = [...new Set(deviceTypes.flatMap(type => type.supportedProtocols))].sort();

  return {
    requiredFields: ['name', 'type', 'credentials', 'address'],
    supportedDeviceTypes: deviceTypes,
    supportedProtocols: allProtocols,
    examples: {
      cisco_ios: {
        name: 'Core-Switch-01',
        type: 'cisco-ios',
        ipAddress: '192.168.1.10',
        credentials: {
          username: 'admin',
          password: 'password123'
        },
        description: 'Core Cisco 2960 switch'
      },
      palo_alto: {
        name: 'PA-FW-01',
        type: 'palo-alto',
        ipAddress: '192.168.1.1',
        credentials: {
          username: 'admin',
          password: 'password123'
        },
        description: 'Main Palo Alto firewall'
      },
      linux: {
        name: 'web-server-01',
        type: 'linux',
        ipAddress: '192.168.1.50',
        credentials: {
          username: 'root',
          password: 'password123'
        },
        description: 'Apache web server'
      },
      windows: {
        name: 'AD-DC-01',
        type: 'windows',
        ipAddress: '192.168.1.100',
        credentials: {
          username: 'Administrator',
          password: 'password123'
        },
        description: 'Active Directory domain controller'
      }
    },
    fieldDescriptions: {
      name: 'Human-readable name for the device (1-200 characters)',
      type: 'Device type identifier (e.g., cisco-ios, palo-alto, linux, windows)',
      credentials: 'Device access credentials with username and password',
      address: 'Network address (IP address or hostname)',
      ipAddress: 'Specific IP address (alternative to hostname)',
      hostname: 'DNS hostname (alternative to IP address)',
      description: 'Optional device description (max 500 characters)',
      enabled: 'Whether device monitoring and backups are enabled',
      protocol: 'Connection protocol (SSH, HTTPS, WinRM, Telnet)',
      monitor: 'Device monitoring configuration'
    }
  };
}

/**
 * Get detailed information about a specific device type
 */
export function getDeviceTypeInfo(deviceType: string): DeviceTypeInfo | null {
  const typeInfo = DEVICE_TYPES[deviceType.toLowerCase()];
  if (!typeInfo) {
    Logger.logWithContext('warn', 'Unknown device type requested', 'DeviceRequirements', { deviceType });
    return null;
  }

  Logger.logWithContext('info', 'Retrieved device type information', 'DeviceRequirements', { 
    deviceType, 
    pluginKey: typeInfo.pluginKey 
  });

  return typeInfo;
}

/**
 * Validate device creation request against requirements
 */
export function validateDeviceRequest(request: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const requirements = getDeviceCreationRequirements();

  Logger.logWithContext('info', 'Validating device creation request', 'DeviceRequirements', { 
    hasName: !!request.name,
    hasType: !!request.type,
    hasCredentials: !!request.credentials,
    hasAddress: !!(request.ipAddress || request.hostname || request.address)
  });

  // Check required fields
  if (!request.name || request.name.trim().length === 0) {
    errors.push('Device name is required');
  }

  if (!request.type || request.type.trim().length === 0) {
    errors.push('Device type is required');
  } else if (!getDeviceTypeInfo(request.type)) {
    errors.push(`Unknown device type: ${request.type}. Supported types: ${Object.keys(DEVICE_TYPES).join(', ')}`);
  }

  if (!request.credentials) {
    errors.push('Device credentials are required');
  } else {
    if (!request.credentials.username) {
      errors.push('Username is required in credentials');
    }
    if (!request.credentials.password) {
      errors.push('Password is required in credentials');
    }
  }

  if (!request.ipAddress && !request.hostname && !request.address) {
    errors.push('Device address (IP address or hostname) is required');
  }

  // Validate name length
  if (request.name && (request.name.length < 1 || request.name.length > 200)) {
    errors.push('Device name must be between 1 and 200 characters');
  }

  // Validate description length
  if (request.description && request.description.length > 500) {
    errors.push('Description must be 500 characters or less');
  }

  // Validate IP address format if provided
  if (request.ipAddress && !isValidIpAddress(request.ipAddress)) {
    errors.push('Invalid IP address format');
  }

  // Validate hostname length if provided
  if (request.hostname && request.hostname.length > 253) {
    errors.push('Hostname must be 253 characters or less');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get list of all supported device types organized by category
 */
export function getSupportedDeviceTypes(): Record<string, DeviceTypeInfo[]> {
  const requirements = getDeviceCreationRequirements();
  const categorized: Record<string, DeviceTypeInfo[]> = {};

  for (const deviceType of requirements.supportedDeviceTypes) {
    if (!categorized[deviceType.category]) {
      categorized[deviceType.category] = [];
    }
    categorized[deviceType.category].push(deviceType);
  }

  return categorized;
}

/**
 * Validate IP address format
 */
function isValidIpAddress(ip: string): boolean {
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip);
}