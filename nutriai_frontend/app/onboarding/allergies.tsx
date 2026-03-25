import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useOnboarding } from '@/hooks/use-onboarding';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const COMMON_ALLERGIES = [
  { id: 'nuts', name: 'Nuts', icon: 'heart.slash.fill' },
  { id: 'dairy', name: 'Dairy', icon: 'heart.slash.fill' },
  { id: 'gluten', name: 'Gluten', icon: 'heart.slash.fill' },
  { id: 'eggs', name: 'Eggs', icon: 'heart.slash.fill' },
  { id: 'soy', name: 'Soy', icon: 'heart.slash.fill' },
  { id: 'fish', name: 'Fish', icon: 'heart.slash.fill' },
  { id: 'shellfish', name: 'Shellfish', icon: 'heart.slash.fill' },
  { id: 'sesame', name: 'Sesame', icon: 'heart.slash.fill' },
  { id: 'mustard', name: 'Mustard', icon: 'heart.slash.fill' },
  { id: 'celery', name: 'Celery', icon: 'heart.slash.fill' },
  { id: 'lupin', name: 'Lupin', icon: 'heart.slash.fill' },
  { id: 'sulphites', name: 'Sulphites', icon: 'heart.slash.fill' },
];

export default function AllergiesScreen() {
  const { dispatch } = useOnboarding();
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);

  const toggleAllergy = (allergyId: string) => {
    setSelectedAllergies(prev => 
      prev.includes(allergyId)
        ? prev.filter(id => id !== allergyId)
        : [...prev, allergyId]
    );
  };

  const handleContinue = () => {
    dispatch({ type: 'SET_ALLERGIES', payload: selectedAllergies });
    router.push('/onboarding/diet' as any);
  };

  const handleSkip = () => {
    dispatch({ type: 'SET_ALLERGIES', payload: [] });
    router.push('/onboarding/diet' as any);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Any allergies or dietary restrictions?</ThemedText>
          <ThemedText style={styles.subtitle}>
            Select all that apply. This helps us avoid suggesting foods that might not be suitable for you.
          </ThemedText>
        </View>

        <View style={styles.allergiesContainer}>
          <View style={styles.allergiesGrid}>
            {COMMON_ALLERGIES.map((allergy) => (
              <TouchableOpacity
                key={allergy.id}
                style={[
                  styles.allergyTag,
                  selectedAllergies.includes(allergy.id) && styles.selectedTag
                ]}
                onPress={() => toggleAllergy(allergy.id)}
              >
                <IconSymbol 
                  name={allergy.icon as any} 
                  size={18} 
                  color={selectedAllergies.includes(allergy.id) ? "#FFFFFF" : "#6B7280"}
                />
                <Text style={[
                  styles.allergyText,
                  selectedAllergies.includes(allergy.id) && styles.selectedTagText
                ]}>
                  {allergy.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.infoBox}>
          <IconSymbol name="info.circle.fill" size={20} color="#6366F1" />
          <ThemedText style={styles.infoText}>
            You can always update these settings later in your profile
          </ThemedText>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>
            Continue {selectedAllergies.length > 0 && `(${selectedAllergies.length})`}
          </Text>
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
  allergiesContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  allergiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  allergyTag: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedTag: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  allergyText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  selectedTagText: {
    color: '#FFFFFF',
  },
  infoBox: {
    marginHorizontal: 24,
    backgroundColor: '#6366F1' + '08',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    fontSize: 14,
    flex: 1,
    opacity: 0.8,
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  skipButton: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '500',
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