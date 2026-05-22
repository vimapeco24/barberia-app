import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('cliente@test.com');
  const [password, setPassword] = useState('Client123');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    console.log('[LOGIN]', msg);
    setDebugLog(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    addLog('Form submitted');
    setError(null);
    setSuccess(null);

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    addLog(`Email: ${trimmedEmail}, Password length: ${trimmedPassword.length}`);

    if (!trimmedEmail || !trimmedPassword) {
      setError('Por favor complete ambos campos.');
      addLog('ERROR: Empty fields');
      return;
    }

    setIsLoading(true);
    addLog('Sending POST /api/auth/login...');

    try {
      const response = await api.post('/auth/login', {
        email: trimmedEmail,
        password: trimmedPassword,
      });

      addLog(`Response status: ${response.status}`);
      addLog(`Response data: ${JSON.stringify(response.data).substring(0, 200)}`);

      const data = response.data.data;
      setSuccess(`¡Bienvenido ${data.user.name}! Redirigiendo...`);
      addLog(`Login OK! User: ${data.user.name}, Role: ${data.user.role}`);

      // Store tokens
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      addLog('Tokens stored in localStorage');

      // Update Zustand store
      useAuth.setState({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      addLog('Zustand store updated');

      // Redirect
      setTimeout(() => {
        const target = data.user.role === 'barber' ? '/barber/agenda' : '/bookings';
        addLog(`Navigating to ${target}`);
        navigate(target, { replace: true });
      }, 1000);

    } catch (err: any) {
      addLog(`ERROR caught: ${err.message}`);
      addLog(`Error response: ${JSON.stringify(err?.response?.data || 'no response data')}`);
      addLog(`Error status: ${err?.response?.status || 'no status'}`);

      const code = err?.response?.data?.error?.code;
      const message = err?.response?.data?.error?.message;

      if (code === 'ACCOUNT_LOCKED') {
        setError(message || 'Cuenta bloqueada temporalmente.');
      } else if (code === 'INVALID_CREDENTIALS') {
        setError('Credenciales inválidas.');
      } else {
        setError(`Error: ${err.message} | Code: ${code || 'unknown'} | ${message || ''}`);
      }
    } finally {
      setIsLoading(false);
      addLog('Request finished');
    }
  };

  // Also handle button click directly as backup
  const handleButtonClick = () => {
    addLog('Button clicked directly');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      padding: '1rem',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '500px',
        backgroundColor: '#fff',
        borderRadius: '16px',
        padding: '2rem',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e', margin: '0 0 0.25rem' }}>✂️ BarberShop</h1>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>Ingresá a tu cuenta</p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem' }}>
            <p style={{ margin: 0, color: '#dc2626', fontSize: '0.8rem', wordBreak: 'break-all' }}>{error}</p>
          </div>
        )}

        {/* Success */}
        {success && (
          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem' }}>
            <p style={{ margin: 0, color: '#16a34a', fontSize: '0.85rem' }}>{success}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="login-email" style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
              Email
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              style={{
                width: '100%', padding: '12px', fontSize: '15px',
                border: '2px solid #e5e7eb', borderRadius: '8px',
                outline: 'none', boxSizing: 'border-box', backgroundColor: '#fafafa',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="login-password" style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
              Contraseña
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              style={{
                width: '100%', padding: '12px', fontSize: '15px',
                border: '2px solid #e5e7eb', borderRadius: '8px',
                outline: 'none', boxSizing: 'border-box', backgroundColor: '#fafafa',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            onClick={handleButtonClick}
            style={{
              width: '100%', padding: '14px', fontSize: '16px', fontWeight: 700,
              color: '#fff', backgroundColor: '#c8a96e', border: 'none', borderRadius: '8px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? '⏳ Ingresando...' : '✂️ INICIAR SESIÓN'}
          </button>
        </form>

        {/* Debug log panel */}
        <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#1a1a2e', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto' }}>
          <p style={{ margin: '0 0 0.5rem', color: '#c8a96e', fontSize: '11px', fontWeight: 700 }}>DEBUG LOG:</p>
          {debugLog.length === 0 && (
            <p style={{ margin: 0, color: '#6b7280', fontSize: '11px' }}>Haz click en "Iniciar Sesión" para ver los logs aquí...</p>
          )}
          {debugLog.map((log, i) => (
            <p key={i} style={{ margin: '2px 0', color: log.includes('ERROR') ? '#ef4444' : '#a0aec0', fontSize: '11px', fontFamily: 'monospace' }}>{log}</p>
          ))}
        </div>

        {/* Available test accounts */}
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
        }}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '11px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Cuentas de prueba
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
              <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#c8a96e', color: '#1a1a2e', fontWeight: 700, fontSize: '9px' }}>CLIENTE</span>
              <span style={{ color: '#4b5563' }}>cliente@test.com / Client123</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
              <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#3b82f6', color: '#fff', fontWeight: 700, fontSize: '9px' }}>BARBERO</span>
              <span style={{ color: '#4b5563' }}>carlos@barbershop.com / Barber123</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
              <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#ef4444', color: '#fff', fontWeight: 700, fontSize: '9px' }}>ADMIN</span>
              <span style={{ color: '#4b5563' }}>admin@barbershop.com / Admin123</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.8rem', color: '#9ca3af' }}>
          <Link to="/register" style={{ color: '#c8a96e', textDecoration: 'none', fontWeight: 600 }}>Crear cuenta nueva</Link>
        </div>
      </div>
    </div>
  );
}
