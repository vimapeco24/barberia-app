import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * Redirects authenticated users to their role-appropriate page.
 * - client → /bookings (Portal del Cliente)
 * - barber → /barber/agenda (Panel del Barbero)
 * - admin → /bookings (same as client for now)
 *
 * If not authenticated, redirects to /login.
 */
export default function RoleRedirect() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  switch (user.role) {
    case 'barber':
      return <Navigate to="/barber/agenda" replace />;
    case 'client':
    case 'admin':
    default:
      return <Navigate to="/bookings" replace />;
  }
}
