-- ============================================================
-- VTMS MIGRATION 005 — NEST to HPMU rename + Workflow normalization
-- ============================================================

USE vehicle_transport_management;

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- 1. Update USERS table: change NEST role to HPMU
-- ------------------------------------------------------------

-- First update existing NEST users to HPMU
UPDATE users SET role = 'HPMU' WHERE role = 'NEST';

-- Change the role ENUM
ALTER TABLE users
  MODIFY COLUMN role ENUM('ADMIN','OFFICER','DRIVER','TRANSPORT_OFFICER','R3','HPMU') NOT NULL;

-- ------------------------------------------------------------
-- 2. Update VEHICLE_REQUESTS table: new workflow statuses
-- ------------------------------------------------------------

-- New status workflow: PENDING -> R3_REVIEW -> R3_APPROVED/R3_REJECTED/R3_RETURNED -> TRANSPORT_REVIEW -> DRIVER_ASSIGNED -> DRIVER_ACCEPTED/DRIVER_CANCELLED -> FUEL_REQUESTED -> HPMU_REVIEW -> HPMU_APPROVED/HPMU_REJECTED/HPMU_RETURNED -> HPMU_RELEASED -> DRIVER_CONFIRMED -> TRIP_STARTED -> TRIP_COMPLETED -> CLOSED/CANCELLED

-- Map old statuses to new ones:
-- PENDING stays PENDING
-- TRANSPORT_REVIEW stays TRANSPORT_REVIEW (but will now come AFTER R3_APPROVED)
-- NEST_REVIEW -> HPMU_REVIEW (but NEST_REVIEW no longer exists in vehicle requests)
-- R3_REVIEW stays R3_REVIEW (now first review step)
-- APPROVED -> R3_APPROVED
-- REJECTED -> R3_REJECTED
-- RETURNED -> R3_RETURNED
-- DRIVER_ASSIGNED stays
-- TRIP_STARTED stays
-- TRIP_COMPLETED stays
-- CLOSED stays
-- CANCELLED stays

UPDATE vehicle_requests SET status = 'R3_APPROVED' WHERE status = 'APPROVED';
UPDATE vehicle_requests SET status = 'R3_REJECTED' WHERE status = 'REJECTED';
UPDATE vehicle_requests SET status = 'R3_RETURNED' WHERE status = 'RETURNED';
UPDATE vehicle_requests SET status = 'HPMU_REVIEW' WHERE status = 'NEST_REVIEW';

-- Add new columns for cancellation and extra fuel
ALTER TABLE vehicle_requests
  ADD COLUMN cancellation_reason TEXT NULL AFTER status,
  ADD COLUMN cancelled_at DATETIME NULL AFTER cancellation_reason,
  ADD COLUMN cancelled_by INT NULL AFTER cancelled_at,
  ADD CONSTRAINT fk_vr_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL;

-- Change status ENUM
ALTER TABLE vehicle_requests
  MODIFY COLUMN status ENUM(
    'PENDING',
    'R3_REVIEW',
    'R3_APPROVED',
    'R3_REJECTED',
    'R3_RETURNED',
    'TRANSPORT_REVIEW',
    'DRIVER_ASSIGNED',
    'DRIVER_ACCEPTED',
    'DRIVER_CANCELLED',
    'FUEL_REQUESTED',
    'HPMU_REVIEW',
    'HPMU_APPROVED',
    'HPMU_REJECTED',
    'HPMU_RETURNED',
    'HPMU_RELEASED',
    'DRIVER_CONFIRMED',
    'TRIP_STARTED',
    'TRIP_COMPLETED',
    'CLOSED',
    'CANCELLED'
  ) NOT NULL DEFAULT 'PENDING';

-- ------------------------------------------------------------
-- 3. Update FUEL_REQUESTS table: HPMU workflow
-- ------------------------------------------------------------

