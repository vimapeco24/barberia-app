import api from './api';
import { BarberProfile, Booking, CreateBookingDTO, TimeSlot } from '../types';

export async function getMyBookings(): Promise<Booking[]> {
  const response = await api.get<{ success: true; data: Booking[] }>(
    '/bookings'
  );
  return response.data.data;
}

export async function cancelBooking(bookingId: string): Promise<void> {
  await api.delete(`/bookings/${bookingId}`);
}

export async function getBarbers(): Promise<BarberProfile[]> {
  const response = await api.get<{ success: true; data: BarberProfile[] }>(
    '/bookings/barbers'
  );
  return response.data.data;
}

export async function getAvailability(barberId: string, date: string): Promise<TimeSlot[]> {
  const response = await api.get<{ success: true; data: TimeSlot[] }>(
    `/bookings/availability/${barberId}`,
    { params: { date } }
  );
  return response.data.data;
}

export async function createBooking(data: CreateBookingDTO): Promise<Booking> {
  const response = await api.post<{ success: true; data: Booking }>(
    '/bookings',
    data
  );
  return response.data.data;
}
