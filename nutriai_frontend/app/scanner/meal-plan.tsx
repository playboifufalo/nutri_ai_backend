import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');

interface MealPlan {
  success?: boolean;
  message?: string;
  meal_plan_id?: number;
  plan_name?: string;
  total_days?: number;
  meals_per_day?: number;
  products_used?: number;
  meal_plan?: {
    id: number;
    user_id: number;
    plan_name: string;
    total_days: number;
    meals_per_day: number;
    daily_calorie_target?: number;
    dietary_restrictions?: string[];
    cuisine_preference?: string;
    is_active: boolean;
    created_at: string;
    days: MealPlanDay[];
  };
  user_id?: number;
  ai_powered?: boolean;
  generated_at?: string;
  user_data?: {
    daily_calories?: number;
    diet_type?: string;
    goal?: string;
    ingredients_count?: number;
    time_period?: number;
    allergies_count?: number;
  };
}

interface MealPlanDay {
  id?: number;
  day_number: number;
  day_name?: string;
  date?: string | null;
  total_calories: number;
  total_protein?: number;
  total_carbs?: number;
  total_fat?: number;
  notes?: string | null;
  meals: MealPlanMeal[];
  daily_calories?: number;
  daily_nutrition?: {
    protein: number;
    carbs: number;
    fat: number;
  };
}

interface MealPlanMeal {
  id?: number;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  meal_name?: string;
  meal_order?: number;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  serving_size_multiplier?: number;
  completed?: boolean;
  completed_at?: string | null;
  notes?: string | null;
  recipe_id?: number | null;
  recipe?: any | null;
  custom_ingredients: string[];
  custom_instructions?: string;
  source_url?: string | null;
  prep_time?: number | null;
  cook_time?: number | null;
  recipe_name?: string;
  ingredients?: string[];
  estimated_calories?: number;
  estimated_nutrition?: {
    protein: number;
    carbs: number;
    fat: number;
  };
}

const MEAL_TYPE_NAMES = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

const MEAL_TYPE_ICONS = {
  breakfast: 'sunny-outline',
  lunch: 'restaurant-outline', 
  dinner: 'moon-outline',
  snack: 'leaf-outline',
};

