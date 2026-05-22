import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarberProfile, TimeSlot, Booking } from '../types';
import { createBooking } from '../services/booking.service';
import { useAuth } from '../hooks/useAuth';
import BarberSelector from '../components/BarberSelector';
import DateSelector from '../components/DateSelector';
import TimeSlotSelector from '../components/TimeSlotSelector';
import Layout from '../components/Layout';

type Step = 'barber' | 'date' | 'time' | 'confirm';

const pageStyles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '650px',
    margin: '0 auto',
  },
  title: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#1a1a2e',
    margin: '0 0 24px 0',
  },
  stepIndicator: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '32px',
    padding: '20px 16px',
    background: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    border: '1px solid #e5e7eb',
  },
  stepItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    flex: 1,
    position: 'relative' as const,
  },
  stepCircle: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 700,
  },
  stepCircleActive: {
    background: '#c8a96e',
    color: '#1a1a2e',
    boxShadow: '0 2px 8px rgba(200, 169, 110, 0.4)',
  },
  stepCircleInactive: {
    background: '#f3f4f6',
    color: '#9ca3af',
  },
  stepCircleCompleted: {
    background: '#1a1a2e',
    color: '#c8a96e',
  },
  stepLabel: {
    fontSize: '12px',
    marginTop: '6px',
    fontWeight: 600,
  },
  stepLabelActive: {
    color: '#c8a96e',
  },
  stepLabelInactive: {
    color: '#9ca3af',
  },
  errorMsg: {
    padding: '14px 18px',
    marginBottom: '20px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '10px',
    color: '#dc2626',
    fontSize: '14px',
    fontWeight: 500,
  },
  backBtn: {
    marginBottom: '20px',
    padding: '10px 18px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#374151',
    fontWeight: 500,
    transition: 'all 0.2s',
  },
  confirmCard: {
    padding: '24px',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    background: '#ffffff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    marginBottom: '24px',
  },
  confirmTitle: {
    fontSize: '20px',
    fontWeight: 700,
    marginBottom: '20px',
    color: '#1a1a2e',
  },
  confirmRow: {
    marginBottom: '16px',
    paddingBottom: '16px',
    borderBottom: '1px solid #f3f4f6',
  },
  confirmLabel: {
    color: '#6b7280',
    fontSize: '13px',
    fontWeight: 500,
    marginBottom: '4px',
  },
  confirmValue: {
    fontWeight: 700,
    fontSize: '15px',
    color: '#1a1a2e',
  },
  confirmBtn: {
    width: '100%',
    padding: '16px 24px',
    background: '#c8a96e',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '16px',
    boxShadow: '0 2px 8px rgba(200, 169, 110, 0.3)',
    transition: 'all 0.2s',
  },
  successCard: {
    textAlign: 'center' as const,
    padding: '40px 32px',
    background: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  },
  successIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: '#dcfce7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    margin: '0 auto 20px',
  },
  successTitle: {
    fontSize: '22px',
    fontWeight: 700,
    marginBottom: '8px',
    color: '#1a1a2e',
  },
  successSubtitle: {
    color: '#6b7280',
    marginBottom: '28px',
    fontSize: '15px',
  },
  successDetails: {
    background: '#f9fafb',
    borderRadius: '10px',
    padding: '20px',
    textAlign: 'left' as const,
    border: '1px solid #e5e7eb',
    marginBottom: '24px',
  },
  viewBookingsBtn: {
    padding: '14px 28px',
    background: '#1a1a2e',
    color: '#c8a96e',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '15px',
    transition: 'all 0.2s',
  },
};

