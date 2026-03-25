import { Platform } from 'react-native';
import { AuthService } from './authService';
import { NetworkAutoConfig } from './networkAutoConfig';
export interface Product {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  barcode?: string;
  image_url?: string;
  serving_size?: string;
  nutritional_info?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
  };
  allergens?: string[];
  ingredients?: string[];
  source?: string;
}

export interface ScanHistoryItem {
  id: string;
  product_name: string;
  brand?: string;
  barcode?: string;
  scan_method: 'barcode' | 'image' | 'manual';
  scanned_at: string;
  is_favorite?: boolean;
  nutritional_info?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
  };
  allergens?: string[];
  ingredients?: string[];
}

export interface SearchResponse {
  products: Product[];
  total_count: number;
  page: number;
  per_page: number;
}

export interface ScanResponse {
  session_id: string | null;
  products: Array<{
    name: string;
    brand?: string;
    weight_grams?: number;
    quantity?: number;
    confidence?: number;
    detection_method?: string;
    calories_per_100g?: number;
    protein_per_100g?: number;
    carbs_per_100g?: number;
    fat_per_100g?: number;
    nutrition_per_100g?: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    };
  }>;
  total_products: number;
  status: string;
  strategy_used?: string;
  processing_time_seconds?: number;
}


//helpers
async function getApiUrl(): Promise<string> {
  try {
    const config = await NetworkAutoConfig.getNetworkConfig();
    return config.apiUrl;
  } catch {
    return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await AuthService.getToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log('🔑 [foodAPI] Token present, first 20 chars:', token.substring(0, 20) + '...');
  } else {
    console.warn('⚠️ [foodAPI] No auth token available — request will be unauthenticated');
  }
  return headers;
}
async function ensureToken(): Promise<void> {
  const token = await AuthService.getToken();
  if (!token) return; //nothing to check

  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      const exp = payload.exp;
      if (exp) {
        const now = Math.floor(Date.now() / 1000);
        if (exp - now < 60) {
          //token expired or about to expire — refresh proactively
          console.log('[foodAPI] Token expired/expiring — proactive refresh');
          await AuthService.refreshToken();
        }
      }
    }
  } catch (e) {
    // If we can't decode — no problem, the server will tell us via 401
    console.log('[foodAPI] Could not decode token for expiry check');
  }
}


//generic request function with automatic token refresh on 401 and proactive refresh if token is about to expire
async function request<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  //proactively refresh token if it's about to expire
  await ensureToken();

  const baseUrl = await getApiUrl();
  const url = `${baseUrl}${endpoint}`;
  const auth = await authHeaders();

  const isFormData =
    options.body instanceof FormData ||
    (typeof options.body === 'object' && options.body !== null && 'getParts' in (options.body as any));

  const defaultHeaders: Record<string, string> = {
    ...auth,
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
  };

  const mergedOptions: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  };

  console.log(`🌐 [foodAPI] ${options.method || 'GET'} ${url}`);

  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutMs = 60000; // 60 seconds — OpenFoodFacts can be slow
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    response = await fetch(url, { ...mergedOptions, signal: controller.signal });
    clearTimeout(timeoutId);
  } catch (err: any) {
    console.error('[foodAPI] Network error:', err.message);
    throw new Error('Network request failed. Check your connection and server.');
  }

  
  if (response.status === 401) {
    console.log('[foodAPI] 401 → refreshing token...');
    const refreshed = await AuthService.refreshToken();
    if (refreshed) {
      const newAuth = await authHeaders();
      const retryResponse = await fetch(url, {
        ...mergedOptions,
        headers: { ...mergedOptions.headers, ...newAuth } as any,
      });
      if (retryResponse.ok) {
        return retryResponse.json() as Promise<T>;
      }
    }
    await AuthService.clearTokens();
    throw new Error('Session expired. Please log in again.');
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const err = await response.json();
      // err.detail can be a string or an array of objects (FastAPI 422 validation)
      const raw = err.detail || err.message || detail;
      detail = typeof raw === 'string' ? raw : JSON.stringify(raw);
    } catch { /* ignore */ }
    console.error(`[foodAPI] Error: ${detail}`);
    throw new Error(detail);
  }

  return response.json() as Promise<T>;
}


