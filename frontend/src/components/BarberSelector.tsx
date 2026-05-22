import { useEffect, useState } from 'react';
import { BarberProfile } from '../types';
import { getBarbers } from '../services/booking.service';

interface BarberSelectorProps {
  onSelect: (barber: BarberProfile) => void;
  selectedBarberId?: string;
}

export default function BarberSelector({ onSelect, selectedBarberId }: BarberSelectorProps) {
  const [barbers, setBarbers] = useState<BarberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBarbers() {
      try {
        setError(null);
        const data = await getBarbers();
        setBarbers(data.filter((b) => b.isAvailable));
      } catch {
        setError('Error al cargar la lista de barberos.');
      } finally {
        setLoading(false);
      }
    }
    fetchBarbers();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 32, color: '#6b7280' }}>
        Cargando barberos...
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

  if (barbers.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 32, color: '#6b7280' }}>
        No hay barberos disponibles en este momento.
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
        Selecciona un barbero
      </h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {barbers.map((barber) => {
          const isSelected = barber.id === selectedBarberId;
          return (
            <li key={barber.id} style={{ marginBottom: 8 }}>
              <button
                onClick={() => onSelect(barber)}
                aria-pressed={isSelected}
                style={{
                  width: '100%',
                  padding: 16,
                  border: isSelected ? '2px solid #2563eb' : '1px solid #e5e7eb',
                  borderRadius: 8,
                  background: isSelected ? '#eff6ff' : '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>
                    {barber.name}
                  </div>
                  {barber.specialty && (
                    <div style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>
                      {barber.specialty}
                    </div>
                  )}
                </div>
                {isSelected && (
                  <span style={{ color: '#2563eb', fontSize: 20 }}>✓</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
