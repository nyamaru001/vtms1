-- Migration: Add request_type and emergency_reason to fuel_requests table
-- This allows distinguishing between NORMAL and EMERGENCY fuel requests

USE vtms;

-- Add request_type column (ENUM: NORMAL, EMERGENCY)
ALTER TABLE fuel_requests 
ADD COLUMN request_type ENUM('NORMAL', 'EMERGENCY') NOT NULL DEFAULT 'NORMAL' AFTER status;

-- Add emergency_reason column (TEXT, nullable - only required for EMERGENCY type)
ALTER TABLE fuel_requests 
ADD COLUMN emergency_reason TEXT NULL AFTER request_type;

-- Add index for request_type for better query performance
CREATE INDEX idx_fuel_requests_request_type ON fuel_requests(request_type);

-- Add index for emergency_reason for filtering emergency requests
CREATE INDEX idx_fuel_requests_emergency_reason ON fuel_requests(emergency_reason(100));