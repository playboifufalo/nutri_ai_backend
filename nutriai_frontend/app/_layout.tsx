import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { OnboardingProvider } from '@/hooks/use-onboarding';
import { AuthService } from '@/utils/authService';

export const unstable_settings = {
  // Ensure the tabs anchor to the index route on web.
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthentication();
  }, []);

  // Redirect based on auth state
  useEffect(() => {
    if (isChecking) return;
    if (!isAuthenticated) {
      router.replace('/auth/login' as any);
    }
  }, [isChecking, isAuthenticated]);

  const checkAuthentication = async () => {
    try {
      // Load tokens from AsyncStorage into memory
      await AuthService.loadTokensFromStorage();
      const authenticated = await AuthService.isAuthenticated();
      
      if (authenticated) {
        console.log('User is authenticated');
      } else {
        console.log('User is not authenticated, showing login');
      }
      
      setIsAuthenticated(authenticated);
      setIsChecking(false);
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthenticated(false);
      setIsChecking(false);
    }
  };
  //Showing loading
  if (isChecking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}> 
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={{ marginTop: 12, color: '#666', fontSize: 14 }}>Initializing...</Text>
      </View>
    );
  }

  return (
    <OnboardingProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen name="scanner" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </OnboardingProvider>
  );
}
