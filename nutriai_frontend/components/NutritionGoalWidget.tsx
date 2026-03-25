import { AuthService } from '@/utils/authService';
import { NetworkAutoConfig } from '@/utils/networkAutoConfig';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';


const GOAL_LABELS: Record<string, { label: string; color: string }> = {
  'lose-weight': { label: 'Lose Weight', color: '#EF4444' },
  'gain-weight': { label: 'Gain Weight', color: '#10B981' },
  'maintain-weight': { label: 'Maintain Weight', color: '#6366F1' },
  'improve-health': { label: 'Improve Health', color: '#EC4899' },
  'gain-muscle-mass': { label: 'Build Muscle', color: '#F59E0B' },
  'competition-preparation': { label: 'Competition Prep', color: '#8B5CF6' },
};

const DIET_LABELS: Record<string, string> = {
  any: 'No Restrictions',
  regular: 'Regular',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  keto: 'Keto',
  paleo: 'Paleo',
  mediterranean: 'Mediterranean',
  low_carb: 'Low Carb',
  high_protein: 'High Protein',
};

interface NutritionGoalData {
  goals: string | null;
  caloric_target: number | null;
  diet_type: string | null;
  allergies: string[];
}

interface Props {
  onConfigured?: () => void;
}

export default function NutritionGoalWidget({ onConfigured }: Props) {
  const [data, setData] = useState<NutritionGoalData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const token = await AuthService.getToken();
      if (!token) { setLoading(false); return; }

      let baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
      try {
        const config = await NetworkAutoConfig.getNetworkConfig();
        baseUrl = config.apiUrl;
      } catch {}

      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(`${baseUrl}/preferences/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(fetchTimeout);

      if (res.ok) {
        const json = await res.json();
        setData({
          goals: json.goals || null,
          caloric_target: json.caloric_target || null,
          diet_type: json.diet_type || null,
          allergies: json.allergies || [],
        });
      }
    } catch (e) {
      console.warn('NutritionGoalWidget: failed to load preferences', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  const hasGoal = data?.goals || data?.caloric_target || data?.diet_type;
  if (!hasGoal) {
    return (
      <TouchableOpacity
        style={[styles.card, styles.ctaCard]}
        onPress={() => router.push('/onboarding/goal' as any)}
        activeOpacity={0.7}
      >
        <View style={styles.ctaContent}>
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>Set Your Nutrition Goal</Text>
            <Text style={styles.ctaSubtitle}>
              Define your goal, calorie target and diet for personalized recommendations
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  const goalInfo = data?.goals ? GOAL_LABELS[data.goals] : null;
  const dietLabel = data?.diet_type ? (DIET_LABELS[data.diet_type] || data.diet_type) : null;

  return (
    <View style={styles.card}>
      {/*Header */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>My Goal</Text>
        <TouchableOpacity
          onPress={() => router.push('/onboarding/goal' as any)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
      </View>
      {/*Main info */}
      <View style={styles.infoRow}>
        {/*Goal */}
        {goalInfo && (
          <View style={[styles.infoPill, { backgroundColor: goalInfo.color + '15' }]}>
            <Text style={[styles.pillText, { color: goalInfo.color }]}>{goalInfo.label}</Text>
          </View>
        )}

        {/*Calories */}
        {data?.caloric_target && (
          <View style={[styles.infoPill, { backgroundColor: '#F59E0B15' }]}>
            <Text style={[styles.pillText, { color: '#D97706' }]}>
              {data.caloric_target} kcal/day
            </Text>
          </View>
        )}
      </View>

      {/*Diet */}
      {dietLabel && (
        <View style={styles.dietRow}>
          <Text style={styles.dietLabel}>Diet:</Text>
          <Text style={styles.dietValue}>{dietLabel}</Text>
        </View>
      )}

      {/*Allergies */}
      {data?.allergies && data.allergies.length > 0 && (
        <View style={styles.dietRow}>
          <Text style={styles.dietLabel}>Allergies:</Text>
          <Text style={styles.dietValue}>{data.allergies.join(', ')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  ctaCard: {
    borderWidth: 1.5,
    borderColor: '#E0E7FF',
    borderStyle: 'dashed',
  },
  ctaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ctaTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  ctaSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 5,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dietRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 5,
  },
  dietLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  dietValue: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  editText: {
    fontSize: 13,
    color: '#6366F1',
    fontWeight: '600',
  },
});
