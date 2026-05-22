import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Booking } from '../types';
import { getMyBookings, cancelBooking } from '../services/booking.service';
import Layout from '../components/Layout';

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

function getStatusColor(status: string): { background: string; color: string; border: string } {
  switch (status) {
    case 'confirmed':
      return { background: '#dcfce7', color: '#166534', border: '#bbf7d0' };
    case 'cancelled':
      return { background: '#fee2e2', color: '#991b1b', border: '#fecaca' };
    case 'completed':
      return { background: '#e0e7ff', color: '#3730a3', border: '#c7d2fe' };
    default:
      return { background: '#f3f4f6', color: '#374151', border: '#e5e7eb' };
  }
}

function getErrorMessage(error: unknown): string {
  const err = error as {
    response?: { data?: { error?: { code?: string; message?: string } } };
  };
  const code = err.response?.data?.error?.code;
  const message = err.response?.data?.error?.message;

  switch (code) {
    case 'SLOT_UNAVAILABLE':
      return 'El horario seleccionado ya fue ocupado por otro cliente.';
    case 'MAX_BOOKINGS_REACHED':
      return 'Has alcanzado el máximo de 3 turnos activos. Cancela uno para reservar otro.';
    case 'CANCELLATION_TOO_LATE':
      return 'No es posible cancelar con menos de 2 horas de anticipación.';
    case 'BOOKING_ALREADY_CANCELLED':
      return 'Este turno ya fue cancelado previamente.';
    case 'BOOKING_ALREADY_COMPLETED':
      return 'No es posible cancelar un turno que ya fue completado.';
    case 'BOOKING_NOT_FOUND':
      return 'El turno no fue encontrado.';
    case 'CLIENT_OVERLAP':
      return 'Ya tienes un turno en ese horario.';
    default:
      return message || 'Ocurrió un error inesperado. Intente nuevamente.';
  }
}

const pageStyles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#1a1a2e',
    margin: 0,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  badge: {
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: 600,
  },
  newBookingBtn: {
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 700,
    color: '#1a1a2e',
    backgroundColor: '#c8a96e',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 2px 8px rgba(200, 169, 110, 0.3)',
    transition: 'all 0.2s',
  },
  successMsg: {
    padding: '14px 18px',
    marginBottom: '20px',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '10px',
    color: '#166534',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px',
    fontWeight: 500,
  },
  errorMsg: {
    padding: '14px 18px',
    marginBottom: '20px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '10px',
    color: '#dc2626',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px',
    fontWeight: 500,
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '64px 32px',
    background: '#ffffff',
    borderRadius: '16px',
    border: '2px dashed #e5e7eb',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px',
    display: 'block',
  },
  emptyTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#1a1a2e',
    marginBottom: '8px',
  },
  emptySubtitle: {
    fontSize: '15px',
    color: '#6b7280',
    marginBottom: '24px',
  },
  bookingCard: {
    padding: '20px',
    marginBottom: '16px',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    background: '#ffffff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    transition: 'box-shadow 0.2s',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  barberName: {
    fontWeight: 700,
    fontSize: '17px',
    color: '#1a1a2e',
  },
  statusBadge: {
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 600,
  },
  cardDetails: {
    marginTop: '10px',
    display: 'flex',
    gap: '24px',
    flexWrap: 'wrap' as const,
  },
  detailItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '14px',
    color: '#4b5563',
  },
  cancelSection: {
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #f3f4f6',
  },
  cancelBtn: {
    padding: '8px 18px',
    background: '#ffffff',
    color: '#dc2626',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    transition: 'all 0.2s',
  },
  confirmBox: {
    padding: '14px',
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: '8px',
  },
  confirmText: {
    margin: '0 0 10px 0',
    fontSize: '14px',
    color: '#92400e',
    fontWeight: 500,
  },
  confirmBtns: {
    display: 'flex',
    gap: '10px',
  },
  confirmYes: {
    padding: '8px 18px',
    background: '#dc2626',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
  },
  confirmNo: {
    padding: '8px 18px',
    background: '#fff',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  loading: {
    textAlign: 'center' as const,
    padding: '48px',
    color: '#6b7280',
    fontSize: '15px',
  },
};

