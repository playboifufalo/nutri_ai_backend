import { IconSymbol } from '@/components/ui/icon-symbol';
import { AuthService } from '@/utils/authService';
import { foodAPI } from '@/utils/foodApi';
import { Product, ProductService } from '@/utils/productService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Modal,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const { width } = Dimensions.get('window');
const STARTER_PRODUCTS = [
  { name: 'Chicken breast', category: 'meat', calories_per_100g: 165, protein_per_100g: 31, carbs_per_100g: 0, fat_per_100g: 3.6 },
  { name: 'Salmon fillet', category: 'fish', calories_per_100g: 208, protein_per_100g: 20, carbs_per_100g: 0, fat_per_100g: 13 },
  { name: 'Brown rice', category: 'grains', calories_per_100g: 123, protein_per_100g: 2.7, carbs_per_100g: 26, fat_per_100g: 1 },
  { name: 'Pasta', category: 'grains', calories_per_100g: 157, protein_per_100g: 5.8, carbs_per_100g: 31, fat_per_100g: 0.9 },
  { name: 'Eggs', category: 'dairy', calories_per_100g: 155, protein_per_100g: 13, carbs_per_100g: 1.1, fat_per_100g: 11 },
  { name: 'Greek yogurt', category: 'dairy', calories_per_100g: 97, protein_per_100g: 9, carbs_per_100g: 3.6, fat_per_100g: 5 },
  { name: 'Broccoli', category: 'vegetables', calories_per_100g: 34, protein_per_100g: 2.8, carbs_per_100g: 7, fat_per_100g: 0.4 },
  { name: 'Spinach', category: 'vegetables', calories_per_100g: 23, protein_per_100g: 2.9, carbs_per_100g: 3.6, fat_per_100g: 0.4 },
  { name: 'Tomatoes', category: 'vegetables', calories_per_100g: 18, protein_per_100g: 0.9, carbs_per_100g: 3.9, fat_per_100g: 0.2 },
  { name: 'Bell peppers', category: 'vegetables', calories_per_100g: 26, protein_per_100g: 1, carbs_per_100g: 6, fat_per_100g: 0.3 },
  { name: 'Olive oil', category: 'oils', calories_per_100g: 884, protein_per_100g: 0, carbs_per_100g: 0, fat_per_100g: 100 },
  { name: 'Oats', category: 'grains', calories_per_100g: 389, protein_per_100g: 17, carbs_per_100g: 66, fat_per_100g: 7 },
  { name: 'Bananas', category: 'fruits', calories_per_100g: 89, protein_per_100g: 1.1, carbs_per_100g: 23, fat_per_100g: 0.3 },
  { name: 'Avocado', category: 'fruits', calories_per_100g: 160, protein_per_100g: 2, carbs_per_100g: 9, fat_per_100g: 15 },
  { name: 'Sweet potato', category: 'vegetables', calories_per_100g: 86, protein_per_100g: 1.6, carbs_per_100g: 20, fat_per_100g: 0.1 },
  { name: 'Onions', category: 'vegetables', calories_per_100g: 40, protein_per_100g: 1.1, carbs_per_100g: 9, fat_per_100g: 0.1 },
  { name: 'Garlic', category: 'vegetables', calories_per_100g: 149, protein_per_100g: 6.4, carbs_per_100g: 33, fat_per_100g: 0.5 },
  { name: 'Cheese', category: 'dairy', calories_per_100g: 402, protein_per_100g: 25, carbs_per_100g: 1.3, fat_per_100g: 33 },
  { name: 'Milk', category: 'dairy', calories_per_100g: 61, protein_per_100g: 3.2, carbs_per_100g: 4.8, fat_per_100g: 3.3 },
  { name: 'Almonds', category: 'nuts', calories_per_100g: 579, protein_per_100g: 21, carbs_per_100g: 22, fat_per_100g: 50 },
];

interface MealPlanDay {
  id: number;
  day_number: number;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  meals: MealPlanMeal[];
}

interface MealPlanMeal {
  id: number;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  meal_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  custom_ingredients: string[];
  custom_instructions: string;
  completed: boolean;
}

