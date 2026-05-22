import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { BarberProfile, TimeSlot, Booking } from '../types';
import {
  getBarbers,
  getAvailability,
  createBooking,
} from '../services/booking.service';

type Step = 'barber' | 'date' | 'time' | 'confirm';

const STEPS: Step[] = ['barber', 'date', 'time', 'confirm'];
const STEP_LABELS: Record<Step, string> = {
  barber: 'Barbero',
  date: 'Fecha',
  time: 'Horario',
  confirm: 'Confirmar',
};

function generateDates(count: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 1; i <= count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatDateFull(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function NewBookingScreen({ navigation }: { navigation: any }) {
  const [step, setStep] = useState<Step>('barber');
  const [selectedBarber, setSelectedBarber] = useState<BarberProfile | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [serviceType] = useState('Corte de cabello');

  const [barbers, setBarbers] = useState<BarberProfile[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Booking | null>(null);

  const dates = generateDates(30);
  const currentStepIndex = STEPS.indexOf(step);

  // Load barbers on mount
  useEffect(() => {
    loadBarbers();
  }, []);

  async function loadBarbers() {
    setLoading(true);
    setError(null);
    try {
      const data = await getBarbers();
      setBarbers(data.filter((b) => b.isAvailable));
    } catch {
      setError('No se pudieron cargar los barberos. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  }

  const loadAvailability = useCallback(async (barberId: string, date: string) => {
    setLoading(true);
    setError(null);
    try {
      const slots = await getAvailability(barberId, date);
      setTimeSlots(slots.filter((s) => s.available));
    } catch {
      setError('No se pudo cargar la disponibilidad. Intente nuevamente.');
      setTimeSlots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleBarberSelect(barber: BarberProfile) {
    setSelectedBarber(barber);
    setSelectedDate(null);
    setSelectedSlot(null);
    setError(null);
    setStep('date');
  }

  function handleDateSelect(date: string) {
    setSelectedDate(date);
    setSelectedSlot(null);
    setError(null);
    setStep('time');
    if (selectedBarber) {
      loadAvailability(selectedBarber.id, date);
    }
  }

  function handleTimeSelect(slot: TimeSlot) {
    setSelectedSlot(slot);
    setError(null);
    setStep('confirm');
  }

  function goBack() {
    setError(null);
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
    } catch (err: unknown) {
      const apiError = err as {
        response?: { data?: { error?: { code?: string; message?: string } } };
      };
      const code = apiError.response?.data?.error?.code;
      const message = apiError.response?.data?.error?.message;

      if (code === 'SLOT_UNAVAILABLE') {
        setError('El horario seleccionado ya fue ocupado. Por favor, elige otro.');
        setStep('time');
        if (selectedBarber && selectedDate) {
          loadAvailability(selectedBarber.id, selectedDate);
        }
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
      <ScrollView style={styles.container} contentContainerStyle={styles.confirmationContainer}>
        <View style={styles.confirmationCard}>
          <Text style={styles.confirmationIcon}>✓</Text>
          <Text style={styles.confirmationTitle}>¡Turno confirmado!</Text>
          <Text style={styles.confirmationSubtitle}>
            Tu reserva ha sido creada exitosamente.
          </Text>

          <View style={styles.confirmationDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>ID del turno</Text>
              <Text style={styles.detailValueMono}>{confirmation.id.slice(0, 8)}...</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Barbero</Text>
              <Text style={styles.detailValue}>{selectedBarber?.name}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Fecha</Text>
              <Text style={styles.detailValue}>
                {formatDateFull(confirmation.bookingDate)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Hora</Text>
              <Text style={styles.detailValue}>
                {confirmation.startTime.slice(0, 5)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('MyBookings')}
            accessibilityRole="button"
            accessibilityLabel="Ver mis turnos"
          >
            <Text style={styles.primaryButtonText}>Ver mis turnos</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Step indicator */}
      <View style={styles.stepIndicator}>
        {STEPS.map((s, i) => (
          <View key={s} style={styles.stepItem}>
            <View
              style={[
                styles.stepCircle,
                i <= currentStepIndex && styles.stepCircleActive,
              ]}
            >
              <Text
                style={[
                  styles.stepNumber,
                  i <= currentStepIndex && styles.stepNumberActive,
                ]}
              >
                {i + 1}
              </Text>
            </View>
            <Text
              style={[
                styles.stepLabel,
                i <= currentStepIndex && styles.stepLabelActive,
              ]}
            >
              {STEP_LABELS[s]}
            </Text>
          </View>
        ))}
      </View>

      {/* Error message */}
      {error && (
        <View style={styles.errorBanner} accessibilityRole="alert">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Back button */}
      {step !== 'barber' && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Volver al paso anterior"
        >
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
      )}

      {/* Step: Barber selection */}
      {step === 'barber' && (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Selecciona un barbero</Text>
          {loading ? (
            <ActivityIndicator size="large" color="#2563eb" style={styles.loader} />
          ) : (
            <FlatList
              data={barbers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.barberCard,
                    selectedBarber?.id === item.id && styles.barberCardSelected,
                  ]}
                  onPress={() => handleBarberSelect(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Seleccionar barbero ${item.name}`}
                >
                  <View style={styles.barberAvatar}>
                    <Text style={styles.barberAvatarText}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.barberInfo}>
                    <Text style={styles.barberName}>{item.name}</Text>
                    {item.specialty && (
                      <Text style={styles.barberSpecialty}>{item.specialty}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  No hay barberos disponibles en este momento.
                </Text>
              }
            />
          )}
        </View>
      )}

      {/* Step: Date selection */}
      {step === 'date' && (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Selecciona una fecha</Text>
          <FlatList
            data={dates}
            keyExtractor={(item) => item}
            numColumns={2}
            columnWrapperStyle={styles.dateGrid}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.dateCard,
                  selectedDate === item && styles.dateCardSelected,
                ]}
                onPress={() => handleDateSelect(item)}
                accessibilityRole="button"
                accessibilityLabel={`Seleccionar fecha ${formatDateDisplay(item)}`}
              >
                <Text
                  style={[
                    styles.dateText,
                    selectedDate === item && styles.dateTextSelected,
                  ]}
                >
                  {formatDateDisplay(item)}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Step: Time selection */}
      {step === 'time' && (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Selecciona un horario</Text>
          {loading ? (
            <ActivityIndicator size="large" color="#2563eb" style={styles.loader} />
          ) : timeSlots.length === 0 ? (
            <Text style={styles.emptyText}>
              No hay horarios disponibles para esta fecha.
            </Text>
          ) : (
            <FlatList
              data={timeSlots}
              keyExtractor={(item) => item.startTime}
              numColumns={3}
              columnWrapperStyle={styles.timeGrid}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.timeCard,
                    selectedSlot?.startTime === item.startTime && styles.timeCardSelected,
                  ]}
                  onPress={() => handleTimeSelect(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Seleccionar horario ${item.startTime.slice(0, 5)}`}
                >
                  <Text
                    style={[
                      styles.timeText,
                      selectedSlot?.startTime === item.startTime && styles.timeTextSelected,
                    ]}
                  >
                    {item.startTime.slice(0, 5)}
                  </Text>
                  <Text
                    style={[
                      styles.timeSubtext,
                      selectedSlot?.startTime === item.startTime && styles.timeTextSelected,
                    ]}
                  >
                    {item.endTime.slice(0, 5)}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}

      {/* Step: Confirmation */}
      {step === 'confirm' && selectedBarber && selectedDate && selectedSlot && (
        <ScrollView style={styles.stepContent}>
          <Text style={styles.stepTitle}>Confirmar reserva</Text>

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Barbero</Text>
              <Text style={styles.summaryValue}>{selectedBarber.name}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Fecha</Text>
              <Text style={styles.summaryValue}>{formatDateFull(selectedDate)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Horario</Text>
              <Text style={styles.summaryValue}>
                {selectedSlot.startTime.slice(0, 5)} - {selectedSlot.endTime.slice(0, 5)}
              </Text>
            </View>
            <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.summaryLabel}>Servicio</Text>
              <Text style={styles.summaryValue}>{serviceType}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
            onPress={handleConfirm}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Confirmar turno"
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Confirmar turno</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
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
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#2563eb',
  },
  stepNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  stepNumberActive: {
    color: '#fff',
  },
  stepLabel: {
    fontSize: 11,
    marginTop: 4,
    color: '#6b7280',
  },
  stepLabelActive: {
    color: '#2563eb',
  },
  errorBanner: {
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
  },
  backButton: {
    marginBottom: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
  },
  backButtonText: {
    fontSize: 14,
    color: '#374151',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#111827',
  },
  loader: {
    marginTop: 32,
  },
  // Barber selection
  barberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  barberCardSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  barberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  barberAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563eb',
  },
  barberInfo: {
    flex: 1,
  },
  barberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  barberSpecialty: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  // Date selection
  dateGrid: {
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dateCard: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  dateCardSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  dateText: {
    fontSize: 13,
    color: '#374151',
    textAlign: 'center',
  },
  dateTextSelected: {
    color: '#2563eb',
    fontWeight: '600',
  },
  // Time selection
  timeGrid: {
    justifyContent: 'flex-start',
    marginBottom: 8,
  },
  timeCard: {
    width: '30%',
    marginHorizontal: '1.5%',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  timeCardSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  timeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  timeTextSelected: {
    color: '#2563eb',
  },
  timeSubtext: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  // Confirmation summary
  summaryCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#f9fafb',
    padding: 16,
    marginBottom: 20,
  },
  summaryRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  // Confirmation success
  confirmationContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 32,
  },
  confirmationCard: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  confirmationIcon: {
    fontSize: 48,
    marginBottom: 12,
    color: '#16a34a',
  },
  confirmationTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  confirmationSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  confirmationDetails: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 20,
  },
  detailRow: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  detailValueMono: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  // Buttons
  primaryButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 14,
    marginTop: 32,
  },
});
