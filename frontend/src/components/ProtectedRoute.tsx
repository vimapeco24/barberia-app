import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Role, UserProfile } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: Role[];
}

/**
 * Protects routes by checking authentication.
 * Checks both Zustand store AND localStorage as fallback.
 */
export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth();

  // Check Zustand store first
  let currentUser = user;
  let authenticated = isAuthenticated;

  // Fallback: check localStorage if Zustand store is not yet hydrated
  if (!authenticated) {
    const token = localStorage.getItem('accessToken');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        currentUser = JSON.parse(userStr) as UserProfile;
        authenticated = true;
        // Sync back to Zustand store
        useAuth.setState({
          user: currentUser,
          accessToken: token,
          refreshToken: localStorage.getItem('refreshToken'),
          isAuthenticated: true,
        });
      } catch {
        // Invalid data in localStorage
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      }
    }
  }

  // Not authenticated → redirect to login
  if (!authenticated || !currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated but role not allowed for this route → redirect based on role
  if (roles && roles.length > 0 && !roles.includes(currentUser.role)) {
    if (currentUser.role === 'barber') {
      return <Navigate to="/barber/agenda" replace />;
    }
    return <Navigate to="/bookings" replace />;
  }

  return <>{children}</>;
}
