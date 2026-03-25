import { Ionicons } from '@expo/vector-icons';
import type { UserProfile as AuthUser } from '@/types/auth';
import { AuthService } from '@/utils/authService';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    // First try cached user
    let currentUser = await AuthService.getUser();
    
    // If no cached user or missing email, fetch from backend
    if (!currentUser || !currentUser.email || currentUser.email === 'email@example.com') {
      try {
        const token = await AuthService.getToken();
        if (token) {
          const { NetworkAutoConfig } = await import('@/utils/networkAutoConfig');
          const config = await NetworkAutoConfig.getNetworkConfig();
          const response = await fetch(`${config.apiUrl}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (response.ok) {
            const data = await response.json();
            // Map backend UserResponse to our AuthUser shape
            currentUser = {
              id: String(data.id),
              username: data.username,
              email: data.email,
              firstName: data.full_name?.split(' ')[0] || data.username,
              lastName: data.full_name?.split(' ').slice(1).join(' ') || '',
            } as AuthUser;
            await AuthService.setUser(currentUser);
          }
        }
      } catch (e) {
        console.warn('Failed to fetch profile from backend:', e);
      }
    }
    
    setUser(currentUser);
  };

  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          onPress: async () => {
            try {
              await AuthService.logout();
              router.replace('/auth/login' as any);
            } catch (error: any) {
              Alert.alert('Error', 'Failed to log out: ' + error.message);
            }
          },
          style: 'destructive',
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={48} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.name}>{user?.firstName || user?.username || 'User'}</Text>
          <Text style={styles.email}>{user?.email || 'email@example.com'}</Text>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => router.push('/onboarding/goal' as any)}
          >
            <View style={[styles.settingIcon, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="nutrition-outline" size={20} color="#6366F1" />
            </View>
            <Text style={styles.settingText}>Nutrition Preferences</Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="notifications-outline" size={20} color="#F59E0B" />
            </View>
            <Text style={styles.settingText}>Notifications</Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#10B981" />
            </View>
            <Text style={styles.settingText}>Privacy</Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: '#F0F9FF' }]}>
              <Ionicons name="help-circle-outline" size={20} color="#3B82F6" />
            </View>
            <Text style={styles.settingText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Build</Text>
            <Text style={styles.infoValue}>NutriAI</Text>
          </View>
        </View>

        {/* Logout Button - always visible, prominent */}
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
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
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  email: {
    fontSize: 15,
    color: '#6B7280',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: {
    fontSize: 15,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 10,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
});
