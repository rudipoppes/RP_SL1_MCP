/**
 * Authentication token interface
 */
export interface AuthToken {
  readonly token: string;
  readonly expiresAt: Date;
  readonly refreshToken?: string;
  readonly scopes?: readonly string[];
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  readonly isValid: boolean;
  readonly token?: AuthToken;
  readonly error?: string;
  readonly expiresSoon?: boolean;
}

/**
 * Token lifecycle events
 */
export interface TokenEvents {
  onTokenRefresh?: (newToken: AuthToken) => void;
  onTokenExpired?: () => void;
  onTokenRefreshFailed?: (error: Error) => void;
}