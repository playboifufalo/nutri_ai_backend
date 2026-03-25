import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScanHistoryItem } from '@/utils/foodApi';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

interface ScanCardProps {
  item: ScanHistoryItem;
  onPress: (item: ScanHistoryItem) => void;
}

export function ScanCard({ item, onPress }: ScanCardProps) {
  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'barcode':
        return 'barcode.viewfinder';
      case 'image':
        return 'camera.fill';
      case 'manual':
        return 'text.cursor';
      default:
        return 'questionmark.circle';
    }
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'barcode':
        return '#007AFF';
      case 'image':
        return '#34C759';
      case 'manual':
        return '#FF9500';
      default:
        return '#666';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return `${diffInMinutes} minutes ago`;
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `${hours} hours ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(item)}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.productInfo}>
            <ThemedText style={styles.productName} numberOfLines={2}>
              {item.product_name}
            </ThemedText>
            {item.brand && (
              <ThemedText style={styles.productBrand} numberOfLines={1}>
                {item.brand}
              </ThemedText>
            )}
          </View>
          
          <View style={styles.meta}>
            {item.is_favorite && (
              <IconSymbol name="heart.fill" size={16} color="#FF3B30" />
            )}
            <View style={[styles.methodBadge, { backgroundColor: getMethodColor(item.scan_method) + '20' }]}>
              <IconSymbol 
                name={getMethodIcon(item.scan_method)} 
                size={12} 
                color={getMethodColor(item.scan_method)} 
              />
              <ThemedText 
                style={[styles.methodText, { color: getMethodColor(item.scan_method) }]}
              >
                {item.scan_method}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Nutrition Summary */}
        {item.nutritional_info && (
          <View style={styles.nutritionSummary}>
            <View style={styles.nutritionItem}>
              <ThemedText style={styles.nutritionValue}>
                {item.nutritional_info.calories || 'N/A'}
              </ThemedText>
              <ThemedText style={styles.nutritionLabel}>cal</ThemedText>
            </View>
            <View style={styles.nutritionItem}>
              <ThemedText style={styles.nutritionValue}>
                {item.nutritional_info.protein || 'N/A'}g
              </ThemedText>
              <ThemedText style={styles.nutritionLabel}>protein</ThemedText>
            </View>
            <View style={styles.nutritionItem}>
              <ThemedText style={styles.nutritionValue}>
                {item.nutritional_info.carbs || 'N/A'}g
              </ThemedText>
              <ThemedText style={styles.nutritionLabel}>carbs</ThemedText>
            </View>
            <View style={styles.nutritionItem}>
              <ThemedText style={styles.nutritionValue}>
                {item.nutritional_info.fat || 'N/A'}g
              </ThemedText>
              <ThemedText style={styles.nutritionLabel}>fat</ThemedText>
            </View>
          </View>
        )}

        {/* Allergens */}
        {item.allergens && item.allergens.length > 0 && (
          <View style={styles.allergensContainer}>
            <IconSymbol name="exclamationmark.triangle.fill" size={12} color="#f39c12" />
            <ThemedText style={styles.allergensText} numberOfLines={1}>
              {item.allergens.join(', ')}
            </ThemedText>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <ThemedText style={styles.scanDate}>
            {formatDate(item.scanned_at)}
          </ThemedText>
          <IconSymbol name="chevron.right" size={16} color="#888" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
    lineHeight: 20,
  },
  productBrand: {
    fontSize: 14,
    color: '#666',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  methodText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  nutritionSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  nutritionItem: {
    alignItems: 'center',
    flex: 1,
  },
  nutritionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  nutritionLabel: {
    fontSize: 11,
    color: '#666',
  },
  allergensContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  allergensText: {
    fontSize: 12,
    color: '#f39c12',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scanDate: {
    fontSize: 12,
    color: '#888',
  },
});