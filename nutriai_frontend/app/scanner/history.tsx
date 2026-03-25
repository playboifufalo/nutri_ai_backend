import { ScanCard } from '@/components/scan-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { foodAPI, ScanHistoryItem } from '@/utils/foodApi';
import { preferencesApi } from '@/utils/preferencesApi';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
export default function ScanHistoryScreen() {
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  useEffect(() => {
    loadScanHistory();
  }, []);

  const loadScanHistory = async () => {
    try {
      const history = await foodAPI.getScanHistory();
      setScanHistory(history);
    } catch (error) {
      console.error('Failed to load scan history:', error);
      Alert.alert('Error', 'Failed to load scan history. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadScanHistory();
    setIsRefreshing(false);
  }, []);

  const handleScanItemPress = (item: ScanHistoryItem) => {
    Alert.alert(
      item.product_name,
      `Brand: ${item.brand || 'N/A'}\nScanned: ${new Date(item.scanned_at).toLocaleDateString()}\nMethod: ${item.scan_method}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add to Favorites', onPress: () => addToFavorites(item) },
        { text: 'Add to Liked', onPress: () => addToLiked(item) },
        { text: 'View Details', onPress: () => viewDetails(item) }
      ]
    );
  };

  const addToFavorites = async (item: ScanHistoryItem) => {
    try {
      await foodAPI.addToFavorites(item.id);
      Alert.alert('Success', `${item.product_name} added to favorites!`);
      setScanHistory(prev => 
        prev.map(scan => 
          scan.id === item.id 
            ? { ...scan, is_favorite: true }
            : scan
        )
      );
    } catch (error) {
      console.error('Failed to add to favorites:', error);
      Alert.alert('Error', 'Failed to add to favorites. Please try again.');
    }
  };



  const addToLiked = async (item: ScanHistoryItem) => {
    try {
      await preferencesApi.addLikedProduct(item.product_name);
      Alert.alert('Success', `${item.product_name} added to your liked products!`);
    } catch (error) {
      console.error('Failed to add to liked products:', error);
      Alert.alert('Error', 'Failed to add to liked products. Please try again.');
    }
  };



  const viewDetails = async (item: ScanHistoryItem) => {
    try {
      const details = await foodAPI.getScanDetails(item.id);
      const detailsText = `
    Product: ${details.product_name}
    Brand: ${details.brand || 'N/A'}
    Barcode: ${details.barcode || 'N/A'}
    Scan Method: ${details.scan_method}
    Scanned At: ${new Date(details.scanned_at).toLocaleString()}

    Nutrition (per ${details.nutritional_info ? '100g' : 'N/A'}):
    Calories: ${details.nutritional_info?.calories || 'N/A'}
    Protein: ${details.nutritional_info?.protein || 'N/A'}g
    Carbs: ${details.nutritional_info?.carbs || 'N/A'}g
    Fat: ${details.nutritional_info?.fat || 'N/A'}g
    Fiber: ${details.nutritional_info?.fiber || 'N/A'}g
    Sugar: ${details.nutritional_info?.sugar || 'N/A'}g
    Sodium: ${details.nutritional_info?.sodium || 'N/A'}mg

${details.allergens?.length ? `Allergens: ${details.allergens.join(', ')}` : 'No allergens listed'}
${details.ingredients?.length ? `\nIngredients: ${details.ingredients.join(', ')}` : ''}
      `;
      
      Alert.alert('Product Details', detailsText.trim());
    } catch (error) {
      console.error('Failed to get scan details:', error);
      Alert.alert('Error', 'Failed to get product details. Please try again.');
    }
  };

  const renderScanItem = ({ item }: { item: ScanHistoryItem }) => (
    <ScanCard
      item={item}
      onPress={handleScanItemPress}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <IconSymbol name="doc.text.magnifyingglass" size={64} color="#ccc" />
      <ThemedText style={styles.emptyTitle}>No Scanned Products</ThemedText>
      <ThemedText style={styles.emptySubtitle}>
        Start scanning products to see your history here
      </ThemedText>
      <TouchableOpacity 
        style={styles.scanButton}
        onPress={() => router.push('/scanner/barcode' as any)}
      >
        <IconSymbol name="camera.fill" size={20} color="#fff" />
        <ThemedText style={styles.scanButtonText}>Start Scanning</ThemedText>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Loading scan history...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/' as any)} style={styles.homeButton}>
          <IconSymbol name="house.fill" size={20} color="#6366F1" />
          <ThemedText style={styles.homeButtonText}>Home</ThemedText>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={scanHistory}
        renderItem={renderScanItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
          />
        }
        contentContainerStyle={[
          styles.listContainer,
          scanHistory.length === 0 && styles.emptyListContainer
        ]}
        showsVerticalScrollIndicator={false}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 4,
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F0EDFF',
    borderRadius: 8,
    gap: 4,
  },
  homeButtonText: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '600',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});