import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ValidationErrors {
  email?: string;
  password?: string;
  name?: string;
}

function validateEmail(email: string): string | undefined {
  if (!email.trim()) return 'El correo electrónico es obligatorio.';
  if (email.length > 254) return 'El correo no puede exceder 254 caracteres.';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return 'El formato del correo no es válido.';
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (!password) return 'La contraseña es obligatoria.';
  if (password.length < 8) return 'Mínimo 8 caracteres.';
  if (!/[A-Z]/.test(password)) return 'Debe contener al menos una mayúscula.';
  if (!/[a-z]/.test(password)) return 'Debe contener al menos una minúscula.';
  if (!/[0-9]/.test(password)) return 'Debe contener al menos un número.';
  return undefined;
}

function validateName(name: string): string | undefined {
  if (!name.trim()) return 'El nombre es obligatorio.';
  return undefined;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, isAuthenticated, isLoading, error, user, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'barber') {
        navigate('/barber/agenda', { replace: true });
      } else {
        navigate('/bookings', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};
    errors.email = validateEmail(email);
    errors.password = validatePassword(password);
    errors.name = validateName(name);
    setValidationErrors(errors);
    return !errors.email && !errors.password && !errors.name;
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errors = { ...validationErrors };
    switch (field) {
      case 'email': errors.email = validateEmail(email); break;
      case 'password': errors.password = validatePassword(password); break;
      case 'name': errors.name = validateName(name); break;
    }
    setValidationErrors(errors);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setTouched({ email: true, password: true, name: true });
    if (!validateForm()) return;
    await register(email.trim(), password, name.trim(), phone.trim() || undefined);
  };

  return (
    <div style={styles.page}>
      {/* Left branding */}
      <div style={styles.brandingSide}>
        <div style={styles.brandingContent}>
          <div style={styles.logoContainer}>
            <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="30" stroke="#c8a96e" strokeWidth="2" fill="none" />
              <path d="M24 16 L24 48 M40 16 L40 48" stroke="#c8a96e" strokeWidth="2" />
              <path d="M24 20 L40 28 M24 28 L40 36 M24 36 L40 44" stroke="#e74c3c" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M24 24 L40 32 M24 32 L40 40" stroke="#3498db" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <h1 style={styles.brandName}>BarberShop</h1>
          <p style={styles.brandTagline}>Únete a nuestra comunidad</p>
          <div style={styles.brandDivider} />
          <div style={styles.features}>
            <div style={styles.featureItem}>
              <span style={styles.featureIcon}>⚡</span>
              <span>Reservas rápidas y fáciles</span>
            </div>
            <div style={styles.featureItem}>
              <span style={styles.featureIcon}>🎯</span>
              <span>Elige tu barbero favorito</span>
            </div>
            <div style={styles.featureItem}>
              <span style={styles.featureIcon}>📱</span>
              <span>Accede desde cualquier dispositivo</span>
            </div>
          </div>
        </div>
        <div style={styles.pattern} />
      </div>

      {/* Right form */}
      <div style={styles.formSide}>
        <div style={styles.formContainer}>
          <div style={styles.formHeader}>
            <h2 style={styles.formTitle}>Crear Cuenta</h2>
            <p style={styles.formSubtitle}>Completá tus datos para empezar</p>
          </div>

          {error && (
            <div style={styles.errorBox} role="alert">
              <p style={styles.errorText}>{error}</p>
              {error.includes('ya está registrado') && (
                <Link to="/login" style={styles.errorLink}>Ir a Iniciar Sesión →</Link>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div style={styles.field}>
              <label htmlFor="name" style={styles.label}>Nombre completo</label>
              <div style={styles.inputWrapper}>
                <span style={styles.inputIcon}>👤</span>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => handleBlur('name')}
                  placeholder="Juan Pérez"
                  style={{ ...styles.input, borderColor: touched.name && validationErrors.name ? '#dc2626' : '#e5e7eb' }}
                  disabled={isLoading}
                  required
                />
              </div>
              {touched.name && validationErrors.name && <p style={styles.fieldError}>{validationErrors.name}</p>}
            </div>

            <div style={styles.field}>
              <label htmlFor="email" style={styles.label}>Correo electrónico</label>
              <div style={styles.inputWrapper}>
                <span style={styles.inputIcon}>✉</span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => handleBlur('email')}
                  placeholder="tu@email.com"
                  style={{ ...styles.input, borderColor: touched.email && validationErrors.email ? '#dc2626' : '#e5e7eb' }}
                  disabled={isLoading}
                  required
                />
              </div>
              {touched.email && validationErrors.email && <p style={styles.fieldError}>{validationErrors.email}</p>}
            </div>

            <div style={styles.field}>
              <label htmlFor="password" style={styles.label}>Contraseña</label>
              <div style={styles.inputWrapper}>
                <span style={styles.inputIcon}>🔒</span>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => handleBlur('password')}
                  placeholder="••••••••"
                  style={{ ...styles.input, borderColor: touched.password && validationErrors.password ? '#dc2626' : '#e5e7eb' }}
                  disabled={isLoading}
                  required
                />
              </div>
              {touched.password && validationErrors.password && <p style={styles.fieldError}>{validationErrors.password}</p>}
              <p style={styles.hint}>Mínimo 8 caracteres, una mayúscula, una minúscula y un número.</p>
            </div>

            <div style={styles.field}>
              <label htmlFor="phone" style={styles.label}>
                Teléfono <span style={styles.optional}>(opcional)</span>
              </label>
              <div style={styles.inputWrapper}>
                <span style={styles.inputIcon}>📞</span>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+54 11 1234-5678"
                  style={styles.input}
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              style={{ ...styles.button, opacity: isLoading ? 0.6 : 1 }}
              disabled={isLoading}
            >
              {isLoading ? 'Creando cuenta...' : 'Crear mi cuenta'}
            </button>
          </form>

          <div style={styles.divider}>
            <span style={styles.dividerLine} />
            <span style={styles.dividerText}>o</span>
            <span style={styles.dividerLine} />
          </div>

          <p style={styles.footer}>
            ¿Ya tenés cuenta?{' '}
            <Link to="/login" style={styles.link}>Iniciar Sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'row' as const },
  brandingSide: {
    flex: 1,
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
    padding: '3rem', position: 'relative' as const, overflow: 'hidden',
  },
  brandingContent: { position: 'relative' as const, zIndex: 2, textAlign: 'center' as const, color: '#fff' },
  logoContainer: { marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' },
  brandName: { fontSize: '2.2rem', fontWeight: 700, color: '#c8a96e', margin: '0 0 0.5rem', letterSpacing: '2px', fontFamily: "'Georgia', serif" },
  brandTagline: { fontSize: '1rem', color: '#a0aec0', margin: '0 0 2rem', fontStyle: 'italic' as const },
  brandDivider: { width: '60px', height: '2px', background: '#c8a96e', margin: '0 auto 2rem' },
  features: { display: 'flex', flexDirection: 'column' as const, gap: '1rem', textAlign: 'left' as const },
  featureItem: { display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem', color: '#cbd5e0' },
  featureIcon: { fontSize: '1.2rem' },
  pattern: {
    position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, opacity: 0.05, zIndex: 1,
    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 20px, #c8a96e 20px, #c8a96e 21px)',
  },
  formSide: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', backgroundColor: '#fafafa', overflowY: 'auto' as const },
  formContainer: { width: '100%', maxWidth: '380px' },
  formHeader: { marginBottom: '1.5rem' },
  formTitle: { fontSize: '1.75rem', fontWeight: 700, color: '#1a1a2e', margin: '0 0 0.5rem' },
  formSubtitle: { fontSize: '0.9rem', color: '#6b7280', margin: 0 },
  errorBox: { backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.25rem' },
  errorText: { margin: 0, color: '#dc2626', fontSize: '0.85rem' },
  errorLink: { display: 'inline-block', marginTop: '0.5rem', color: '#c8a96e', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' },
  field: { marginBottom: '1.1rem' },
  label: { display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', fontWeight: 600, color: '#374151', textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
  optional: { fontWeight: 400, color: '#9ca3af', fontSize: '0.75rem', textTransform: 'none' as const },
  inputWrapper: { position: 'relative' as const, display: 'flex', alignItems: 'center' },
  inputIcon: { position: 'absolute' as const, left: '12px', fontSize: '0.9rem', opacity: 0.5, pointerEvents: 'none' as const },
  input: { width: '100%', padding: '0.7rem 0.75rem 0.7rem 2.4rem', fontSize: '0.9rem', border: '2px solid #e5e7eb', borderRadius: '8px', outline: 'none', boxSizing: 'border-box' as const, backgroundColor: '#fff' },
  fieldError: { margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#dc2626' },
  hint: { margin: '0.25rem 0 0', fontSize: '0.7rem', color: '#9ca3af' },
  button: {
    width: '100%', padding: '0.85rem', fontSize: '0.9rem', fontWeight: 700, color: '#fff',
    background: 'linear-gradient(135deg, #c8a96e 0%, #a0824a 100%)', border: 'none', borderRadius: '8px',
    cursor: 'pointer', marginTop: '0.5rem', letterSpacing: '0.5px', textTransform: 'uppercase' as const,
    boxShadow: '0 4px 12px rgba(200, 169, 110, 0.3)',
  },
  divider: { display: 'flex', alignItems: 'center', margin: '1.25rem 0', gap: '0.75rem' },
  dividerLine: { flex: 1, height: '1px', backgroundColor: '#e5e7eb' },
  dividerText: { fontSize: '0.8rem', color: '#9ca3af', textTransform: 'uppercase' as const },
  footer: { textAlign: 'center' as const, fontSize: '0.9rem', color: '#6b7280', margin: 0 },
  link: { color: '#c8a96e', textDecoration: 'none', fontWeight: 600 },
};