-- Map old statuses:
-- PENDING stays PENDING
-- R3_REVIEW stays R3_REVIEW
-- NEST_REVIEW -> HPMU_REVIEW
-- R3_FINAL_REVIEW -> HPMU_APPROVED (or keep as intermediate)
-- APPROVED -> HPMU_APPROVED
-- REJECTED -> HPMU_REJECTED
-- RETURNED -> HPMU_RETURNED
-- RELEASED -> HPMU_RELEASED
-- COMPLETED -> DRIVER_CONFIRMED

UPDATE fuel_requests SET status = 'HPMU_REVIEW' WHERE status = 'NEST_REVIEW';
UPDATE fuel_requests SET status = 'HPMU_APPROVED' WHERE status = 'R3_FINAL_REVIEW';
UPDATE fuel_requests SET status = 'HPMU_APPROVED' WHERE status = 'APPROVED';
UPDATE fuel_requests SET status = 'HPMU_REJECTED' WHERE status = 'REJECTED';
UPDATE fuel_requests SET status = 'HPMU_RETURNED' WHERE status = 'RETURNED';
UPDATE fuel_requests SET status = 'HPMU_RELEASED' WHERE status = 'RELEASED';
UPDATE fuel_requests SET status = 'DRIVER_CONFIRMED' WHERE status = 'COMPLETED';

