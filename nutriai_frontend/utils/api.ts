import { router } from 'expo-router';
import { AuthService } from './authService';
import { NetworkAutoConfig } from './networkAutoConfig';

let currentApiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const API_VERSION = process.env.EXPO_PUBLIC_API_VERSION || 'v1';
const API_TIMEOUT = parseInt(process.env.EXPO_PUBLIC_API_TIMEOUT || '10000');

export const API_CONFIG = {
  get BASE_URL() {
    return currentApiUrl;
  },
  VERSION: API_VERSION,
  TIMEOUT: API_TIMEOUT,
  get FULL_URL() {
    return currentApiUrl;
  },
  
  // Method to update API URL
  setApiUrl: (newUrl: string) => {
    currentApiUrl = newUrl;
    console.log('📡 API URL updated:', newUrl);
  }
};

// Network auto-configuration initialization
let networkInitialized = false;

const initializeNetwork = async () => {
  if (networkInitialized) return;
  
  try {
    console.log('🔧 Initializing automatic network configuration...');
    const config = await NetworkAutoConfig.getNetworkConfig();
    API_CONFIG.setApiUrl(config.apiUrl);
    networkInitialized = true;
    console.log('Network configuration initialized:', config.apiUrl);
  } catch (error) {
    console.error('Network initialization error:', error);
    // Continue with default URL
  }
};

//API request wrapper with automatic network configuration and 401→refresh→retry
export const apiRequest = async (endpoint: string, options: RequestInit = {}, skipAuth: boolean = false) => {
  // Initialize network on first request
  await initializeNetwork();
  
  const url = `${API_CONFIG.FULL_URL}${endpoint}`;
  
  // Add auth headers unless explicitly skipped (e.g. login/register endpoints)
  const authHeaders: Record<string, string> = {};
  if (!skipAuth) {
    const token = await AuthService.getToken();
    if (token) {
      authHeaders['Authorization'] = `Bearer ${token}`;
    }
  }
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
    ...options,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
    
    console.log(`API Request: ${url}`);
    
    const response = await fetch(url, {
      ...defaultOptions,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    // Handle 401 — try to refresh token and retry
    if (response.status === 401 && !skipAuth) {
      console.log('Got 401, attempting token refresh...');
      const refreshed = await AuthService.refreshToken();
      
      if (refreshed) {
        console.log('Token refreshed, retrying request...');
        const newToken = await AuthService.getToken();
        
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), API_CONFIG.TIMEOUT);
        
        const retryResponse = await fetch(url, {
          ...defaultOptions,
          headers: {
            ...defaultOptions.headers,
            'Authorization': `Bearer ${newToken}`,
          },
          signal: retryController.signal,
        });
        
        clearTimeout(retryTimeoutId);
        
        if (retryResponse.ok) {
          console.log('Retry after refresh successful');
          return await retryResponse.json();
        }
        
        // If still 401 after refresh — session expired, redirect to login
        if (retryResponse.status === 401) {
          console.log('Still 401 after refresh — logging out');
          await AuthService.clearTokens();
          router.replace('/auth/login');
          throw new Error('Session expired. Please log in again.');
        }
        
        throw new Error(`HTTP error! status: ${retryResponse.status}`);
      } else {
        // Refresh failed — redirect to login
        console.log('Token refresh failed — logging out');
        await AuthService.clearTokens();
        router.replace('/auth/login');
        throw new Error('Session expired. Please log in again.');
      }
    }
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    
    // If the request fails due to network, try to update network configuration
    if (error instanceof Error && (
      error.message.includes('Network request failed') || 
      error.message.includes('fetch failed') ||
      error.name === 'AbortError'
    )) {
      console.log('Trying to find alternative network configuration...');
      
      try {
        const newConfig = await NetworkAutoConfig.refreshNetworkConfig();
        API_CONFIG.setApiUrl(newConfig.apiUrl);
        
        // Retry request with new configuration
        const retryUrl = `${API_CONFIG.FULL_URL}${endpoint}`;
        console.log(`Retry request: ${retryUrl}`);
        
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), API_CONFIG.TIMEOUT);
        
        const retryResponse = await fetch(retryUrl, {
          ...defaultOptions,
          signal: retryController.signal,
        });
        
        clearTimeout(retryTimeoutId);
        
        if (retryResponse.ok) {
          console.log('Retry request successful with new configuration');
          return await retryResponse.json();
        }
      } catch (retryError) {
        console.error('Retry request also failed:', retryError);
      }
    }
    
    throw error;
  }
};

//nutrition API functions
export const nutritionApi = {
  getFoodItem: (id: string) => apiRequest(`/nutrition/food/${id}`),
  
  searchFood: (query: string) => apiRequest(`/nutrition/search?q=${encodeURIComponent(query)}`),
  
  addMeal: (mealData: any) =>
    apiRequest('/nutrition/meals', {
      method: 'POST',
      body: JSON.stringify(mealData),
    }),
};

//user API functions (non-auth related)
export const userApi = {
  getProfile: () => apiRequest('/user/profile'),
  
  updateProfile: (profileData: any) =>
    apiRequest('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    }),
};