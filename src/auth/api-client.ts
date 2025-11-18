import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import type { AppConfig } from '../config/types.js';
import { HTTP_STATUS_CODES, RESTOREPOINT_ENDPOINTS } from '../constants/endpoints.js';
import { ERROR_CODES, RestorepointError } from '../constants/error-codes.js';
import { tokenManager } from './token-manager.js';
import { errorHandler } from '../utils/error-handler.js';
import { Logger } from '../utils/logger.js';

/**
 * API response wrapper
 */
export interface ApiResponse<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly message?: string;
  readonly errors?: Record<string, readonly string[]>;
  readonly metadata?: {
    readonly offset?: number;
    readonly limit?: number;
    readonly total?: number;
  };
}

/**
 * Request options
 */
export interface RequestOptions extends Omit<AxiosRequestConfig, 'headers' | 'baseURL'> {
  readonly skipAuth?: boolean;
  readonly skipRetry?: boolean;
  readonly maxRetries?: number;
}

interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  skipAuth?: boolean;
  _retry?: boolean;
}

/**
 * HTTP client for Restorepoint API
 * Provides authenticated requests with error handling and retry logic
 */
export class ApiClient {
  private static instance: ApiClient;
  private readonly axiosInstance: AxiosInstance;
  private readonly config: AppConfig;
  private readonly defaultMaxRetries = 3;

  private constructor(config: AppConfig) {
    this.config = config;
    
    this.axiosInstance = axios.create({
      baseURL: `${config.restorepoint.serverUrl}/api/${config.restorepoint.apiVersion}`,
      timeout: config.restorepoint.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': `${config.mcp.serverName}/${config.mcp.version}`,
      },
    });

