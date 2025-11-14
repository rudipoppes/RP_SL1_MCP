/**
 * Unit Tests for Validators
 */

import { InputValidator, CommonSchemas, DeviceSchemas } from '../../src/utils/validators';
import { RestorepointError } from '../../src/constants/error-codes';

describe('InputValidator', () => {
  describe('validate', () => {
    it('should validate correct data successfully', () => {
      const schema = CommonSchemas.deviceId;
      const result = InputValidator.validate(schema, 'valid-device-id');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toBe('valid-device-id');
    });

    it('should return errors for invalid data', () => {
      const schema = CommonSchemas.deviceId;
      const result = InputValidator.validate(schema, '');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.data).toBeUndefined();
    });

    it('should handle complex object validation', () => {
      const validDevice = {
        name: 'Test Device',
        type: 'cisco-ios',
        credentials: {
          username: 'admin',
          password: 'password123'
        }
      };
      
      const result = InputValidator.validate(DeviceSchemas.createDevice, validDevice);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateOrThrow', () => {
    it('should return data for valid input', () => {
      const schema = CommonSchemas.limit;
      const result = InputValidator.validateOrThrow(schema, 50);
      
      expect(result).toBe(50);
    });

    it('should throw error for invalid input', () => {
      const schema = CommonSchemas.limit;
      
      expect(() => {
        InputValidator.validateOrThrow(schema, 2000); // Exceeds max of 1000
      }).toThrow(RestorepointError);
    });
  });

  describe('validateRequiredFields', () => {
    it('should pass when all required fields are present', () => {
      const data = { name: 'Test', type: 'router' };
      const result = InputValidator.validateRequiredFields(data, ['name', 'type']);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when required fields are missing', () => {
      const data = { name: 'Test' };
      const result = InputValidator.validateRequiredFields(data, ['name', 'type']);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('type: Required field is missing or empty');
    });
  });

  describe('validateIpAddress', () => {
    it('should validate correct IP addresses', () => {
      expect(InputValidator.validateIpAddress('192.168.1.1')).toBe(true);
      expect(InputValidator.validateIpAddress('10.0.0.1')).toBe(true);
      expect(InputValidator.validateIpAddress('172.16.0.1')).toBe(true);
    });

    it('should reject invalid IP addresses', () => {
      expect(InputValidator.validateIpAddress('256.168.1.1')).toBe(false);
      expect(InputValidator.validateIpAddress('192.168.1')).toBe(false);
      expect(InputValidator.validateIpAddress('invalid.ip')).toBe(false);
    });
  });

  describe('validateHostname', () => {
    it('should validate correct hostnames', () => {
      expect(InputValidator.validateHostname('router-1.example.com')).toBe(true);
      expect(InputValidator.validateHostname('server01')).toBe(true);
    });

    it('should reject invalid hostnames', () => {
      expect(InputValidator.validateHostname('')).toBe(false);
      expect(InputValidator.validateHostname('a'.repeat(254))).toBe(false); // Too long
    });
  });
});