import { IconSymbol } from '@/components/ui/icon-symbol';
import { AuthService } from '@/utils/authService';
import { foodAPI } from '@/utils/foodApi';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface RecognizedFood {
  id: number;
  name: string;
  brand?: string;
  category: string;
  quantity: number;
  quantity_unit: string;
  estimated_weight_grams: number;
  confidence: number;
  is_food: boolean;
  nutrition_per_100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export default function FoodRecognitionScreen() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [recognizedFoods, setRecognizedFoods] = useState<RecognizedFood[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const hasValidToken = await AuthService.ensureValidToken();
      setIsAuthenticated(hasValidToken);
      
      if (!hasValidToken) {
        console.log('Creating test user for authentication...');  
        const createResult = await AuthService.createTestUser();
        setIsAuthenticated(createResult.success);
      }
      await checkApiConnection();
    } catch (error) {
      console.error('Auth check error:', error);  //checking api connection
      setIsAuthenticated(false);
    }
  };

  const checkApiConnection = async () => {
    try {
      console.log('🔌 Checking API connection...');
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        console.log('API connection successful');
      } else {
        console.log('API connection issue, status:', response.status);
      }
    } catch (error) {
      console.error('API connection failed:', error);
      Alert.alert(
        'Connection Warning',
        'Cannot connect to the server. The app will work with demo data only.',
        [{ text: 'OK' }]
      );
    }
  };

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Sorry, we need camera roll permissions to make this work!');
      return false;
    }
    return true;
  };

  const takePhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, //disable cropping for better recognition
        quality: 0.5, //reduced quality — faster upload, AI works fine
        base64: false,
        exif: false,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        analyzeImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, //disable cropping
        quality: 0.5, //reduced quality — faster upload
        base64: false,
        exif: false,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        analyzeImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const analyzeImage = async (imageUri: string) => {
    setIsLoading(true);
    setLoadingStatus('Uploading image...');
    setRecognizedFoods([]);
    try {
      setLoadingStatus('AI is analyzing products...');
      const result = await foodAPI.scanProductImage(imageUri);
      
      console.log('[analyzeImage] Raw result keys:', result ? Object.keys(result) : 'null');
      const rawProducts = result?.products;
      let products: RecognizedFood[] = [];
      if (rawProducts && rawProducts.length > 0) {
        products = rawProducts.map((p: any, index: number) => ({
          id: p.id || index + 1,
          name: p.name || 'Unknown Product',
          brand: (p.brand && p.brand !== 'unknown') ? p.brand : undefined,
          category: p.category || 'Food',
          quantity: p.quantity || 1,
          quantity_unit: p.quantity_unit || 'piece',
          estimated_weight_grams: p.weight_grams || p.estimated_weight_grams || 100,
          confidence: p.confidence || 0.5,
          is_food: p.is_food !== undefined ? p.is_food : true,
          nutrition_per_100g: p.nutrition_per_100g || {
            calories: p.calories_per_100g || 0,
            protein: p.protein_per_100g || 0,
            carbs: p.carbs_per_100g || 0,
            fat: p.fat_per_100g || 0,
          },
        }));
      }
      
      console.log('[analyzeImage] Mapped products:', products.length);
      
      if (products.length > 0) {
        setRecognizedFoods(products);
        setLoadingStatus('Saving products...');
        console.log('[analyzeImage] Auto-adding products to preferences (parallel)...');
        const addResults = await Promise.allSettled(
          products.map(p => foodAPI.addScannedProduct({
            name: p.name,
            brand: p.brand,
            category: p.category,
            weight_grams: p.estimated_weight_grams,
            calories_per_100g: p.nutrition_per_100g?.calories || 0,
            protein_per_100g: p.nutrition_per_100g?.protein || 0,
            carbs_per_100g: p.nutrition_per_100g?.carbs || 0,
            fat_per_100g: p.nutrition_per_100g?.fat || 0,
          }))
        );
        const addedCount = addResults.filter(r => r.status === 'fulfilled').length;
        console.log(`Added ${addedCount}/${products.length} products to preferences`);
        
        Alert.alert(
          'Analysis Complete',
          `Products found: ${products.length}\n${products.map(p => `• ${p.name} (${p.estimated_weight_grams}g)`).join('\n')}${addedCount > 0 ? `\n\n${addedCount} product(s) saved` : ''}`,
          [
            { text: 'OK' },
            { text: 'My Products', onPress: () => router.push('/scanner/product-list' as any) }
          ]
        );
      } else {
        console.log('[analyzeImage] No products found in result. Full result:', JSON.stringify(result, null, 2));
        Alert.alert(
          'Not Found',
          'Could not recognize products in the photo. Try taking a clearer photo.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('[analyzeImage] Error:', error?.message, error);
      const isTimeout = error?.message?.includes('timed out') || error?.message?.includes('abort');
      Alert.alert(
        'Error',
        isTimeout 
          ? 'Analysis took too long. Try photographing fewer products or improving lighting.'
          : (error?.message || 'Error analyzing image. Please try again.'),
        [{ text: 'OK' }]
      );
    }
    setIsLoading(false);
    setLoadingStatus('');
  };

  // Add all recognized products to the user's preference list
  const addAllProductsToList = async (products: RecognizedFood[]) => {
    try {
      let addedCount = 0;
      let failedCount = 0;

      for (const product of products) {
        try {
          await foodAPI.addScannedProduct({
            name: product.name,
            brand: product.brand,
            category: product.category,
            weight_grams: product.estimated_weight_grams,
            calories_per_100g: product.nutrition_per_100g?.calories || 0,
            protein_per_100g: product.nutrition_per_100g?.protein || 0,
            carbs_per_100g: product.nutrition_per_100g?.carbs || 0,
            fat_per_100g: product.nutrition_per_100g?.fat || 0,
          });
          addedCount++;
          console.log(`Added product: ${product.name}`);      //use documented API: POST /preferences/me/add-scanned-product?product=Name
        } catch (error) {
          failedCount++;
          console.error(`Error adding: ${product.name}`, error);
        }
      }

      if (addedCount > 0) {
        Alert.alert(
          'Products Added!',
          `Successfully added: ${addedCount} product(s)${failedCount > 0 ? `\nFailed: ${failedCount}` : ''}`,
          [
            { text: 'Continue Scanning', style: 'default' },
            { text: 'View List', style: 'default', onPress: () => router.push('/scanner/product-list' as any) }
          ]
        );
      } else {
        Alert.alert('Error', 'Could not add any products');
      }
    } catch (error) {
      console.error('Error adding products:', error);
      Alert.alert('Error', 'Could not add products');
    }
  };

  const addToMealPlan = async (food: RecognizedFood) => {
    try {
      await foodAPI.addScannedProduct({
        name: food.name,
        brand: food.brand,
        category: food.category,
        weight_grams: food.estimated_weight_grams,
        calories_per_100g: food.nutrition_per_100g?.calories || 0,
        protein_per_100g: food.nutrition_per_100g?.protein || 0,
        carbs_per_100g: food.nutrition_per_100g?.carbs || 0,
        fat_per_100g: food.nutrition_per_100g?.fat || 0,
      });
      Alert.alert('Added!', `${food.name} added to your product list`);     //add product to preferences via documented API
    } catch (error) {
      console.error('Add to meal plan error:', error);
      Alert.alert('Error', 'Could not add product');
    }
  };

  const renderFoodItem = ({ item }: { item: RecognizedFood }) => (
    <View style={styles.foodItem}>
      <View style={styles.foodHeader}>
        <Text style={styles.foodName}>{item.name}</Text>
        <View style={styles.confidenceContainer}>
          <Text style={styles.confidenceText}>{Math.round(item.confidence * 100)}%</Text>
        </View>
      </View>
      
      {item.brand && (
        <Text style={styles.foodBrand}>{item.brand}</Text>
      )}
      
      <Text style={styles.foodDetails}>
        {item.estimated_weight_grams}g • {item.category}
      </Text>
      
      {(item.nutrition_per_100g.calories > 0 || item.nutrition_per_100g.protein > 0) ? (
        <View style={styles.nutritionContainer}>
          <Text style={styles.nutritionText}>
            For {item.estimated_weight_grams}g: {Math.round(((item.nutrition_per_100g.calories || 0) * item.estimated_weight_grams) / 100)} kcal
          </Text>
          <Text style={styles.nutritionText}>
            P: {Math.round(((item.nutrition_per_100g.protein || 0) * item.estimated_weight_grams) / 100 * 10) / 10}g • 
            C: {Math.round(((item.nutrition_per_100g.carbs || 0) * item.estimated_weight_grams) / 100 * 10) / 10}g • 
            F: {Math.round(((item.nutrition_per_100g.fat || 0) * item.estimated_weight_grams) / 100 * 10) / 10}g
          </Text>
        </View>
      ) : (
        <View style={styles.nutritionContainer}>
          <Text style={styles.nutritionText}>Nutrition data not available</Text>
        </View>
      )}
      
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => addToMealPlan(item)}
      >
        <IconSymbol name="plus.circle.fill" size={20} color="white" />
        <Text style={styles.addButtonText}>Add to Plan</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/*header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/' as any)} style={styles.homeButton}>
          <IconSymbol name="house.fill" size={20} color="#6366F1" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Food Recognition</Text>
          <View style={styles.authStatus}>
            <IconSymbol 
              name={isAuthenticated ? "lock.fill" : "lock.open.fill"} 
              size={16} 
              color={isAuthenticated ? "#4CAF50" : "#FF9800"} 
            />
            <Text style={[styles.authText, { color: isAuthenticated ? "#4CAF50" : "#FF9800" }]}>
              {isAuthenticated ? "Authenticated" : "Guest"}
            </Text>
          </View>
        </View>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content}>
        {/*image Selection */}
        <View style={styles.imageSection}>
          {selectedImage ? (
            <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <IconSymbol name="camera.fill" size={64} color="#ccc" />
              <Text style={styles.imagePlaceholderText}>Select food photo</Text>
            </View>
          )}
        </View>




        {/*action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={takePhoto}>
            <IconSymbol name="camera.fill" size={24} color="white" />
            <Text style={styles.actionButtonText}>Take Photo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
            <IconSymbol name="photo.fill" size={24} color="white" />
            <Text style={styles.actionButtonText}>Choose Photo</Text>
          </TouchableOpacity>
        </View>

        {/*loading Indicator */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.loadingText}>{loadingStatus || 'Analyzing image...'}</Text>
            <Text style={styles.loadingHint}>This may take 10-30 seconds</Text>
          </View>
        )}

        {/* Results */}
        {recognizedFoods.length > 0 && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>
              Recognized Products ({recognizedFoods.length})
            </Text>
            <FlatList
              data={recognizedFoods}
              renderItem={renderFoodItem}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
            />
            


            {/*acction buttons after recognition */}
            <View style={styles.recognitionActionsContainer}>
              <TouchableOpacity 
                style={styles.addAllButton}
                onPress={() => addAllProductsToList(recognizedFoods)}
              >
                <IconSymbol name="plus.circle.fill" size={20} color="#FFFFFF" />
                <Text style={styles.addAllButtonText}>Add All Products</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.viewListButton}
                onPress={() => router.push('/scanner/product-list')}
              >
                <IconSymbol name="list.clipboard" size={20} color="#4A90E2" />
                <Text style={styles.viewListButtonText}>View List</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    marginLeft: 5,
  },
  titleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  authStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  authText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  placeholder: {
    width: 70,
  },
  homeButton: {
    padding: 8,
    backgroundColor: '#F0EDFF',
    borderRadius: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  imageSection: {
    marginTop: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  selectedImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#333',
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: '#666',
  },
  imagePlaceholderText: {
    color: '#ccc',
    fontSize: 16,
    marginTop: 10,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 150,
    justifyContent: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 10,
    fontWeight: '600',
  },
  loadingHint: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 6,
  },
  progressContainer: {
    marginTop: 20,
    width: '80%',
    alignItems: 'center',
  },
  progressText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  resultsContainer: {
    marginBottom: 20,
  },
  resultsTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  foodItem: {
    backgroundColor: '#333',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
  },
  foodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  foodName: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  confidenceContainer: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  foodBrand: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 5,
  },
  foodDetails: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 10,
  },
  nutritionContainer: {
    backgroundColor: '#222',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  nutritionText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 5,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  recognitionActionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingHorizontal: 20,
  },
  addAllButton: {
    backgroundColor: '#27AE60',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 8,
  },
  addAllButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  viewListButton: {
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 8,
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  viewListButtonText: {
    color: '#4A90E2',
    fontSize: 16,
    fontWeight: '600',
  },
});