-- Add columns for HPMU release and driver confirmation
ALTER TABLE fuel_requests
  ADD COLUMN hpmu_review_comment TEXT NULL AFTER review_comment,
  ADD COLUMN hpmu_reviewed_by INT NULL AFTER hpmu_review_comment,
  ADD COLUMN hpmu_reviewed_at DATETIME NULL AFTER hpmu_reviewed_by,
  ADD CONSTRAINT fk_fr_hpmu_reviewer FOREIGN KEY (hpmu_reviewed_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE fuel_requests
  ADD COLUMN litres_released FLOAT NULL AFTER actual_litres_received,
  ADD COLUMN release_comment TEXT NULL AFTER litres_released,
  ADD COLUMN released_by INT NULL AFTER release_comment,
  ADD COLUMN released_at DATETIME NULL AFTER released_by,
  ADD CONSTRAINT fk_fr_released_by FOREIGN KEY (released_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE fuel_requests
  ADD COLUMN confirmed_by_driver BOOLEAN NOT NULL DEFAULT FALSE AFTER actual_litres_received,
  ADD COLUMN confirmed_at DATETIME NULL AFTER confirmed_by_driver,
  ADD COLUMN confirmation_notes TEXT NULL AFTER confirmed_at;

-- Change status ENUM
ALTER TABLE fuel_requests
  MODIFY COLUMN status ENUM(
    'PENDING',
    'HPMU_REVIEW',
    'HPMU_APPROVED',
    'HPMU_REJECTED',
    'HPMU_RETURNED',
    'HPMU_RELEASED',
    'DRIVER_CONFIRMED',
    'COMPLETED'
  ) NOT NULL DEFAULT 'PENDING';

-- ------------------------------------------------------------
-- 4. Rename NEST_RECOMMENDATIONS to HPMU_RECOMMENDATIONS
-- ------------------------------------------------------------

-- Create new table
CREATE TABLE IF NOT EXISTS hpmu_recommendations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  reviewed_by INT NOT NULL,
  decision ENUM('APPROVE','REJECT','RETURN') NOT NULL,
  comment TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_hpmur_request FOREIGN KEY (request_id) REFERENCES vehicle_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_hpmur_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Migrate data from nest_recommendations (for vehicle requests)
INSERT INTO hpmu_recommendations (request_id, reviewed_by, decision, comment, created_at, updated_at)
SELECT request_id, reviewed_by, decision, comment, created_at, updated_at
FROM nest_recommendations
WHERE request_id IN (SELECT id FROM vehicle_requests);

-- Migrate data from nest_recommendations (for fuel requests) - need separate handling
-- For now, we'll keep the old table but the new model will use hpmu_recommendations

-- ------------------------------------------------------------
-- 5. Update TRIPS table: add statuses for driver assignment workflow
-- ------------------------------------------------------------

-- New trip statuses: NOT_STARTED -> DRIVER_ASSIGNED -> DRIVER_ACCEPTED -> DRIVER_CANCELLED -> TRIP_STARTED -> IN_PROGRESS -> TRIP_COMPLETED -> CLOSED

UPDATE trips SET status = 'DRIVER_ACCEPTED' WHERE status = 'DRIVER_ASSIGNED' AND status IN ('TRIP_STARTED','IN_PROGRESS','TRIP_COMPLETED','CLOSED');

ALTER TABLE trips
  MODIFY COLUMN status ENUM(
    'NOT_STARTED',
    'DRIVER_ASSIGNED',
    'DRIVER_ACCEPTED',
    'DRIVER_CANCELLED',
    'TRIP_STARTED',
    'IN_PROGRESS',
    'TRIP_COMPLETED',
    'CLOSED'
  ) NOT NULL DEFAULT 'NOT_STARTED';

-- ------------------------------------------------------------
-- 6. Update DRIVERS table: add availability status
-- ------------------------------------------------------------

-- Current: AVAILABLE, ASSIGNED, ON_TRIP, INACTIVE
-- Add: BUSY, UNAVAILABLE, CANCELLED_ASSIGNMENT

ALTER TABLE drivers
  MODIFY COLUMN status ENUM(
    'AVAILABLE',
    'ASSIGNED',
    'ON_TRIP',
    'BUSY',
    'UNAVAILABLE',
    'CANCELLED_ASSIGNMENT',
    'INACTIVE'
  ) NOT NULL DEFAULT 'AVAILABLE';

-- ------------------------------------------------------------
-- 7. Update NOTIFICATIONS: add type field for better filtering
-- ------------------------------------------------------------

ALTER TABLE notifications
  ADD COLUMN type VARCHAR(50) NULL AFTER link,
  ADD COLUMN reference_id INT NULL AFTER type,
  ADD COLUMN reference_type VARCHAR(50) NULL AFTER reference_id;

-- ------------------------------------------------------------
-- 8. Add EXTRA_FUEL_REQUESTS table for officer emergency fuel
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS extra_fuel_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trip_id INT NOT NULL,
  vehicle_id INT NOT NULL,
  driver_id INT NOT NULL,
  officer_id INT NOT NULL,
  requested_litres FLOAT NOT NULL,
  reason TEXT NOT NULL,
  current_lat FLOAT NULL,
  current_lng FLOAT NULL,
  current_location_name VARCHAR(255) NULL,
  status ENUM('PENDING','HPMU_REVIEW','HPMU_APPROVED','HPMU_REJECTED','HPMU_RELEASED','DRIVER_CONFIRMED','COMPLETED') NOT NULL DEFAULT 'PENDING',
  hpmu_reviewed_by INT NULL,
  hpmu_reviewed_at DATETIME NULL,
  hpmu_review_comment TEXT NULL,
  litres_released FLOAT NULL,
  release_comment TEXT NULL,
  released_by INT NULL,
  released_at DATETIME NULL,
  confirmed_by_driver BOOLEAN NOT NULL DEFAULT FALSE,
  confirmed_at DATETIME NULL,
  actual_litres_received FLOAT NULL,
  confirmation_notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_efr_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT fk_efr_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  CONSTRAINT fk_efr_driver FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  CONSTRAINT fk_efr_officer FOREIGN KEY (officer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_efr_hpmu_reviewer FOREIGN KEY (hpmu_reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_efr_released_by FOREIGN KEY (released_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_efr_status (status),
  INDEX idx_efr_trip (trip_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 9. Update AUDIT_LOGS: add metadata JSON column
-- ------------------------------------------------------------

ALTER TABLE audit_logs
  ADD COLUMN metadata JSON NULL AFTER description;

SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
-- VERIFICATION QUERIES
-- ------------------------------------------------------------
-- DESCRIBE users;
-- DESCRIBE vehicle_requests;
-- DESCRIBE fuel_requests;
-- DESCRIBE trips;
-- DESCRIBE drivers;
-- DESCRIBE hpmu_recommendations;
-- DESCRIBE extra_fuel_requests;
-- DESCRIBE audit_logs;