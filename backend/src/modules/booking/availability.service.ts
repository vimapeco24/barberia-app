import { barberRepository } from './barber.repository';
import { bookingRepository, BookingRow } from './booking.repository';
import { BOOKING_DURATION_MINUTES } from '../../shared/constants';

/** Represents a time slot with availability status */
export interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
}

/** Day-of-week index (0=Sunday) to working_hours key mapping */
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/**
 * Adds minutes to a time string in HH:mm format.
 * Returns the resulting time as HH:mm string.
 */
export function addMinutes(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60);
  const newMins = totalMinutes % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
}

/**
 * Converts a time string (HH:mm) to total minutes since midnight.
 */
export function timeToMinutes(time: string): number {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
}

/**
 * Generates all 30-minute time slots within a given working hours range.
 */
export function generateSlots(start: string, end: string): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const endMinutes = timeToMinutes(end);
  let currentMinutes = timeToMinutes(start);

  while (currentMinutes + BOOKING_DURATION_MINUTES <= endMinutes) {
    const startTime = addMinutes('00:00', currentMinutes);
    const endTime = addMinutes('00:00', currentMinutes + BOOKING_DURATION_MINUTES);
    slots.push({ startTime, endTime, available: true });
    currentMinutes += BOOKING_DURATION_MINUTES;
  }

  return slots;
}

/**
 * Checks if a time slot overlaps with an existing booking.
 * A slot [slotStart, slotEnd) overlaps with a booking [bookingStart, bookingStart + duration)
 * if slotStart < bookingEnd AND bookingStart < slotEnd.
 */
export function slotsOverlap(
  slotStartMinutes: number,
  slotEndMinutes: number,
  bookingStartMinutes: number,
  bookingDuration: number
): boolean {
  const bookingEndMinutes = bookingStartMinutes + bookingDuration;
  return slotStartMinutes < bookingEndMinutes && bookingStartMinutes < slotEndMinutes;
}

/**
 * Filters out slots that overlap with existing confirmed bookings.
 */
export function filterAvailableSlots(slots: TimeSlot[], bookings: BookingRow[]): TimeSlot[] {
  return slots.map((slot) => {
    const slotStartMinutes = timeToMinutes(slot.startTime);
    const slotEndMinutes = timeToMinutes(slot.endTime);

    const hasConflict = bookings.some((booking) => {
      const bookingStartMinutes = timeToMinutes(booking.start_time);
      return slotsOverlap(slotStartMinutes, slotEndMinutes, bookingStartMinutes, booking.duration_minutes);
    });

    return { ...slot, available: !hasConflict };
  });
}

/**
 * Gets available time slots for a barber on a specific date.
 * Returns only available (non-overlapping) 30-minute blocks within the barber's working hours.
 */
export async function getAvailability(barberId: string, date: string): Promise<TimeSlot[]> {
  // Get the barber's working hours
  const workingHours = await barberRepository.getWorkingHours(barberId);
  if (!workingHours) {
    return [];
  }

  // Determine the day of the week for the requested date
  const requestedDate = new Date(date + 'T00:00:00');
  const dayOfWeek = requestedDate.getUTCDay(); // 0=Sunday
  const dayKey = DAY_KEYS[dayOfWeek];

  // Get the schedule for that day
  const daySchedule = workingHours[dayKey];
  if (!daySchedule) {
    // Barber doesn't work on this day
    return [];
  }

  // Generate all 30-minute blocks within working hours
  const allSlots = generateSlots(daySchedule.start, daySchedule.end);

  // Get existing confirmed bookings for this barber on this date
  const existingBookings = await bookingRepository.findByBarberAndDate(barberId, date);

  // Filter out slots that overlap with existing bookings
  const availableSlots = filterAvailableSlots(allSlots, existingBookings);

  // Return only available slots
  return availableSlots.filter((slot) => slot.available);
}