interface MealPlan {
  id: number;
  user_id: number;
  total_days: number;
  meals_per_day: number;
  daily_calorie_target: number;
  dietary_restrictions?: string[];
  created_at: string;
  days: MealPlanDay[];
}

export default function ProductListScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(7);
  const [isLoadingStarter, setIsLoadingStarter] = useState(false);

  const loadStarterProducts = async () => {
    setIsLoadingStarter(true);
    try {
      const token = await AuthService.getToken();
      if (!token) {
        const result = await AuthService.createTestUser();
        if (!result.success) {
          Alert.alert('Error', 'Please log in first.');
          setIsLoadingStarter(false);
          return;
        }
      }

      let added = 0;
      for (const product of STARTER_PRODUCTS) {
        try {
          await foodAPI.addScannedProduct(product);
          added++;
        } catch (e) {
          console.warn(`Failed to add starter product "${product.name}":`, e);
        }
      }

      console.log(`Added ${added}/${STARTER_PRODUCTS.length} starter products`);
      await loadProducts();
      Alert.alert('Starter Products Loaded', `${added} products have been added to your list. You can now create a meal plan!`);
    } catch (error: any) {
      console.error('Error loading starter products:', error);
      Alert.alert('Error', error.message || 'Failed to load starter products');
    } finally {
      setIsLoadingStarter(false);
    }
  };
  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [])
  );

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(product => 
        product.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.brand && product.brand.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (product.category && product.category.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredProducts(filtered);
    }
  }, [searchQuery, products]);

  const loadProducts = async () => {
    try {
      console.log('Loading products via ProductService...');
      const token = await AuthService.getToken();
      if (!token) {
        console.log('No token found - skipping product load');
        setProducts([]);
        setIsLoading(false);
        setIsRefreshing(false);
        Alert.alert('Authentication Required', 'Please log in to view your products.');
        return;
      }
      
      const data = await ProductService.getMyProducts();
      setProducts(data || []);
      console.log('Loaded products:', data?.length || 0);
    } catch (error: any) {
      console.error('Error loading products:', error);
      Alert.alert('Error', error.message || 'Error loading products');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadProducts();
  }, []);

  const removeProduct = async (productId: number) => {
    try {
      const product = products.find(p => p.id === productId);
      if (!product) {
        Alert.alert('Error', 'Product not found');
        return;
      }

      console.log('Attempting to remove product:', product.product_name);
      const result = await ProductService.removeScannedProduct(product.product_name);
      console.log('Product removed:', result);
      setProducts(prev => prev.filter(p => p.id !== productId));
      Alert.alert(
        'Success', 
        `${product.product_name} removed from list.\n${result.remaining_products} products remaining.`
      );
    } catch (error: any) {
      console.error('Error removing product:', error);
      let errorMessage = 'Failed to remove product';
      if (error.message) {
        if (error.message.includes('not found')) {
          errorMessage = 'Product not found in scan history';
        } else {
          errorMessage = error.message;
        }
      }
      Alert.alert('Error', errorMessage);
    }
  };
  const createMealPlan = async () => {
    if (products.length === 0) {
      Alert.alert(
        'No Products',
        'Add products first or create a plan without saved products?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Add Products', 
            onPress: () => router.push('/(tabs)/' as any)
          },
          {
            text: 'Create Without Products',
            onPress: () => confirmAndCreatePlan(false)
          }
        ]
      );
      return;
    }
    if (products.length < 5) {
      Alert.alert(
        'Not Enough Products',
        `You have ${products.length} product(s), but at least 5 are needed to create a balanced meal plan.\n\nScan, search, or add more products to continue.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Add More Products', 
            onPress: () => router.push('/scanner/search')
          },
        ]
      );
      return;
    }
    confirmAndCreatePlan(true);
  };

  const confirmAndCreatePlan = async (useSavedProducts: boolean) => {
    // Check if user already has a meal plan
    try {
      const existingPlan = await AsyncStorage.getItem('current_meal_plan');
      if (existingPlan) {
        const parsed = JSON.parse(existingPlan);
        const planName = parsed?.plan_name || parsed?.meal_plan?.plan_name || 'current plan';
        Alert.alert(
          'Replace Existing Plan?',
          `You already have a meal plan ("${planName}"). Creating a new one will replace it.\n\nDo you want to continue?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Replace',
              style: 'destructive',
              onPress: () => createMealPlanV2(useSavedProducts),
            },
          ]
        );
        return;
      }
    } catch {}
    // No existing plan — proceed directly
    createMealPlanV2(useSavedProducts);
  };



  const createMealPlanV2 = async (useSavedProducts: boolean) => {
    setIsCreatingPlan(true);
    try {
      const hasValidToken = await AuthService.ensureValidToken();
      if (!hasValidToken) {
        console.log('Creating test user for meal plan creation...');
        const createResult = await AuthService.createTestUser();
        if (!createResult.success) {
          Alert.alert('Authentication Error', 'Failed to access API');
          setIsCreatingPlan(false);
          return;
        }
      }

      // Fetch user's calorie target from preferences
      let userCalorieTarget = 2000;
      try {
        const { NetworkAutoConfig } = require('@/utils/networkAutoConfig');
        let baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
        try {
          const cfg = await NetworkAutoConfig.getNetworkConfig();
          baseUrl = cfg.apiUrl;
        } catch {}
        const token = await AuthService.getToken();
        if (token) {
          const prefRes = await fetch(`${baseUrl}/preferences/me`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          });
          if (prefRes.ok) {
            const prefs = await prefRes.json();
            if (prefs.caloric_target) {
              userCalorieTarget = prefs.caloric_target;
              console.log('Using user calorie target:', userCalorieTarget);
            }
          }
        }
      } catch (e) {
        console.warn('Could not fetch calorie target, using default 2000:', e);
      }

      console.log('Creating meal plan via /scanner-ai/meal-plan...');
      console.log('Days:', selectedDuration);
      console.log('Use saved products:', useSavedProducts);
      console.log('Calorie target:', userCalorieTarget);

      const createdPlan = await foodAPI.createMealPlan({
        daily_calorie_target: userCalorieTarget,
        days: selectedDuration,
        meals_per_day: 3,
      });
      console.log('Meal plan generated, id:', createdPlan.id);
      await AsyncStorage.setItem('current_meal_plan', JSON.stringify(createdPlan));
      // Reset cooked meals for the new plan
      await AsyncStorage.removeItem('cooked_meals');
      setMealPlan(createdPlan);
      console.log('Reloading products after meal plan creation...');
      await loadProducts();
      
      Alert.alert(
        'Success!', 
        `Meal plan for ${selectedDuration} days has been created!`,
        [
          {
            text: 'View Plan',
            onPress: () => router.push('/scanner/meal-plan'),
            style: 'default'
          },
          {
            text: 'Stay Here',
            style: 'cancel'
          }
        ]
      );
    } catch (error: any) {
      console.error('Error creating meal plan:', error);
      let errorMessage = error.message || 'Failed to create meal plan';
      try {
        const parsed = JSON.parse(errorMessage);
        if (parsed.message) {
          errorMessage = parsed.message;
          if (parsed.suggestion) {
            errorMessage += '\n\n' + parsed.suggestion;
          }
        }
      } catch {
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsCreatingPlan(false);
    }
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const calories = item.calories_per_100g || 0;
    const quantity = item.planned_quantity_grams || 0;
    const totalCalories = Math.round(calories * quantity / 100);
    const sourceIcon = '';
    
    return (
      <View style={styles.productCard}>
        <View style={styles.productHeader}>
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{item.product_name}</Text>
            {item.brand && (
              <Text style={styles.productBrand}>{item.brand}</Text>
            )}
            <Text style={styles.productCategory}>{item.category}</Text>
          </View>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => {
              Alert.alert(
                'Remove Product',
                `Remove "${item.product_name}" from the list?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => removeProduct(item.id) }
                ]
              );
            }}
          >
            <IconSymbol name="trash" size={18} color="#E74C3C" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.nutritionRow}>
          <Text style={styles.nutritionText}>
            {quantity}g • {totalCalories} kcal
          </Text>
          <Text style={styles.nutritionText}>
            P: {Math.round((item.protein_per_100g || 0) * quantity / 100)}g •
            F: {Math.round((item.fat_per_100g || 0) * quantity / 100)}g •
            C: {Math.round((item.carbs_per_100g || 0) * quantity / 100)}g
          </Text>
        </View>
      </View>
    );
  };

  const renderMealPlan = () => {
    if (!mealPlan) return null;

    return (
      <ScrollView style={styles.mealPlanContainer}>
        <Text style={styles.mealPlanTitle}>Meal Plan ({mealPlan.total_days} days)</Text>
        <Text style={styles.mealPlanDescription}>
          Target: {mealPlan.daily_calorie_target} kcal/day • {mealPlan.meals_per_day} meals/day
        </Text>
        
        {mealPlan.days?.map((day: MealPlanDay) => (
          <View key={day.day_number} style={{ marginBottom: 16 }}>
            <Text style={styles.mealHeader}>
              Day {day.day_number} • {day.total_calories} kcal
            </Text>
            <Text style={styles.nutritionValue}>
              P: {day.total_protein}g • C: {day.total_carbs}g • F: {day.total_fat}g
            </Text>
            
            {day.meals?.map((meal: MealPlanMeal) => (
              <View key={meal.id} style={styles.mealCard}>
                <Text style={styles.mealHeader}>
                  {getMealTypeLabel(meal.meal_type)}
                </Text>
                <Text style={styles.mealRecipe}>{meal.meal_name}</Text>
                
                {meal.custom_ingredients && meal.custom_ingredients.length > 0 && (
                  <>
                    <Text style={styles.ingredientsTitle}>Ingredients:</Text>
                    {meal.custom_ingredients.map((ingredient: string, idx: number) => (
                      <Text key={idx} style={styles.ingredient}>• {ingredient}</Text>
                    ))}
                  </>
                )}
                
                {meal.custom_instructions && (
                  <>
                    <Text style={styles.stepsTitle}>Instructions:</Text>
                    {meal.custom_instructions.split('\n').map((step: string, idx: number) => (
                      <Text key={idx} style={styles.step}>{step}</Text>
                    ))}
                  </>
                )}
                
                <View style={styles.mealNutrition}>
                  <Text style={styles.nutritionTitle}>Per serving:</Text>
                  <Text style={styles.nutritionValue}>
                    {meal.calories} kcal • 
                    P: {meal.protein}g • 
                    F: {meal.fat}g • 
                    C: {meal.carbs}g
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    );
  };

  const getMealTypeLabel = (mealType: string) => {
    const labels: { [key: string]: string } = {
      breakfast: 'Breakfast',
      lunch: 'Lunch', 
      dinner: 'Dinner',
      snack: 'Snack'
    };
    return labels[mealType] || mealType;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/' as any)} style={styles.homeButton}>
            <IconSymbol name="house.fill" size={20} color="#6366F1" />
            <Text style={styles.homeButtonText}>Home</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>My Products</Text>
        <Text style={styles.subtitle}>
          {products.length} products in list
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <IconSymbol name="magnifyingglass" size={20} color="#7F8C8D" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {isCreatingPlan ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingTitle}>Your meal plan is being prepared</Text>
          <Text style={styles.loadingText}>
            Creating a personalized meal plan based on your products...
          </Text>
        </View>
      ) : mealPlan ? renderMealPlan() : (
        <>
          {/* Products List */}
          <FlatList
            data={filteredProducts}
            renderItem={renderProduct}
            keyExtractor={(item) => item.id.toString()}
            style={styles.productsList}
            contentContainerStyle={styles.productsListContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                colors={['#4A90E2']}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>List is Empty</Text>
                <Text style={styles.emptyText}>
                  Add products using the scanner or load a starter set
                </Text>

                <TouchableOpacity
                  style={styles.starterButton}
                  onPress={loadStarterProducts}
                  disabled={isLoadingStarter}
                >
                  {isLoadingStarter ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <IconSymbol name="sparkles" size={20} color="#FFFFFF" />
                  )}
                  <Text style={styles.starterButtonText}>
                    {isLoadingStarter ? 'Loading...' : 'Load Starter Products (20)'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => router.push('/(tabs)/' as any)}
                >
                  <Text style={styles.addButtonText}>Scan Products</Text>
                </TouchableOpacity>
              </View>
            }
          />

          {/* Actions */}
          {products.length > 0 && (
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={styles.addMoreButton}
                onPress={() => router.push('/(tabs)/' as any)}
              >
                <IconSymbol name="plus.circle" size={20} color="#4A90E2" />
                <Text style={styles.addMoreText}>Add More Products</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.createPlanButton, isCreatingPlan && styles.disabledButton]}
                onPress={() => setShowPlanModal(true)}
                disabled={isCreatingPlan}
              >
                {isCreatingPlan ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <IconSymbol name="fork.knife.circle" size={20} color="#FFFFFF" />
                )}
                <Text style={styles.createPlanText}>
                  {isCreatingPlan ? 'Creating plan...' : 'Create Meal Plan'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      
      <Modal
        animationType="slide"
        transparent={true}
        visible={showPlanModal}
        onRequestClose={() => setShowPlanModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Meal Plan Duration</Text>
            
            <View style={styles.durationContainer}>
              {[3, 7, 14, 30].map((days) => (
                <TouchableOpacity
                  key={days}
                  style={[
                    styles.durationButton,
                    selectedDuration === days && styles.selectedDurationButton
                  ]}
                  onPress={() => setSelectedDuration(days)}
                >
                  <Text style={[
                    styles.durationButtonText,
                    selectedDuration === days && styles.selectedDurationButtonText
                  ]}>
                    {days === 3 ? '3 Days' : 
                     days === 7 ? '1 Week' :
                     days === 14 ? '2 Weeks' : '1 Month'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowPlanModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => {
                  setShowPlanModal(false);
                  createMealPlan();
                }}
              >
                <Text style={styles.confirmButtonText}>Create Plan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 40,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    lineHeight: 22,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 4,
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#7F8C8D',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginVertical: 15,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#2C3E50',
  },
  productsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  productsListContent: {
    paddingBottom: 20,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  productBrand: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 12,
    color: '#95A5A6',
  },
  removeButton: {
    padding: 8,
  },
  nutritionRow: {
    gap: 4,
  },
  nutritionText: {
    fontSize: 12,
    color: '#34495E',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  starterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  starterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E1E8ED',
    gap: 12,
  },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F4FD',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  addMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A90E2',
  },
  createPlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27AE60',
    paddingVertical: 15,
    borderRadius: 12,
    gap: 8,
  },
  disabledButton: {
    backgroundColor: '#95A5A6',
  },
  createPlanText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  mealPlanContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  mealPlanTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#27AE60',
    marginBottom: 8,
    textAlign: 'center',
  },
  mealPlanDescription: {
    fontSize: 14,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 20,
  },
  mealCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  mealHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#27AE60',
    marginBottom: 8,
  },
  mealRecipe: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 12,
  },
  ingredientsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34495E',
    marginBottom: 8,
    marginTop: 8,
  },
  ingredient: {
    fontSize: 13,
    color: '#7F8C8D',
    marginBottom: 4,
    marginLeft: 8,
  },
  stepsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34495E',
    marginBottom: 8,
    marginTop: 12,
  },
  step: {
    fontSize: 13,
    color: '#7F8C8D',
    marginBottom: 6,
    lineHeight: 18,
  },
  mealNutrition: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E1E8ED',
  },
  nutritionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#34495E',
    marginBottom: 4,
  },
  nutritionValue: {
    fontSize: 12,
    color: '#7F8C8D',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    width: width * 0.85,
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 20,
    textAlign: 'center',
  },
  durationContainer: {
    gap: 12,
    marginBottom: 24,
  },
  durationButton: {
    backgroundColor: '#F8F9FA',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E8ED',
  },
  selectedDurationButton: {
    backgroundColor: '#E8F4FD',
    borderColor: '#4A90E2',
  },
  durationButtonText: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    fontWeight: '500',
  },
  selectedDurationButtonText: {
    color: '#4A90E2',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E1E8ED',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#27AE60',
    paddingVertical: 14,
    borderRadius: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '600',
  },
});