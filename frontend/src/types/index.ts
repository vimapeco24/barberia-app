// API Response types (mirrors backend structure)
export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

// User types
export type Role = 'client' | 'barber' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: Role;
}

// Auth types
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export interface RegisterDTO {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

// Booking types
export interface Booking {
  id: string;
  clientId: string;
  barberId: string;
  barberName?: string;
  bookingDate: string;
  startTime: string;
  durationMinutes: number;
  serviceType: string;
  status: BookingStatus;
  createdAt: string;
  cancelledAt?: string;
}

export type BookingStatus = 'confirmed' | 'cancelled' | 'completed';

export interface CreateBookingDTO {
  barberId: string;
  date: string;
  startTime: string;
  serviceType: string;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
}

// Barber types
export interface BarberProfile {
  id: string;
  userId: string;
  name: string;
  phone?: string;
  specialty?: string;
  isAvailable: boolean;
}

// Agenda types
export interface AgendaEntry {
  bookingId: string;
  clientName: string;
  startTime: string;
  duration: number;
  serviceType: string;
  status: BookingStatus;
}
