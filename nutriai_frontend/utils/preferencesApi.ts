import { router } from 'expo-router';
import { AuthService } from './authService';
import { NetworkAutoConfig } from './networkAutoConfig';

const FALLBACK_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

async function getBaseUrl(): Promise<string> {
  try {
    const cfg = await NetworkAutoConfig.getNetworkConfig();
    return cfg.apiUrl;
  } catch {
    return FALLBACK_URL;
  }
}

export interface UserPreferences {
  goal?: string;
  allergies?: string[];
  diet_type?: string;
  caloric_target?: number;
  liked_products?: string[];
  disliked_products?: string[];
}

export interface PreferencesResponse {
  id: number;
  user_id: number;
  liked_products: string[];
  disliked_products: string[];
  allergies: string[];
  diet_type: string;
  goals: string;
  caloric_target: number;
  last_scanned_products: string[];
  created_at: string;
  updated_at?: string;
}

export interface AvailableOptions {
  diet_types: string[];
  goal_types: string[];
  supported_products: string[];
  common_allergies: string[];
  caloric_ranges: {
    min: number;
    max: number;
    recommended_female: string;
    recommended_male: string;
  };
}

export interface PreferencesStats {
  stats: {
    liked_products_count: number;
    disliked_products_count: number;
    allergies_count: number;
    scan_history_count: number;
    diet_type?: string;
    goals?: string;
    caloric_target?: number;
  };
}

class PreferencesAPI {
  private async getAuthHeaders() {
    const token = await AuthService.getToken();
    
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  }

  // Authenticated fetch with 401→refresh→retry
  private async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (response.status === 401) {
      console.log('[PreferencesAPI] Got 401, attempting token refresh...');
      const refreshed = await AuthService.refreshToken();
      
      if (refreshed) {
        console.log('[PreferencesAPI] Token refreshed, retrying request...');
        const newHeaders = await this.getAuthHeaders();
        return fetch(url, {
          ...options,
          headers: {
            ...newHeaders,
            ...options.headers,
          },
        });
      } else {
        console.log('[PreferencesAPI] Token refresh failed — logging out');
        await AuthService.clearTokens();
        router.replace('/auth/login');
        throw new Error('Session expired. Please log in again.');
      }
    }

    return response;
  }

  async getMyPreferences(): Promise<PreferencesResponse> {
    const baseUrl = await getBaseUrl();
    const response = await this.authenticatedFetch(`${baseUrl}/preferences/me`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch preferences');
    }

    return response.json();
  }

  async createMyPreferences(preferences: UserPreferences): Promise<PreferencesResponse> {
    const baseUrl = await getBaseUrl();
    console.log('Creating preferences with data:', preferences);
    
    const payload = {
      goals: preferences.goal,
      allergies: preferences.allergies || [],
      diet_type: preferences.diet_type,
      caloric_target: preferences.caloric_target,
      liked_products: preferences.liked_products || [],
      disliked_products: preferences.disliked_products || [],
    };
    
    console.log('Sending payload:', payload);
    console.log('API URL:', `${baseUrl}/preferences/me`);

    const response = await this.authenticatedFetch(`${baseUrl}/preferences/me`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      throw new Error(`Failed to create preferences: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Success result:', result);
    return result;
  }

  async updateMyPreferences(preferences: Partial<UserPreferences>): Promise<PreferencesResponse> {
    const baseUrl = await getBaseUrl();
    const response = await this.authenticatedFetch(`${baseUrl}/preferences/me`, {
      method: 'PUT',
      body: JSON.stringify({
        goals: preferences.goal,
        allergies: preferences.allergies,
        diet_type: preferences.diet_type,
        caloric_target: preferences.caloric_target,
        liked_products: preferences.liked_products,
        disliked_products: preferences.disliked_products,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update preferences');
    }

    return response.json();
  }

  async addLikedProduct(product: string): Promise<{ message: string }> {
    const baseUrl = await getBaseUrl();
    const response = await this.authenticatedFetch(`${baseUrl}/preferences/me/add-liked-product`, {
      method: 'POST',
      body: JSON.stringify({ product }),
    });

    if (!response.ok) {
      throw new Error('Failed to add liked product');
    }

    return response.json();
  }

  async addDislikedProduct(product: string): Promise<{ message: string }> {
    const baseUrl = await getBaseUrl();
    const response = await this.authenticatedFetch(`${baseUrl}/preferences/me/add-disliked-product`, {
      method: 'POST',
      body: JSON.stringify({ product }),
    });

    if (!response.ok) {
      throw new Error('Failed to add disliked product');
    }

    return response.json();
  }

  async addScannedProduct(product: string): Promise<{ message: string }> {
    const baseUrl = await getBaseUrl();
    const response = await this.authenticatedFetch(
      `${baseUrl}/preferences/me/add-scanned-product?product=${encodeURIComponent(product)}`,
      { method: 'POST' }
    );

    if (!response.ok) {
      throw new Error('Failed to add scanned product');
    }

    return response.json();
  }

  async deleteMyPreferences(): Promise<{ message: string }> {
    const baseUrl = await getBaseUrl();
    const response = await this.authenticatedFetch(`${baseUrl}/preferences/me`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete preferences');
    }

    return response.json();
  }

  async getAvailableOptions(): Promise<AvailableOptions> {
    const baseUrl = await getBaseUrl();
    const response = await fetch(`${baseUrl}/preferences/available-options`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch available options');
    }

    return response.json();
  }

  async getPreferencesStats(): Promise<PreferencesStats> {
    const baseUrl = await getBaseUrl();
    const response = await this.authenticatedFetch(`${baseUrl}/preferences/stats`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch preferences stats');
    }

    return response.json();
  }
}

export const preferencesApi = new PreferencesAPI();