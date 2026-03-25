import { router } from 'expo-router';
import React, { useEffect } from 'react';
import {
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

export default function ScannerHomeScreen() {
  useEffect(() => {
    router.replace('/(tabs)/' as any);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Redirecting...</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#7F8C8D',
  },
});