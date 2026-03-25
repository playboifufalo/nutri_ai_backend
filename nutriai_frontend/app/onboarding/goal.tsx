import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useOnboarding } from '@/hooks/use-onboarding';
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

const GOAL_OPTIONS = [
  {
    id: 'lose-weight',
    title: 'Lose Weight',
    description: 'Reduce body weight and fat percentage',
    icon: 'minus.circle.fill',
    color: '#EF4444'
  },
  {
    id: 'gain-weight',
    title: 'Gain Weight',
    description: 'Increase body weight in a healthy way',
    icon: 'plus.circle.fill',
    color: '#10B981'
  },
  {
    id: 'maintain-weight',
    title: 'Maintain Weight',
    description: 'Keep current weight stable',
    icon: 'equal.circle.fill',
    color: '#6366F1'
  },
  {
    id: 'improve-health',
    title: 'Improve Health',
    description: 'Focus on overall wellness and nutrition',
    icon: 'heart.circle.fill',
    color: '#EC4899'
  },
  {
    id: 'gain-muscle-mass',
    title: 'Gain Muscle Mass',
    description: 'Build lean muscle and strength',
    icon: 'figure.strengthtraining.traditional',
    color: '#F59E0B'
  },
  {
    id: 'competition-preparation',
    title: 'Competition Preparation',
    description: 'Prepare for athletic competitions',
    icon: 'trophy.circle.fill',
    color: '#8B5CF6'
  }
];

export default function GoalSelectionScreen() {
  const { dispatch } = useOnboarding();
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);

  const handleContinue = () => {
    if (!selectedGoal) {
      Alert.alert('Selection Required', 'Please select a goal to continue');
      return;
    }
    
    dispatch({ type: 'SET_GOAL', payload: selectedGoal });
    router.push('/onboarding/allergies' as any);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>What's your main goal?</ThemedText>
          <ThemedText style={styles.subtitle}>
            This helps us personalize your nutrition recommendations
          </ThemedText>
        </View>

        <View style={styles.optionsContainer}>
          {GOAL_OPTIONS.map((option) => (
            <Pressable
              key={option.id}
              style={[
                styles.optionCard,
                selectedGoal === option.id && styles.selectedCard
              ]}
              onPress={() => setSelectedGoal(option.id)}
            >
              <View style={styles.optionContent}>
                <View style={[styles.iconContainer, { backgroundColor: option.color + '15' }]}>
                  <IconSymbol 
                    name={option.icon as any} 
                    size={32} 
                    color={option.color}
                  />
                </View>
                <View style={styles.textContainer}>
                  <ThemedText style={styles.optionTitle}>{option.title}</ThemedText>
                  <ThemedText style={styles.optionDescription}>
                    {option.description}
                  </ThemedText>
                </View>
                <View style={styles.radioContainer}>
                  <View style={[
                    styles.radioOuter,
                    selectedGoal === option.id && styles.radioSelected
                  ]}>
                    {selectedGoal === option.id && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, !selectedGoal && styles.disabledButton]}
          onPress={handleContinue}
          disabled={!selectedGoal}
        >
          <Text style={[styles.continueButtonText, !selectedGoal && styles.disabledButtonText]}>
            Continue
          </Text>
          <IconSymbol name="arrow.right" size={20} color={selectedGoal ? "#FFFFFF" : "#9CA3AF"} />
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
  },
  optionsContainer: {
    paddingHorizontal: 24,
    gap: 16,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
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
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
  radioContainer: {
    marginLeft: 12,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: '#6366F1',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6366F1',
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
  },
  continueButton: {
    backgroundColor: '#6366F1',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  disabledButton: {
    backgroundColor: '#E5E7EB',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButtonText: {
    color: '#9CA3AF',
  },
});