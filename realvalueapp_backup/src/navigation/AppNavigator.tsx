// frontend/src/navigation/AppNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import your screens
import ProfileScreen from '../screens/ProfileScreen';
import GiveEndorsementScreen from '../screens/GiveEndorsementScreen';
// Import other screens like HomeScreen, SettingsScreen, etc.
// import HomeScreen from '../screens/HomeScreen';
// import HealthCheckScreen from '../screens/HealthCheckScreen'; // Example existing screen
import ExchangeBoardScreen from '../screens/ExchangeBoardScreen';
import ExchangeOfferFormScreen from '../screens/ExchangeOfferFormScreen';
import MyExchangeOffersScreen from '../screens/MyExchangeOffersScreen';

// Define the types for your stack parameters
export type RootStackParamList = {
  // HomeScreen: undefined; // Example
  // HealthCheck: undefined; // Example
  Profile: { userId?: string }; // Optional userId
  GiveEndorsement: { endorseeId: string; endorseeName?: string };

  // Skill Exchange Board Feature Screens
  ExchangeBoard: undefined; // No params for the main board
  ExchangeOfferForm: { offerId?: string }; // Optional offerId for editing
  MyExchangeOffers: undefined; // No params
  // ... other screens
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Mock auth hook or context to get initial route
const useAuth = () => {
  // In a real app, this would check if the user is authenticated
  // and might also provide user data.
  // For this example, let's assume the user is always authenticated.
  return { isAuthenticated: true, user: { id: 'current-user-placeholder-id' } };
};

const AppNavigator: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  // Determine initial route based on auth state or other logic
  // For simplicity, always starting at Profile.
  // In a real app, you might have a different initial screen like 'HomeScreen'
  // or conditional logic for login/signup screens.

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Profile" // Or your main entry screen
        // screenOptions={{ headerShown: false }} // Example global screen options
      >
        {/* Example of other screens you might have */}
        {/* <Stack.Screen name="HomeScreen" component={HomeScreen} /> */}
        {/* <Stack.Screen name="HealthCheck" component={HealthCheckScreen} /> */}

        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          initialParams={{ userId: user.id }} // Default to current user's profile
          options={({ route }) => ({
            title: route.params?.userId === user.id ? 'My Profile' : 'User Profile'
          })}
        />
        <Stack.Screen
          name="GiveEndorsement"
          component={GiveEndorsementScreen}
          options={{ title: 'Give Endorsement' }}
        />

        {/* Skill Exchange Board Screens */}
        <Stack.Screen
          name="ExchangeBoard"
          component={ExchangeBoardScreen}
          options={{ title: 'Skill Exchange Board' }}
        />
        <Stack.Screen
          name="ExchangeOfferForm"
          component={ExchangeOfferFormScreen}
          // Options can be dynamic based on route params (e.g., if editing)
          options={({ route }) => ({
            title: route.params?.offerId ? 'Edit Exchange Offer' : 'Create Exchange Offer'
          })}
        />
        <Stack.Screen
          name="MyExchangeOffers"
          component={MyExchangeOffersScreen}
          options={{ title: 'My Exchange Offers' }}
        />
        {/* Add other screens for your application here */}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;

/*
How to use in your App.tsx:

import AppNavigator from './src/navigation/AppNavigator'; // Adjust path as needed

export default function App() {
  return (
    <AppNavigator />
  );
}

Navigation from a component:

import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from './path/to/AppNavigator'; // Adjust path

type MyComponentNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Profile'>; // Or current screen

function MyComponent() {
  const navigation = useNavigation<MyComponentNavigationProp>();

  return (
    <Button
      title="View Other User's Profile"
      onPress={() => navigation.navigate('Profile', { userId: 'some-other-user-id' })}
    />
    <Button
      title="Go to My Profile"
      onPress={() => navigation.navigate('Profile', { userId: 'current-user-id' })} // Or navigation.navigate('Profile') if initialParams handles it
    />
     <Button
      title="Endorse User X"
      onPress={() => navigation.navigate('GiveEndorsement', { endorseeId: 'user-x-id', endorseeName: 'User X' })}
    />
  );
}

*/
