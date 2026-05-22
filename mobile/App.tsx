import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { useAuth } from './src/hooks/useAuth';

export default function App() {
  const { hydrate } = useAuth();

  useEffect(() => {
    hydrate();
  }, []);

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <AppNavigator />
    </NavigationContainer>
  );
}
