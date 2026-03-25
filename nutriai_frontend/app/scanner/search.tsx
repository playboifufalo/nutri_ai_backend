import { ProductCard } from '@/components/product-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { foodAPI, Product } from '@/utils/foodApi';
import { MealPlannerService } from '@/utils/mealPlannerService';
import { preferencesApi } from '@/utils/preferencesApi';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

export default function ProductSearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false); 
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [debounceTimeout, setDebounceTimeout] = useState<number | null>(null);
  const [showMockDataWarning, setShowMockDataWarning] = useState(false);
  const [lastSearchedQuery, setLastSearchedQuery] = useState(''); 

  useEffect(() => {
    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, []);

  const loadInitialProducts = async () => {
    setIsLoading(true);
    try {
      const response = await foodAPI.getAllProducts(1, 20);
      setProducts(response.products);
      setTotalCount(response.total_count);
      setCurrentPage(1);
      setHasMore(response.products.length < response.total_count);
    } catch (error) {
      console.error('Failed to load products:', error);
      Alert.alert('Error', 'Failed to load products. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (text: string) => {
    setSearchQuery(text);
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
    if (text.trim() === '') {
      setProducts([]);
      setTotalCount(0);
      setHasMore(false);
      setIsSearching(false);
      return;
    }


    if (text.trim().length < 3) {
      return;
    }



    if (text.trim().toLowerCase() === lastSearchedQuery.trim().toLowerCase()) {
      return;
    }
    


    setIsSearching(true);
    const newTimeout = setTimeout(async () => {
      await performSearch(text);
    }, 800) as unknown as number;
    
    setDebounceTimeout(newTimeout);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
    
    const newTimeout = setTimeout(async () => {
      await performSearch(query);
    }, 800);
    
    setDebounceTimeout(newTimeout);
  };

  const performSearch = async (query: string) => {
    if (query.trim() === '') {
      setProducts([]);
      setTotalCount(0);
      setHasMore(false);
      setIsSearching(false);
      return;
    }

    if (query.trim().length < 3) {
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    setShowMockDataWarning(false); //inline check for mock data in search results and show warning if detected (instead of showing alert for every search error)
    
    try {
      const response = await foodAPI.searchProducts(query, 1, 20);
      const isMockData = response.products.some(p => p.id.startsWith('mock-'));
      if (isMockData && query.trim().length > 0) {
        setShowMockDataWarning(true);
      }
      
      setProducts(response.products);
      setTotalCount(response.total_count);
      setCurrentPage(1);
      setHasMore(response.products.length < response.total_count);
      setLastSearchedQuery(query);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
      setIsLoading(false);
    }
  };



  const loadMoreProducts = async () => {
    if (!hasMore || isLoading) return;

    setIsLoading(true);
    try {
      const nextPage = currentPage + 1;
      let response;
      if (searchQuery.trim() === '') {
        response = await foodAPI.getAllProducts(nextPage, 20);
      } else {
        response = await foodAPI.searchProducts(searchQuery, nextPage, 20);
      }
      setProducts(prev => [...prev, ...response.products]);
      setCurrentPage(nextPage);
      setHasMore(products.length + response.products.length < response.total_count);
    } catch (error) {
      console.error('Failed to load more products:', error);
    } finally {
      setIsLoading(false);
    }
  };





  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (searchQuery.trim() === '') {
      setProducts([]);
      setTotalCount(0);
      setHasMore(false);
    } else {
      await handleSearch(searchQuery);
    }
    setIsRefreshing(false);
  };

  
  const handleProductSelect = (product: Product) => {
    Alert.alert(
      product.name,
      `Brand: ${product.brand || 'N/A'}\nCategory: ${product.category || 'N/A'}\nCalories: ${product.nutritional_info?.calories || 'N/A'} per ${product.serving_size || '100g'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add to Meal Plan', onPress: () => addToMealPlan(product) },
        { text: 'Add to Liked', onPress: () => addToLiked(product) },
        { text: 'View Details', onPress: () => viewProductDetails(product) }
      ]
    );
  };




  
  const addToMealPlan = async (product: Product) => {
    try {
      //Save to backend (persistent storage)
      await foodAPI.addScannedProduct({
        name: product.name,
        brand: product.brand,
        category: product.category,
        calories_per_100g: product.nutritional_info?.calories || 0,
        protein_per_100g: product.nutritional_info?.protein || 0,
        carbs_per_100g: product.nutritional_info?.carbs || 0,
        fat_per_100g: product.nutritional_info?.fat || 0,
      });

      //Also save locally for quick access
      await MealPlannerService.addProduct(product);
      
      Alert.alert(
        'Success', 
        `${product.name} added to your product list!`,
        [
          { text: 'Continue Shopping', style: 'default' },
          { text: 'View Products', onPress: () => router.push('/scanner/product-list' as any) }
        ]
      );
    } catch (error) {
      console.error('Failed to add to meal plan:', error);
      Alert.alert('Error', 'Failed to add product. Please try again.');
    }
  };

  const addToLiked = async (product: Product) => {
    try {
      await preferencesApi.addLikedProduct(product.name);
      Alert.alert('Success', `${product.name} added to your liked products!`);
    } catch (error) {
      console.error('Failed to add to liked products:', error);
      Alert.alert('Error', 'Failed to add product to liked products.');
    }
  };




  const viewProductDetails = (product: Product) => { //here we can format the product details in a more readable way for the alert
    const detailsText = `
        Product: ${product.name}
        Brand: ${product.brand || 'N/A'}
        Category: ${product.category || 'N/A'}
        Barcode: ${product.barcode || 'N/A'}

        Nutrition (per ${product.serving_size || '100g'}):
        Calories: ${product.nutritional_info?.calories || 'N/A'} 
        Protein: ${product.nutritional_info?.protein || 'N/A'}g
        Carbs: ${product.nutritional_info?.carbs || 'N/A'}g
        Fat: ${product.nutritional_info?.fat || 'N/A'}g
        Fiber: ${product.nutritional_info?.fiber || 'N/A'}g
        Sugar: ${product.nutritional_info?.sugar || 'N/A'}g
        Sodium: ${product.nutritional_info?.sodium || 'N/A'}mg

        ${product.allergens?.length ? `Allergens: ${product.allergens.join(', ')}` : 'No allergens listed'}
        ${product.ingredients?.length ? `\nIngredients: ${product.ingredients.join(', ')}` : ''}
            `;
            
            Alert.alert('Product Details', detailsText.trim());
          };




          
  const renderProduct = ({ item }: { item: Product }) => (
    <ProductCard
      product={item}
      onPress={handleProductSelect}
    />
  );



  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.backButtonContainer}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/' as any)} style={styles.homeButton}>
          <IconSymbol name="house.fill" size={20} color="#6366F1" />
          <ThemedText style={styles.homeButtonText}>Home</ThemedText>
        </TouchableOpacity>
      </View>
      
      <View style={styles.searchContainer}>
        <IconSymbol name="magnifyingglass" size={20} color="#888" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products by name..."
          value={searchQuery}
          onChangeText={handleInputChange}
          placeholderTextColor="#888"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => {
            setSearchQuery('');
            if (debounceTimeout) {
              clearTimeout(debounceTimeout);
            }
            setProducts([]);
            setTotalCount(0);
            setHasMore(false);
            setIsSearching(false);
            setLastSearchedQuery('');
          }}>
            <IconSymbol name="xmark.circle.fill" size={20} color="#888" />
          </TouchableOpacity>
        )}
      </View>
      
      {showMockDataWarning && (
        <View style={styles.warningBanner}>
          <IconSymbol name="exclamationmark.triangle.fill" size={16} color="#FF9500" />
          <ThemedText style={styles.warningText}>
            External product database is unavailable. Showing demo data. Please try again later.
          </ThemedText>
        </View>
      )}
      
      <View style={styles.resultsInfo}>
        {isSearching ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#6366F1" style={{ marginRight: 8 }} />
            <ThemedText style={styles.resultsText}>Searching...</ThemedText>
          </View>
        ) : (
          <>
            {(totalCount > 0 || lastSearchedQuery) && (
              <ThemedText style={styles.resultsText}>
                {totalCount} products found
              </ThemedText>
            )}
            {lastSearchedQuery ? (
              <ThemedText style={styles.searchQueryText}>
                {' '}for "{lastSearchedQuery}"
              </ThemedText>
            ) : null}
          </>
        )}
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!isLoading || isRefreshing) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#007AFF" />
        <ThemedText style={styles.loadingText}>Loading more products...</ThemedText>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <IconSymbol name="magnifyingglass" size={48} color="#999" />
              <ThemedText style={styles.emptyTitle}>
                {searchQuery.trim().length > 0
                  ? 'No products found'
                  : 'Search for products'}
              </ThemedText>
              <ThemedText style={styles.emptySubtitle}>
                {searchQuery.trim().length > 0
                  ? 'Try a different search query'
                  : 'Type at least 3 characters to start searching'}
              </ThemedText>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
          />
        }
        onEndReached={loadMoreProducts}
        onEndReachedThreshold={0.1}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  header: {
    marginBottom: 16,
    paddingTop: 16,
  },
  backButtonContainer: {
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 4,
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F0EDFF',
    borderRadius: 8,
    gap: 4,
  },
  homeButtonText: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#856404',
    lineHeight: 18,
  },
  resultsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  resultsText: {
    fontSize: 14,
    color: '#666',
    marginRight: 4,
  },
  searchQueryText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});