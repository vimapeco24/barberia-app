import React, { useState, useCallback } from 'react';
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

type RegisterScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

interface Props {
  navigation: RegisterScreenNavigationProp;
}

interface ValidationErrors {
  email?: string;
  password?: string;
  name?: string;
}

function validateEmail(email: string): string | undefined {
  if (!email.trim()) {
    return 'El correo electrónico es obligatorio.';
  }
  if (email.length > 254) {
    return 'El correo electrónico no puede exceder 254 caracteres.';
  }
  // Basic RFC 5322 validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'El formato del correo electrónico no es válido.';
  }
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (!password) {
    return 'La contraseña es obligatoria.';
  }
  if (password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'La contraseña debe contener al menos una letra mayúscula.';
  }
  if (!/[a-z]/.test(password)) {
    return 'La contraseña debe contener al menos una letra minúscula.';
  }
  if (!/[0-9]/.test(password)) {
    return 'La contraseña debe contener al menos un número.';
  }
  return undefined;
}

function validateName(name: string): string | undefined {
  if (!name.trim()) {
    return 'El nombre es obligatorio.';
  }
  return undefined;
}

export default function RegisterScreen({ navigation }: Props) {
  const { register, isLoading, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateForm = useCallback((): boolean => {
    const errors: ValidationErrors = {};
    errors.email = validateEmail(email);
    errors.password = validatePassword(password);
    errors.name = validateName(name);

    setValidationErrors(errors);
    return !errors.email && !errors.password && !errors.name;
  }, [email, password, name]);

  const handleBlur = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));

    setValidationErrors((prev) => {
      const errors = { ...prev };
      switch (field) {
        case 'email':
          errors.email = validateEmail(email);
          break;
        case 'password':
          errors.password = validatePassword(password);
          break;
        case 'name':
          errors.name = validateName(name);
          break;
      }
      return errors;
    });
  }, [email, password, name]);

  const handleRegister = useCallback(async () => {
    clearError();
    setTouched({ email: true, password: true, name: true });

    if (!validateForm()) {
      return;
    }

    await register(email.trim(), password, name.trim(), phone.trim() || undefined);
  }, [email, password, name, phone, register, clearError, validateForm]);

  const handleNavigateToLogin = useCallback(() => {
    clearError();
    navigation.navigate('Login');
  }, [navigation, clearError]);

  const showEmailError = touched.email && validationErrors.email;
  const showPasswordError = touched.password && validationErrors.password;
  const showNameError = touched.name && validationErrors.name;

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
          <Text style={styles.title}>Crear Cuenta</Text>
          <Text style={styles.subtitle}>Complete los datos para registrarse</Text>

          {error && (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Text style={styles.errorText}>{error}</Text>
              {error.includes('ya está registrado') && (
                <TouchableOpacity onPress={handleNavigateToLogin}>
                  <Text style={styles.errorLink}>Ir a Iniciar Sesión</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Nombre completo</Text>
            <TextInput
              style={[
                styles.input,
                showNameError ? styles.inputError : null,
              ]}
              value={name}
              onChangeText={setName}
              onBlur={() => handleBlur('name')}
              placeholder="Juan Pérez"
              placeholderTextColor="#9ca3af"
              autoCapitalize="words"
              autoComplete="name"
              editable={!isLoading}
              accessibilityLabel="Nombre completo"
            />
            {showNameError && (
              <Text style={styles.fieldError}>{validationErrors.name}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={[
                styles.input,
                showEmailError ? styles.inputError : null,
              ]}
              value={email}
              onChangeText={setEmail}
              onBlur={() => handleBlur('email')}
              placeholder="ejemplo@correo.com"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!isLoading}
              accessibilityLabel="Correo electrónico"
            />
            {showEmailError && (
              <Text style={styles.fieldError}>{validationErrors.email}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={[
                styles.input,
                showPasswordError ? styles.inputError : null,
              ]}
              value={password}
              onChangeText={setPassword}
              onBlur={() => handleBlur('password')}
              placeholder="••••••••"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              autoComplete="password-new"
              editable={!isLoading}
              accessibilityLabel="Contraseña"
            />
            {showPasswordError && (
              <Text style={styles.fieldError}>{validationErrors.password}</Text>
            )}
            <Text style={styles.hint}>
              Mínimo 8 caracteres, una mayúscula, una minúscula y un número.
            </Text>
          </View>

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Teléfono </Text>
              <Text style={styles.optional}>(opcional)</Text>
            </View>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+54 11 1234-5678"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
              autoComplete="tel"
              editable={!isLoading}
              accessibilityLabel="Teléfono"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Registrarse"
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Registrarse</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>¿Ya tiene cuenta? </Text>
            <TouchableOpacity onPress={handleNavigateToLogin}>
              <Text style={styles.link}>Iniciar Sesión</Text>
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
  errorLink: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
  },
  field: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  optional: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '400',
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
  inputError: {
    borderColor: '#dc2626',
  },
  fieldError: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: 4,
  },
  hint: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 4,
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
