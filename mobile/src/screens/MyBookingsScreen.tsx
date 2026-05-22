import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Booking } from '../types';
import { getMyBookings, cancelBooking } from '../services/booking.service';

const MAX_ACTIVE_BOOKINGS = 3;

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('es-AR', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(time: string): string {
  return time.slice(0, 5);
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'confirmed':
      return 'Confirmado';
    case 'cancelled':
      return 'Cancelado';
    case 'completed':
      return 'Completado';
    default:
      return status;
  }
}

function getStatusStyles(status: string): { backgroundColor: string; color: string } {
  switch (status) {
    case 'confirmed':
      return { backgroundColor: '#dcfce7', color: '#166534' };
    case 'cancelled':
      return { backgroundColor: '#fee2e2', color: '#991b1b' };
    case 'completed':
      return { backgroundColor: '#e0e7ff', color: '#3730a3' };
    default:
      return { backgroundColor: '#f3f4f6', color: '#374151' };
  }
}

function getErrorMessage(error: unknown): string {
  const err = error as {
    response?: { data?: { error?: { code?: string; message?: string } } };
  };
  const code = err.response?.data?.error?.code;
  const message = err.response?.data?.error?.message;

  switch (code) {
    case 'CANCELLATION_TOO_LATE':
      return 'No es posible cancelar con menos de 2 horas de anticipación.';
    case 'BOOKING_ALREADY_CANCELLED':
      return 'Este turno ya fue cancelado previamente.';
    case 'BOOKING_ALREADY_COMPLETED':
      return 'No es posible cancelar un turno que ya fue completado.';
    case 'BOOKING_NOT_FOUND':
      return 'El turno no fue encontrado.';
    default:
      return message || 'Ocurrió un error inesperado. Intente nuevamente.';
  }
}

export default function MyBookingsScreen({ navigation }: { navigation: any }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const activeCount = bookings.filter((b) => b.status === 'confirmed').length;

  const fetchBookings = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const data = await getMyBookings();
      const sorted = [...data].sort((a, b) => {
        if (a.status === 'confirmed' && b.status !== 'confirmed') return -1;
        if (a.status !== 'confirmed' && b.status === 'confirmed') return 1;
        const dateCompare = b.bookingDate.localeCompare(a.bookingDate);
        if (dateCompare !== 0) return dateCompare;
        return b.startTime.localeCompare(a.startTime);
      });
      setBookings(sorted);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  function handleRefresh() {
    setRefreshing(true);
    fetchBookings(true);
  }

  function confirmCancel(bookingId: string) {
    Alert.alert(
      'Cancelar turno',
      '¿Estás seguro de que deseas cancelar este turno?',
      [
        { text: 'No, mantener', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: () => handleCancelBooking(bookingId),
        },
      ]
    );
  }

  async function handleCancelBooking(bookingId: string) {
    setCancellingId(bookingId);
    setError(null);
    try {
      await cancelBooking(bookingId);
      Alert.alert('Turno cancelado', 'El turno ha sido cancelado exitosamente.');
      await fetchBookings();
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      Alert.alert('Error', message);
    } finally {
      setCancellingId(null);
    }
  }

  function renderBookingItem({ item }: { item: Booking }) {
    const statusStyle = getStatusStyles(item.status);
    const isConfirmed = item.status === 'confirmed';
    const isCancelling = cancellingId === item.id;

    return (
      <View style={styles.bookingCard}>
        <View style={styles.bookingHeader}>
          <Text style={styles.barberName}>{item.barberName || 'Barbero'}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.backgroundColor }]}>
            <Text style={[styles.statusText, { color: statusStyle.color }]}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>

        <Text style={styles.bookingDate}>
          {formatDate(item.bookingDate)} a las {formatTime(item.startTime)}
        </Text>
        <Text style={styles.bookingService}>
          {item.serviceType} · {item.durationMinutes} min
        </Text>

        {isConfirmed && (
          <TouchableOpacity
            style={[styles.cancelButton, isCancelling && styles.cancelButtonDisabled]}
            onPress={() => confirmCancel(item.id)}
            disabled={isCancelling}
            accessibilityRole="button"
            accessibilityLabel={`Cancelar turno del ${formatDate(item.bookingDate)}`}
          >
            {isCancelling ? (
              <ActivityIndicator size="small" color="#dc2626" />
            ) : (
              <Text style={styles.cancelButtonText}>Cancelar turno</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mis Turnos</Text>
        <View
          style={[
            styles.counterBadge,
            activeCount >= MAX_ACTIVE_BOOKINGS && styles.counterBadgeFull,
          ]}
          accessibilityLabel={`${activeCount} de ${MAX_ACTIVE_BOOKINGS} turnos activos`}
        >
          <Text
            style={[
              styles.counterText,
              activeCount >= MAX_ACTIVE_BOOKINGS && styles.counterTextFull,
            ]}
          >
            {activeCount}/{MAX_ACTIVE_BOOKINGS} activos
          </Text>
        </View>
      </View>

      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner} accessibilityRole="alert">
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={() => setError(null)}
            accessibilityLabel="Cerrar error"
          >
            <Text style={styles.errorClose}>×</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading state */}
      {loading && !refreshing && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Cargando turnos...</Text>
        </View>
      )}

      {/* Empty state */}
      {!loading && !error && bookings.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No tienes turnos</Text>
          <Text style={styles.emptySubtitle}>
            Reserva tu primer turno para verlo aquí.
          </Text>
          <TouchableOpacity
            style={styles.newBookingButton}
            onPress={() => navigation.navigate('NewBooking')}
            accessibilityRole="button"
            accessibilityLabel="Reservar un turno"
          >
            <Text style={styles.newBookingButtonText}>Reservar turno</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bookings list */}
      {!loading && bookings.length > 0 && (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={renderBookingItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#2563eb']}
              tintColor="#2563eb"
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  counterBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#dbeafe',
  },
  counterBadgeFull: {
    backgroundColor: '#fee2e2',
  },
  counterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e40af',
  },
  counterTextFull: {
    color: '#991b1b',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
  },
  errorText: {
    flex: 1,
    color: '#dc2626',
    fontSize: 14,
  },
  errorClose: {
    color: '#dc2626',
    fontSize: 20,
    fontWeight: '600',
    paddingLeft: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  newBookingButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  newBookingButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 24,
  },
  bookingCard: {
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  barberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  bookingDate: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  bookingService: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 6,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
  },
});
