import { AuthService } from '@/utils/authService';
import { NetworkAutoConfig } from '@/utils/networkAutoConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) { //will be used for the future updates when we go for andoriod as well
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/*helpers  */

const todayKey = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `water_tracker_${yyyy}-${mm}-${dd}`;
};

const fmt = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : Math.round(n).toString();

/* types */

interface TodayData {
  calorieTarget: number;
  caloriesConsumed: number;
  proteinConsumed: number;
  carbsConsumed: number;
  fatConsumed: number;
  completedMeals: number;
  totalMeals: number;
  planName: string | null;
}

interface MealItem {
  meal_type: string;
  meal_name?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  cooked: boolean;
}

const MEAL_TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  breakfast: { label: 'Breakfast', icon: '☀', color: '#F59E0B' },
  lunch:     { label: 'Lunch',     icon: '◐', color: '#3B82F6' },
  dinner:    { label: 'Dinner',    icon: '☽', color: '#8B5CF6' },
  snack:     { label: 'Snack',     icon: '◇', color: '#10B981' },
};

/* component */

export default function TodayStatsWidget() {
  const [data, setData] = useState<TodayData | null>(null);
  const [meals, setMeals] = useState<MealItem[]>([]);
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  /* reload every time the tab is focused */
  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, []),
  );

  /*data loading*/

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadNutrition(), loadWater()]);
    setLoading(false);
  };

  const loadNutrition = async () => {
    try {
      const token = await AuthService.getToken();
      if (!token) return;

      let baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
      try {
        const cfg = await NetworkAutoConfig.getNetworkConfig();
        baseUrl = cfg.apiUrl;
      } catch {}

      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      };

      //1. preferences → caloric target
      // 1. preferences → caloric target (this is the source of truth — user edits this in Daily Goals)
      let calorieTarget = 2000; // sensible default
      let preferencesCalorieTarget: number | null = null;
      try {
        const prefRes = await fetch(`${baseUrl}/preferences/me`, { headers });
        if (prefRes.ok) {
          const prefs = await prefRes.json();
          if (prefs.caloric_target) {
            calorieTarget = prefs.caloric_target;
            preferencesCalorieTarget = prefs.caloric_target;
          }
        }
      } catch {}

      // 2. Read meal plan from AsyncStorage (same source as MealPlanScreen)
      let caloriesConsumed = 0;
      let proteinConsumed = 0;
      let carbsConsumed = 0;
      let fatConsumed = 0;
      let completedMeals = 0;
      let totalMeals = 0;
      let planName: string | null = null;
      const mealItems: MealItem[] = [];

      try {
        const planData = await AsyncStorage.getItem('current_meal_plan');
        const cookedData = await AsyncStorage.getItem('cooked_meals');
        const cookedMap: Record<string, boolean> = cookedData ? JSON.parse(cookedData) : {};

        if (planData) {
          const plan = JSON.parse(planData);
          const mealPlanData = plan.meal_plan || plan;
          planName = plan.plan_name || mealPlanData.plan_name || null;

          // Only use plan's calorie target as fallback if preferences didn't have one
          if (!preferencesCalorieTarget) {
            if (mealPlanData.daily_calorie_target) {
              calorieTarget = mealPlanData.daily_calorie_target;
            }
            if (plan.user_data?.daily_calories) {
              calorieTarget = plan.user_data.daily_calories;
            }
          }
          const days: any[] = mealPlanData.days || plan.days || [];
          const currentDayNumber = 1;
          const todayDay = days.find((d: any) => d.day_number === currentDayNumber) || days[0];

          if (todayDay && todayDay.meals) {
            totalMeals = todayDay.meals.length;
            todayDay.meals.forEach((meal: any, index: number) => {
              const cookedKey = `${currentDayNumber}-${meal.meal_type}-${index}`;
              const isCooked = !!cookedMap[cookedKey];

              const mealCals = meal.calories || meal.estimated_calories || 0;
              const mealProtein = meal.protein || meal.estimated_nutrition?.protein || 0;
              const mealCarbs = meal.carbs || meal.estimated_nutrition?.carbs || 0;
              const mealFat = meal.fat || meal.estimated_nutrition?.fat || 0;

              mealItems.push({
                meal_type: meal.meal_type,
                meal_name: meal.meal_name || meal.recipe_name,
                calories: mealCals,
                protein: mealProtein,
                carbs: mealCarbs,
                fat: mealFat,
                cooked: isCooked,
              });

              if (isCooked) {
                completedMeals++;
                caloriesConsumed += mealCals;
                proteinConsumed += mealProtein;
                carbsConsumed += mealCarbs;
                fatConsumed += mealFat;
              }
            });
          }
        }
      } catch (e) {
        console.warn('TodayStatsWidget: meal plan load failed', e);
      }

      setData({
        calorieTarget,
        caloriesConsumed,
        proteinConsumed,
        carbsConsumed,
        fatConsumed,
        completedMeals,
        totalMeals,
        planName,
      });
      setMeals(mealItems);
    } catch (e) {
      console.warn('TodayStatsWidget: loadNutrition error', e);
    }
  };

  const loadWater = async () => {
    try {
      const val = await AsyncStorage.getItem(todayKey());
      setWaterGlasses(val ? parseInt(val, 10) || 0 : 0);
    } catch {}
  };

  const changeWater = async (delta: number) => {
    const next = Math.max(0, waterGlasses + delta);
    setWaterGlasses(next);
    await AsyncStorage.setItem(todayKey(), String(next));
  };

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };
//rendering

  if (loading) {
    return (
      <View style={[styles.card, styles.loadingCard]}>
        <ActivityIndicator size="small" color="#6366F1" />
      </View>
    );
  }

  const target = data?.calorieTarget ?? 2000;
  const consumed = data?.caloriesConsumed ?? 0;
  const remaining = Math.max(0, target - consumed);
  const progress = target > 0 ? Math.min(consumed / target, 1) : 0;
  const mealsLabel = data ? `${data.completedMeals}/${data.totalMeals}` : '0/0';

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.headerRow} onPress={toggleExpand} activeOpacity={0.7}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Today</Text>
          {data?.planName && (
            <Text style={styles.planBadge} numberOfLines={1}>
              📋 {data.planName}
            </Text>
          )}
        </View>
        <Text style={styles.expandArrow}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      <View style={styles.calorieSection}>
        <View style={styles.calorieNumbers}>
          <View style={styles.calorieMain}>
            <Text style={styles.calorieConsumed}>{fmt(consumed)}</Text>
            <Text style={styles.calorieSuffix}> / {fmt(target)} kcal</Text>
          </View>
          <Text style={styles.calorieRemaining}>
            {remaining > 0 ? `${fmt(remaining)} left` : 'Goal reached!'}
          </Text>
        </View>

        {/* progress bar */}
        <View style={styles.progressBg}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.round(progress * 100)}%`,
                backgroundColor: progress >= 1 ? '#10B981' : '#6366F1',
              },
            ]}
          />
        </View>
      </View>
      <View style={styles.macroRow}>
        <MacroPill label="Protein" value={data?.proteinConsumed ?? 0} color="#EF4444" unit="g" />
        <MacroPill label="Carbs" value={data?.carbsConsumed ?? 0} color="#F59E0B" unit="g" />
        <MacroPill label="Fat" value={data?.fatConsumed ?? 0} color="#3B82F6" unit="g" />
        <MacroPill label="Meals" value={mealsLabel} color="#8B5CF6" />
      </View>

      <View style={styles.divider} />
      <View style={styles.waterRow}>
        <View style={styles.waterInfo}>
          <Text style={styles.waterIcon}>💧</Text>
          <Text style={styles.waterText}>
            {waterGlasses} glass{waterGlasses !== 1 ? 'es' : ''}
          </Text>
        </View>
        <View style={styles.waterButtons}>
          <TouchableOpacity style={styles.waterBtn} onPress={() => changeWater(-1)}>
            <Text style={styles.waterBtnText}>−</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.waterBtn, styles.waterBtnPlus]} onPress={() => changeWater(1)}>
            <Text style={[styles.waterBtnText, styles.waterBtnTextPlus]}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
      {expanded && (
        <View style={styles.mealsSection}>
          <View style={styles.divider} />
          <Text style={styles.mealsTitle}>Today's Meals</Text>

          {meals.length === 0 ? (
            <TouchableOpacity
              style={styles.emptyMeals}
              onPress={() => router.push('/scanner/product-list' as any)}
            >
              <Text style={styles.emptyMealsText}>
                No meal plan yet — tap to create one
              </Text>
            </TouchableOpacity>
          ) : (
            meals.map((meal, idx) => {
              const meta = MEAL_TYPE_META[meal.meal_type] || MEAL_TYPE_META.snack;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.mealRow, meal.cooked && styles.mealRowCooked]}
                  activeOpacity={0.7}
                  onPress={() => router.push('/scanner/meal-plan' as any)}
                >
                  <View style={styles.mealLeft}>
                    <View style={[styles.mealTypeBadge, { backgroundColor: meta.color + '18' }]}>
                      <Text style={styles.mealTypeIcon}>{meta.icon}</Text>
                      <Text style={[styles.mealTypeLabel, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                    <Text
                      style={[styles.mealName, meal.cooked && styles.mealNameCooked]}
                      numberOfLines={1}
                    >
                      {meal.cooked ? '✓ ' : ''}{meal.meal_name || 'Unnamed meal'}
                    </Text>
                  </View>
                  <Text style={styles.mealCalories}>{meal.calories} kcal</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

function MacroPill({
  label,
  value,
  color,
  unit,
}: {
  label: string;
  value: number | string;
  color: string;
  unit?: string;
}) {
  return (
    <View style={[styles.macroPill, { backgroundColor: color + '12' }]}>
      <Text style={[styles.macroPillValue, { color }]}>
        {typeof value === 'number' ? Math.round(value) : value}
        {unit ? unit : ''}
      </Text>
      <Text style={styles.macroPillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  planBadge: {
    fontSize: 12,
    color: '#64748B',
    maxWidth: '55%',
  },
  calorieSection: {
    marginBottom: 10,
  },
  calorieNumbers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  calorieMain: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  calorieConsumed: {
    fontSize: 24,
    fontWeight: '800',
    color: '#6366F1',
  },
  calorieSuffix: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  calorieRemaining: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  progressBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 5,
    marginBottom: 10,
  },
  macroPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 8,
  },
  macroPillValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  macroPillLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 10,
  },
  waterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  waterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  waterIcon: {
    fontSize: 20,
  },
  waterText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  waterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  waterBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterBtnPlus: {
    backgroundColor: '#6366F1',
  },
  waterBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6366F1',
    lineHeight: 20,
  },
  waterBtnTextPlus: {
    color: '#FFFFFF',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'column',
    gap: 2,
  },
  expandArrow: {
    fontSize: 14,
    color: '#94A3B8',
    marginLeft: 8,
  },
  mealsSection: {
    marginTop: 4,
  },
  mealsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptyMeals: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyMealsText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  mealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  mealRowCooked: {
    backgroundColor: '#F0FDF4',
    opacity: 0.85,
  },
  mealLeft: {
    flex: 1,
    gap: 4,
  },
  mealTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  mealTypeIcon: {
    fontSize: 12,
  },
  mealTypeLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  mealName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
  },
  mealNameCooked: {
    color: '#64748B',
    textDecorationLine: 'line-through',
  },
  mealCalories: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
    marginLeft: 8,
  },
});
