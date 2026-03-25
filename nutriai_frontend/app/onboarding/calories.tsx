import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useOnboarding } from '@/hooks/use-onboarding';
import { OnboardingService } from '@/utils/onboardingService';
import { preferencesApi } from '@/utils/preferencesApi';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const CALORIE_RANGES = [
  { id: 'low', label: 'Low Activity', range: '1200-1500', description: 'Sedentary lifestyle, desk job' },
  { id: 'moderate', label: 'Moderate Activity', range: '1500-2000', description: 'Light exercise 1-3 days/week' },
  { id: 'active', label: 'Active', range: '2000-2500', description: 'Moderate exercise 3-5 days/week' },
  { id: 'very-active', label: 'Very Active', range: '2500-3000', description: 'Hard exercise 6-7 days/week' },
];

export default function CaloriesScreen() {
  const { state, dispatch } = useOnboarding();
  const [selectedRange, setSelectedRange] = useState<string>('moderate');
  const [isLoading, setIsLoading] = useState(false);

  const handleFinish = async () => {
    const finalCalories = getCaloriesFromRange(selectedRange);

    setIsLoading(true);
    
    try {
      await preferencesApi.createMyPreferences({
        goal: state.goal || 'maintain-weight',      //here we save all preferences together at the end, so we have a complete profile for the user when generating meal plans
        allergies: state.allergies,
        diet_type: state.dietType || 'regular',
        caloric_target: finalCalories,
      });

      const starterProducts = [
        'Chicken Breast', 'Rice', 'Eggs', 'Bananas', 'Milk',
        'Oatmeal', 'Salmon', 'Broccoli', 'Greek Yogurt', 'Bread',
      ];
      
      await Promise.allSettled(
        starterProducts.map(product =>
          preferencesApi.addScannedProduct(product).catch(() => {})
        )
      );
      dispatch({ type: 'RESET' });
      await OnboardingService.markOnboardingCompleted();
      
      Alert.alert(
        'Setup Complete!',
        'Your preferences have been saved and we added 10 starter products for you.\nYou can scan or search for more products anytime!',
        [
          {
            text: 'Get Started',
            onPress: () => router.replace('/(tabs)'),
          },
        ]
      );
    } catch (error) {
      console.error('Failed to save preferences:', error);
      Alert.alert('Error', 'Failed to save preferences. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getCaloriesFromRange = (rangeId: string): number => {   //here we convert selected range to a specific calorie number (using the midpoint of the range)
    const range = CALORIE_RANGES.find(r => r.id === rangeId);
    if (!range) return 2000;
    
    const [min, max] = range.range.split('-').map(Number);
    return Math.round((min + max) / 2);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Daily Calorie Target</ThemedText>
          <ThemedText style={styles.subtitle}>
            Set your daily calorie goal based on your activity level and goals
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Choose a preset range</ThemedText>
          <View style={styles.rangesContainer}>
            {CALORIE_RANGES.map((range) => (
              <Pressable
                key={range.id}
                style={[
                  styles.rangeCard,
                  selectedRange === range.id && styles.selectedCard
                ]}
                onPress={() => {
                  setSelectedRange(range.id);
                }}
              >
                <View style={styles.rangeContent}>
                  <View style={styles.rangeHeader}>
                    <ThemedText style={styles.rangeLabel}>{range.label}</ThemedText>
                    <Text style={styles.rangeCalories}>{range.range} cal</Text>
                  </View>
                  <ThemedText style={styles.rangeDescription}>
                    {range.description}
                  </ThemedText>
                </View>
                <View style={styles.radioContainer}>
                  <View style={[
                    styles.radioOuter,
                    selectedRange === range.id && styles.radioSelected
                  ]}>
                    {selectedRange === range.id && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipIcon}>ℹ️</Text>
          <View style={styles.tipContent}>
            <ThemedText style={styles.tipTitle}>Recommended ranges:</ThemedText>
            <ThemedText style={styles.tipText}>Female: 1200-2000 cal</ThemedText>
            <ThemedText style={styles.tipText}>Male: 1500-2500 cal</ThemedText>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.finishButton, isLoading && styles.disabledButton]}
          onPress={handleFinish}
          disabled={isLoading}
        >
          {isLoading ? (
            <Text style={styles.finishButtonText}>Setting up...</Text>
          ) : (
            <>
              <Text style={styles.finishButtonText}>Complete Setup ✅</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 24,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  rangesContainer: {
    gap: 12,
  },
  rangeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  selectedCard: {
    borderColor: '#6366F1',
    backgroundColor: '#6366F1' + '08',
  },
  rangeContent: {
    flex: 1,
  },
  rangeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  rangeLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  rangeCalories: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366F1',
  },
  rangeDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
  radioContainer: {
    marginLeft: 16,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: '#6366F1',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6366F1',
  },
  tipBox: {
    marginHorizontal: 24,
    backgroundColor: '#EBF8FF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tipIcon: {
    fontSize: 20,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 14,
    color: '#1E40AF',
    opacity: 0.8,
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
  },
  finishButton: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  disabledButton: {
    opacity: 0.7,
  },
  finishButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});