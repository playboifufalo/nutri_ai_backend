import { router } from 'expo-router';
import { AuthService } from './authService';
import { NetworkAutoConfig } from './networkAutoConfig';

async function authenticatedRequest(endpoint: string, options: RequestInit = {}) {
  const token = await AuthService.getToken();
  if (!token) {
    console.error('No auth token found! User needs to login.');   //log before redirecting
    throw new Error('Not authenticated. Please login first.');
  }
  
  console.log('Token present:', token.substring(0, 20) + '...');
  
  const headers = await AuthService.getAuthHeaders();
  const networkConfig = await NetworkAutoConfig.getNetworkConfig();
  
  const url = `${networkConfig.apiUrl}${endpoint}`;
  
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };
  
  if (options.headers && (options.headers as any)['Content-Type'] === 'multipart/form-data') {    //remove Content-Type for multipart/form-data to let browser set the correct boundary
    delete defaultHeaders['Content-Type'];
  }
  
  console.log('API Request:', url);
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });
  
  console.log('� Response status:', response.status, response.statusText);
  if (response.status === 401) {
    console.log('[ProductService] Got 401, attempting token refresh...');
    const refreshed = await AuthService.refreshToken();
    
    if (refreshed) {
      console.log('[ProductService] Token refreshed, retrying request...');
      const newHeaders = await AuthService.getAuthHeaders();
      const retryHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...newHeaders,
      };
      if (options.headers && (options.headers as any)['Content-Type'] === 'multipart/form-data') {
        delete retryHeaders['Content-Type'];
      }
      
      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          ...retryHeaders,
          ...options.headers,
        },
      });
      
      console.log('Retry response status:', retryResponse.status, retryResponse.statusText);
      
      if (retryResponse.status === 401) {
        console.log('[ProductService] Still 401 after refresh — logging out');
        await AuthService.clearTokens();
        router.replace('/auth/login');
        throw new Error('Session expired. Please log in again.');
      }
      
      return retryResponse;
    } else {
      console.log('[ProductService] Token refresh failed — logging out');
      await AuthService.clearTokens();
      router.replace('/auth/login');
      throw new Error('Session expired. Please log in again.');
    }
  }
  
  return response;
}

export interface Product {
  id: number;
  product_name: string;
  brand?: string;
  category?: string;
  source: 'manual' | 'barcode' | 'ai_scan';
  planned_quantity_grams?: number;
  calories_per_100g?: number;
  protein_per_100g?: number;
  carbs_per_100g?: number;
  fat_per_100g?: number;
  created_at?: string;
  barcode?: string;
}

export interface CreateMealPlanRequest {
  name: string;
  description?: string;
  duration_days: number;
  target_calories_per_day?: number;
  target_protein_per_day?: number;
  target_carbs_per_day?: number;
  target_fat_per_day?: number;
  use_ai_optimization?: boolean;
  ai_prompt?: string;
}

export interface MealPlanItem {
  id: number;
  day_number: number;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  planned_grams: number;
  product_name: string;
  calculated_calories: number;
  calculated_protein?: number;
  calculated_carbs?: number;
  calculated_fat?: number;
  preparation_notes?: string;
}

export interface MealPlan {
  id: number;
  name: string;
  description?: string;
  duration_days: number;
  target_calories_per_day?: number;
  target_protein_per_day?: number;
  target_carbs_per_day?: number;
  target_fat_per_day?: number;
  is_active: boolean;
  created_at: string;
  items?: MealPlanItem[];
}

