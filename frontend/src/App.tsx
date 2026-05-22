import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import BarberAgendaPage from './pages/BarberAgendaPage';
import MyBookingsPage from './pages/MyBookingsPage';
import NewBookingPage from './pages/NewBookingPage';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRedirect from './components/RoleRedirect';
import { useAuth } from './hooks/useAuth';

function App() {
  const { hydrate, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      hydrate();
    }
  }, []);

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Root redirects based on role */}
      <Route path="/" element={<RoleRedirect />} />

      {/* Client routes */}
      <Route
        path="/bookings"
        element={
          <ProtectedRoute roles={['client', 'admin']}>
            <MyBookingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/bookings/new"
        element={
          <ProtectedRoute roles={['client']}>
            <NewBookingPage />
          </ProtectedRoute>
        }
      />

      {/* Barber routes */}
      <Route
        path="/barber/agenda"
        element={
          <ProtectedRoute roles={['barber']}>
            <BarberAgendaPage />
          </ProtectedRoute>
        }
      />

      {/* Catch-all: redirect to role-based home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
