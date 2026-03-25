import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

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
    is_active: boolean;
    created_at: string;
    days: Array<{
      id: number;
      day_number: number;
      day_name: string;
      total_calories: number;
      total_protein: number;
      total_carbs: number;
      total_fat: number;
      meals: Array<{
        id: number;
        meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
        meal_name: string;
        meal_order: number;
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        custom_ingredients: string[];
        custom_instructions: string;
        source_url?: string | null;
      }>;
    }>;
  };
}

const MEAL_TYPE_NAMES = {
  breakfast: 'Breakfast',
  lunch: 'Lunch', 
  dinner: 'Dinner',
  snack: 'Snack',
};

export default function MealPlanWidget() {
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [todayMeals, setTodayMeals] = useState<any[]>([]);

  useEffect(() => {
    loadMealPlan();
  }, []);

  const loadMealPlan = async () => {
    try {
      const planData = await AsyncStorage.getItem('current_meal_plan');
      if (planData) {
        const plan = JSON.parse(planData);
        console.log('MealPlanWidget: Loaded plan structure:', Object.keys(plan));
        
        //handle both old and new API structure
        const mealPlanData = plan.meal_plan || plan;
        console.log('MealPlanWidget: Meal plan data keys:', Object.keys(mealPlanData));
        
        setMealPlan(plan);
        
        //get meals for the first day (or current day)
        const days = mealPlanData.days || [];
        console.log('MealPlanWidget: Days found:', days.length);
        
        const firstDay = days.find((d: any) => d.day_number === 1) || days[0];
        const dayMeals = firstDay ? firstDay.meals : [];
        console.log('MealPlanWidget: Today meals:', dayMeals.length);
        
        setTodayMeals(dayMeals);
      } else {
        console.log('MealPlanWidget: No meal plan in storage');
      }
    } catch (error) {
      console.error('MealPlanWidget: Failed to load meal plan:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Meal Plan</Text>
          <ActivityIndicator size="small" color="#27AE60" />
        </View>
      </View>
    );
  }

  if (!mealPlan) {
    return (
      <TouchableOpacity 
        style={styles.container}
        onPress={() => router.push('/scanner/product-list')}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Meal Plan</Text>
          <Ionicons name="chevron-forward" size={16} color="#4A90E2" />
        </View>
        <Text style={styles.emptyText}>
          Create a meal plan based on your products
        </Text>
      </TouchableOpacity>
    );
  }

  const currentDay = 1; //can be made dynamic
  
  //get total days from the new structure
  const totalDays = mealPlan?.total_days || mealPlan?.meal_plan?.total_days || 0;
  const planName = mealPlan?.plan_name || mealPlan?.meal_plan?.plan_name || 'Meal Plan';

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={() => router.push('/scanner/meal-plan')}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Meal Plan</Text>
        <Ionicons name="chevron-forward" size={16} color="#4A90E2" />
      </View>
      
      <Text style={styles.planName}>{planName}</Text>
      {totalDays > 0 && (
        <Text style={styles.dayInfo}>Day {currentDay} of {totalDays}</Text>
      )}

      {todayMeals.length > 0 && (
        <View style={styles.mealsPreview}>
          <Text style={styles.mealsTitle}>Today:</Text>
          {todayMeals.slice(0, 2).map((meal, index) => (
            <View key={index} style={styles.mealItem}>
              <Text style={styles.mealType}>
                {MEAL_TYPE_NAMES[meal.meal_type as keyof typeof MEAL_TYPE_NAMES] || meal.meal_type}
              </Text>
              <Text style={styles.mealRecipe} numberOfLines={1}>
                {meal.meal_name || meal.recipe_name}
              </Text>
            </View>
          ))}
          {todayMeals.length > 2 && (
            <Text style={styles.moreText}>
              and {todayMeals.length - 2} more dishes...
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  emptyText: {
    fontSize: 13,
    color: '#7F8C8D',
    textAlign: 'center',
    paddingVertical: 8,
  },
  planName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 2,
  },
  dayInfo: {
    fontSize: 13,
    color: '#27AE60',
    fontWeight: '500',
    marginBottom: 8,
  },
  mealsPreview: {
    gap: 6,
  },
  mealsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#34495E',
    marginBottom: 2,
  },
  mealItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mealType: {
    fontSize: 12,
    color: '#27AE60',
    fontWeight: '600',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 60,
    textAlign: 'center',
  },
  mealRecipe: {
    fontSize: 14,
    color: '#2C3E50',
    flex: 1,
  },
  moreText: {
    fontSize: 12,
    color: '#4A90E2',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingTop: 4,
  },
});