    this.setupInterceptors();
    this.setupTokenEvents();
  }

  private async setupHttpsAgent() {
    // Allow self-signed certificates for development/testing
    if (process.env.NODE_ENV !== 'production') {
      const https = await import('https');
      this.axiosInstance.defaults.httpsAgent = new https.Agent({
        rejectUnauthorized: false,
      });
    }
  }

  /**
   * Create API client instance
   */
  public static async create(config: AppConfig): Promise<ApiClient> {
    if (ApiClient.instance) {
      throw new Error('ApiClient instance already exists. Use getInstance() instead.');
    }
    ApiClient.instance = new ApiClient(config);
    await ApiClient.instance.setupHttpsAgent();
    return ApiClient.instance;
  }

  /**
   * Get existing API client instance
   */
  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      throw new Error('ApiClient instance not initialized. Call create() first.');
    }
    return ApiClient.instance;
  }

  /**
   * Setup request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor for authentication
    this.axiosInstance.interceptors.request.use(
      async (config: ExtendedAxiosRequestConfig) => {
        const timer = Logger.startTimer('ApiClient', 'HTTP Request');
        
        try {
          // Add authentication token if available
          if (!config.skipAuth) {
            const token = await tokenManager.ensureValidToken();
            (config.headers as any)['Authorization'] = `Custom ${token}`;
          }

          Logger.logWithContext('debug', `Making ${config.method?.toUpperCase()} request to ${config.url}`, 'ApiClient', {
            url: config.url,
            method: config.method,
            hasAuth: !!config.headers.Authorization,
          });

          return config;
        } finally {
          timer();
        }
      },
      (error) => {
        Logger.logWithContext('error', 'Request interceptor error', 'ApiClient', {
          error: error.message,
        });
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => {
        Logger.logWithContext('debug', `Received response from ${response.config.url}`, 'ApiClient', {
          status: response.status,
          duration: response.headers['x-response-time'],
        });

        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        Logger.logWithContext('warn', `API request failed: ${originalRequest?.method?.toUpperCase()} ${originalRequest?.url}`, 'ApiClient', {
          status: error.response?.status,
          message: error.message,
        });

        // Handle 401 Unauthorized - try to refresh token
        if (error.response?.status === HTTP_STATUS_CODES.UNAUTHORIZED && 
            !originalRequest._retry && 
            !originalRequest.skipAuth) {
          
          originalRequest._retry = true;

          try {
            await tokenManager.refreshToken();
            const token = tokenManager.getToken();
            
            if (token) {
              originalRequest.headers.Authorization = `Custom ${token}`;
              return this.axiosInstance(originalRequest);
            }
          } catch (refreshError) {
            Logger.logWithContext('error', 'Token refresh failed during retry', 'ApiClient', {
              refreshError: refreshError instanceof Error ? refreshError.message : 'Unknown error',
            });
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Setup token lifecycle events
   */
  private setupTokenEvents(): void {
    tokenManager.setEvents({
      onTokenRefresh: (newToken) => {
        Logger.logWithContext('info', 'Token refreshed in API client', 'ApiClient');
      },
      onTokenExpired: () => {
        Logger.logWithContext('warn', 'Token expired in API client', 'ApiClient');
      },
      onTokenRefreshFailed: (error) => {
        Logger.logWithContext('error', 'Token refresh failed in API client', 'ApiClient', {
          error: error.message,
        });
      },
    });
  }

  /**
   * Make HTTP request with retry logic
   */
  private async makeRequest<T>(
    config: AxiosRequestConfig,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      skipRetry = false,
      maxRetries = this.defaultMaxRetries,
      ...axiosConfig
    } = options;

    const fullConfig: any = {
      ...axiosConfig,
      ...config,
      skipAuth: options.skipAuth,
      _retry: false, // Flag for retry logic
    };

    try {
      if (skipRetry) {
        const response = await this.axiosInstance.request(fullConfig);
        return this.transformResponse(response);
      }

      return await errorHandler.retryWithBackoff(
        () => this.axiosInstance.request(fullConfig).then(response => this.transformResponse(response)),
        maxRetries,
        this.config.restorepoint.retryDelay,
        'ApiClient'
      );
    } catch (error) {
      if (error instanceof RestorepointError) {
        throw error;
      }
      
      // Convert axios error to RestorepointError
      if (axios.isAxiosError(error)) {
        throw RestorepointError.fromHttpResponse(
          error.response?.status || HTTP_STATUS_CODES.NETWORK_CONNECTION_FAILED,
          error.response?.data
        );
      }

      throw new RestorepointError(
        ERROR_CODES.NETWORK_CONNECTION_FAILED,
        error instanceof Error ? error.message : 'Unknown network error'
      );
    }
  }

  /**
   * Transform axios response to ApiResponse format
   */
  private transformResponse<T>(response: AxiosResponse): ApiResponse<T> {
    const data = response.data;

    // Handle Restorepoint API response format
    if (data && typeof data === 'object') {
      const apiResponse: any = {
        success: response.status >= 200 && response.status < 300,
      };

      // Handle paginated responses
      if ('offset' in data || 'limit' in data || 'total' in data) {
        const responseData = data as any;
        apiResponse.metadata = {
          offset: responseData.offset,
          limit: responseData.limit,
          total: responseData.total,
        };
        apiResponse.data = responseData.data || data;
      }
      // Handle error responses
      else if ('message' in data || 'errors' in data) {
        const responseData = data as any;
        apiResponse.message = responseData.message;
        apiResponse.errors = responseData.errors;
        apiResponse.success = false;
      }
      // Handle success responses
      else {
        apiResponse.data = data;
      }

      return apiResponse as ApiResponse<T>;
    }

    return {
      success: true,
      data: data as T,
    };
  }

  /**
   * GET request
   */
  public async get<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>({ method: 'GET', url: endpoint }, options);
  }

  /**
   * POST request
   */
  public async post<T>(endpoint: string, data?: unknown, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>({ 
      method: 'POST', 
      url: endpoint, 
      data 
    }, options);
  }

  /**
   * PUT request
   */
  public async put<T>(endpoint: string, data?: unknown, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>({ 
      method: 'PUT', 
      url: endpoint, 
      data 
    }, options);
  }

  /**
   * PATCH request
   */
  public async patch<T>(endpoint: string, data?: unknown, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>({ 
      method: 'PATCH', 
      url: endpoint, 
      data 
    }, options);
  }

  /**
   * DELETE request
   */
  public async delete<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>({ method: 'DELETE', url: endpoint }, options);
  }

  /**
   * Test connection to Restorepoint server
   */
  public async testConnection(): Promise<boolean> {
    try {
      // Try to access a basic endpoint to test connectivity
      await this.get('/system/status', { skipAuth: true, maxRetries: 1 });
      return true;
    } catch (error) {
      Logger.logWithContext('error', 'Connection test failed', 'ApiClient', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get API configuration
   */
  public getConfig(): Readonly<AppConfig> {
    return this.config;
  }

  /**
   * Initialize token with configuration
   */
  public initializeToken(): void {
    const token = this.config.restorepoint.token;
    if (token) {
      // Set initial token with default expiry
      tokenManager.setToken(token, 24 * 60 * 60); // 24 hours
    }
  }
}

/**
 * Export convenience functions using singleton
 */
export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) => ApiClient.getInstance().get<T>(endpoint, options),
  post: <T>(endpoint: string, data?: unknown, options?: RequestOptions) => ApiClient.getInstance().post<T>(endpoint, data, options),
  put: <T>(endpoint: string, data?: unknown, options?: RequestOptions) => ApiClient.getInstance().put<T>(endpoint, data, options),
  patch: <T>(endpoint: string, data?: unknown, options?: RequestOptions) => ApiClient.getInstance().patch<T>(endpoint, data, options),
  delete: <T>(endpoint: string, options?: RequestOptions) => ApiClient.getInstance().delete<T>(endpoint, options),
  testConnection: () => ApiClient.getInstance().testConnection(),
  getConfig: () => ApiClient.getInstance().getConfig(),
  initializeToken: () => ApiClient.getInstance().initializeToken(),
};