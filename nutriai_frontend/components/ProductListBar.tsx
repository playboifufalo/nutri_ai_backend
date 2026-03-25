import { AuthService } from '@/utils/authService';
import { Product, ProductService } from '@/utils/productService';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ProductListBarProps {
  onProductsLoaded?: (count: number) => void;
}

export default function ProductListBar({ onProductsLoaded }: ProductListBarProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('ProductListBar: Loading products...');
      
      //check token BEFORE attempting to load
      const token = await AuthService.getToken();
      console.log('ProductListBar: Token exists:', !!token);
      
      if (!token) {
        console.log('ProductListBar: No token - skipping product load (user not logged in)');
        setProducts([]);
        onProductsLoaded?.(0);
        setIsLoading(false);
        return;
      }
      
      if (token) {
        console.log('ProductListBar: Token preview:', token.substring(0, 30) + '...');
        
        //check token payload
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          console.log('ProductListBar: Token payload:', JSON.stringify(payload));
        } catch (e) {
          console.error('ProductListBar: Failed to decode token:', e);
        }
      }
      
      const products = await ProductService.getMyProducts();
      console.log('ProductListBar: Products loaded:', products?.length, products);
      setProducts(products);
      onProductsLoaded?.(products.length);
    } catch (err: any) {
      console.error('ProductListBar: Error loading products:', err);
      console.error('ProductListBar: Error message:', err.message);
      console.error('ProductListBar: Error stack:', err.stack);
      setError(err.message || 'Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const getTotalStats = () => {
    if (products.length === 0) return null;

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    products.forEach(product => {
      const grams = product.planned_quantity_grams || 100;
      const multiplier = grams / 100;

      totalCalories += (product.calories_per_100g || 0) * multiplier;
      totalProtein += (product.protein_per_100g || 0) * multiplier;
      totalCarbs += (product.carbs_per_100g || 0) * multiplier;
      totalFat += (product.fat_per_100g || 0) * multiplier;
    });

    return {
      calories: Math.round(totalCalories),
      protein: Math.round(totalProtein),
      carbs: Math.round(totalCarbs),
      fat: Math.round(totalFat),
    };
  };

  const handleDebugToken = async () => {
    const token = await AuthService.getToken();
    if (!token) {
      Alert.alert('Debug', 'No token found! Trying to login...');
      const result = await AuthService.createTestUser();
      Alert.alert('Login Result', JSON.stringify(result));
      await loadProducts();
    } else {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        Alert.alert('Token Info', `Token exists!\n\nPayload:\n${JSON.stringify(payload, null, 2)}`);
      } catch (e) {
        Alert.alert('Token Error', 'Failed to decode token: ' + e);
      }
    }
  };

  const getSourceIcon = (source: string): { name: keyof typeof Ionicons.glyphMap; color: string } => {
    switch (source) {
      case 'barcode': return { name: 'barcode-outline', color: '#6366F1' };
      case 'ai_scan': return { name: 'scan-outline', color: '#10B981' };
      case 'manual': return { name: 'create-outline', color: '#F59E0B' };
      default: return { name: 'cube-outline', color: '#94A3B8' };
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>My Products</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#6366F1" />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>My Products</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={28} color="#F59E0B" />
          <Text style={styles.errorText}>{error}</Text>
          <View style={styles.errorButtons}>
            <TouchableOpacity style={styles.retryButton} onPress={loadProducts}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.debugButton} onPress={handleDebugToken}>
              <Text style={styles.debugButtonText}>Debug Token</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (products.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>My Products</Text>
          <Text style={styles.count}>0 items</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="cube-outline" size={28} color="#94A3B8" />
          <Text style={styles.emptyText}>No products yet</Text>
          <Text style={styles.emptySubtext}>Start by scanning or adding products</Text>
        </View>
      </View>
    );
  }

  const stats = getTotalStats();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Products</Text>
          <Text style={styles.subtitle}>{products.length} items</Text>
        </View>
        <TouchableOpacity 
          style={styles.viewAllButton}
          onPress={() => router.push('/scanner/product-list')}
        >
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      {stats && (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.calories}</Text>
            <Text style={styles.statLabel}>kcal</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.protein}g</Text>
            <Text style={styles.statLabel}>protein</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.carbs}g</Text>
            <Text style={styles.statLabel}>carbs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.fat}g</Text>
            <Text style={styles.statLabel}>fat</Text>
          </View>
        </View>
      )}

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.productsList}
        contentContainerStyle={styles.productsListContent}
      >
        {products.map((product, index) => (
          <TouchableOpacity
            key={product.id || index}
            style={styles.productCard}
            onPress={() => router.push(`/scanner/product?id=${product.id}`)}
          >
            <View style={styles.productHeader}>
              <Ionicons name={getSourceIcon(product.source).name} size={16} color={getSourceIcon(product.source).color} />
              {product.category && (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{product.category}</Text>
                </View>
              )}
            </View>
            <Text style={styles.productName} numberOfLines={2}>
              {product.product_name}
            </Text>
            {product.brand && (
              <Text style={styles.productBrand} numberOfLines={1}>
                {product.brand}
              </Text>
            )}
            <View style={styles.productFooter}>
              <Text style={styles.productCalories}>
                {product.calories_per_100g || 0} kcal
              </Text>
              {product.planned_quantity_grams && (
                <Text style={styles.productQuantity}>
                  {product.planned_quantity_grams}g
                </Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity 
        style={styles.createPlanButton}
        onPress={() => router.push('/scanner/meal-plan')}
      >
        <Text style={styles.createPlanIcon}>✨</Text>
        <Text style={styles.createPlanText}>Create Meal Plan</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  count: {
    fontSize: 14,
    color: '#6B7280',
  },
  viewAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
  },
  productsList: {
    marginVertical: 8,
  },
  productsListContent: {
    paddingRight: 16,
  },
  productCard: {
    width: 140,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  productIcon: {
    fontSize: 24,
  },
  categoryBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 10,
    color: '#1E40AF',
    fontWeight: '600',
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
    minHeight: 36,
  },
  productBrand: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  productCalories: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366F1',
  },
  productQuantity: {
    fontSize: 12,
    color: '#6B7280',
  },
  createPlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  createPlanIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  createPlanText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  debugButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  debugButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
