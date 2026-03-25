import MealPlanWidget from '@/components/MealPlanWidget';
import { NetworkStatusComponent } from '@/components/NetworkStatusComponent';
import NutritionGoalWidget from '@/components/NutritionGoalWidget';
import TodayStatsWidget from '@/components/TodayStatsWidget';
import { AuthService } from '@/utils/authService';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AuthService.getToken();
      
      if (!token) {
        console.log('No token found, user needs to login');
        setIsAuthenticated(false);
      } else {
        console.log('Token found');
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScannerAction = (path: string) => {
    if (!isAuthenticated) {
      Alert.alert(
        'Authentication Required',
        'Please log in to use scanner features.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Login', onPress: () => router.push('../auth/login' as any) }
        ]
      );
      return;
    }
    router.push(path as any);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {/*header*/}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome</Text> 
          <Text style={styles.appName}>NutriAI</Text>
        </View>
        <TouchableOpacity style={styles.notificationButton}>
          <Text style={styles.notificationIcon}>⚙</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Network Status Component */}
        <NetworkStatusComponent 
          onConfigChange={(apiUrl) => {
            console.log('API configuration changed to:', apiUrl);
          }}
        />

        {/* Nutrition Goal Widget */}
        {isAuthenticated && <NutritionGoalWidget />}

        {/*stats card - dynamic*/}
        {isAuthenticated && <TodayStatsWidget />}

        {/*quick actions*/}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        <View style={styles.actionsGrid}>
          <TouchableOpacity 
            style={[styles.actionCard, { backgroundColor: isAuthenticated ? '#6366F1' : '#9CA3AF' }]}
            onPress={() => handleScannerAction('../scanner/barcode')}
          >
            <Text style={styles.actionIcon}>⊞</Text>
            <Text style={styles.actionTitle}>Barcode Scanner</Text>
            <Text style={styles.actionSubtitle}>
              {isAuthenticated ? 'Scan product barcode' : 'Login required'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionCard, { backgroundColor: isAuthenticated ? '#10B981' : '#9CA3AF' }]}
            onPress={() => handleScannerAction('../scanner/food-recognition')}
          >
            <Text style={styles.actionIcon}>◎</Text>
            <Text style={styles.actionTitle}>AI Scanner</Text>
            <Text style={styles.actionSubtitle}>
              {isAuthenticated ? 'AI product recognition' : 'Login required'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionsGrid}>
          <TouchableOpacity 
            style={[styles.actionCard, { backgroundColor: isAuthenticated ? '#007AFF' : '#9CA3AF' }]}
            onPress={() => handleScannerAction('../scanner/search')}
          >
            <Text style={styles.actionIcon}>⌕</Text>
            <Text style={styles.actionTitle}>Search Products</Text>
            <Text style={styles.actionSubtitle}>
              {isAuthenticated ? 'Find products manually' : 'Login required'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionCard, { backgroundColor: isAuthenticated ? '#EC4899' : '#9CA3AF' }]}
            onPress={() => handleScannerAction('../scanner/product-list')}
          >
            <Text style={styles.actionIcon}>☰</Text>
            <Text style={styles.actionTitle}>My Products</Text>
            <Text style={styles.actionSubtitle}>
              {isAuthenticated ? 'View all products' : 'Login required'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Meal Plan Widget */}
        {isAuthenticated && (
          <MealPlanWidget />
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  greeting: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 2,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationIcon: {
    fontSize: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 10,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  actionCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 4,
    alignItems: 'center',
    minHeight: 100,
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 22,
    marginBottom: 6,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: 11,
    color: '#FFFFFF',
    opacity: 0.8,
    textAlign: 'center',
  },
});