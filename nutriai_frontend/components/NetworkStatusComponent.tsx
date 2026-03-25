import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NetworkAutoConfig } from '../utils/networkAutoConfig';

interface NetworkStatusProps {
  onConfigChange?: (apiUrl: string) => void;
}

export const NetworkStatusComponent: React.FC<NetworkStatusProps> = ({ onConfigChange }) => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [currentApiUrl, setCurrentApiUrl] = useState<string>('');
  const [networkType, setNetworkType] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    checkNetworkStatus();
  }, []);

  const checkNetworkStatus = async () => {
    try {
      setIsRefreshing(true);
      
      //get current configuration
      const config = await NetworkAutoConfig.getNetworkConfig();
      setCurrentApiUrl(config.apiUrl);
      setNetworkType(config.networkType);
      
      //check connection
      const connected = await NetworkAutoConfig.quickConnectionTest(config.apiUrl);
      setIsConnected(connected);
      
      //notify parent component about configuration change
      if (onConfigChange) {
        onConfigChange(config.apiUrl);
      }
      
    } catch (error) {
      console.error('Error of connection:', error);
      setIsConnected(false);
    } finally {
      setIsRefreshing(false);
    }
  };

  const refreshNetworkConfig = async () => {
    try {
      setIsRefreshing(true);
      
      //forcefully update configuration
      const newConfig = await NetworkAutoConfig.refreshNetworkConfig();
      setCurrentApiUrl(newConfig.apiUrl);
      setNetworkType(newConfig.networkType);
      
      //check new connection
      const connected = await NetworkAutoConfig.quickConnectionTest(newConfig.apiUrl);
      setIsConnected(connected);
      
      if (onConfigChange) {
        onConfigChange(newConfig.apiUrl);
      }
      
      Alert.alert(
        'Configuration Updated',
        `New API URL: ${newConfig.apiUrl}\nStatus: ${connected ? 'Connected!' : 'Error'}`
      );
      
    } catch (error) {
      Alert.alert('Error', 'Could not update configuration');
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusColor = () => {
    if (isConnected === null) return '#FFA500'; 
    return isConnected ? '#4CAF50' : '#F44336'; 
  };

  const getStatusText = () => {
    if (isRefreshing) return 'Loading...';
    if (isConnected === null) return 'Unknown';
    return isConnected ? 'Connected' : 'Error';
  };

  const getNetworkTypeText = () => {
    switch (networkType) {
      case 'auto-detected':
        return 'Auto-detected';
      case 'fallback':
        return 'Fallback';
      default:
        return networkType || 'Unknown';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusContainer}>
        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
        <View style={styles.statusText}>
          <Text style={styles.statusLabel}>Connection status: {getStatusText()}</Text>
          <Text style={styles.apiUrl}>API: {currentApiUrl}</Text>
          <Text style={styles.networkType}>Type: {getNetworkTypeText()}</Text>
        </View>
      </View>
      
      <TouchableOpacity 
        style={styles.refreshButton}
        onPress={refreshNetworkConfig}
        disabled={isRefreshing}
      >
        <Text style={styles.refreshButtonText}>
          {isRefreshing ? 'Updating...' : 'Refresh Connection'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    margin: 10,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  statusText: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  apiUrl: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  networkType: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});