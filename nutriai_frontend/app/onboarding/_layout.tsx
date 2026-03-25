import { useColorScheme } from '@/hooks/use-color-scheme';
import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  const colorScheme = useColorScheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colorScheme === 'dark' ? '#1F2937' : '#FFFFFF',
        },
        headerTintColor: colorScheme === 'dark' ? '#FFFFFF' : '#1F2937',
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <Stack.Screen
        name="goal"
        options={{
          title: 'Select Your Goal',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="allergies"
        options={{
          title: 'Allergies & Restrictions',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="diet"
        options={{
          title: 'Diet Type',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="calories"
        options={{
          title: 'Daily Calorie Target',
          headerBackTitle: 'Back',
        }}
      />
    </Stack>
  );
}