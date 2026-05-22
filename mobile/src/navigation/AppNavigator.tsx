import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import NewBookingScreen from '../screens/NewBookingScreen';
import MyBookingsScreenImpl from '../screens/MyBookingsScreen';

function HomeScreen({ navigation }: { navigation: any }) {
  const { logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.homeTitle}>Barbería</Text>
      <TouchableOpacity
        style={styles.homeButton}
        onPress={() => navigation.navigate('NewBooking')}
      >
        <Text style={styles.homeButtonText}>Reservar turno</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.homeButton, styles.homeButtonSecondary]}
        onPress={() => navigation.navigate('MyBookings')}
      >
        <Text style={styles.homeButtonSecondaryText}>Mis turnos</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.homeButton, styles.homeButtonLogout]}
        onPress={logout}
      >
        <Text style={styles.homeButtonLogoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

// Navigation param types
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainStackParamList = {
  Home: undefined;
  NewBooking: undefined;
  MyBookings: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{ headerShown: false }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#1a1a2e' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <MainStack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Barbería' }}
      />
      <MainStack.Screen
        name="NewBooking"
        component={NewBookingScreen}
        options={{ title: 'Reservar Turno' }}
      />
      <MainStack.Screen
        name="MyBookings"
        component={MyBookingsScreenImpl}
        options={{ title: 'Mis Turnos' }}
      />
    </MainStack.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated } = useAuth();

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <RootStack.Screen name="Main" component={MainNavigator} />
      ) : (
        <RootStack.Screen name="Auth" component={AuthNavigator} />
      )}
    </RootStack.Navigator>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  homeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 32,
  },
  homeButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    marginBottom: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  homeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  homeButtonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  homeButtonSecondaryText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  homeButtonLogout: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 16,
  },
  homeButtonLogoutText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
});
