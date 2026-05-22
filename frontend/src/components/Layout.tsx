import { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Role } from '../types';

interface LayoutProps {
  children: ReactNode;
}

function getRoleBadgeStyle(role: Role): React.CSSProperties {
  switch (role) {
    case 'client':
      return { backgroundColor: '#c8a96e', color: '#1a1a2e' };
    case 'barber':
      return { backgroundColor: '#3b82f6', color: '#ffffff' };
    case 'admin':
      return { backgroundColor: '#ef4444', color: '#ffffff' };
    default:
      return { backgroundColor: '#6b7280', color: '#ffffff' };
  }
}

function getRoleLabel(role: Role): string {
  switch (role) {
    case 'client': return 'Cliente';
    case 'barber': return 'Barbero';
    case 'admin': return 'Admin';
    default: return role;
  }
}

interface NavLink {
  path: string;
  label: string;
  icon: string;
}

function getNavLinks(role: Role): NavLink[] {
  switch (role) {
    case 'client':
      return [
        { path: '/bookings', label: 'Mis Turnos', icon: '📋' },
        { path: '/bookings/new', label: 'Reservar', icon: '✂️' },
      ];
    case 'barber':
      return [
        { path: '/barber/agenda', label: 'Mi Agenda', icon: '📅' },
      ];
    case 'admin':
      return [
        { path: '/bookings', label: 'Turnos', icon: '📋' },
      ];
    default:
      return [];
  }
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (!user) return <>{children}</>;

  const navLinks = getNavLinks(user.role);
  const badgeStyle = getRoleBadgeStyle(user.role);
  const roleLabel = getRoleLabel(user.role);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation Bar */}
      <nav style={{
        backgroundColor: '#1a1a2e',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        flexWrap: 'wrap',
        gap: '8px',
      }}>
        {/* Logo + Menu toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <span style={{ fontSize: '20px' }}>✂️</span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#c8a96e' }}>BarberShop</span>
          </div>
        </div>

        {/* User info + hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 500 }}>{user.name.split(' ')[0]}</span>
          <span style={{ ...badgeStyle, padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>
            {roleLabel}
          </span>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px', padding: '6px 10px', cursor: 'pointer',
              color: '#e2e8f0', fontSize: '18px', lineHeight: 1,
            }}
            aria-label="Menú"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Dropdown menu (mobile-friendly) */}
        {menuOpen && (
          <div style={{
            width: '100%', display: 'flex', flexDirection: 'column', gap: '4px',
            paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)',
          }}>
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <button
                  key={link.path}
                  onClick={() => { navigate(link.path); setMenuOpen(false); }}
                  style={{
                    padding: '10px 14px', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                    color: isActive ? '#ffffff' : '#a0aec0',
                    backgroundColor: isActive ? 'rgba(200, 169, 110, 0.15)' : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: '8px',
                  }}
                >
                  <span>{link.icon}</span> {link.label}
                </button>
              );
            })}
            <button
              onClick={handleLogout}
              style={{
                padding: '10px 14px', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                color: '#fca5a5', backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: '8px',
                marginTop: '4px',
              }}
            >
              <span>🚪</span> Cerrar sesión
            </button>
          </div>
        )}
      </nav>

      {/* Bottom Navigation (mobile tab bar) */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        backgroundColor: '#ffffff', borderTop: '1px solid #e5e7eb',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        padding: '8px 0 env(safe-area-inset-bottom, 8px) 0',
        zIndex: 100, boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
      }}>
        {navLinks.map((link) => {
          const isActive = location.pathname === link.path;
          return (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '4px 16px',
                color: isActive ? '#c8a96e' : '#6b7280',
              }}
            >
              <span style={{ fontSize: '20px' }}>{link.icon}</span>
              <span style={{ fontSize: '11px', fontWeight: isActive ? 700 : 500 }}>{link.label}</span>
            </button>
          );
        })}
        <button
          onClick={handleLogout}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px 16px', color: '#6b7280',
          }}
        >
          <span style={{ fontSize: '20px' }}>🚪</span>
          <span style={{ fontSize: '11px', fontWeight: 500 }}>Salir</span>
        </button>
      </div>

      {/* Main Content */}
      <main style={{
        flex: 1, padding: '16px', paddingBottom: '80px',
        maxWidth: '1200px', width: '100%', margin: '0 auto', boxSizing: 'border-box',
      }}>
        {children}
      </main>
    </div>
  );
}
