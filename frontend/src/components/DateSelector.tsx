import { useMemo } from 'react';

interface DateSelectorProps {
  onSelect: (date: string) => void;
  selectedDate?: string;
}

function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export default function DateSelector({ onSelect, selectedDate }: DateSelectorProps) {
  const availableDates = useMemo(() => {
    const dates: { iso: string; display: string; dayName: string; dayNum: number }[] = [];
    const today = new Date();

    for (let i = 1; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      // Skip Sundays (day 0) since barbers don't work on Sundays per working_hours schema
      if (date.getDay() === 0) continue;

      dates.push({
        iso: formatDateISO(date),
        display: formatDisplayDate(date),
        dayName: date.toLocaleDateString('es-AR', { weekday: 'short' }),
        dayNum: date.getDate(),
      });
    }
    return dates;
  }, []);

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
        Selecciona una fecha
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
          gap: 8,
        }}
      >
        {availableDates.map((d) => {
          const isSelected = d.iso === selectedDate;
          return (
            <button
              key={d.iso}
              onClick={() => onSelect(d.iso)}
              aria-pressed={isSelected}
              style={{
                padding: '12px 8px',
                border: isSelected ? '2px solid #2563eb' : '1px solid #e5e7eb',
                borderRadius: 8,
                background: isSelected ? '#eff6ff' : '#fff',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: '#6b7280',
                  textTransform: 'capitalize',
                }}
              >
                {d.dayName}
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>
                {d.dayNum}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
