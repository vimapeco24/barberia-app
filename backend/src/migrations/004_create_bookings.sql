-- Migration 004: Create bookings table with constraints
-- Requisitos: 3.3, 8.1

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES users(id),
    barber_id UUID NOT NULL REFERENCES barber_profiles(id),
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    service_type VARCHAR(50) NOT NULL,
    status booking_status NOT NULL DEFAULT 'confirmed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_duration CHECK (duration_minutes > 0),
    CONSTRAINT future_booking CHECK (booking_date >= CURRENT_DATE)
);
