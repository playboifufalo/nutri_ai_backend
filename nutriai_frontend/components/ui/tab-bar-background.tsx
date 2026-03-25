import { useThemeColor } from '@/hooks/use-theme-color';
import { View, ViewStyle } from 'react-native';

interface TabBarBackgroundProps {
  style?: ViewStyle;
}

export default function TabBarBackground({ style }: TabBarBackgroundProps) {
  const backgroundColor = useThemeColor({}, 'background');
  
  return <View style={[{ backgroundColor }, style]} />;
}