export default function MealPlanScreen() {
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(1);
  const [cookedMeals, setCookedMeals] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadMealPlan();
    loadCookedMeals();
  }, []);

  const loadMealPlan = async () => {
    try {
      const planData = await AsyncStorage.getItem('current_meal_plan');
      if (planData) {
        setMealPlan(JSON.parse(planData));
      }
    } catch (error) {
      console.error('Failed to load meal plan:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCookedMeals = async () => {
    try {
      const data = await AsyncStorage.getItem('cooked_meals');
      if (data) {
        setCookedMeals(JSON.parse(data));
      }
    } catch (error) {
      console.error('Failed to load cooked meals:', error);
    }
  };

  const toggleCooked = async (dayNumber: number, mealType: string, index: number) => {
    const key = `${dayNumber}-${mealType}-${index}`;
    const updated = { ...cookedMeals, [key]: !cookedMeals[key] };
    setCookedMeals(updated);
    try {
      await AsyncStorage.setItem('cooked_meals', JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save cooked state:', error);
    }
  };

  const getDayMeals = (dayNumber: number): MealPlanMeal[] => {
    if (!mealPlan) return [];

    const days = (mealPlan as any).days || mealPlan.meal_plan?.days || [];
    const day = days.find((d: MealPlanDay) => d.day_number === dayNumber); //handle documented structure: { days: [...] } or legacy { meal_plan: { days: [...] } }
    return day ? day.meals : [];
  };

  const renderDaySelector = () => {
    if (!mealPlan) return null;
    const totalDays = mealPlan.total_days || (mealPlan as any).total_days || mealPlan.meal_plan?.total_days || mealPlan.user_data?.time_period || 3;
    const days = Array.from({ length: totalDays }, (_, i) => i + 1);
    
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.daySelector}
        contentContainerStyle={styles.daySelectorContent}
      >
        {days.map(day => (
          <TouchableOpacity
            key={day}
            style={[
              styles.dayButton,
              selectedDay === day && styles.selectedDayButton
            ]}
            onPress={() => setSelectedDay(day)}
          >
            <Text style={[
              styles.dayButtonText,
              selectedDay === day && styles.selectedDayButtonText
            ]}>
              Day {day}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderMeal = ({ item, index }: { item: MealPlanMeal; index: number }) => {
    const totalTime = (item.prep_time || 0) + (item.cook_time || 0);
    const cookedKey = `${selectedDay}-${item.meal_type}-${index}`;
    const isCooked = !!cookedMeals[cookedKey];
    
    const openRecipeDetail = () => {
      router.push({
        pathname: '/scanner/recipe-detail' as any,
        params: { meal: JSON.stringify(item) },
      });
    };

    return (
      <TouchableOpacity 
        style={[styles.mealCard, isCooked && styles.mealCardCooked]} 
        onPress={openRecipeDetail} 
        activeOpacity={0.7}
      >
        <View style={styles.mealHeader}>
          <View style={styles.mealTypeContainer}>
            <Ionicons
              name={MEAL_TYPE_ICONS[item.meal_type] as keyof typeof Ionicons.glyphMap}
              size={20}
              color={isCooked ? '#9CA3AF' : '#27AE60'}
            />
            <Text style={[styles.mealType, isCooked && styles.mealTypeCooked]}>
              {MEAL_TYPE_NAMES[item.meal_type]}
            </Text>
          </View>
          <View style={styles.mealHeaderRight}>
            <Text style={styles.mealCalories}>
              {item.calories || item.estimated_calories || 0} kcal
            </Text>
            <TouchableOpacity
              style={[styles.cookedButton, isCooked && styles.cookedButtonActive]}
              onPress={(e) => {
                e.stopPropagation?.();
                toggleCooked(selectedDay, item.meal_type, index);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={isCooked ? 'checkmark-circle' : 'checkmark-circle-outline'}
                size={26}
                color={isCooked ? '#10B981' : '#D1D5DB'}
              />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.recipeName, isCooked && styles.recipeNameCooked]}>
          {item.meal_name || item.recipe_name}
        </Text>

        {totalTime > 0 && (
          <View style={styles.timeInfo}>
            <Ionicons name="time-outline" size={14} color="#6B7280" />
            <Text style={styles.timeInfoText}>{totalTime} min</Text>
          </View>
        )}

        <View style={styles.ingredientsSection}>
          <Text style={styles.sectionTitle}>
            Ingredients ({(item.custom_ingredients || item.ingredients || []).length}):
          </Text>
          {(item.custom_ingredients || item.ingredients || []).slice(0, 4).map((ingredient: string, index: number) => (
            <Text key={index} style={styles.ingredient}>
              • {ingredient}
            </Text>
          ))}
          {(item.custom_ingredients || item.ingredients || []).length > 4 && (
            <Text style={styles.moreIngredients}>
              and {(item.custom_ingredients || item.ingredients || []).length - 4} more...
            </Text>
          )}
        </View>

        {/* Tap hint */}
        <View style={styles.tapHint}>
          <Text style={styles.tapHintText}>Tap for recipe details</Text>
          <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#27AE60" />
        <Text style={styles.loadingText}>Loading meal plan...</Text>
      </View>
    );
  }

  if (!mealPlan) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={{ width: 36 }} />
          
          <Text style={styles.headerTitle}>Meal Plan</Text>
          
          <TouchableOpacity 
            style={styles.homeButton}
            onPress={() => router.replace('/(tabs)/' as any)}
          >
            <Ionicons name="home" size={20} color="#6366F1" />
          </TouchableOpacity>
        </View>

        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Meal Plan Not Found</Text>
          <Text style={styles.emptyText}>
            Create a meal plan from your product list
          </Text>
          <TouchableOpacity
            style={styles.createPlanButton}
            onPress={() => router.push('/scanner/product-list')}
          >
            <Text style={styles.createPlanButtonText}>Go to Products</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const dayMeals = getDayMeals(selectedDay);
  const totalCalories = dayMeals.reduce((sum, meal) => sum + (meal.calories || meal.estimated_calories || 0), 0);
  
  // Count cooked meals for current day
  const cookedCount = dayMeals.filter((meal, index) => {
    const key = `${selectedDay}-${meal.meal_type}-${index}`;
    return !!cookedMeals[key];
  }).length;

  // Get plan info from documented or legacy structure
  const planName = mealPlan.plan_name || mealPlan.meal_plan?.plan_name || 'Meal Plan';
  const totalDays = mealPlan.total_days || (mealPlan as any).total_days || mealPlan.meal_plan?.total_days || mealPlan.user_data?.time_period || 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ width: 36 }} />
        
        <Text style={styles.headerTitle}>Meal Plan</Text>
        
        <TouchableOpacity 
          style={styles.homeButton}
          onPress={() => router.replace('/(tabs)/' as any)}
        >
          <Ionicons name="home" size={20} color="#6366F1" />
        </TouchableOpacity>
      </View>

      <View style={styles.planInfo}>
        <Text style={styles.planName}>{planName}</Text>
        {totalDays > 0 && (
          <Text style={styles.planDuration}>Duration: {totalDays} days</Text>
        )}
      </View>

      {renderDaySelector()}

      <View style={styles.dayInfo}>
        <View>
          <Text style={styles.selectedDayTitle}>Day {selectedDay}</Text>
          {cookedCount > 0 && (
            <Text style={styles.cookedCountText}>
              ✅ {cookedCount}/{dayMeals.length} cooked
            </Text>
          )}
        </View>
        <Text style={styles.totalCalories}>Total: {totalCalories} kcal</Text>
      </View>

      <FlatList
        data={dayMeals}
        renderItem={renderMeal}
        keyExtractor={(item, index) => `${selectedDay}-${item.meal_type}-${index}`}
        style={styles.mealsList}
        contentContainerStyle={styles.mealsListContent}
        showsVerticalScrollIndicator={false}
      />
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
    backgroundColor: '#F8F9FA',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#7F8C8D',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: '#4A90E2',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  homeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0EDFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  planInfo: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
  },
  planName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 8,
  },
  planDescription: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 8,
  },
  planDuration: {
    fontSize: 14,
    color: '#27AE60',
    fontWeight: '600',
  },
  daySelector: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
  },
  daySelectorContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  dayButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E1E8ED',
  },
  selectedDayButton: {
    backgroundColor: '#E8F4FD',
    borderColor: '#4A90E2',
  },
  dayButtonText: {
    fontSize: 14,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  selectedDayButtonText: {
    color: '#4A90E2',
    fontWeight: '600',
  },
  dayInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
  },
  selectedDayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  totalCalories: {
    fontSize: 16,
    color: '#27AE60',
    fontWeight: '600',
  },
  mealsList: {
    flex: 1,
  },
  mealsListContent: {
    padding: 20,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mealTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mealType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#27AE60',
  },
  mealCalories: {
    fontSize: 14,
    color: '#E67E22',
    fontWeight: '600',
    backgroundColor: '#FDF2E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  recipeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 12,
  },
  ingredientsSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34495E',
    marginBottom: 8,
  },
  ingredient: {
    fontSize: 13,
    color: '#7F8C8D',
    marginBottom: 4,
    paddingLeft: 8,
  },
  moreIngredients: {
    fontSize: 13,
    color: '#4A90E2',
    fontStyle: 'italic',
    paddingLeft: 8,
  },
  nutritionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#E1E8ED',
    paddingTop: 12,
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginBottom: 4,
  },
  nutritionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 24,
  },
  createPlanButton: {
    backgroundColor: '#27AE60',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createPlanButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  preparationNote: {
    fontSize: 12,
    color: '#7F8C8D',
    fontStyle: 'italic',
    marginTop: 8,
  },
  mealHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  timeInfoText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginTop: 4,
  },
  tapHintText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  mealCardCooked: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    opacity: 0.85,
  },
  mealTypeCooked: {
    color: '#9CA3AF',
  },
  recipeNameCooked: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through' as const,
  },
  cookedButton: {
    padding: 2,
  },
  cookedButtonActive: {
    transform: [{ scale: 1.1 }],
  },
  cookedCountText: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 2,
  },
});