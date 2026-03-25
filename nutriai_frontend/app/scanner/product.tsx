import { IconSymbol } from '@/components/ui/icon-symbol';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { foodAPI } from '../../utils/foodApi';

export default function ProductScanner() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedData, setScannedData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [productDescription, setProductDescription] = useState('');

  useEffect(() => {
    requestCameraPermissions();
  }, []);

  const requestCameraPermissions = async () => {
    if (!permission?.granted) {
      await requestPermission();
    }
  };

  //upload image via /scanner-ai/analyze-advanced
  const uploadImage = async (imageUri: string, description?: string) => {
    setIsLoading(true);
    setAnalysisResult(null);
    try {
      const result = await foodAPI.scanProductImage(imageUri);
      setAnalysisResult(result);
      setScannedData(result);
      
      const product = result.products?.[0];
      if (product) {
        //auto-add to preferences
        try {
          await foodAPI.addScannedProduct(product.name);
        } catch (e) {
          console.warn('Failed to add product to preferences:', e);
        }
        
        Alert.alert(
          'Analysis Complete!',
          `Product: ${product.name}\nWeight: ${product.weight_grams || 0}g\nConfidence: ${Math.round((product.confidence || 0) * 100)}%`,
          [{ text: 'OK', onPress: () => setIsCameraActive(false) }]
        );
      } else {
        Alert.alert(
          'Not Found',
          'Could not recognize product in the photo. Try again.',
          [{ text: 'OK', onPress: () => setIsCameraActive(false) }]
        );
      }
    } catch (error: any) {
      console.error('Scan error:', error);
      Alert.alert(
        'Analysis Error',
        error?.message || 'Error analyzing product. Please try again.',
        [{ text: 'OK', onPress: () => setIsCameraActive(false) }]
      );
    }
    setIsLoading(false);
  };

  const takePhoto = async () => {
    setIsLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri, productDescription);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert(
        'Error',
        'Failed to take photo',
        [{ text: 'OK', onPress: () => setIsCameraActive(false) }]
      );
    }
    setIsLoading(false);
  };

  const pickImage = async () => {
    setIsLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri, productDescription);
      }
    } catch (error) {
      console.error('Photo selection error:', error);
      Alert.alert(
        'Error',
        'Failed to select photo',
        [{ text: 'OK', onPress: () => setIsCameraActive(false) }]
      );
    }
    setIsLoading(false);
  };

  const capturePhoto = async () => {
    setIsCameraActive(false);
    await takePhoto();
  };

  if (permission === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>
          Camera permission is required for product analysis
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Product Scanner</Text>
        <Text style={styles.subtitle}>
          Take a photo of a product to get nutrition information
        </Text>
      </View>


      <View style={styles.descriptionContainer}>
        <Text style={styles.descriptionLabel}>
          Describe the product (optional):
        </Text>
        <TextInput
          style={styles.descriptionInput}
          placeholder="For example: red apple, banana, bread..."
          placeholderTextColor="#999"
          value={productDescription}
          onChangeText={setProductDescription}
          multiline
        />
      </View>



      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.controlButton, isCameraActive && styles.controlButtonActive]}
          onPress={() => setIsCameraActive(!isCameraActive)}
        >
          <IconSymbol
            name={isCameraActive ? "camera.fill" : "viewfinder"}
            size={24}
            color="white"
          />
          <Text style={styles.controlText}>
            {isCameraActive ? 'Hide' : 'Show'} camera
          </Text>
        </TouchableOpacity>

        {isCameraActive && (
          <>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => setFlashEnabled(!flashEnabled)}
            >
              <IconSymbol
                name={flashEnabled ? "flashlight.on.fill" : "flashlight.off.fill"}
                size={24}
                color="white"
              />
              <Text style={styles.controlText}>
                {flashEnabled ? 'Turn off' : 'Turn on'} flash
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
            >
              <IconSymbol name="camera.rotate.fill" size={24} color="white" />
              <Text style={styles.controlText}>Flip</Text>
            </TouchableOpacity>
          </>
        )}
      </View>



      {/*camera */}
      {isCameraActive && (
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing={facing}
            enableTorch={flashEnabled}
          >
            <View style={styles.cameraOverlay}>
              <View style={styles.scanFrame} />
              <Text style={styles.scanText}>
                Point camera at product
              </Text>
              <TouchableOpacity
                style={styles.captureButton}
                onPress={capturePhoto}
                disabled={isLoading}
              >
                <IconSymbol name="camera.fill" size={32} color="white" />
              </TouchableOpacity>
            </View>
          </CameraView>
        </View>
      )}

      {/* Photo Options */}
      <View style={styles.optionsContainer}>
        <TouchableOpacity
          style={styles.optionButton}
          onPress={takePhoto}
          disabled={isLoading}
        >
          <IconSymbol name="camera.fill" size={24} color="white" />
          <Text style={styles.optionText}>Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.optionButton}
          onPress={pickImage}
          disabled={isLoading}
        >
          <IconSymbol name="photo.fill" size={24} color="white" />
          <Text style={styles.optionText}>Choose from Gallery</Text>
        </TouchableOpacity>
      </View>

      
      {analysisResult && (
        <ScrollView style={styles.resultsContainer}>
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Analysis Result</Text>
            
            <View style={styles.nutritionInfo}>
              <Text style={styles.productName}>
                {analysisResult.name || 'Unknown Product'}
              </Text>
              
              <View style={styles.nutritionRow}>
                <Text style={styles.nutritionLabel}>Protein:</Text>
                <Text style={styles.nutritionValue}>
                  {analysisResult.protein || 0}g
                </Text>
              </View>
              
              <View style={styles.nutritionRow}>
                <Text style={styles.nutritionLabel}>Fat:</Text>
                <Text style={styles.nutritionValue}>
                  {analysisResult.fat || 0}g
                </Text>
              </View>
              
              <View style={styles.nutritionRow}>
                <Text style={styles.nutritionLabel}>Carbs:</Text>
                <Text style={styles.nutritionValue}>
                  {analysisResult.carbs || 0}g
                </Text>
              </View>
              
              <View style={styles.nutritionRow}>
                <Text style={styles.nutritionLabel}>Calories:</Text>
                <Text style={styles.nutritionValue}>
                  {analysisResult.calories || 0}
                </Text>
              </View>
            </View>

            {analysisResult.description && (
              <View style={styles.descriptionResult}>
                <Text style={styles.descriptionResultTitle}>Description:</Text>
                <Text style={styles.descriptionResultText}>
                  {analysisResult.description}
                </Text>
              </View>
            )}

            {analysisResult.confidence && (
              <Text style={styles.confidenceText}>
                Confidence: {Math.round(analysisResult.confidence * 100)}%
              </Text>
            )}
          </View>
        </ScrollView>
      )}

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Analyzing product...</Text>
          <Text style={styles.loadingSubtext}>
            Using AI to determine composition
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    color: 'white',
    fontSize: 16,
    paddingHorizontal: 20,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 20,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  descriptionContainer: {
    padding: 15,
    backgroundColor: '#1a1a1a',
  },
  descriptionLabel: {
    color: 'white',
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  descriptionInput: {
    backgroundColor: '#333',
    color: 'white',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    minHeight: 60,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
    backgroundColor: '#1a1a1a',
  },
  controlButton: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#333',
    minWidth: 80,
  },
  controlButtonActive: {
    backgroundColor: '#007AFF',
  },
  controlText: {
    color: 'white',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  cameraContainer: {
    height: 300,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 200,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  scanText: {
    color: 'white',
    fontSize: 16,
    marginVertical: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  captureButton: {
    backgroundColor: '#007AFF',
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    backgroundColor: '#1a1a1a',
  },
  optionButton: {
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    minWidth: 120,
  },
  optionText: {
    color: 'white',
    fontSize: 14,
    marginTop: 5,
    textAlign: 'center',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  resultCard: {
    backgroundColor: '#333',
    margin: 15,
    padding: 20,
    borderRadius: 12,
  },
  resultTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  nutritionInfo: {
    marginBottom: 15,
  },
  productName: {
    color: '#007AFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 5,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#555',
  },
  nutritionLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  nutritionValue: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  descriptionResult: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#444',
    borderRadius: 8,
  },
  descriptionResultTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  descriptionResultText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },
  confidenceText: {
    color: '#007AFF',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 15,
    fontWeight: '500',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  loadingSubtext: {
    color: '#ccc',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
  },
});