// api methods
export const foodAPI = {

  /**
   *search products via OpenFoodFacts.
   *backend: GET /scanner/search-products?query=...&page=...&page_size=...
   */
  async searchProducts(
    query: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<SearchResponse> {
    const data = await request<any>(
      `/scanner/search-products?query=${encodeURIComponent(query)}&page=${page}&page_size=${pageSize}`,
    );

    //map backend format { results: [...], pagination: {...} } → SearchResponse
    const results = data.results || data.products || [];
    const products: Product[] = results.map((p: any, idx: number) => ({
      id: p.id?.toString() || p.barcode || `product-${idx}`,
      name: p.product_name || p.name || 'Unknown',
      brand: p.brands || p.brand,
      category: p.categories || p.category,
      barcode: p.barcode || p.code,
      image_url: p.image_url || p.image_front_url,
      serving_size: p.serving_size,
      nutritional_info: p.nutritional_info || p.nutriments || {
        calories: p.energy_kcal || p.calories_per_100g,
        protein: p.proteins || p.protein_per_100g,
        carbs: p.carbohydrates || p.carbs_per_100g,
        fat: p.fat || p.fat_per_100g,
        fiber: p.fiber,
        sugar: p.sugars,
        sodium: p.sodium,
      },
      allergens: p.allergens_tags || p.allergens || [],
      ingredients: p.ingredients_text
        ? [p.ingredients_text]
        : p.ingredients || [],
      source: p.source || 'openfoodfacts',
    }));

    return {
      products,
      total_count: data.pagination?.total || data.total_count || products.length,
      page: data.pagination?.page || page,
      per_page: data.pagination?.page_size || pageSize,
    };
  },

  /**
   *get all products (alias for empty-ish search or supported-products).
   */
  async getAllProducts(page: number = 1, pageSize: number = 20): Promise<SearchResponse> {
    try {
      return await this.searchProducts('food', page, pageSize);
    } catch {
      return { products: [], total_count: 0, page, per_page: pageSize };
    }
  },

  //image scanning

  /**
   * upload an image for AI product recognition.
   * backend: POST /scanner/analyze-advanced  (multipart/form-data)
   */
  async scanProductImage(imageUri: string): Promise<ScanResponse> {
    const baseUrl = await getApiUrl();
    const url = `${baseUrl}/scanner/analyze-advanced`;
    const auth = await authHeaders();

    const formData = new FormData();

    //react Native requires a specific object shape for file uploads
    const uriParts = imageUri.split('.');
    const fileType = uriParts[uriParts.length - 1] || 'jpg';
    const mimeType = `image/${fileType === 'jpg' ? 'jpeg' : fileType}`;

    //backend scanner_ai.py expects field name "image"
    formData.append('image', {
      uri: imageUri,
      name: `photo.${fileType}`,
      type: mimeType,
    } as any);

    console.log('[foodAPI] Uploading image to /scanner/analyze-advanced ...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); //120s for AI analysis

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...auth,
          //NOTE: Do NOT set Content-Type for FormData — fetch sets it automatically with boundary
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
          const err = await response.json();
          const raw = err.detail || err.message || detail;
          detail = typeof raw === 'string' ? raw : JSON.stringify(raw);
        } catch { /* ignore */ }
        throw new Error(detail);
      }

      const data = await response.json();
      
      //Backend scanner.py returns "all_products", scanner_ai.py returns "products"
      //Normalize to always have "products" array for frontend consistency
      const scanResponse: ScanResponse = {
        session_id: data.session_id,
        products: data.products || data.all_products || [],
        total_products: data.total_products || data.total_products_found || 0,
        status: data.status || (data.success ? 'success' : 'failed'),
        strategy_used: data.strategy_used,
        processing_time_seconds: data.processing_time_seconds,
      };
      
      console.log('[foodAPI] Scan result:', scanResponse.total_products, 'products found');
      return scanResponse;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Image analysis timed out. Please try again.');
      }
      throw err;
    }
  },

  //barcode
  async lookupBarcode(barcode: string): Promise<any> {
    return request<any>(
      `/scanner/barcode-lookup?barcode=${encodeURIComponent(barcode)}`,
      { method: 'POST' },
    );
  },
  async scanBarcodeFromImage(imageUri: string): Promise<any> {
    const baseUrl = await getApiUrl();
    const url = `${baseUrl}/scanner/barcode`;
    const auth = await authHeaders();

    const formData = new FormData();
    const uriParts = imageUri.split('.');
    const fileType = uriParts[uriParts.length - 1] || 'jpg';
    const mimeType = `image/${fileType === 'jpg' ? 'jpeg' : fileType}`;

    formData.append('file', {
      uri: imageUri,
      name: `barcode.${fileType}`,
      type: mimeType,
    } as any);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...auth },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
          const err = await response.json();
          detail = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
        } catch { /* ignore */ }
        throw new Error(detail);
      }

      return await response.json();
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Barcode scan timed out.');
      }
      throw err;
    }
  },

  //preferences integration for scanned products
  async addScannedProduct(
    productNameOrObj: string | {
      name: string;
      brand?: string;
      category?: string;
      weight_grams?: number;
      calories_per_100g?: number;
      protein_per_100g?: number;
      carbs_per_100g?: number;
      fat_per_100g?: number;
    },
  ): Promise<{ message: string }> {
    //if string — use legacy query param for backward compat
    if (typeof productNameOrObj === 'string') {
      return request<{ message: string }>(
        `/preferences/me/add-scanned-product?product=${encodeURIComponent(productNameOrObj)}`,
        { method: 'POST' },
      );
    }
    //object with nutrition — send as JSON body
    return request<{ message: string }>(
      '/preferences/me/add-scanned-product',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productNameOrObj),
      },
    );
  },
  async getScanHistory(): Promise<ScanHistoryItem[]> {
    const data = await request<any>('/preferences/me');
    const scannedProducts: any[] = data.last_scanned_products || [];

    return scannedProducts.map((item: any, idx: number) => {
      const name = typeof item === 'string' ? item : (item.name || 'Unknown');
      return {
        id: `scan-${idx}`,
        product_name: name,
        brand: typeof item === 'object' ? item.brand : undefined,
        scan_method: 'manual' as const,
        scanned_at: data.updated_at || new Date().toISOString(),
        nutritional_info: typeof item === 'object' ? {
          calories: item.calories_per_100g || 0,
          protein: item.protein_per_100g || 0,
          carbs: item.carbs_per_100g || 0,
          fat: item.fat_per_100g || 0,
        } : undefined,
      };
    });
  },

 

  //get scan details by id
  async getScanDetails(scanId: string): Promise<ScanHistoryItem> {
    //scan details are not stored individually on the backend,
    //so return from the history list
    const history = await this.getScanHistory();
    const item = history.find(h => h.id === scanId);
    if (!item) {
      throw new Error('Scan record not found');
    }
    return item;
  },

 //add item to my favourite (for the future)
  async addToFavorites(scanId: string): Promise<void> {
    const history = await this.getScanHistory();
    const item = history.find(h => h.id === scanId);
    if (item) {
      await request(
        `/preferences/me/add-liked-product?product=${encodeURIComponent(item.product_name)}`,
        { method: 'POST' },
      );
    }
  },

  //meal plans
  async createMealPlan(params: {
    days?: number;
    meals_per_day?: number;
    daily_calorie_target?: number;
    dietary_restrictions?: string[];
    cuisine_preference?: string;
    plan_name?: string;
  }): Promise<any> {
    const baseUrl = await getApiUrl();
    const auth = await authHeaders();

    const formData = new FormData();
    if (params.days) formData.append('days', params.days.toString());
    if (params.meals_per_day) formData.append('meals_per_day', params.meals_per_day.toString());
    if (params.daily_calorie_target) formData.append('daily_calorie_target', params.daily_calorie_target.toString());
    if (params.cuisine_preference) formData.append('cuisine_preference', params.cuisine_preference);
    if (params.plan_name) formData.append('plan_name', params.plan_name);
    formData.append('use_saved_products', 'true');

    const response = await fetch(`${baseUrl}/scanner/meal-plans/create`, {
      method: 'POST',
      headers: { ...auth },
      body: formData,
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try { const err = await response.json(); detail = err.detail || detail; } catch {}
      throw new Error(detail);
    }

    return response.json();
  },

  async getMyMealPlans(): Promise<any[]> {
    const data = await request<any>('/scanner/meal-plans/my'); //get user's specific meal plan
    return data.meal_plans || data || [];
  },

  
  async getMealPlan(planId: number): Promise<any> {
    return request<any>(`/scanner/meal-plans/${planId}`);
  },



  //deleting meal plan
  async deleteMealPlan(planId: number): Promise<void> {
    await request(`/scanner/meal-plans/${planId}`, { method: 'DELETE' });
  },

  //recipes

  
  async generateRecipes(sessionId: number, params?: {
    cuisine_preference?: string;
    max_recipes?: number;
  }): Promise<any> {
    const baseUrl = await getApiUrl();
    const auth = await authHeaders();

    const formData = new FormData();
    if (params?.cuisine_preference) formData.append('cuisine_preference', params.cuisine_preference);
    if (params?.max_recipes) formData.append('max_recipes', params.max_recipes.toString());

    const response = await fetch(`${baseUrl}/scanner/sessions/${sessionId}/recipes`, {
      method: 'POST',
      headers: { ...auth },
      body: formData,
    });

    if (!response.ok) throw new Error(`Recipe generation failed: ${response.status}`);
    return response.json();
  },

  //get recipes for a session
  async getMyRecipes(): Promise<any[]> {
    const data = await request<any>('/scanner/my-recipes');
    return data.recipes || [];
  },

  //get user's scan sessions
  async getMySessions(): Promise<any[]> {
    const data = await request<any>('/scanner/my-sessions');
    return data.sessions || [];
  },

  //get products for a session
  async getSessionProducts(sessionId: number): Promise<any[]> {
    const data = await request<any>(`/scanner/sessions/${sessionId}/products`);
    return data.products || [];
  },
};