export interface MealPlanSummary {
  plan_name: string;
  duration_days: number;
  average_daily: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  target_compliance_percent?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface ProductStatistics {
  total_products: number;
  by_source: {
    manual: number;
    barcode: number;
    ai_scan: number;
  };
  top_categories: Array<{
    category: string;
    count: number;
  }>;
}

export class ProductService {
  // Get user's product list (from preferences)
  static async getMyProducts(params?: {
    category?: string;
    source?: 'manual' | 'barcode' | 'ai_scan';
  }): Promise<Product[]> {
    try {
      // Use the correct endpoint: GET /preferences/me
      const url = '/preferences/me';

      const response = await authenticatedRequest(url, {
        method: 'GET',
      });

      console.log('Products response status:', response.status);
      console.log('Products response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Products API error:', response.status, errorText);
        throw new Error(`Failed to fetch products: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Preferences data received:', JSON.stringify(data).substring(0, 300));
      
      // Extract last_scanned_products from preferences
      if (data.last_scanned_products && Array.isArray(data.last_scanned_products)) {
        console.log('Found last_scanned_products:', data.last_scanned_products.length);
        
        // Convert string array to Product objects
        const products: Product[] = data.last_scanned_products.map((item: any, index: number) => {
          // If item is a string, convert it to Product object
          if (typeof item === 'string') {
            return {
              id: index + 1, // Generate temporary ID
              product_name: item,
              source: 'manual' as const,
              category: 'Unknown',
              planned_quantity_grams: 100,
              calories_per_100g: 0,
              protein_per_100g: 0,
              carbs_per_100g: 0,
              fat_per_100g: 0,
            };
          }
          // If item is already an object, return it
          return {
            id: item.id || index + 1,
            product_name: item.product_name || item.name || 'Unknown',
            brand: item.brand,
            category: item.category || 'Unknown',
            source: item.source || 'manual',
            planned_quantity_grams: item.planned_quantity_grams || item.quantity_grams || 100,
            calories_per_100g: item.calories_per_100g || 0,
            protein_per_100g: item.protein_per_100g || 0,
            carbs_per_100g: item.carbs_per_100g || 0,
            fat_per_100g: item.fat_per_100g || 0,
            created_at: item.created_at,
            barcode: item.barcode,
          };
        });
        
        console.log('Converted to Product objects:', products.length);
        
        return products;
      } else {
        console.log('No last_scanned_products in response, returning empty array');
        return [];
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  }

  // Enrich products with nutrition data from OpenFoodFacts
  static async enrichProductsWithNutrition(products: Product[]): Promise<void> {
    const networkConfig = await NetworkAutoConfig.getNetworkConfig();
    const headers = await AuthService.getAuthHeaders();

    // Process products in parallel (max 5 concurrent to avoid overwhelming the server)
    const batchSize = 5;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (product) => {
          // Skip if already has nutrition data
          if (product.calories_per_100g || product.protein_per_100g || product.fat_per_100g || product.carbs_per_100g) {
            return;
          }
          try {
            const url = `${networkConfig.apiUrl}/scanner/search-products?query=${encodeURIComponent(product.product_name)}&page_size=1`;
            const resp = await fetch(url, { headers: { ...headers } });
            if (resp.ok) {
              const result = await resp.json();
              const items = result.products || result.items || result;
              if (Array.isArray(items) && items.length > 0) {
                const found = items[0];
                product.calories_per_100g = found.calories_per_100g || found.energy_kcal_100g || 0;
                product.protein_per_100g = found.protein_per_100g || found.proteins_100g || 0;
                product.carbs_per_100g = found.carbs_per_100g || found.carbohydrates_100g || 0;
                product.fat_per_100g = found.fat_per_100g || found.fat_100g || 0;
                if (found.brand) product.brand = found.brand;
                if (found.category) product.category = found.category;
                console.log(`✅ Nutrition found for "${product.product_name}": ${product.calories_per_100g} kcal`);
              } else {
                console.log(`⚠️ No nutrition found for "${product.product_name}"`);
              }
            }
          } catch (err) {
            console.warn(`Failed to look up nutrition for "${product.product_name}":`, err);
          }
        })
      );
    }
  }

  // Add product manually
  static async addManualProduct(product: {
    product_name: string;
    brand?: string;
    category?: string;
    calories_per_100g?: number;
    protein_per_100g?: number;
    carbs_per_100g?: number;
    fat_per_100g?: number;
    planned_quantity_grams?: number;
  }): Promise<Product> {
    try {
      const response = await authenticatedRequest('/products/add-manual', {
        method: 'POST',
        body: JSON.stringify({
          ...product,
          source: 'manual',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add product');
      }

      return await response.json();
    } catch (error) {
      console.error('Error adding product:', error);
      throw error;
    }
  }

  // Add product by barcode
  static async addProductByBarcode(
    barcode: string,
    plannedQuantityGrams?: number
  ): Promise<Product> {
    try {
      // Build query parameters - backend expects product name/barcode as query param
      const quantity = plannedQuantityGrams || 100;
      const endpoint = `/preferences/me/add-scanned-product?product=${encodeURIComponent(barcode)}&quantity_grams=${quantity}`;

      console.log('📤 Adding scanned product:', { barcode, quantity });
      console.log('📤 Endpoint:', endpoint);

      const response = await authenticatedRequest(endpoint, {
        method: 'POST',
      });

      console.log('Add product response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Add scanned product error:', response.status, errorText);
        throw new Error(`Failed to add scanned product: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Scanned product added:', JSON.stringify(result).substring(0, 300));
      
      // Handle different response formats
      if (result.product) {
        console.log('Response has product property');
        return result.product;
      } else if (result.data) {
        console.log('Response has data property');
        return result.data;
      } else {
        console.log('Returning result as-is');
        return result;
      }
    } catch (error) {
      console.error('Error adding scanned product:', error);
      throw error;
    }
  }

  // Remove product from scanned products list
  static async removeScannedProduct(productName: string): Promise<{ message: string; remaining_products: number }> {
    try {
      const endpoint = `/preferences/me/remove-scanned-product?product=${encodeURIComponent(productName)}`;

      console.log('🗑️ Removing scanned product:', productName);
      console.log('🗑️ Endpoint:', endpoint);

      const response = await authenticatedRequest(endpoint, {
        method: 'DELETE',
      });

      console.log('Remove product response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Remove scanned product error:', response.status, errorText);
        
        // Parse error response
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.detail || `Failed to remove product: ${response.status}`);
        } catch (parseError) {
          throw new Error(`Failed to remove product: ${response.status} - ${errorText}`);
        }
      }

