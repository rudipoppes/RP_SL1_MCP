/**
 * Utility Helper Functions
 * Common utility functions for the MCP server
 */

/**
 * Generate unique ID with prefix
 */
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomUUID()}`;
}

/**
 * Sanitize string for safe logging
 */
export function sanitizeString(str: string): string {
  return str.replace(/[\r\n\t]/g, ' ').trim();
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Simple delay function
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}