import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { AuthStackParamList } from '../navigation/AppNavigator';

type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

export default function LoginScreen({ navigation }: Props) {
  const { login, isLoading, error, lockoutUntil, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remainingTime, setRemainingTime] = useState<string | null>(null);

  // Countdown timer for account lockout
  useEffect(() => {
    if (!lockoutUntil) {
      setRemainingTime(null);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = lockoutUntil - now;
      if (diff <= 0) {
        setRemainingTime(null);
        return;
      }
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setRemainingTime(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const isLocked = lockoutUntil !== null && lockoutUntil > Date.now();

  const handleLogin = useCallback(async () => {
    clearError();

    if (!email.trim() || !password.trim()) {
      return;
    }

    await login(email.trim(), password);
  }, [email, password, login, clearError]);

  const handleNavigateToRegister = useCallback(() => {
    clearError();
    navigation.navigate('Register');
  }, [navigation, clearError]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>Iniciar Sesión</Text>
          <Text style={styles.subtitle}>Ingrese sus credenciales para acceder</Text>

          {error && (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Text style={styles.errorText}>{error}</Text>
              {remainingTime && (
                <Text style={styles.lockoutTimer}>
                  Tiempo de espera: {remainingTime}
                </Text>
              )}
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="ejemplo@correo.com"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!isLocked && !isLoading}
              accessibilityLabel="Correo electrónico"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              autoComplete="password"
              editable={!isLocked && !isLoading}
              accessibilityLabel="Contraseña"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              (isLocked || isLoading) && styles.buttonDisabled,
            ]}
            onPress={handleLogin}
            disabled={isLocked || isLoading}
            accessibilityRole="button"
            accessibilityLabel="Iniciar sesión"
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Iniciar Sesión</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>¿No tiene cuenta? </Text>
            <TouchableOpacity onPress={handleNavigateToRegister}>
              <Text style={styles.link}>Registrarse</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    color: '#1f2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
  },
  lockoutTimer: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2937',
    backgroundColor: '#ffffff',
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#6b7280',
  },
  link: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
  },
});
