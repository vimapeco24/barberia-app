-- Migration 006: Create indexes for performance
-- Requisitos: 3.3, 8.1

-- Index for querying barber bookings by date (only confirmed)
CREATE INDEX idx_bookings_barber_date ON bookings(barber_id, booking_date) WHERE status = 'confirmed';

-- Index for querying client bookings (only confirmed)
CREATE INDEX idx_bookings_client ON bookings(client_id) WHERE status = 'confirmed';

-- Index for querying login attempts by user and time
CREATE INDEX idx_login_attempts_user ON login_attempts(user_id, attempted_at);

-- Unique index on users email (redundant with UNIQUE constraint but explicit for clarity)
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- Partial unique index to prevent overlapping bookings for the same barber
CREATE UNIQUE INDEX idx_no_overlap_barber ON bookings (barber_id, booking_date, start_time) WHERE status = 'confirmed';
