import { apiRequest } from './api';
export interface UserCredentials {
  email: string;
  password: string;
}
export interface UserRegistration {
  username: string;
  email: string;
  full_name: string;
  password: string;
}
export interface UserProfile {
  id: number;
  username: string;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
  last_login?: string;
}
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
export interface PasswordChange {
  current_password: string;
  new_password: string;
}
export interface ProfileUpdate {
  full_name?: string;
  email?: string;
}
//authentication API class
export class AuthAPI {
  private static tokenKey = 'nutriai_auth_tokens';
  private static tokens: AuthTokens | null = null;
  /**
   *reegister new user
   */
  static async register(userData: UserRegistration): Promise<UserProfile> {
    const response = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    return response;
  }
  /**
   *login user and store tokens
   */
  static async login(credentials: UserCredentials): Promise<AuthTokens> {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    
    //store tokens
    this.tokens = response;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.tokenKey, JSON.stringify(response));
    }
    
    return response;
  }

  /**
   *refresh access token
   */
  static async refreshToken(): Promise<AuthTokens> {
    const currentTokens = this.getTokens();
    if (!currentTokens?.refresh_token) {
      throw new Error('No refresh token available');
    }

    const response = await apiRequest('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: currentTokens.refresh_token }),
    });

    //update stored tokens
    this.tokens = response;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.tokenKey, JSON.stringify(response));
    }

    return response;
  }

  /**
   *get current user profile
   */
  static async getCurrentUser(): Promise<UserProfile> {
    const response = await apiRequest('/auth/me', {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });
    return response;
  }

  /**
   *update user profile
   */
  static async updateProfile(profileData: ProfileUpdate): Promise<UserProfile> {
    const params = new URLSearchParams();
    if (profileData.full_name) params.append('full_name', profileData.full_name);
    if (profileData.email) params.append('email', profileData.email);

    const response = await apiRequest(`/auth/me?${params.toString()}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
    });
    return response;
  }

  /**
   *chsange user password
   */
  static async changePassword(passwordData: PasswordChange): Promise<{ message: string }> {
    const response = await apiRequest('/auth/change-password', {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(passwordData),
    });
    return response;
  }

  /**
   *logout user
   */
  static async logout(): Promise<{ message: string }> {
    try {
      const response = await apiRequest('/auth/logout', {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });
      return response;
    } finally {
      //clear stored tokens regardless of API response
      this.clearTokens();
    }
  }

  /**
   * get stored tokens
   */
  static getTokens(): AuthTokens | null {
    if (this.tokens) return this.tokens;
    
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(this.tokenKey);
      if (stored) {
        this.tokens = JSON.parse(stored);
        return this.tokens;
      }
    }
    
    return null;
  }

  /**
   * check if user is authenticated
   */
  static isAuthenticated(): boolean {
    const tokens = this.getTokens();
    return !!tokens?.access_token;
  }

  /**
   *get authorization headers for API requests
   */
  static getAuthHeaders(): Record<string, string> {
    const tokens = this.getTokens();
    if (!tokens?.access_token) {
      throw new Error('No access token available');
    }

    return {
      'Authorization': `Bearer ${tokens.access_token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   *clear stored tokens
   */
  static clearTokens(): void {
    this.tokens = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.tokenKey);
    }
  }

  /**
   *make authenticated API request with automatic token refresh
   */
  static async authenticatedRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    try {
      //first attempt with current token
      return await apiRequest(endpoint, {
        ...options,
        headers: {
          ...this.getAuthHeaders(),
          ...options.headers,
        },
      });
    } catch (error: any) {
      //if unauthorized, try to refresh token
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        try {
          await this.refreshToken();
          //retry request with new token
          return await apiRequest(endpoint, {
            ...options,
            headers: {
              ...this.getAuthHeaders(),
              ...options.headers,
            },
          });
        } catch (refreshError) {
          //refresh failed, clear tokens and re-throw
          this.clearTokens();
          throw new Error('Authentication failed. Please login again.');
        }
      }
      throw error;
    }
  }
}

//convenience functions
export const authApi = {
  register: AuthAPI.register.bind(AuthAPI),
  login: AuthAPI.login.bind(AuthAPI),
  logout: AuthAPI.logout.bind(AuthAPI),
  getCurrentUser: AuthAPI.getCurrentUser.bind(AuthAPI),
  updateProfile: AuthAPI.updateProfile.bind(AuthAPI),
  changePassword: AuthAPI.changePassword.bind(AuthAPI),
  refreshToken: AuthAPI.refreshToken.bind(AuthAPI),
  isAuthenticated: AuthAPI.isAuthenticated.bind(AuthAPI),
  getTokens: AuthAPI.getTokens.bind(AuthAPI),
  clearTokens: AuthAPI.clearTokens.bind(AuthAPI),
  authenticatedRequest: AuthAPI.authenticatedRequest.bind(AuthAPI),
};