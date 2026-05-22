-- Migration 003: Create barber_profiles table
-- Requisitos: 8.1

CREATE TABLE barber_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id),
    specialty VARCHAR(100),
    working_hours JSONB NOT NULL DEFAULT '{"mon":{"start":"09:00","end":"18:00"},"tue":{"start":"09:00","end":"18:00"},"wed":{"start":"09:00","end":"18:00"},"thu":{"start":"09:00","end":"18:00"},"fri":{"start":"09:00","end":"18:00"},"sat":{"start":"09:00","end":"14:00"}}',
    is_available BOOLEAN NOT NULL DEFAULT true
);
