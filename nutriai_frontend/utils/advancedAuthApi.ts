import type {
    ActivityEvent,
    AuthResponse,
    LoginCredentials,
    PasswordValidation,
    RegistrationData,
    SearchResult,
    SecuritySettings,
    UserProfile,
    UserSearchParams,
    UserSession,
    UserStatistics,
    ValidationResult
} from '@/types/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthService } from './authService';
import { NetworkAutoConfig } from './networkAutoConfig';

//advanced authentication API with SQL-based patterns
export class AdvancedAuthAPI {
  private baseURL: string;
  private tokenKey = '@auth_token';
  private refreshTokenKey = '@refresh_token';
  private userProfileKey = '@user_profile';

  constructor(baseURL: string = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001') {
    this.baseURL = baseURL;
  }

  //get the current API URL, preferring NetworkAutoConfig's discovered URL
  private async getBaseURL(): Promise<string> {
    try {
      const config = await NetworkAutoConfig.getNetworkConfig();
      if (config.apiUrl) {
        this.baseURL = config.apiUrl;
      }
    } catch (error) {
      //fall back to stored baseURL
    }
    return this.baseURL;
  }
  async searchUsers(params: UserSearchParams): Promise<SearchResult<UserProfile>> {
    const queryParams = new URLSearchParams();    //user management with SQL-like filtering and pagination
    
    if (params.query) queryParams.append('q', params.query);
    if (params.status) queryParams.append('status', params.status);
    if (params.orderBy) queryParams.append('order_by', params.orderBy);
    if (params.orderDirection) queryParams.append('order_direction', params.orderDirection);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.offset) queryParams.append('offset', params.offset.toString());

