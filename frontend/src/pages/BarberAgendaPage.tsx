import { useEffect, useState, useCallback } from 'react';
import { AgendaEntry } from '../types';
import { getBarberAgendaByDate, getBarberAgendaForRange } from '../services/barber.service';
import Layout from '../components/Layout';

type ViewMode = 'day' | 'week' | 'month';

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(time: string): string {
  return time.slice(0, 5);
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

function getWeekDates(date: Date): Date[] {
  const monday = getMonday(date);
  const dates: Date[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function getMonthDates(date: Date): { weeks: (Date | null)[][] } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let startDow = firstDay.getDay();
  if (startDow === 0) startDow = 7;
  startDow -= 1; // Monday = 0

  const weeks: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = [];

  for (let i = 0; i < startDow; i++) {
    currentWeek.push(null);
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const d = new Date(year, month, day);
    if (d.getDay() === 0) continue; // Skip Sundays
    currentWeek.push(d);
    if (currentWeek.length === 6) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 6) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  return { weeks };
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

function formatWeekRange(date: Date): string {
  const dates = getWeekDates(date);
  const first = dates[0];
  const last = dates[dates.length - 1];
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${first.toLocaleDateString('es-AR', opts)} - ${last.toLocaleDateString('es-AR', opts)}, ${last.getFullYear()}`;
}

const AUTO_REFRESH_INTERVAL = 30_000;

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const pageStyles: Record<string, React.CSSProperties> = {
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#1a1a2e',
    margin: '0 0 4px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
  },
  viewTabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '20px',
    padding: '4px',
    background: '#f3f4f6',
    borderRadius: '10px',
    width: 'fit-content',
  },
  viewTab: {
    padding: '10px 24px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    color: '#6b7280',
    transition: 'all 0.2s',
  },
  viewTabActive: {
    padding: '10px 24px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    background: '#c8a96e',
    color: '#ffffff',
    boxShadow: '0 2px 4px rgba(200, 169, 110, 0.3)',
  },
  dateNav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '28px',
    padding: '16px 20px',
    background: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    border: '1px solid #e5e7eb',
  },
  navBtn: {
    padding: '10px 18px',
    cursor: 'pointer',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    background: '#ffffff',
    fontSize: '14px',
    fontWeight: 600,
    color: '#1a1a2e',
    transition: 'all 0.2s',
  },
  dateDisplay: {
    textAlign: 'center' as const,
  },
  dateText: {
    fontWeight: 700,
    fontSize: '16px',
    textTransform: 'capitalize' as const,
    color: '#1a1a2e',
  },
  todayBtn: {
    marginTop: '6px',
    fontSize: '12px',
    color: '#c8a96e',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    textDecoration: 'underline',
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
  loading: {
    textAlign: 'center' as const,
    padding: '48px',
    color: '#6b7280',
    fontSize: '15px',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '64px 32px',
    background: '#ffffff',
    borderRadius: '16px',
    border: '2px dashed #e5e7eb',
  },
  emptyIcon: {
    fontSize: '56px',
    marginBottom: '16px',
    display: 'block',
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1a1a2e',
    marginBottom: '8px',
  },
  emptySubtitle: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
  },
  entryCard: {
    padding: '18px 20px',
    marginBottom: '12px',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    background: '#ffffff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    borderLeft: '4px solid #c8a96e',
  },
  entryTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clientName: {
    fontWeight: 700,
    fontSize: '16px',
    color: '#1a1a2e',
  },
  timeBlock: {
    textAlign: 'right' as const,
  },
  time: {
    fontWeight: 700,
    fontSize: '18px',
    color: '#c8a96e',
  },
  duration: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '2px',
  },
  service: {
    marginTop: '8px',
    fontSize: '14px',
    color: '#4b5563',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  refreshIndicator: {
    marginTop: '24px',
    textAlign: 'center' as const,
    fontSize: '12px',
    color: '#9ca3af',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  countBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: 600,
    background: '#dbeafe',
    color: '#1e40af',
  },
  // Week view styles
  weekGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '12px',
    marginBottom: '24px',
  },
  weekDayColumn: {
    background: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    overflow: 'hidden',
    minHeight: '200px',
  },
  weekDayHeader: {
    padding: '12px 10px',
    background: '#1a1a2e',
    color: '#ffffff',
    textAlign: 'center' as const,
    fontSize: '13px',
    fontWeight: 600,
  },
  weekDayHeaderToday: {
    padding: '12px 10px',
    background: '#c8a96e',
    color: '#ffffff',
    textAlign: 'center' as const,
    fontSize: '13px',
    fontWeight: 600,
  },
  weekDayBody: {
    padding: '8px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  weekEntryCard: {
    padding: '8px 10px',
    borderRadius: '8px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderLeft: '3px solid #c8a96e',
    fontSize: '12px',
  },
  weekEntryTime: {
    fontWeight: 700,
    color: '#c8a96e',
    fontSize: '12px',
  },
  weekEntryClient: {
    fontWeight: 600,
    color: '#1a1a2e',
    fontSize: '12px',
    marginTop: '2px',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  weekEntryService: {
    color: '#6b7280',
    fontSize: '11px',
    marginTop: '2px',
  },
  weekEmptyDay: {
    padding: '16px 8px',
    textAlign: 'center' as const,
    color: '#9ca3af',
    fontSize: '12px',
  },
  // Month view styles
  monthGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '2px',
    background: '#e5e7eb',
    borderRadius: '12px',
    overflow: 'hidden',
    marginBottom: '24px',
  },
  monthDayHeader: {
    padding: '10px',
    background: '#1a1a2e',
    color: '#ffffff',
    textAlign: 'center' as const,
    fontSize: '12px',
    fontWeight: 600,
  },
  monthDayCell: {
    padding: '10px 8px',
    background: '#ffffff',
    minHeight: '80px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    position: 'relative' as const,
  },
  monthDayCellToday: {
    padding: '10px 8px',
    background: '#fffbeb',
    minHeight: '80px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    position: 'relative' as const,
    boxShadow: 'inset 0 0 0 2px #c8a96e',
  },
  monthDayCellEmpty: {
    padding: '10px 8px',
    background: '#f9fafb',
    minHeight: '80px',
  },
  monthDayNumber: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1a1a2e',
    marginBottom: '6px',
  },
  monthDayNumberToday: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#c8a96e',
    marginBottom: '6px',
  },
  monthBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 600,
    background: '#c8a96e',
    color: '#ffffff',
  },
  monthNoBadge: {
    fontSize: '11px',
    color: '#9ca3af',
  },
};

export default function BarberAgendaPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [entries, setEntries] = useState<AgendaEntry[]>([]);
  const [rangeEntries, setRangeEntries] = useState<Record<string, AgendaEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDayAgenda = useCallback(async () => {
    try {
      setError(null);
      const dateStr = formatDate(selectedDate);
      const data = await getBarberAgendaByDate(dateStr);
      setEntries(data);
    } catch {
      setError('Error al cargar la agenda. Reintentando...');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const fetchWeekAgenda = useCallback(async () => {
    try {
      setError(null);
      const weekDates = getWeekDates(selectedDate);
      const startStr = formatDate(weekDates[0]);
      const endStr = formatDate(weekDates[weekDates.length - 1]);
      const data = await getBarberAgendaForRange(startStr, endStr);
      setRangeEntries(data);
    } catch {
      setError('Error al cargar la agenda semanal. Reintentando...');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const fetchMonthAgenda = useCallback(async () => {
    try {
      setError(null);
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startStr = formatDate(firstDay);
      const endStr = formatDate(lastDay);
      const data = await getBarberAgendaForRange(startStr, endStr);
      setRangeEntries(data);
    } catch {
      setError('Error al cargar la agenda mensual. Reintentando...');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const fetchAgenda = useCallback(async () => {
    if (viewMode === 'day') {
      await fetchDayAgenda();
    } else if (viewMode === 'week') {
      await fetchWeekAgenda();
    } else {
      await fetchMonthAgenda();
    }
  }, [viewMode, fetchDayAgenda, fetchWeekAgenda, fetchMonthAgenda]);

  useEffect(() => {
    setLoading(true);
    fetchAgenda();
  }, [fetchAgenda]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAgenda();
    }, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAgenda]);

  function goToPrevious() {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      if (viewMode === 'day') {
        next.setDate(next.getDate() - 1);
      } else if (viewMode === 'week') {
        next.setDate(next.getDate() - 7);
      } else {
        next.setMonth(next.getMonth() - 1);
      }
      return next;
    });
  }

  function goToNext() {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      if (viewMode === 'day') {
        next.setDate(next.getDate() + 1);
      } else if (viewMode === 'week') {
        next.setDate(next.getDate() + 7);
      } else {
        next.setMonth(next.getMonth() + 1);
      }
      return next;
    });
  }

  function goToToday() {
    setSelectedDate(new Date());
  }

  function handleMonthDayClick(date: Date) {
    setSelectedDate(date);
    setViewMode('day');
  }

  function getNavLabel(): string {
    if (viewMode === 'day') return formatDisplayDate(selectedDate);
    if (viewMode === 'week') return formatWeekRange(selectedDate);
    return formatMonthYear(selectedDate);
  }

  function getPrevLabel(): string {
    if (viewMode === 'day') return '← Anterior';
    if (viewMode === 'week') return '← Semana';
    return '← Mes';
  }

  function getNextLabel(): string {
    if (viewMode === 'day') return 'Siguiente →';
    if (viewMode === 'week') return 'Semana →';
    return 'Mes →';
  }

  const isToday = formatDate(selectedDate) === formatDate(new Date());

  const totalCount = viewMode === 'day'
    ? entries.length
    : Object.values(rangeEntries).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <Layout>
      {/* Header */}
      <div style={pageStyles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={pageStyles.title}>Mi Agenda</h1>
            <p style={pageStyles.subtitle}>Vista de turnos (solo lectura)</p>
          </div>
          {!loading && totalCount > 0 && (
            <span style={pageStyles.countBadge}>
              📋 {totalCount} turno{totalCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* View mode tabs */}
      <div style={pageStyles.viewTabs}>
        <button
          style={viewMode === 'day' ? pageStyles.viewTabActive : pageStyles.viewTab}
          onClick={() => setViewMode('day')}
        >
          Día
        </button>
        <button
          style={viewMode === 'week' ? pageStyles.viewTabActive : pageStyles.viewTab}
          onClick={() => setViewMode('week')}
        >
          Semana
        </button>
        <button
          style={viewMode === 'month' ? pageStyles.viewTabActive : pageStyles.viewTab}
          onClick={() => setViewMode('month')}
        >
          Mes
        </button>
      </div>

      {/* Date navigation */}
      <div style={pageStyles.dateNav}>
        <button
          onClick={goToPrevious}
          aria-label="Anterior"
          style={pageStyles.navBtn}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#f9fafb';
            e.currentTarget.style.borderColor = '#c8a96e';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#ffffff';
            e.currentTarget.style.borderColor = '#e5e7eb';
          }}
        >
          {getPrevLabel()}
        </button>

        <div style={pageStyles.dateDisplay}>
          <div style={pageStyles.dateText}>
            {getNavLabel()}
          </div>
          {!isToday && (
            <button onClick={goToToday} style={pageStyles.todayBtn}>
              Volver a hoy
            </button>
          )}
          {isToday && viewMode === 'day' && (
            <span style={{ fontSize: '12px', color: '#c8a96e', fontWeight: 600 }}>
              Hoy
            </span>
          )}
        </div>

        <button
          onClick={goToNext}
          aria-label="Siguiente"
          style={pageStyles.navBtn}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#f9fafb';
            e.currentTarget.style.borderColor = '#c8a96e';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#ffffff';
            e.currentTarget.style.borderColor = '#e5e7eb';
          }}
        >
          {getNextLabel()}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div role="alert" style={pageStyles.errorMsg}>
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={pageStyles.loading}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
          Cargando agenda...
        </div>
      )}

      {/* Day View */}
      {!loading && viewMode === 'day' && (
        <>
          {entries.length === 0 && !error && (
            <div style={pageStyles.emptyState}>
              <span style={pageStyles.emptyIcon}>📅</span>
              <p style={pageStyles.emptyTitle}>No hay turnos agendados</p>
              <p style={pageStyles.emptySubtitle}>
                No tienes turnos programados para este día.
              </p>
            </div>
          )}
          {entries.length > 0 && (
            <div>
              {entries.map((entry) => (
                <div key={entry.bookingId} style={pageStyles.entryCard}>
                  <div style={pageStyles.entryTop}>
                    <div>
                      <div style={pageStyles.clientName}>
                        {entry.clientName}
                      </div>
                      <div style={pageStyles.service}>
                        <span>💈</span> {entry.serviceType}
                      </div>
                    </div>
                    <div style={pageStyles.timeBlock}>
                      <div style={pageStyles.time}>
                        {formatTime(entry.startTime)}
                      </div>
                      <div style={pageStyles.duration}>
                        {entry.duration} min
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Week View */}
      {!loading && viewMode === 'week' && (
        <div style={pageStyles.weekGrid}>
          {getWeekDates(selectedDate).map((date) => {
            const dateStr = formatDate(date);
            const dayEntries = rangeEntries[dateStr] || [];
            const isDayToday = dateStr === formatDate(new Date());
            return (
              <div key={dateStr} style={pageStyles.weekDayColumn}>
                <div style={isDayToday ? pageStyles.weekDayHeaderToday : pageStyles.weekDayHeader}>
                  <div>{formatShortDate(date)}</div>
                  {dayEntries.length > 0 && (
                    <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
                      {dayEntries.length} turno{dayEntries.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                <div style={pageStyles.weekDayBody}>
                  {dayEntries.length === 0 && (
                    <div style={pageStyles.weekEmptyDay}>Sin turnos</div>
                  )}
                  {dayEntries.map((entry) => (
                    <div key={entry.bookingId} style={pageStyles.weekEntryCard}>
                      <div style={pageStyles.weekEntryTime}>
                        {formatTime(entry.startTime)}
                      </div>
                      <div style={pageStyles.weekEntryClient}>
                        {entry.clientName}
                      </div>
                      <div style={pageStyles.weekEntryService}>
                        {entry.serviceType} · {entry.duration}min
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Month View */}
      {!loading && viewMode === 'month' && (
        <div style={pageStyles.monthGrid}>
          {/* Day headers */}
          {DAY_NAMES.map((name) => (
            <div key={name} style={pageStyles.monthDayHeader}>
              {name}
            </div>
          ))}
          {/* Calendar cells */}
          {getMonthDates(selectedDate).weeks.map((week, weekIdx) =>
            week.map((date, dayIdx) => {
              if (!date) {
                return (
                  <div
                    key={`empty-${weekIdx}-${dayIdx}`}
                    style={pageStyles.monthDayCellEmpty}
                  />
                );
              }
              const dateStr = formatDate(date);
              const dayEntries = rangeEntries[dateStr] || [];
              const isDayToday = dateStr === formatDate(new Date());
              return (
                <div
                  key={dateStr}
                  style={isDayToday ? pageStyles.monthDayCellToday : pageStyles.monthDayCell}
                  onClick={() => handleMonthDayClick(date)}
                  onMouseEnter={(e) => {
                    if (!isDayToday) {
                      e.currentTarget.style.background = '#f9fafb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isDayToday) {
                      e.currentTarget.style.background = '#ffffff';
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Ver agenda del ${date.getDate()}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleMonthDayClick(date);
                    }
                  }}
                >
                  <div style={isDayToday ? pageStyles.monthDayNumberToday : pageStyles.monthDayNumber}>
                    {date.getDate()}
                  </div>
                  {dayEntries.length > 0 ? (
                    <span style={pageStyles.monthBadge}>
                      {dayEntries.length} turno{dayEntries.length !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span style={pageStyles.monthNoBadge}>—</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Auto-refresh indicator */}
      <div style={pageStyles.refreshIndicator}>
        <span>🔄</span> Actualización automática cada 30 segundos
      </div>
    </Layout>
  );
}
