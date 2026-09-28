-- ============================================================
-- VTMS MIGRATION 006 — Final NEST to HPMU cleanup
-- ============================================================
-- Fixes remaining NEST artifacts after migration 005.
-- Run against vehicle_transport_management database.
-- ============================================================

USE vehicle_transport_management;

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 1. Update USERS: change any remaining NEST role to HPMU
-- ============================================================
UPDATE users SET role = 'HPMU' WHERE role = 'NEST';

-- ============================================================
-- 2. Rename username: nest1 -> HPMU1
-- ============================================================
UPDATE users SET username = 'HPMU1', full_name = 'HPMU Officer' WHERE username = 'nest1';

-- ============================================================
-- 3. Update USERS table ENUM to include HPMU and remove NEST
-- ============================================================
ALTER TABLE users
  MODIFY COLUMN role ENUM('ADMIN','OFFICER','DRIVER','TRANSPORT_OFFICER','R3','HPMU') NOT NULL;

-- ============================================================
-- 4. Update FUEL_REQUESTS status ENUM — match Sequelize model
-- ============================================================
-- Model: PENDING, HPMU_REVIEW, HPMU_APPROVED, HPMU_REJECTED,
--        HPMU_RETURNED, HPMU_RELEASED, DRIVER_CONFIRMED, COMPLETED
ALTER TABLE fuel_requests
  MODIFY COLUMN status ENUM(
    'PENDING',
    'HPMU_REVIEW','HPMU_APPROVED','HPMU_REJECTED',
    'HPMU_RETURNED','HPMU_RELEASED',
    'DRIVER_CONFIRMED','COMPLETED'
  ) DEFAULT 'PENDING';

-- ============================================================
-- 5. Update EXTRA_FUEL_REQUESTS status ENUM — match model
-- ============================================================
ALTER TABLE extra_fuel_requests
  MODIFY COLUMN status ENUM(
    'PENDING',
    'HPMU_REVIEW','HPMU_APPROVED','HPMU_REJECTED',
    'HPMU_RETURNED','HPMU_RELEASED',
    'DRIVER_CONFIRMED','COMPLETED'
  ) DEFAULT 'PENDING';

-- ============================================================
-- 6. Update VEHICLE_REQUESTS status ENUM — match model
-- ============================================================
-- Must include PENDING (new requests) and all workflow statuses.
ALTER TABLE vehicle_requests
  MODIFY COLUMN status ENUM(
    'PENDING',
    'R3_REVIEW','R3_APPROVED','R3_REJECTED','R3_RETURNED',
    'TRANSPORT_REVIEW',
    'DRIVER_ASSIGNED','DRIVER_ACCEPTED','DRIVER_CANCELLED',
    'FUEL_REQUESTED',
    'HPMU_REVIEW','HPMU_APPROVED','HPMU_REJECTED',
    'HPMU_RETURNED','HPMU_RELEASED',
    'DRIVER_CONFIRMED',
    'TRIP_STARTED','TRIP_COMPLETED',
    'CLOSED','CANCELLED'
  ) DEFAULT 'PENDING';

-- ============================================================
-- 7. Drop old NEST_RECOMMENDATIONS if both tables exist
-- ============================================================
-- hpmu_recommendations should already have the data from migration 005.
-- Drop the old table if it still exists.
DROP TABLE IF EXISTS nest_recommendations;

-- ============================================================
-- 8. Verify
-- ============================================================
-- SELECT role, COUNT(*) FROM users GROUP BY role;
-- SELECT username, role FROM users WHERE role = 'HPMU';
-- SELECT status, COUNT(*) FROM fuel_requests GROUP BY status;
-- SELECT status, COUNT(*) FROM vehicle_requests GROUP BY status;
-- SHOW TABLES LIKE '%recommendation%';

SET FOREIGN_KEY_CHECKS = 1;
