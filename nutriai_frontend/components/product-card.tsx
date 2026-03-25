import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Product } from '@/utils/foodApi';
import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';

interface ProductCardProps {
  product: Product;
  onPress: (product: Product) => void;
  showNutrition?: boolean;
  showAllergens?: boolean;
}

export function ProductCard({ 
  product, 
  onPress, 
  showNutrition = true, 
  showAllergens = true 
}: ProductCardProps) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(product)}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <IconSymbol name="photo" size={24} color="#888" />
          </View>
        )}
        <View style={styles.info}>
          <ThemedText style={styles.name} numberOfLines={2}>
            {product.name}
          </ThemedText>
          
          {product.brand && (
            <ThemedText style={styles.brand} numberOfLines={1}>
              {product.brand}
            </ThemedText>
          )}
          
          {product.category && (
            <ThemedText style={styles.category} numberOfLines={1}>
              {product.category}
            </ThemedText>
          )}
          
          {showNutrition && product.nutritional_info && (
            <View style={styles.nutritionContainer}>
              <View style={styles.nutritionRow}>
                <View style={styles.nutritionItem}>
                  <ThemedText style={styles.nutritionValue}>
                    {product.nutritional_info.calories || 'N/A'}
                  </ThemedText>
                  <ThemedText style={styles.nutritionLabel}>cal</ThemedText>
                </View>
                
                <View style={styles.nutritionItem}>
                  <ThemedText style={styles.nutritionValue}>
                    {product.nutritional_info.protein || 'N/A'}g
                  </ThemedText>
                  <ThemedText style={styles.nutritionLabel}>protein</ThemedText>
                </View>
                
                <View style={styles.nutritionItem}>
                  <ThemedText style={styles.nutritionValue}>
                    {product.nutritional_info.carbs || 'N/A'}g
                  </ThemedText>
                  <ThemedText style={styles.nutritionLabel}>carbs</ThemedText>
                </View>
                
                <View style={styles.nutritionItem}>
                  <ThemedText style={styles.nutritionValue}>
                    {product.nutritional_info.fat || 'N/A'}g
                  </ThemedText>
                  <ThemedText style={styles.nutritionLabel}>fat</ThemedText>
                </View>
              </View>
              
              {product.serving_size && (
                <ThemedText style={styles.servingSize}>
                  per {product.serving_size}
                </ThemedText>
              )}
            </View>
          )}
        
          {showAllergens && product.allergens && product.allergens.length > 0 && (
            <View style={styles.allergensContainer}>
              <IconSymbol name="exclamationmark.triangle.fill" size={12} color="#f39c12" />
              <ThemedText style={styles.allergensText} numberOfLines={1}>
                Contains: {product.allergens.join(', ')}
              </ThemedText>
            </View>
          )}
        </View>
        <IconSymbol name="chevron.right" size={16} color="#888" />
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  imagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
    lineHeight: 20,
  },
  brand: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  category: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  nutritionContainer: {
    marginTop: 4,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  nutritionItem: {
    alignItems: 'center',
    flex: 1,
  },
  nutritionValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  nutritionLabel: {
    fontSize: 10,
    color: '#666',
  },
  servingSize: {
    fontSize: 10,
    color: '#888',
    textAlign: 'center',
    marginTop: 2,
  },
  allergensContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  allergensText: {
    fontSize: 11,
    color: '#f39c12',
    flex: 1,
  },
});