import { Platform } from 'react-native';
import Constants from 'expo-constants';

interface NetworkConfig {
  apiUrl: string;
  isLocalHost: boolean;
  networkType: string;
  ipAddress?: string;
}
//NetworkAutoConfig — automatically detects the backend URL in development
export class NetworkAutoConfig {
  private static readonly BACKEND_PORT = 3001;
  private static readonly REQUEST_TIMEOUT = 5000;
  private static readonly MEMORY_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  //in-memory cache (valid for 10 minutes)
  private static cachedConfig: NetworkConfig | null = null;
  private static cacheTimestamp: number = 0;
  private static discoveryInProgress: Promise<NetworkConfig> | null = null;

  static async getNetworkConfig(): Promise<NetworkConfig> {
    if (this.cachedConfig && (Date.now() - this.cacheTimestamp) < this.MEMORY_CACHE_TTL) {
      return this.cachedConfig;
    }

    if (this.discoveryInProgress) {
      return this.discoveryInProgress;
    }
    this.discoveryInProgress = this.discoverBackend();
    try {
      const config = await this.discoveryInProgress;
      this.cachedConfig = config;
      this.cacheTimestamp = Date.now();
      return config;
    } finally {
      this.discoveryInProgress = null;
    }
  }

  private static async discoverBackend(): Promise<NetworkConfig> {
    const saved = await this.loadFromStorage();
    if (saved) {
      const isWorking = await this.testConnection(saved.apiUrl);
      if (isWorking) {
        console.log('Loaded saved config:', saved.apiUrl);
        return saved;
      }
      console.log('Saved config not working, searching for new...');
    }
    const candidates = this.getPriorityAddresses();
    console.log('Checking priority addresses:', candidates);
    const result = await this.raceConnections(candidates);

    if (result) {
      console.log('Backend found:', result.apiUrl);
      await this.saveToStorage(result);
      return result;
    }
    const fallback = this.getFallbackConfig();
    console.log('Backend not found, using fallback:', fallback.apiUrl);
    return fallback;
  }


  //here we generate a short list of candidate URLs to check, prioritizing the most likely ones (dev server IP, localhost variants)
  private static getPriorityAddresses(): string[] {
    const port = this.BACKEND_PORT;
    const addresses: string[] = [];
    const devServerHost = Constants.expoConfig?.hostUri 
      ?? (Constants as any).manifest?.debuggerHost 
      ?? (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
    if (devServerHost) {
      const computerIp = devServerHost.split(':')[0];
      if (computerIp && computerIp !== '127.0.0.1' && computerIp !== 'localhost') {
        // This is the computer's real LAN IP — use it first!
        addresses.push(`http://${computerIp}:${port}`);
        console.log(`[NetworkAutoConfig] Detected dev server IP: ${computerIp}`);
      }
    }
    if (Platform.OS === 'ios') {
      addresses.push(`http://localhost:${port}`);
    } else if (Platform.OS === 'android') {
      addresses.push(`http://10.0.2.2:${port}`);
      addresses.push(`http://localhost:${port}`);
    } else {
      addresses.push(`http://localhost:${port}`); //here we add localhost for  other platforms for the future
    }

    const envUrl = process.env.EXPO_PUBLIC_API_URL;
    if (envUrl && !addresses.includes(envUrl)) {
      addresses.push(envUrl);
    }

    return addresses;
  }

  private static async raceConnections(urls: string[]): Promise<NetworkConfig | null> {
    const promises = urls.map(async (url): Promise<NetworkConfig | null> => {
      const isWorking = await this.testConnection(url);
      if (isWorking) {
        const host = url.replace(/^https?:\/\//, '').split(':')[0];
        return {
          apiUrl: url,
          isLocalHost: host === 'localhost' || host === '127.0.0.1',
          networkType: 'auto-detected',
          ipAddress: host,
        };
      }
      return null;
    });

    const results = await Promise.all(promises);
    return results.find(r => r !== null) || null;
  }

  private static async testConnection(apiUrl: string): Promise<boolean> {
    try {
      console.log(`Checking: ${apiUrl}/health`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

      const response = await fetch(`${apiUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        console.log(`Backend found: ${apiUrl}`, data);
        return data.status === 'healthy' || data.message === 'OK';
      }
      return false;
    } catch {
      return false;
    }
  }
//if all else fails, return a reasonable default based on platform
  private static getFallbackConfig(): NetworkConfig {
    const port = this.BACKEND_PORT;
    let url: string;

    //try dev server IP first (works on real devices)
    const devServerHost = Constants.expoConfig?.hostUri
      ?? (Constants as any).manifest?.debuggerHost
      ?? (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
    if (devServerHost) {
      const computerIp = devServerHost.split(':')[0];
      if (computerIp && computerIp !== '127.0.0.1' && computerIp !== 'localhost') {
        url = `http://${computerIp}:${port}`;
        return {
          apiUrl: url,
          isLocalHost: false,
          networkType: 'fallback',
          ipAddress: computerIp,
        };
      }
    }

    switch (Platform.OS) {
      case 'ios':
        url = `http://localhost:${port}`;
        break;
      case 'android':
        url = `http://10.0.2.2:${port}`;
        break;
      default:
        url = `http://localhost:${port}`;
    }

    return {
      apiUrl: url,
      isLocalHost: true,
      networkType: 'fallback',
      ipAddress: url.replace(/^https?:\/\//, '').split(':')[0],
    };
  }
  private static async saveToStorage(config: NetworkConfig): Promise<void> {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.setItem('network_config', JSON.stringify({
        ...config,
        timestamp: Date.now(),
      }));
    } catch {
    }
  }

  private static async loadFromStorage(): Promise<NetworkConfig | null> {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage'); //dynamic import to avoid AsyncStorage overhead if not used
      const saved = await AsyncStorage.getItem('network_config');
      if (!saved) return null;

      const config = JSON.parse(saved);
      if (Date.now() - config.timestamp > 24 * 60 * 60 * 1000) {
        return null;
      }
      return config;
    } catch {
      return null;
    }
  }

  static async refreshNetworkConfig(): Promise<NetworkConfig> {
    this.cachedConfig = null;
    this.cacheTimestamp = 0;

    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.removeItem('network_config');
    } catch {
    }

    return this.getNetworkConfig();
  }

  static async quickConnectionTest(apiUrl?: string): Promise<boolean> {
    const url = apiUrl || (await this.getNetworkConfig()).apiUrl;
    return this.testConnection(url);
  }
}