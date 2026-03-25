export interface UserProfile {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  profilePicture?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFactorEnabled: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'inactive' | 'locked' | 'suspended';
  roles: string[];
  preferences?: UserPreferences;
}

export interface UserPreferences {
  language: string;
  timezone: string;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'private' | 'friends';
    allowDataSharing: boolean;
    marketingOptIn: boolean;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
  deviceId?: string;
  rememberMe?: boolean;
  twoFactorCode?: string;
}

export interface RegistrationData {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  acceptTerms: boolean;
  marketingOptIn?: boolean;
}

export interface AuthResponse {
  success: boolean;
  data?: any;
  error?: string | string[];
  status: number;
}

export interface UserSession {
  id: string;
  deviceId: string;
  deviceName: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface UserActivity {
  id: string;
  action: string;
  metadata?: any;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

export interface PasswordValidation {
  isValid: boolean;
  score: number;
  feedback: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface UserStatistics {
  totalLogins: number;
  lastLogin: string;
  accountAge: number; // days since registration
  sessionsCount: number;
  activitiesCount: number;
  profileCompleteness: number; // percentage
  securityScore: number; // 0-100 based on security settings
}

export interface SecuritySettings {
  currentPassword: string;
  newPassword?: string;
  enableTwoFactor?: boolean;
  trustedDevices?: string[];
}

export interface UserSearchParams {
  query?: string;
  status?: 'active' | 'inactive' | 'locked';
  orderBy?: 'created_at' | 'last_login' | 'username';
  orderDirection?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export interface SearchResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

//SQL-like query interfaces for advanced features
export interface QueryFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'between';
  value: any;
}

export interface QuerySort {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface AdvancedQuery {
  filters?: QueryFilter[];
  sort?: QuerySort[];
  limit?: number;
  offset?: number;
  include?: string[]; //related data to include
}

//API response types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
    timestamp: string;
  };
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface EmailVerificationRequest {
  email: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmation {
  token: string;
  newPassword: string;
}

export interface TwoFactorSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface TwoFactorVerification {
  code: string;
  rememberDevice?: boolean;
}

//event types for activity logging
export type ActivityType =
  | 'login'
  | 'logout'
  | 'register'
  | 'password_change'
  | 'password_reset'
  | 'email_verification'
  | 'profile_update'
  | 'two_factor_enable'
  | 'two_factor_disable'
  | 'session_revoke'
  | 'data_export'
  | 'data_deletion'
  | 'security_alert';

export interface ActivityEvent {
  type: ActivityType;
  metadata?: Record<string, any>;
  timestamp?: string;
}

//error types
export interface AuthError {
  code: string;
  message: string;
  details?: any;
}
export class AuthenticationError extends Error {
  public code: string;
  public details?: any;

  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'AuthenticationError';
    this.code = code;
    this.details = details;
  }
}
export class ValidationError extends Error {
  public errors: string[];

  constructor(errors: string[]) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

//configuration interfaces
export interface AuthConfig {
  baseURL: string;
  timeout: number;
  retryAttempts: number;
  tokenStorage: {
    accessTokenKey: string;
    refreshTokenKey: string;
    userProfileKey: string;
  };
  security: {
    enforceHttps: boolean;
    validateCertificates: boolean;
    enableDeviceFingerprinting: boolean;
  };
}

export interface DeviceInfo {
  id: string;
  name: string;
  platform: string;
  version: string;
  model: string;
}