      const result = await response.json();
      console.log('Scanned product removed:', JSON.stringify(result));
      
      return {
        message: result.message || 'Product removed successfully',
        remaining_products: result.remaining_products || 0
      };
    } catch (error) {
      console.error('Error removing scanned product:', error);
      throw error;
    }
  }

  // Get scan history
  static async getScanHistory(): Promise<any[]> {
    try {
      const response = await authenticatedRequest('/food-analysis/scan-history', {
        method: 'GET',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Scan history error:', response.status, errorText);
        throw new Error(`Failed to fetch scan history: ${response.status}`);
      }

      const data = await response.json();
      console.log('Scan history loaded:', data?.length || 0);
      return Array.isArray(data) ? data : data.history || [];
    } catch (error) {
      console.error('Error fetching scan history:', error);
      throw error;
    }
  }

  // Add product by image
  static async addProductByImage(
    imageUri: string,
    plannedQuantityGrams?: number
  ): Promise<Product> {
    try {
      const formData = new FormData();
      
      const filename = imageUri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('file', {
        uri: imageUri,
        name: filename,
        type,
      } as any);

      if (plannedQuantityGrams) {
        formData.append('planned_quantity_grams', plannedQuantityGrams.toString());
      }

      const response = await authenticatedRequest('/products/add-by-image', {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to add product by image');
      }

      return await response.json();
    } catch (error) {
      console.error('Error adding product by image:', error);
      throw error;
    }
  }

  // Update product
  static async updateProduct(
    productId: number,
    updates: {
      planned_quantity_grams?: number;
      calories_per_100g?: number;
      protein_per_100g?: number;
      carbs_per_100g?: number;
      fat_per_100g?: number;
    }
  ): Promise<Product> {
    try {
      const response = await authenticatedRequest(`/products/update/${productId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update product');
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }

  // Delete product
  static async deleteProduct(productId: number): Promise<void> {
    try {
      const response = await authenticatedRequest(`/products/remove/${productId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete product');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  // Search products
  static async searchProducts(query: string): Promise<Product[]> {
    try {
      const response = await authenticatedRequest(`/products/search?query=${encodeURIComponent(query)}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to search products');
      }

      const data = await response.json();
      return data.products || data || [];
    } catch (error) {
      console.error('Error searching products:', error);
      throw error;
    }
  }

  // Get product statistics
  static async getStatistics(): Promise<ProductStatistics> {
    try {
      const response = await authenticatedRequest('/products/statistics', {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch statistics');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching statistics:', error);
      throw error;
    }
  }
}

export class MealPlanService {
  // Get meal plans
  static async getMealPlans(isActive?: boolean): Promise<MealPlan[]> {
    try {
      const params = isActive !== undefined ? `?is_active=${isActive}` : '';
      const response = await authenticatedRequest(`/nutrition/plans${params}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch meal plans');
      }

      const data = await response.json();
      return data.plans || data || [];
    } catch (error) {
      console.error('Error fetching meal plans:', error);
      throw error;
    }
  }

  // Create meal plan
  static async createMealPlan(request: CreateMealPlanRequest): Promise<MealPlan> {
    try {
      const response = await authenticatedRequest('/nutrition/plans/create', {
        method: 'POST',
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create meal plan');
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating meal plan:', error);
      throw error;
    }
  }

  // Get meal plan details
  static async getMealPlanDetails(planId: number): Promise<MealPlan> {
    try {
      const response = await authenticatedRequest(`/nutrition/plans/${planId}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch meal plan details');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching meal plan details:', error);
      throw error;
    }
  }

  // Get meal plan summary
  static async getMealPlanSummary(planId: number): Promise<MealPlanSummary> {
    try {
      const response = await authenticatedRequest(`/nutrition/plans/${planId}/summary`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch meal plan summary');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching meal plan summary:', error);
      throw error;
    }
  }

  // Delete meal plan
  static async deleteMealPlan(planId: number): Promise<void> {
    try {
      const response = await authenticatedRequest(`/nutrition/plans/${planId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete meal plan');
      }
    } catch (error) {
      console.error('Error deleting meal plan:', error);
      throw error;
    }
  }
}
