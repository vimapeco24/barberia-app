import { useEffect, useState } from 'react';
import { TimeSlot } from '../types';
import { getAvailability } from '../services/booking.service';

interface TimeSlotSelectorProps {
  barberId: string;
  date: string;
  onSelect: (slot: TimeSlot) => void;
  selectedTime?: string;
}

export default function TimeSlotSelector({
  barberId,
  date,
  onSelect,
  selectedTime,
}: TimeSlotSelectorProps) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSlots() {
      try {
        setLoading(true);
        setError(null);
        const data = await getAvailability(barberId, date);
        setSlots(data);
      } catch {
        setError('Error al cargar los horarios disponibles.');
      } finally {
        setLoading(false);
      }
    }
    fetchSlots();
  }, [barberId, date]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 32, color: '#6b7280' }}>
        Cargando horarios...
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        style={{
          padding: 12,
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 4,
          color: '#dc2626',
        }}
      >
        {error}
      </div>
    );
  }

  const availableSlots = slots.filter((s) => s.available);

  if (availableSlots.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 32, color: '#6b7280' }}>
        No hay horarios disponibles para esta fecha.
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
        Selecciona un horario
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
          gap: 8,
        }}
      >
        {availableSlots.map((slot) => {
          const isSelected = slot.startTime === selectedTime;
          return (
            <button
              key={slot.startTime}
              onClick={() => onSelect(slot)}
              aria-pressed={isSelected}
              style={{
                padding: '12px 8px',
                border: isSelected ? '2px solid #2563eb' : '1px solid #e5e7eb',
                borderRadius: 8,
                background: isSelected ? '#eff6ff' : '#fff',
                cursor: 'pointer',
                textAlign: 'center',
                fontWeight: isSelected ? 600 : 400,
              }}
            >
              <div style={{ fontSize: 14 }}>
                {slot.startTime.slice(0, 5)}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                {slot.endTime.slice(0, 5)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
