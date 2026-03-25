import { Stack } from 'expo-router';

export default function ScannerLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1a1a1a',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Scanner',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="select"
        options={{
          title: 'Select Scanner',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="barcode"
        options={{
          title: 'Barcode Scanner',
        }}
      />
      <Stack.Screen
        name="product"
        options={{
          title: 'AI Product Scanner',
        }}
      />
      <Stack.Screen
        name="food-recognition"
        options={{
          title: 'AI Food Recognition',
          headerStyle: {
            backgroundColor: '#10B981',
          },
        }}
      />
      <Stack.Screen
        name="search"
        options={{
          title: 'Search Products',
          headerStyle: {
            backgroundColor: '#007AFF',
          },
        }}
      />
      <Stack.Screen
        name="history"
        options={{
          title: 'Scan History',
          headerStyle: {
            backgroundColor: '#34C759',
          },
        }}
      />
      <Stack.Screen
        name="product-list"
        options={{
          title: 'My Products',
          headerStyle: {
            backgroundColor: '#8B5CF6',
          },
        }}
      />
      <Stack.Screen
        name="meal-plan"
        options={{
          title: 'Meal Plan',
          headerStyle: {
            backgroundColor: '#F59E0B',
          },
        }}
      />
      <Stack.Screen
        name="recipe-detail"
        options={{
          title: 'Recipe',
          headerShown: false,
        }}
      />
    </Stack>
  );
}