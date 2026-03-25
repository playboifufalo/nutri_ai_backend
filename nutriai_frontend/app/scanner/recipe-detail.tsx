import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

interface MealData {
  id?: number;
  meal_type: string;
  meal_name?: string;
  recipe_name?: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  custom_ingredients?: string[];
  ingredients?: string[];
  custom_instructions?: string;
  instructions?: string;
  source_url?: string | null;
  prep_time?: number | null;
  cook_time?: number | null;
  estimated_calories?: number;
  estimated_nutrition?: {
    protein: number;
    carbs: number;
    fat: number;
  };
}

const MEAL_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  breakfast: { label: 'Breakfast', icon: 'sunny-outline', color: '#F59E0B', bg: '#FEF3C7' },
  lunch: { label: 'Lunch', icon: 'restaurant-outline', color: '#10B981', bg: '#D1FAE5' },
  dinner: { label: 'Dinner', icon: 'moon-outline', color: '#6366F1', bg: '#EEF2FF' },
  snack: { label: 'Snack', icon: 'leaf-outline', color: '#EC4899', bg: '#FCE7F3' },
};

export default function RecipeDetailScreen() {
  const params = useLocalSearchParams();
  const [meal, setMeal] = useState<MealData | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (params.meal) {
      try {
        const mealData = JSON.parse(params.meal as string);
        setMeal(mealData);
        fetchMealImage(mealData.meal_name || mealData.recipe_name || '');
      } catch (e) {
        console.error('Failed to parse meal data:', e);
      }
    }
  }, [params.meal]);

  const fetchMealImage = async (mealName: string) => {
    try {
      const searchName = mealName.split(' ').slice(0, 3).join(' ');
      const response = await fetch(
        `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(searchName)}`,
        { signal: AbortSignal.timeout(5000) }
      );
      const data = await response.json();
      if (data.meals && data.meals[0]?.strMealThumb) {
        setImageUrl(data.meals[0].strMealThumb);
        return;
      }
    } catch (e) {
    }
    


    setImageUrl(null);
  };

  if (!meal) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Recipe not found</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const name = meal.meal_name || meal.recipe_name || 'Recipe';
  const ingredients = meal.custom_ingredients || meal.ingredients || [];
  const instructionsRaw = meal.custom_instructions || meal.instructions || '';


  const parseInstructions = (raw: string | string[]): string[] => {
    if (Array.isArray(raw)) {
      return raw.map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    }
    if (!raw || typeof raw !== 'string') return [];
    const text = raw.replace(/\\n/g, '\n');
    const numberedParts = text.split(/\n?\s*(?:STEP\s*\d+[.:)\s]\s*|Step\s*\d+[.:)\s]\s*|\d+[.)]\s)/i);
    const cleaned = numberedParts.map(p => p.trim()).filter(p => p.length > 0);
    if (cleaned.length >= 3) return cleaned;
    const lines = text.split('\n').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    if (lines.length >= 3) return lines;
    const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 10);
    if (sentences.length >= 3) return sentences;
    return lines.length > 0 ? lines : [text.trim()];
  };



  const instructionSteps = parseInstructions(instructionsRaw);
  const calories = meal.calories || meal.estimated_calories || 0;
  const protein = meal.protein || meal.estimated_nutrition?.protein || 0;
  const carbs = meal.carbs || meal.estimated_nutrition?.carbs || 0;
  const fat = meal.fat || meal.estimated_nutrition?.fat || 0;
  const mealConfig = MEAL_TYPE_CONFIG[meal.meal_type] || MEAL_TYPE_CONFIG.lunch;
  const totalTime = (meal.prep_time || 0) + (meal.cook_time || 0);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.heroContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={[styles.heroPlaceholder, { backgroundColor: mealConfig.bg }]}>
              <Ionicons name={mealConfig.icon as any} size={80} color={mealConfig.color} />
            </View>
          )}
          
          
          <TouchableOpacity style={styles.backOverlay} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>


          <View style={[styles.mealTypeBadge, { backgroundColor: mealConfig.bg }]}>
            <Text style={[styles.mealTypeBadgeText, { color: mealConfig.color }]}>
              {mealConfig.label}
            </Text>
          </View>
        </View>


        <View style={styles.content}>
         
          <Text style={styles.recipeName}>{name}</Text>

 {/* info about time */}
          {totalTime > 0 && (
            <View style={styles.timeRow}>
              {meal.prep_time ? (
                <View style={styles.timeChip}>
                  <Ionicons name="hand-left-outline" size={16} color="#6B7280" />
                  <Text style={styles.timeChipText}>Prep: {meal.prep_time} min</Text>
                </View>
              ) : null}
              {meal.cook_time ? (
                <View style={styles.timeChip}>
                  <Ionicons name="flame-outline" size={16} color="#EF4444" />
                  <Text style={styles.timeChipText}>Cook: {meal.cook_time} min</Text>
                </View>
              ) : null}
              <View style={styles.timeChip}>
                <Ionicons name="time-outline" size={16} color="#3B82F6" />
                <Text style={styles.timeChipText}>Total: {totalTime} min</Text>
              </View>
            </View>
          )}
 {/* Nutrition info */}
          <View style={styles.nutritionRow}>
            <View style={[styles.nutritionCard, { backgroundColor: '#FEF3C7' }]}>
              <Text style={styles.nutritionValue}>{Math.round(calories)}</Text>
              <Text style={styles.nutritionLabel}>kcal</Text>
            </View>
            <View style={[styles.nutritionCard, { backgroundColor: '#DBEAFE' }]}>
              <Text style={styles.nutritionValue}>{Math.round(protein)}g</Text>
              <Text style={styles.nutritionLabel}>Protein</Text>
            </View>
            <View style={[styles.nutritionCard, { backgroundColor: '#D1FAE5' }]}>
              <Text style={styles.nutritionValue}>{Math.round(carbs)}g</Text>
              <Text style={styles.nutritionLabel}>Carbs</Text>
            </View>
            <View style={[styles.nutritionCard, { backgroundColor: '#FCE7F3' }]}>
              <Text style={styles.nutritionValue}>{Math.round(fat)}g</Text>
              <Text style={styles.nutritionLabel}>Fat</Text>
            </View>
          </View>

          {/*Ingredients*/}
          {ingredients.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="cart-outline" size={22} color="#2C3E50" />
                <Text style={styles.sectionTitle}>
                  Ingredients ({ingredients.length})
                </Text>
              </View>
              {ingredients.map((ingredient: string, index: number) => (
                <View key={index} style={styles.ingredientItem}>
                  <View style={styles.ingredientBullet} />
                  <Text style={styles.ingredientText}>{ingredient}</Text>
                </View>
              ))}
            </View>
          )}

          {/*Receipe itself*/}
          {instructionSteps.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="list-outline" size={22} color="#2C3E50" />
                <Text style={styles.sectionTitle}>Instructions</Text>
              </View>
              {instructionSteps.map((step: string, index: number) => {
                const cleanStep = step.replace(/^(Step\s*\d+[:.]\s*)/i, '');
                return (
                  <View key={index} style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{cleanStep}</Text>
                  </View>
                );
              })}
            </View>
          )}

          
          {meal.source_url && (
            <TouchableOpacity style={styles.sourceLink}>
              <Ionicons name="link-outline" size={18} color="#3B82F6" />
              <Text style={styles.sourceLinkText}>Recipe Source</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollView: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: 18,
    color: '#6B7280',
  },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#6366F1',
    borderRadius: 8,
  },
  backBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  heroContainer: {
    width: width,
    height: 260,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backOverlay: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  mealTypeBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  mealTypeBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  recipeName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 12,
    lineHeight: 32,
  },
  timeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  timeChipText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  nutritionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  nutritionCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
  },
  nutritionValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
  },
  nutritionLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 2,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  ingredientBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginTop: 6,
  },
  ingredientText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    gap: 14,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    lineHeight: 23,
  },
  sourceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    marginBottom: 8,
  },
  sourceLinkText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
  },
});
