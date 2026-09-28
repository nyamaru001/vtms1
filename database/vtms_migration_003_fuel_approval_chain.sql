-- ============================================================
-- VTMS MIGRATION 003 — Fuel approval chain: Driver -> Officer -> R3 -> NEST
--
-- Run this AFTER vtms_database.sql / migration 002 if you already have
-- data. It only changes the fuel_requests.status enum — no data dropped,
-- but any existing rows with status 'UNDER_REVIEW' are converted to
-- 'PENDING' first (since that status no longer exists in the new chain).
--
-- Usage:
--   mysql -u root -p vehicle_transport_management < vtms_migration_003_fuel_approval_chain.sql
-- ============================================================

USE vehicle_transport_management;

UPDATE fuel_requests SET status = 'PENDING' WHERE status = 'UNDER_REVIEW';

ALTER TABLE fuel_requests
  MODIFY COLUMN status ENUM('PENDING','R3_REVIEW','NEST_REVIEW','APPROVED','REJECTED','RETURNED','RELEASED','COMPLETED')
  NOT NULL DEFAULT 'PENDING';

-- Verify with:
--   DESCRIBE fuel_requests;
