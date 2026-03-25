import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from './foodApi';

const SELECTED_PRODUCTS_KEY = '@selected_products';

export class MealPlannerService {
  //get selected products
  static async getSelectedProducts(): Promise<Product[]> {
    try {
      const stored = await AsyncStorage.getItem(SELECTED_PRODUCTS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get selected products:', error);
      return [];
    }
  }

  //add product to meal plan
  static async addProduct(product: Product): Promise<boolean> {
    try {
      const currentProducts = await this.getSelectedProducts();
      
      //check if the product already exists
      const exists = currentProducts.some(p => p.id === product.id);
      if (exists) {
        return false; //product already exists
      }

      const updatedProducts = [...currentProducts, product];
      await AsyncStorage.setItem(SELECTED_PRODUCTS_KEY, JSON.stringify(updatedProducts));
      return true; //successfully added
    } catch (error) {
      console.error('Failed to add product:', error);
      return false;
    }
  }

  //remove product from meal plan
  static async removeProduct(productId: string): Promise<void> {
    try {
      const currentProducts = await this.getSelectedProducts();
      const updatedProducts = currentProducts.filter(p => p.id !== productId);
      await AsyncStorage.setItem(SELECTED_PRODUCTS_KEY, JSON.stringify(updatedProducts));
    } catch (error) {
      console.error('Failed to remove product:', error);
    }
  }

  //clear all selected products
  static async clearSelectedProducts(): Promise<void> {
    try {
      await AsyncStorage.removeItem(SELECTED_PRODUCTS_KEY);
    } catch (error) {
      console.error('Failed to clear selected products:', error);
    }
  }

  //get count of selected products
  static async getProductCount(): Promise<number> {
    try {
      const products = await this.getSelectedProducts();
      return products.length;
    } catch (error) {
      console.error('Failed to get product count:', error);
      return 0;
    }
  }
}