    const response = await this.makeAuthenticatedRequest(
      `${this.baseURL}/admin/users?${queryParams.toString()}`
    );
    return response.json();
  }

  //user statistics and analytics
  async getUserStatistics(userId?: string): Promise<UserStatistics> {
    const endpoint = userId 
      ? `${this.baseURL}/users/${userId}/stats`
      : `${this.baseURL}/users/me/stats`;
    
    const response = await this.makeAuthenticatedRequest(endpoint);
    return response.json();
  }

  //login with advanced security features
  async loginWithSecurity(credentials: LoginCredentials): Promise<AuthResponse> {
    const baseUrl = await this.getBaseURL();
    console.log('[AdvancedAuth] Login attempt to:', `${baseUrl}/auth/login`);
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: credentials.email.toLowerCase().trim(),
        password: credentials.password,
        device_id: credentials.deviceId,
        remember_me: credentials.rememberMe || false,
        two_factor_code: credentials.twoFactorCode,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      //store tokens
      if (data.access_token) {
        await AsyncStorage.setItem(this.tokenKey, data.access_token);
      }
      if (data.refresh_token) {
        await AsyncStorage.setItem(this.refreshTokenKey, data.refresh_token);
      }
      if (data.user) {
        await AsyncStorage.setItem(this.userProfileKey, JSON.stringify(data.user));
      }

      //sync with AuthService so all parts of the app can access the token
      if (data.access_token && data.refresh_token) {
        await AuthService.setTokens({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
        });
      }
      if (data.user) {
        await AuthService.setUser(data.user);
      }

      //backend /auth/login returns only tokens (no user object).
      //fetch the actual user profile so the rest of the app has it.
      if (data.access_token && !data.user) {
        try {
          const meResponse = await fetch(`${baseUrl}/auth/me`, {
            headers: { 'Authorization': `Bearer ${data.access_token}` },
          });
          if (meResponse.ok) {
            const meData = await meResponse.json();
            const userProfile = {
              id: String(meData.id),
              username: meData.username,
              email: meData.email,
              firstName: meData.full_name?.split(' ')[0] || meData.username,
              lastName: meData.full_name?.split(' ').slice(1).join(' ') || '',
            };
            await AsyncStorage.setItem(this.userProfileKey, JSON.stringify(userProfile));
            await AuthService.setUser(userProfile as any);
          }
        } catch (e) {
          console.warn('[AdvancedAuth] Failed to fetch user profile after login:', e);
        }
      }

      //log successful login
      try {
        await this.logUserActivity({ type: 'login', metadata: { device_id: credentials.deviceId } });
      } catch {}
    }

    return { success: response.ok, data, status: response.status };
  }

  //enhanced registration with validation
  async registerWithValidation(userData: RegistrationData): Promise<AuthResponse> {
    //client-side validation
    const validation = this.validateRegistrationData(userData);
    if (!validation.isValid) {
      return { success: false, error: validation.errors, status: 400 };
    }

    const response = await fetch(`${await this.getBaseURL()}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: userData.username.toLowerCase().trim(),
        email: userData.email.toLowerCase().trim(),
        password: userData.password,
        first_name: userData.firstName,
        last_name: userData.lastName,
        phone_number: userData.phoneNumber,
        date_of_birth: userData.dateOfBirth,
        accept_terms: userData.acceptTerms,
        marketing_opt_in: userData.marketingOptIn || false,
      }),
    });

    const data = await response.json();
    return { success: response.ok, data, status: response.status };
  }

  //password strength validation
  validatePassword(password: string): PasswordValidation {
    const feedback: string[] = [];
    let score = 0;

    //length check
    if (password.length >= 8) score += 1;
    else feedback.push('Password should be at least 8 characters long');

    if (password.length >= 12) score += 1;

    //character variety
    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Include lowercase letters');

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Include uppercase letters');

    if (/[0-9]/.test(password)) score += 1;
    else feedback.push('Include numbers');

    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    else feedback.push('Include special characters');

    // Common patterns check
    if (!/(.)\1{2,}/.test(password)) score += 1;
    else feedback.push('Avoid repeating characters');

    return {
      isValid: score >= 4,
      score,
      feedback,
    };
  }

  //registration data validation
  private validateRegistrationData(userData: RegistrationData): ValidationResult {
    const errors: string[] = [];

    //required fields
    if (!userData.username) errors.push('Username is required');
    if (!userData.email) errors.push('Email is required');
    if (!userData.password) errors.push('Password is required');
    if (!userData.acceptTerms) errors.push('You must accept the terms and conditions');

    //email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (userData.email && !emailRegex.test(userData.email)) {
      errors.push('Please enter a valid email address');
    }

    //username validation
    if (userData.username && (userData.username.length < 3 || userData.username.length > 30)) {
      errors.push('Username must be between 3 and 30 characters');
    }

    //password validation
    const passwordValidation = this.validatePassword(userData.password);
    if (!passwordValidation.isValid) {
      errors.push(...passwordValidation.feedback);
    }

    //phone number validation (if provided)
    if (userData.phoneNumber) {
      const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
      if (!phoneRegex.test(userData.phoneNumber)) {
        errors.push('Please enter a valid phone number');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  //account management
  async updateAccountSecurity(settings: SecuritySettings): Promise<UserProfile> {
    const response = await this.makeAuthenticatedRequest(
      `${this.baseURL}/users/me/security`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      }
    );

    return response.json();
  }

  //session management
  async getActiveSessions(): Promise<UserSession[]> {
    const response = await this.makeAuthenticatedRequest(
      `${this.baseURL}/users/me/sessions`
    );
    return response.json();
  }

  async revokeSession(sessionId: string): Promise<{ success: boolean }> {
    const response = await this.makeAuthenticatedRequest(
      `${this.baseURL}/users/me/sessions/${sessionId}`,
      { method: 'DELETE' }
    );
    return response.json();
  }

  //activity logging
  async logUserActivity(event: ActivityEvent): Promise<void> {
    try {
      await this.makeAuthenticatedRequest(
        `${this.baseURL}/users/me/activity`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: event.type,
            metadata: event.metadata,
            timestamp: event.timestamp || new Date().toISOString(),
          }),
        }
      );
    } catch (error) {
      console.warn('Failed to log user activity:', error);
    }
  }

  //account recovery
  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseURL}/auth/password-reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: email.toLowerCase().trim() }),
    });

    return response.json();
  }

  async resetPasswordWithToken(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseURL}/auth/password-reset/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        new_password: newPassword,
      }),
    });

    return response.json();
  }

  //account verification
  async resendVerificationEmail(): Promise<{ success: boolean; message: string }> {
    const response = await this.makeAuthenticatedRequest(
      `${this.baseURL}/auth/resend-verification`,
      { method: 'POST' }
    );
    return response.json();
  }

  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseURL}/auth/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    return response.json();
  }

  //token management
  private async makeAuthenticatedRequest(url: string, options: RequestInit = {}) {
    let token = await AsyncStorage.getItem(this.tokenKey);

    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
      },
    });

    //handle token refresh
    if (response.status === 401) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        token = await AsyncStorage.getItem(this.tokenKey);
        return fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
          },
        });
      } else {
        await this.logout();
        throw new Error('Authentication failed');
      }
    }

    return response;
  }

  private async refreshToken(): Promise<boolean> {
    const refreshToken = await AsyncStorage.getItem(this.refreshTokenKey);
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${await this.getBaseURL()}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        await AsyncStorage.setItem(this.tokenKey, data.access_token);
        if (data.refresh_token) {
          await AsyncStorage.setItem(this.refreshTokenKey, data.refresh_token);
        }
        //sync with AuthService so all API layers use the refreshed token
        await AuthService.setTokens({
          accessToken: data.access_token,
          refreshToken: data.refresh_token || refreshToken,
        });
        console.log('[AdvancedAuthAPI] Token refreshed and synced with AuthService');
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }

    return false;
  }
  //logout with cleanup
  async logout(): Promise<void> {
    try {
      await this.logUserActivity({ type: 'logout' });
      await this.makeAuthenticatedRequest(`${await this.getBaseURL()}/auth/logout`, {
        method: 'POST',
      });
    } catch (error) {
      console.warn('Logout request failed:', error);
    }
    //clear local storage
    await AsyncStorage.multiRemove([
      this.tokenKey,
      this.refreshTokenKey,
      this.userProfileKey,
    ]);
    // Sync with AuthService
    await AuthService.clearTokens();
  }
  //check authentication status
  async isAuthenticated(): Promise<boolean> {
    const token = await AsyncStorage.getItem(this.tokenKey);
    return !!token;
  }

  //get current user profile
  async getCurrentUser(): Promise<UserProfile | null> {
    try {
      const cached = await AsyncStorage.getItem(this.userProfileKey);
      if (cached) {
        const user = JSON.parse(cached);
        //refresh in background
        this.refreshUserProfile();
        return user;
      }

      return await this.refreshUserProfile();
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  }

  private async refreshUserProfile(): Promise<UserProfile | null> {
    try {
      const response = await this.makeAuthenticatedRequest(`${this.baseURL}/users/me`);
      const user = await response.json();
      await AsyncStorage.setItem(this.userProfileKey, JSON.stringify(user));
      return user;
    } catch (error) {
      console.error('Failed to refresh user profile:', error);
      return null;
    }
  }
}
//create singleton instance
export const advancedAuthAPI = new AdvancedAuthAPI();