export default function MyBookingsPage() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const activeCount = bookings.filter((b) => b.status === 'confirmed').length;

  const fetchBookings = useCallback(async () => {
    try {
      setError(null);
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
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  async function handleCancelBooking(bookingId: string) {
    setCancellingId(bookingId);
    setError(null);
    setSuccessMessage(null);
    try {
      await cancelBooking(bookingId);
      setSuccessMessage('Turno cancelado exitosamente.');
      setConfirmCancelId(null);
      await fetchBookings();
    } catch (err) {
      setError(getErrorMessage(err));
      setConfirmCancelId(null);
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <Layout>
      {/* Header */}
      <div style={pageStyles.header}>
        <h1 style={pageStyles.title}>Mis Turnos</h1>
        <div style={pageStyles.headerRight}>
          <span
            style={{
              ...pageStyles.badge,
              background: activeCount >= MAX_ACTIVE_BOOKINGS ? '#fee2e2' : '#dbeafe',
              color: activeCount >= MAX_ACTIVE_BOOKINGS ? '#991b1b' : '#1e40af',
            }}
            aria-label={`${activeCount} de ${MAX_ACTIVE_BOOKINGS} turnos activos`}
          >
            {activeCount}/{MAX_ACTIVE_BOOKINGS} activos
          </span>
          <button
            onClick={() => navigate('/bookings/new')}
            style={pageStyles.newBookingBtn}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(200, 169, 110, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(200, 169, 110, 0.3)';
            }}
          >
            <span>✂️</span> Reservar turno
          </button>
        </div>
      </div>

      {/* Success message */}
      {successMessage && (
        <div role="status" style={pageStyles.successMsg}>
          <span>✓ {successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534', fontSize: '18px', padding: '4px' }}
            aria-label="Cerrar mensaje"
          >
            ×
          </button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div role="alert" style={pageStyles.errorMsg}>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '18px', padding: '4px' }}
            aria-label="Cerrar error"
          >
            ×
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={pageStyles.loading}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
          Cargando turnos...
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && bookings.length === 0 && (
        <div style={pageStyles.emptyState}>
          <span style={pageStyles.emptyIcon}>📋</span>
          <p style={pageStyles.emptyTitle}>No tienes turnos reservados</p>
          <p style={pageStyles.emptySubtitle}>
            Reserva tu primer turno y comienza a disfrutar de nuestro servicio.
          </p>
          <button
            onClick={() => navigate('/bookings/new')}
            style={pageStyles.newBookingBtn}
          >
            <span>✂️</span> Reservar mi primer turno
          </button>
        </div>
      )}

      {/* Bookings list */}
      {!loading && bookings.length > 0 && (
        <div>
          {bookings.map((booking) => {
            const statusStyle = getStatusColor(booking.status);
            const isConfirmed = booking.status === 'confirmed';
            const isCancelling = cancellingId === booking.id;
            const isConfirmingCancel = confirmCancelId === booking.id;

            return (
              <div
                key={booking.id}
                style={{
                  ...pageStyles.bookingCard,
                  borderLeft: `4px solid ${statusStyle.border}`,
                }}
              >
                <div style={pageStyles.cardTop}>
                  <div>
                    <span style={pageStyles.barberName}>
                      {booking.barberName || 'Barbero'}
                    </span>
                  </div>
                  <span
                    style={{
                      ...pageStyles.statusBadge,
                      background: statusStyle.background,
                      color: statusStyle.color,
                    }}
                  >
                    {getStatusLabel(booking.status)}
                  </span>
                </div>

                <div style={pageStyles.cardDetails}>
                  <div style={pageStyles.detailItem}>
                    <span>📅</span>
                    {formatDate(booking.bookingDate)}
                  </div>
                  <div style={pageStyles.detailItem}>
                    <span>🕐</span>
                    {formatTime(booking.startTime)}
                  </div>
                  <div style={pageStyles.detailItem}>
                    <span>💈</span>
                    {booking.serviceType} · {booking.durationMinutes} min
                  </div>
                </div>

                {/* Cancel button / confirmation */}
                {isConfirmed && (
                  <div style={pageStyles.cancelSection}>
                    {isConfirmingCancel ? (
                      <div style={pageStyles.confirmBox}>
                        <p style={pageStyles.confirmText}>
                          ¿Estás seguro de que deseas cancelar este turno?
                        </p>
                        <div style={pageStyles.confirmBtns}>
                          <button
                            onClick={() => handleCancelBooking(booking.id)}
                            disabled={isCancelling}
                            style={{
                              ...pageStyles.confirmYes,
                              opacity: isCancelling ? 0.6 : 1,
                              cursor: isCancelling ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {isCancelling ? 'Cancelando...' : 'Sí, cancelar'}
                          </button>
                          <button
                            onClick={() => setConfirmCancelId(null)}
                            disabled={isCancelling}
                            style={pageStyles.confirmNo}
                          >
                            No, mantener
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmCancelId(booking.id)}
                        style={pageStyles.cancelBtn}
                      >
                        Cancelar turno
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
