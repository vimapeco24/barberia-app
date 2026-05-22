-- Migration 001: Create ENUM types
-- Requisitos: 3.3, 8.1

CREATE TYPE user_role AS ENUM ('client', 'barber', 'admin');
CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled', 'completed');