export default function NewBookingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>('barber');
  const [selectedBarber, setSelectedBarber] = useState<BarberProfile | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [serviceType] = useState('Corte de cabello');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Booking | null>(null);

  function handleBarberSelect(barber: BarberProfile) {
    setSelectedBarber(barber);
    setSelectedDate(null);
    setSelectedSlot(null);
    setStep('date');
  }

  function handleDateSelect(date: string) {
    setSelectedDate(date);
    setSelectedSlot(null);
    setStep('time');
  }

  function handleTimeSelect(slot: TimeSlot) {
    setSelectedSlot(slot);
    setStep('confirm');
  }

  function goBack() {
    if (step === 'date') setStep('barber');
    else if (step === 'time') setStep('date');
    else if (step === 'confirm') setStep('time');
  }

  async function handleConfirm() {
    if (!selectedBarber || !selectedDate || !selectedSlot) return;

    setSubmitting(true);
    setError(null);

    try {
      const booking = await createBooking({
        barberId: selectedBarber.id,
        date: selectedDate,
        startTime: selectedSlot.startTime,
        serviceType,
      });
      setConfirmation(booking);

      // Auto-open WhatsApp to notify the barber
      if (selectedBarber?.phone) {
        const phone = selectedBarber.phone.replace(/[^0-9]/g, '');
        const message = encodeURIComponent(
          `🔔 *Nueva reserva en BarberShop*\n\n` +
          `👤 Cliente: ${user?.name || 'Cliente'}\n` +
          `📅 Fecha: ${new Date(booking.bookingDate + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}\n` +
          `🕐 Hora: ${booking.startTime.slice(0, 5)}\n` +
          `💈 Servicio: ${booking.serviceType}\n\n` +
          `ID: ${booking.id.slice(0, 8)}`
        );
        window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
      }
    } catch (err: unknown) {
      const apiError = err as {
        response?: { data?: { error?: { code?: string; message?: string } } };
      };
      const code = apiError.response?.data?.error?.code;
      const message = apiError.response?.data?.error?.message;

      if (code === 'SLOT_UNAVAILABLE') {
        setError('El horario seleccionado ya fue ocupado. Por favor, elige otro.');
        setStep('time');
      } else if (code === 'CLIENT_OVERLAP') {
        setError('Ya tienes un turno en ese horario. Elige otro horario.');
        setStep('time');
      } else if (code === 'MAX_BOOKINGS_REACHED') {
        setError('Has alcanzado el máximo de 3 turnos activos. Cancela uno para reservar otro.');
      } else {
        setError(message || 'Error al crear el turno. Intenta nuevamente.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Confirmation screen
  if (confirmation) {
    return (
      <Layout>
        <div style={pageStyles.container}>
          <div style={pageStyles.successCard}>
            <div style={pageStyles.successIcon}>✓</div>
            <h1 style={pageStyles.successTitle}>¡Turno confirmado!</h1>
            <p style={pageStyles.successSubtitle}>
              Tu reserva ha sido creada exitosamente.
            </p>

            <div style={pageStyles.successDetails}>
              <div style={{ marginBottom: '14px' }}>
                <div style={pageStyles.confirmLabel}>ID del turno</div>
                <div style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '13px', color: '#1a1a2e' }}>
                  {confirmation.id}
                </div>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <div style={pageStyles.confirmLabel}>Barbero</div>
                <div style={pageStyles.confirmValue}>{selectedBarber?.name}</div>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <div style={pageStyles.confirmLabel}>Fecha</div>
                <div style={pageStyles.confirmValue}>
                  {new Date(confirmation.bookingDate + 'T00:00:00').toLocaleDateString('es-AR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>
              <div>
                <div style={pageStyles.confirmLabel}>Hora</div>
                <div style={pageStyles.confirmValue}>
                  {confirmation.startTime.slice(0, 5)}
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/bookings')}
              style={pageStyles.viewBookingsBtn}
            >
              Ver mis turnos
            </button>

            <p style={{ textAlign: 'center', fontSize: '13px', color: '#16a34a', marginTop: '12px' }}>
              ✅ Notificación enviada al barbero por WhatsApp
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  const stepLabels: Record<Step, string> = {
    barber: 'Barbero',
    date: 'Fecha',
    time: 'Horario',
    confirm: 'Confirmar',
  };

  const stepIcons: Record<Step, string> = {
    barber: '💈',
    date: '📅',
    time: '🕐',
    confirm: '✓',
  };

  const steps: Step[] = ['barber', 'date', 'time', 'confirm'];
  const currentStepIndex = steps.indexOf(step);

  return (
    <Layout>
      <div style={pageStyles.container}>
        <h1 style={pageStyles.title}>Reservar turno</h1>

        {/* Step indicator */}
        <div style={pageStyles.stepIndicator}>
          {steps.map((s, i) => {
            const isActive = i === currentStepIndex;
            const isCompleted = i < currentStepIndex;

            let circleStyle: React.CSSProperties;
            if (isActive) {
              circleStyle = { ...pageStyles.stepCircle, ...pageStyles.stepCircleActive };
            } else if (isCompleted) {
              circleStyle = { ...pageStyles.stepCircle, ...pageStyles.stepCircleCompleted };
            } else {
              circleStyle = { ...pageStyles.stepCircle, ...pageStyles.stepCircleInactive };
            }

            const labelStyle = isActive || isCompleted
              ? { ...pageStyles.stepLabel, ...pageStyles.stepLabelActive }
              : { ...pageStyles.stepLabel, ...pageStyles.stepLabelInactive };

            return (
              <div key={s} style={pageStyles.stepItem}>
                <div style={circleStyle}>
                  {isCompleted ? '✓' : stepIcons[s]}
                </div>
                <span style={labelStyle}>
                  {stepLabels[s]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Error message */}
        {error && (
          <div role="alert" style={pageStyles.errorMsg}>
            {error}
          </div>
        )}

        {/* Back button */}
        {step !== 'barber' && (
          <button
            onClick={goBack}
            style={pageStyles.backBtn}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#c8a96e';
              e.currentTarget.style.background = '#fefce8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.background = '#ffffff';
            }}
          >
            ← Volver
          </button>
        )}

        {/* Step content */}
        {step === 'barber' && (
          <BarberSelector
            onSelect={handleBarberSelect}
            selectedBarberId={selectedBarber?.id}
          />
        )}

        {step === 'date' && (
          <DateSelector
            onSelect={handleDateSelect}
            selectedDate={selectedDate ?? undefined}
          />
        )}

        {step === 'time' && selectedBarber && selectedDate && (
          <TimeSlotSelector
            barberId={selectedBarber.id}
            date={selectedDate}
            onSelect={handleTimeSelect}
            selectedTime={selectedSlot?.startTime}
          />
        )}

        {step === 'confirm' && selectedBarber && selectedDate && selectedSlot && (
          <div>
            <div style={pageStyles.confirmCard}>
              <h2 style={pageStyles.confirmTitle}>Confirmar reserva</h2>
              <div style={pageStyles.confirmRow}>
                <div style={pageStyles.confirmLabel}>Barbero</div>
                <div style={pageStyles.confirmValue}>{selectedBarber.name}</div>
              </div>
              <div style={pageStyles.confirmRow}>
                <div style={pageStyles.confirmLabel}>Fecha</div>
                <div style={pageStyles.confirmValue}>
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-AR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>
              <div style={pageStyles.confirmRow}>
                <div style={pageStyles.confirmLabel}>Horario</div>
                <div style={pageStyles.confirmValue}>
                  {selectedSlot.startTime.slice(0, 5)} - {selectedSlot.endTime.slice(0, 5)}
                </div>
              </div>
              <div style={{ marginBottom: 0 }}>
                <div style={pageStyles.confirmLabel}>Servicio</div>
                <div style={pageStyles.confirmValue}>{serviceType}</div>
              </div>
            </div>

            <button
              onClick={handleConfirm}
              disabled={submitting}
              style={{
                ...pageStyles.confirmBtn,
                opacity: submitting ? 0.7 : 1,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!submitting) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(200, 169, 110, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(200, 169, 110, 0.3)';
              }}
            >
              {submitting ? '⏳ Reservando...' : '✂️ Confirmar turno'}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
