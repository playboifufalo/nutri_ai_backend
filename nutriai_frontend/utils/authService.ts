import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile as AuthUser, LoginCredentials, RegistrationData } from '../types/auth';
import { NetworkAutoConfig } from './networkAutoConfig';

//in-memory token cache (duplicated in AsyncStorage for persistence)
let _accessToken: string | null = null;
let _refreshToken: string | null = null;
let _user: AuthUser | null = null;
let _tokensLoaded = false;

let API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const TOKEN_KEY = '@auth_token';
const REFRESH_TOKEN_KEY = '@refresh_token';
const USER_KEY = '@user_data';

//API key for token generation (development only)
const DEV_API_KEY = process.env.EXPO_PUBLIC_DEV_API_KEY || 'dev-token-key-2026';

//function to get current API URL — uses NetworkAutoConfig for dynamic discovery
const getApiUrl = async (): Promise<string> => {
  try {
    const config = await NetworkAutoConfig.getNetworkConfig();
    if (config.apiUrl) {
      API_BASE_URL = config.apiUrl;
    }
  } catch (error) {
    //fall back to stored URL
  }
  return API_BASE_URL;
};

export class AuthService {
    //load tokens from AsyncStorage into memory (called at startup)
    static async loadTokensFromStorage(): Promise<void> {
      if (_tokensLoaded) return;
      try {
        const [token, refreshToken, userData] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(REFRESH_TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (token) _accessToken = token;
        if (refreshToken) _refreshToken = refreshToken;
        if (userData) {
          try { _user = JSON.parse(userData); } catch {}
        }
        _tokensLoaded = true;
        console.log('Tokens loaded from storage:', !!token);
      } catch (e) {
        console.error('Failed to load tokens from storage:', e);
      }
    }

    static async getToken(): Promise<string | null> {
      await this.loadTokensFromStorage();
      return _accessToken;
    }

    static async getRefreshToken(): Promise<string | null> {
      await this.loadTokensFromStorage();
      return _refreshToken;
    }

    static async setTokens(tokens: { accessToken: string; refreshToken: string }): Promise<void> {
      _accessToken = tokens.accessToken;
      _refreshToken = tokens.refreshToken;
      _tokensLoaded = true;
      try {
        await AsyncStorage.setItem(TOKEN_KEY, tokens.accessToken);
        await AsyncStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
        console.log('Tokens saved to storage');
      } catch (e) {
        console.error('Failed to save tokens to storage:', e);
      }
    }

    static async clearTokens(): Promise<void> {
      _accessToken = null;
      _refreshToken = null;
      _user = null;
      _tokensLoaded = true;
      try {
        await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]);
        console.log('Tokens cleared from storage');
      } catch (e) {
        console.error('Failed to clear tokens from storage:', e);
      }
    }

    static async getUser(): Promise<AuthUser | null> {
      await this.loadTokensFromStorage();
      return _user;
    }

    static async setUser(user: AuthUser | null): Promise<void> {
      _user = user;
      try {
        if (user) {
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
        } else {
          await AsyncStorage.removeItem(USER_KEY);
        }
      } catch (e) {
        console.error('Failed to save user to storage:', e);
      }
    }

    static async getUserId(): Promise<string | null> {
      try {
        const token = await this.getToken();
        if (!token) return null;
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.sub || null;
      } catch {
        return null;
      }
    }

    static async isAuthenticated(): Promise<boolean> {
      const token = await this.getToken();
      return !!token;
    }

    static async validateToken(): Promise<boolean> {
      const token = await this.getToken();
      if (!token) return false;
      const apiUrl = await getApiUrl();
      try {
        const response = await fetch(`${apiUrl}/auth/me`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) return true;
        if (response.status === 401 || response.status === 403) {
          this.clearTokens();
        }
        return false;
      } catch {
        return false;
      }
    }

    static async ensureValidToken(): Promise<boolean> {
      if (await this.validateToken()) return true;
      const refreshed = await this.refreshToken();
      return !!refreshed;
    }

  static async login(credentials: LoginCredentials): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
      try {
        const apiUrl = await getApiUrl();
        const response = await fetch(`${apiUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
        });
        if (response.ok) {
          const data = await response.json();
          //support both camelCase and snake_case token fields from backend
          const accessToken = data.accessToken || data.access_token;
          const refreshToken = data.refreshToken || data.refresh_token;
          if (accessToken && refreshToken) {
            await this.setTokens({ accessToken, refreshToken });
            
            let user = data.user;
            //backend may not return user object — fetch profile separately
            if (!user && accessToken) {
              try {
                const meResponse = await fetch(`${apiUrl}/auth/me`, {
                  headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                if (meResponse.ok) {
                  const meData = await meResponse.json();
                  user = {
                    id: String(meData.id),
                    username: meData.username,
                    email: meData.email,
                    firstName: meData.full_name?.split(' ')[0] || meData.username,
                    lastName: meData.full_name?.split(' ').slice(1).join(' ') || '',
                  };
                }
              } catch (e) {
                console.warn('Failed to fetch profile after login:', e);
              }
            }
            if (user) await this.setUser(user);
            return { success: true, user };
          } else {
            return { success: false, error: 'No access/refresh token received' };
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          return { success: false, error: errorData.message || errorData.detail || 'Login failed' };
        }
      } catch {
        return { success: false, error: 'Network error' };
      }
    }

  static async register(data: RegistrationData): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
      try {
        const apiUrl = await getApiUrl();
    const response = await fetch(`${apiUrl}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (response.ok) {
          return await this.login({ email: data.email, password: data.password });
        } else {
          const errorData = await response.json().catch(() => ({}));
          return { success: false, error: errorData.message || 'Registration failed' };
        }
      } catch {
        return { success: false, error: 'Network error' };
      }
    }

    static async logout(): Promise<void> {
      await this.clearTokens();
    }

    static async getAuthHeaders(): Promise<Record<string, string>> {
      const token = await this.getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return headers;
    }

    static async refreshToken(): Promise<boolean> {
      const refreshToken = await this.getRefreshToken();
      if (!refreshToken) return false;
      const apiUrl = await getApiUrl();
      try {
        const response = await fetch(`${apiUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken, refresh_token: refreshToken }),
        });
        if (response.ok) {
          const data = await response.json();
          const accessToken = data.accessToken || data.access_token;
          const newRefreshToken = data.refreshToken || data.refresh_token;
          if (accessToken && newRefreshToken) {
            await this.setTokens({ accessToken, refreshToken: newRefreshToken });
            return true;
          }
        } else {
          await this.clearTokens();
        }
      } catch {
        await this.clearTokens();
      }
      return false;
    }

    static async createTestUser(): Promise<{ success: boolean; error?: string }> {
      const testUser = {
        username: 'scanner_test',
        email: 'scanner@test.com',
        password: 'scanner123',
        firstName: 'Scanner',
        lastName: 'Test User',
        acceptTerms: true
      };
      const loginResult = await this.login({ email: testUser.email, password: testUser.password });
      if (loginResult.success) return { success: true };
      const registerResult = await this.register(testUser);
      return registerResult;
    }

    static async generateQuickToken(
      usernameOrEmail: string = 'testscanner',
      apiKey: string = DEV_API_KEY
    ): Promise<{ success: boolean; error?: string }> {
      try {
        const apiUrl = await getApiUrl();
        const url = `${apiUrl}/auth/generate-token?username_or_email=${encodeURIComponent(usernameOrEmail)}&api_key=${encodeURIComponent(apiKey)}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          const data = await response.json();
          console.log('Token response:', data);
          const accessToken = data.accessToken || data.access_token;
          const refreshToken = data.refreshToken || data.refresh_token;
          if (accessToken && refreshToken) {
            await this.setTokens({ accessToken, refreshToken });
            console.log('Tokens set successfully');
            return { success: true };
          } else {
            console.warn('Response missing tokens:', data);
            return { success: false, error: 'No access/refresh token received' };
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          if (response.status === 403) {
            return { success: false, error: 'Invalid or missing API key' };
          }
          return { success: false, error: errorData.detail || 'Token generation failed' };
        }
      } catch (error) {
        console.error('generateQuickToken error:', error);
        return { success: false, error: 'Network error' };
      }
    }

    static async ensureValidTokenQuick(username: string = 'testscanner'): Promise<boolean> {
      if (!(await this.getToken())) {
        const result = await this.generateQuickToken(username);
        return result.success;
      }
      if (await this.validateToken()) return true;
      const result = await this.generateQuickToken(username);
      return result.success;
    }
        
    }