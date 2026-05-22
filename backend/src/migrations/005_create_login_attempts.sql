-- Migration 005: Create login_attempts table
-- Requisitos: 8.1

CREATE TABLE login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    email VARCHAR(254) NOT NULL,
    success BOOLEAN NOT NULL,
    ip_address INET,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
