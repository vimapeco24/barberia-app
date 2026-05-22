import api from './api';
import { AgendaEntry } from '../types';

export async function getBarberAgendaToday(): Promise<AgendaEntry[]> {
  const response = await api.get<{ success: true; data: AgendaEntry[] }>(
    '/barber/agenda'
  );
  return response.data.data;
}

export async function getBarberAgendaByDate(date: string): Promise<AgendaEntry[]> {
  const response = await api.get<{ success: true; data: AgendaEntry[] }>(
    `/barber/agenda/${date}`
  );
  return response.data.data;
}

export async function getBarberAgendaForRange(
  startDate: string,
  endDate: string
): Promise<Record<string, AgendaEntry[]>> {
  const result: Record<string, AgendaEntry[]> = {};
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  const promises: { date: string; promise: Promise<AgendaEntry[]> }[] = [];

  const current = new Date(start);
  while (current <= end) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    promises.push({ date: dateStr, promise: getBarberAgendaByDate(dateStr) });
    current.setDate(current.getDate() + 1);
  }

  const results = await Promise.allSettled(promises.map((p) => p.promise));

  results.forEach((res, index) => {
    const dateStr = promises[index].date;
    if (res.status === 'fulfilled') {
      result[dateStr] = res.value;
    } else {
      result[dateStr] = [];
    }
  });

  return result;
}
