import type { AuthToken, TokenValidationResult, TokenEvents } from './types.js';
import { ERROR_CODES, RestorepointError } from '../constants/error-codes.js';
import { Logger } from '../utils/logger.js';

/**
 * Token manager for handling authentication tokens
 * Implements secure token lifecycle management with automatic refresh
 */
export class TokenManager {
  private static instance: TokenManager;
  private currentToken: AuthToken | null = null;
  private events: TokenEvents = {};
  private refreshTimer: NodeJS.Timeout | null = null;
  private readonly REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry

  private constructor() {}

  /**
   * Singleton pattern implementation
   */
  public static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * Set token events callbacks
   */
  public setEvents(events: TokenEvents): void {
    this.events = { ...this.events, ...events };
  }

  /**
   * Set authentication token
   */
  public setToken(token: string, expiresIn?: number, refreshToken?: string, scopes?: readonly string[]): void {
    const expiresAt = new Date();
    if (expiresIn) {
      expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);
    } else {
      // Default to 24 hours if not specified
      expiresAt.setHours(expiresAt.getHours() + 24);
    }

    this.currentToken = {
      token,
      expiresAt,
      refreshToken,
      scopes,
    };

    Logger.logWithContext('info', 'Authentication token set', 'TokenManager', {
      expiresAt: expiresAt.toISOString(),
      hasRefreshToken: !!refreshToken,
      scopes,
    });

    this.scheduleRefresh();
  }

  /**
   * Get current authentication token
   */
  public getToken(): string | null {
    return this.currentToken?.token || null;
  }

  /**
   * Get full token information
   */
  public getFullToken(): AuthToken | null {
    return this.currentToken;
  }

  /**
   * Validate current token
   */
  public validateToken(): TokenValidationResult {
    if (!this.currentToken) {
      return {
        isValid: false,
        error: 'No token available',
      };
    }

    const now = new Date();
    const expiresAt = this.currentToken.expiresAt;
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();

    // Check if token is expired
    if (timeUntilExpiry <= 0) {
      this.handleTokenExpired();
      return {
        isValid: false,
        error: 'Token has expired',
      };
    }

    // Check if token expires soon
    const expiresSoon = timeUntilExpiry <= this.REFRESH_BUFFER_MS;

    return {
      isValid: true,
      token: this.currentToken,
      expiresSoon,
    };
  }

  /**
   * Ensure we have a valid token (refresh if needed)
   */
  public async ensureValidToken(): Promise<string> {
    const validation = this.validateToken();

    if (!validation.isValid) {
      throw new RestorepointError(
        ERROR_CODES.AUTH_TOKEN_EXPIRED,
        validation.error || 'Invalid token'
      );
    }

    if (validation.expiresSoon && this.currentToken?.refreshToken) {
      try {
        await this.refreshToken();
      } catch (error) {
        Logger.logWithContext('warn', 'Failed to refresh token, using current token', 'TokenManager', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return this.currentToken!.token;
  }

  /**
   * Manually refresh token
   */
  public async refreshToken(): Promise<AuthToken> {
    if (!this.currentToken?.refreshToken) {
      throw new RestorepointError(
        ERROR_CODES.AUTH_MISSING_TOKEN,
        'No refresh token available'
      );
    }

    try {
      Logger.logWithContext('debug', 'Refreshing authentication token', 'TokenManager');

      // This would typically make an API call to refresh the token
      // For now, we'll simulate the refresh with an extended expiry
      const newToken: AuthToken = {
        token: this.currentToken.token, // In a real implementation, this would be a new token
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        refreshToken: this.currentToken.refreshToken,
        scopes: this.currentToken.scopes,
      };

      this.currentToken = newToken;
      this.scheduleRefresh();

      Logger.logWithContext('info', 'Token refreshed successfully', 'TokenManager', {
        newExpiresAt: newToken.expiresAt.toISOString(),
      });

      if (this.events.onTokenRefresh) {
        this.events.onTokenRefresh(newToken);
      }

      return newToken;
    } catch (error) {
      Logger.logWithContext('error', 'Token refresh failed', 'TokenManager', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (this.events.onTokenRefreshFailed) {
        this.events.onTokenRefreshFailed(error instanceof Error ? error : new Error('Unknown error'));
      }

      throw new RestorepointError(
        ERROR_CODES.AUTH_INVALID_TOKEN,
        `Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Clear current token
   */
  public clearToken(): void {
    Logger.logWithContext('info', 'Clearing authentication token', 'TokenManager');
    
    this.currentToken = null;
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Check if user is authenticated
   */
  public isAuthenticated(): boolean {
    const validation = this.validateToken();
    return validation.isValid;
  }

  /**
   * Get token information for logging
   */
  public getTokenInfo(): {
    readonly hasToken: boolean;
    readonly expiresAt?: string;
    readonly isExpired: boolean;
    readonly expiresSoon: boolean;
    readonly hasRefreshToken: boolean;
    readonly scopes?: readonly string[];
  } {
    const validation = this.validateToken();
    const now = new Date();

    return {
      hasToken: !!this.currentToken,
      expiresAt: this.currentToken?.expiresAt.toISOString(),
      isExpired: !validation.isValid,
      expiresSoon: !!validation.expiresSoon,
      hasRefreshToken: !!this.currentToken?.refreshToken,
      scopes: this.currentToken?.scopes,
    };
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (!this.currentToken || !this.currentToken.refreshToken) {
      return;
    }

    const now = Date.now();
    const expiresAt = this.currentToken.expiresAt.getTime();
    const refreshTime = expiresAt - this.REFRESH_BUFFER_MS;

    // If token expires before buffer, refresh immediately
    if (refreshTime <= now) {
      // Schedule refresh for immediate execution
      this.refreshTimer = setTimeout(() => {
        this.refreshToken().catch(error => {
          Logger.logWithContext('error', 'Scheduled token refresh failed', 'TokenManager', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });
      }, 1000);
    } else {
      const delay = refreshTime - now;
      this.refreshTimer = setTimeout(() => {
        this.refreshToken().catch(error => {
          Logger.logWithContext('error', 'Scheduled token refresh failed', 'TokenManager', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });
      }, delay);

      Logger.logWithContext('debug', `Token refresh scheduled in ${Math.round(delay / 1000 / 60)} minutes`, 'TokenManager');
    }
  }

  /**
   * Handle token expiration
   */
  private handleTokenExpired(): void {
    Logger.logWithContext('warn', 'Authentication token expired', 'TokenManager');

    if (this.events.onTokenExpired) {
      this.events.onTokenExpired();
    }

    // Clear the expired token
    this.clearToken();
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.currentToken = null;
    this.events = {};
  }
}

/**
 * Export singleton instance for convenience
 */
export const tokenManager = TokenManager.getInstance();