import { IconSymbol } from '@/components/ui/icon-symbol';
import { AuthService } from '@/utils/authService';
import { CameraType, CameraView, scanFromURLAsync, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { foodAPI } from '@/utils/foodApi';
export default function BarcodeScanner() {
  const router = useRouter();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedData, setScannedData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const lastScannedRef = useRef<string | null>(null);
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const valid = await AuthService.ensureValidToken();
        setIsAuthenticated(valid);
        if (!valid) {
          console.log('[BarcodeScanner] Not authenticated on mount — will prompt on scan');
        } else {
          console.log('BarcodeScanner] Authenticated on mount');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);
  const searchProduct = async (barcode: string) => {
    setIsLoading(true);
    setLoadingStatus('Checking authentication...');
    try {
      const hasValidToken = await AuthService.ensureValidToken();
      if (!hasValidToken) {
        console.warn('[BarcodeScanner] No valid token — attempting auto-login with test user');
        setLoadingStatus('Logging in...');
        const autoLogin = await AuthService.createTestUser();
        if (!autoLogin.success) {
          Alert.alert(
            'Authentication Required',
            'Please log in to scan products.',
            [
              { text: 'Go to Login', onPress: () => { lastScannedRef.current = null; router.push('/auth/login'); } },
              { text: 'Cancel', onPress: () => { lastScannedRef.current = null; setIsScanning(true); } }
            ]
          );
          setIsLoading(false);
          setLoadingStatus('');
          return;
        }
        setIsAuthenticated(true);
      }

      console.log(`[BarcodeScanner] Looking up barcode: ${barcode}`);
      setLoadingStatus('Searching product database...');
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Product lookup timed out. The server may be slow — please try again.')), 15000),
      );
      const result = await Promise.race([
        foodAPI.lookupBarcode(barcode),
        timeoutPromise,
      ]);

      console.log(`[BarcodeScanner] Lookup result:`, JSON.stringify(result).substring(0, 200));
      if (result && result.success && result.product) {
        const product = result.product;
        const productName = product.name || result.message || barcode;
        setScannedData(product);
        
        Alert.alert(
          'Success!',
          `Product "${productName}" found and added!`,
          [{ text: 'OK', onPress: () => { lastScannedRef.current = null; setIsScanning(true); } }]
        );
      } else {
        try {
          await foodAPI.addScannedProduct(barcode);
          Alert.alert(
            'Product Added',
            `Barcode "${barcode}" saved to your list. Product details not found in database.`,
            [{ text: 'OK', onPress: () => { lastScannedRef.current = null; setIsScanning(true); } }]
          );
        } catch (e) {
          Alert.alert('Not found', 'Product not found by barcode', [
            { text: 'OK', onPress: () => { lastScannedRef.current = null; setIsScanning(true); } }
          ]);
        }
      }
    } catch (error: any) {
      console.error(`[BarcodeScanner] Lookup error:`, error);
      const msg = error?.message || 'Error searching for product';
      if (msg.includes('Session expired') || msg.includes('validate credentials') || msg.includes('log in')) {
        setIsAuthenticated(false);
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please log in again.',
          [
            { text: 'Go to Login', onPress: () => { lastScannedRef.current = null; router.push('/auth/login'); } },
            { text: 'Cancel', onPress: () => { lastScannedRef.current = null; setIsScanning(true); } }
          ]
        );
      } else {
        Alert.alert('Search Error', msg, [
          { text: 'OK', onPress: () => { lastScannedRef.current = null; setIsScanning(true); } }
        ]);
      }
    }
    setIsLoading(false);
    setLoadingStatus('');
  };
  const uploadImage = async (imageUri: string) => {
    setIsLoading(true);
    setLoadingStatus('Scanning image for barcodes...');
    try {
      console.log(`[BarcodeScanner] Sending photo to server for barcode detection...`);
      const barcodeResult = await foodAPI.scanBarcodeFromImage(imageUri);
      console.log(`[BarcodeScanner] Server barcode result:`, JSON.stringify(barcodeResult).substring(0, 300));

      if (barcodeResult?.success && barcodeResult?.barcode) {
        const barcode = barcodeResult.barcode;
        const productInfo = barcodeResult.product_info;
        const productName = productInfo?.name || `Product ${barcode}`;

        setScannedData({
          name: productName,
          brand: productInfo?.brand || '',
          barcode: barcode,
          nutrition: productInfo?.nutrition || {},
          ...productInfo,
        });
        try {
          await foodAPI.addScannedProduct(productName);
          console.log(`[BarcodeScanner] Product "${productName}" saved to scan history`);
        } catch (e) {
          console.warn('[BarcodeScanner] Failed to save product to scan history:', e);
        }

        Alert.alert(
          'Product Found!',
          `Barcode: ${barcode}\nProduct: "${productName}"\n\nAdded to your product list!`,
          [{ text: 'OK', onPress: () => { lastScannedRef.current = null; setIsScanning(true); } }]
        );
        setIsLoading(false);
        setLoadingStatus('');
        return;
      } else {
        console.log('[BarcodeScanner] Server did not find barcode in photo');
      }
    } catch (serverErr: any) {
      console.warn('[BarcodeScanner] Server barcode scan failed:', serverErr?.message || serverErr);
    }
    try {
      const barcodeResults = await scanFromURLAsync(imageUri);
      console.log(`[BarcodeScanner] On-device scan: ${barcodeResults.length} codes found`);

      if (barcodeResults.length > 0) {
        const validBarcodes = barcodeResults.filter(r => /^\d{8,13}$/.test(r.data));
        if (validBarcodes.length > 0) {
          const best = validBarcodes[0];
          console.log(`[BarcodeScanner] On-device barcode: ${best.data} (type: ${best.type})`);
          setLoadingStatus(`Barcode ${best.data} found! Looking up product...`);
          await searchProduct(best.data);
          return;
        }
      }
    } catch (scanErr) {
      console.warn('[BarcodeScanner] On-device scan error:', scanErr);
    }
    setLoadingStatus('No barcode detected. Analyzing with AI...');
    try {
      const result = await foodAPI.scanProductImage(imageUri);
      if (result && result.products && result.products.length > 0) {
        const product = result.products[0];
        setScannedData(product);
        try {
          await foodAPI.addScannedProduct(product.name);
        } catch (e) {
          console.warn('Failed to add scanned product to preferences:', e);
        }
        
        Alert.alert(
          'AI Recognition',
          `No barcode found in the photo.\nAI identified: "${product.name}"\n\nNote: AI recognition may be less accurate than barcode scanning. Point camera directly at the barcode for best results.`,
          [{ text: 'OK', onPress: () => setIsScanning(true) }]
        );
      } else {
        Alert.alert(
          'Not Found',
          'No barcode or product detected in the photo. Try pointing the camera directly at the barcode.',
          [{ text: 'OK', onPress: () => setIsScanning(true) }]
        );
      }
    } catch (error: any) {
      const msg = error?.message || 'Error analyzing photo. Please try again.';
      const isOverloaded = msg.includes('overloaded') || msg.includes('503') || msg.includes('timed out');
      Alert.alert(
        isOverloaded ? 'Server Busy' : 'Analysis Error',
        isOverloaded
          ? 'The AI service is temporarily busy. Please wait a few seconds and try again.'
          : msg,
        [{ text: 'OK', onPress: () => setIsScanning(true) }]
      );
    }
    setIsLoading(false);
    setLoadingStatus('');
  };
  const VALID_PRODUCT_BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'org.gs1.EAN-13', 'org.gs1.EAN-8', 'org.gs1.UPC-A', 'org.gs1.UPC-E'];

  const isValidProductBarcode = (type: string, data: string): boolean => {
    const normalizedType = type?.toLowerCase() || '';
    const isProductType = VALID_PRODUCT_BARCODE_TYPES.some(t => normalizedType.includes(t.toLowerCase()));
    if (!isProductType) {
      console.log(`[BarcodeScanner] Ignoring non-product barcode type: ${type}`);
      return false;
    }
    //check data is numeric and correct length (8-13 digits for EAN/UPC)
    if (!/^\d{8,13}$/.test(data)) {
      console.log(`[BarcodeScanner] Ignoring invalid barcode data: ${data} (not 8-13 digits)`);
      return false;
    }
    return true;
  };

  const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (!isScanning || isLoading) return;
    if (!isValidProductBarcode(type, data)) return;
    if (lastScannedRef.current === data) return;
    lastScannedRef.current = data;
    setIsScanning(false);
    
    console.log(`[BarcodeScanner] Scanned barcode: ${data} (type: ${type})`);
    Alert.alert(
      'Barcode Scanned',
      `Barcode: ${data}\nType: ${type.replace('org.gs1.', '').toUpperCase()}\n\nSearch for this product?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            lastScannedRef.current = null;
            setIsScanning(true);
          },
        },
        {
          text: 'Search',
          onPress: () => {
            setIsLoading(true);
            searchProduct(data);
          },
        },
      ],
    );
  };


  const takePhoto = async () => {
    setIsLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert(
        'Error',
        'Failed to take photo',
        [{ text: 'OK', onPress: () => setIsScanning(true) }]
      );
    }
    setIsLoading(false);
  };

  const pickImage = async () => {
    setIsLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Photo selection error:', error);
      Alert.alert(
        'Error',
        'Failed to select photo',
        [{ text: 'OK', onPress: () => setIsScanning(true) }]
      );
    }
    setIsLoading(false);
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
          Camera permission is required for barcode scanning
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
        <TouchableOpacity onPress={() => router.replace('/(tabs)/' as any)} style={styles.homeButton}>
          <IconSymbol name="house.fill" size={20} color="#6366F1" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Barcode Scanner</Text>
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


      {/*camera Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.controlButton, isScanning && styles.controlButtonActive]}
          onPress={() => setIsScanning(!isScanning)}
        >
          <IconSymbol
            name={isScanning ? "viewfinder" : "play.fill"}
            size={24}
            color="white"
          />
          <Text style={styles.controlText}>
            {isScanning ? 'Stop' : 'Start'} scanning
          </Text>
        </TouchableOpacity>

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
          <Text style={styles.controlText}>Flip Camera</Text>
        </TouchableOpacity>
      </View>

      {/*camera — always mounted to avoid re-init lag */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing={facing}
          enableTorch={flashEnabled}
          onBarcodeScanned={isScanning && !isLoading ? handleBarcodeScanned : undefined}
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
          }}
        />
        <View style={styles.cameraOverlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.scanText}>
            {isScanning ? 'Point camera at barcode' : 'Scanning paused'}
          </Text>
        </View>
      </View>

      {/*additional Options */}
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

      {/*scan Results */}
      {scannedData && (
        <ScrollView style={styles.resultsContainer}>
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Product Information</Text>
            <Text style={styles.resultText}>Name: {scannedData.name || 'Unknown'}</Text>
            {scannedData.brand ? <Text style={styles.resultText}>Brand: {scannedData.brand}</Text> : null}
            <Text style={styles.resultText}>Protein: {scannedData.nutrition?.protein ?? scannedData.protein ?? 0}g</Text>
            <Text style={styles.resultText}>Fat: {scannedData.nutrition?.fat ?? scannedData.fat ?? 0}g</Text>
            <Text style={styles.resultText}>Carbs: {scannedData.nutrition?.carbohydrates ?? scannedData.carbs ?? 0}g</Text>
            <Text style={styles.resultText}>Calories: {scannedData.nutrition?.calories ?? scannedData.calories ?? 0} kcal</Text>

            {/* Add to product list button */}
            <TouchableOpacity
              style={styles.addToListButton}
              onPress={async () => {
                const productName = scannedData.name || 'Unknown Product';
                try {
                  await foodAPI.addScannedProduct(productName);
                  Alert.alert('✅ Added!', `"${productName}" has been added to your product list.`);
                } catch (e: any) {
                  console.error('Failed to add product:', e);
                  Alert.alert('Error', e?.message || 'Failed to add product to list.');
                }
              }}
            >
              <IconSymbol name="plus.circle.fill" size={20} color="white" />
              <Text style={styles.addToListButtonText}>Add to Product List</Text>
            </TouchableOpacity>

            {/* View product list button */}
            <TouchableOpacity
              style={styles.viewListButton}
              onPress={() => router.push('/scanner/product-list')}
            >
              <IconSymbol name="list.bullet" size={20} color="#6366F1" />
              <Text style={styles.viewListButtonText}>View Product List</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Scanning...</Text>
          {loadingStatus ? (
            <Text style={styles.loadingStatusText}>{loadingStatus}</Text>
          ) : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    marginLeft: 4,
  },
  placeholder: {
    width: 50,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  titleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  homeButton: {
    padding: 8,
    backgroundColor: '#F0EDFF',
    borderRadius: 8,
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
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    color: 'white',
    fontSize: 16,
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
  camera: {
    flex: 1,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  scanText: {
    color: 'white',
    fontSize: 16,
    marginTop: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
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
    maxHeight: 200,
    backgroundColor: '#1a1a1a',
  },
  resultCard: {
    backgroundColor: '#333',
    margin: 15,
    padding: 15,
    borderRadius: 8,
  },
  resultTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  resultText: {
    color: 'white',
    fontSize: 14,
    marginVertical: 2,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  loadingStatusText: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  progressContainer: {
    marginTop: 24,
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
  addToListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 14,
    gap: 8,
  },
  addToListButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  viewListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#6366F1',
    gap: 8,
  },
  viewListButtonText: {
    color: '#6366F1',
    fontSize: 15,
    fontWeight: '500',
  },
});