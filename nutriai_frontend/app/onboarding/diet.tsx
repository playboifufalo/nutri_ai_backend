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

const DIET_TYPES = [
  {
    id: 'regular',
    title: 'Regular',
    description: 'No specific dietary restrictions',
    icon: 'fork.knife',
    color: '#6B7280'
  },
  {
    id: 'vegetarian',
    title: 'Vegetarian',
    description: 'No meat, but includes dairy and eggs',
    icon: 'leaf.fill',
    color: '#10B981'
  },
  {
    id: 'vegan',
    title: 'Vegan',
    description: 'No animal products whatsoever',
    icon: 'heart.fill',
    color: '#059669'
  },
  {
    id: 'keto',
    title: 'Keto',
    description: 'High fat, very low carbohydrate',
    icon: 'flame.fill',
    color: '#F59E0B'
  },
  {
    id: 'gluten-free',
    title: 'Gluten-Free',
    description: 'No gluten-containing grains',
    icon: 'minus.circle.fill',
    color: '#EF4444'
  },
  {
    id: 'paleo',
    title: 'Paleo',
    description: 'Whole foods, no processed items',
    icon: 'figure.hunting',
    color: '#8B5CF6'
  },
  {
    id: 'mediterranean',
    title: 'Mediterranean',
    description: 'Fish, olive oil, fruits and vegetables',
    icon: 'sun.max.fill',
    color: '#3B82F6'
  },
  {
    id: 'intermittent-fasting',
    title: 'Intermittent Fasting',
    description: 'Time-restricted eating patterns',
    icon: 'clock.fill',
    color: '#EC4899'
  }
];

export default function DietTypeScreen() {
  const { dispatch } = useOnboarding();
  const [selectedDiet, setSelectedDiet] = useState<string>('regular');

  const handleContinue = () => {
    if (!selectedDiet) {
      Alert.alert('Selection Required', 'Please select a diet type to continue');
      return;
    }
    
    dispatch({ type: 'SET_DIET_TYPE', payload: selectedDiet });
    router.push('/onboarding/calories' as any);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>What's your diet type?</ThemedText>
          <ThemedText style={styles.subtitle}>
            This helps us suggest meals that align with your eating style
          </ThemedText>
        </View>

        <View style={styles.optionsContainer}>
          {DIET_TYPES.map((diet) => (
            <Pressable
              key={diet.id}
              style={[
                styles.optionCard,
                selectedDiet === diet.id && styles.selectedCard
              ]}
              onPress={() => setSelectedDiet(diet.id)}
            >
              <View style={styles.optionContent}>
                <View style={[styles.iconContainer, { backgroundColor: diet.color + '15' }]}>
                  <IconSymbol 
                    name={diet.icon as any} 
                    size={28} 
                    color={diet.color}
                  />
                </View>
                <View style={styles.textContainer}>
                  <ThemedText style={styles.optionTitle}>{diet.title}</ThemedText>
                  <ThemedText style={styles.optionDescription}>
                    {diet.description}
                  </ThemedText>
                </View>
                <View style={styles.radioContainer}>
                  <View style={[
                    styles.radioOuter,
                    selectedDiet === diet.id && styles.radioSelected
                  ]}>
                    {selectedDiet === diet.id && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.noteBox}>
          <IconSymbol name="lightbulb.fill" size={20} color="#F59E0B" />
          <ThemedText style={styles.noteText}>
            Don't worry if you're not sure - you can change this anytime in settings
          </ThemedText>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
          <IconSymbol name="arrow.right" size={20} color="#FFFFFF" />
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
  optionsContainer: {
    paddingHorizontal: 24,
    gap: 12,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
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
  noteBox: {
    marginHorizontal: 24,
    marginTop: 24,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noteText: {
    fontSize: 14,
    flex: 1,
    color: '#92400E',
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
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});