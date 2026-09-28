-- ============================================================
-- VTMS MIGRATION — Driver-owned Logbook + expanded Fuel workflow
--
-- Run this AFTER the original vtms_database.sql if you already have
-- a database running. It only ALTERs the two affected tables — no
-- data is dropped, and it's safe to re-run (checks are best-effort;
-- if a column/index already exists, drop that one line before running).
--
-- Usage:
--   mysql -u root -p vehicle_transport_management < vtms_migration_002.sql
-- ============================================================

USE vehicle_transport_management;

-- ------------------------------------------------------------
-- LOGBOOKS — now driver-owned, with a real review workflow
-- ------------------------------------------------------------

ALTER TABLE logbooks
  ADD COLUMN purpose TEXT NULL AFTER officer_id,
  ADD COLUMN route_distance_km FLOAT NULL AFTER destination,
  ADD COLUMN start_time DATETIME NULL AFTER route_distance_km,
  ADD COLUMN end_time DATETIME NULL AFTER start_time,
  ADD COLUMN fuel_issued_litres FLOAT NULL AFTER fuel_used_litres,
  ADD COLUMN submitted_at DATETIME NULL AFTER remarks,
  ADD COLUMN verified_by INT NULL AFTER submitted_at,
  ADD COLUMN verified_at DATETIME NULL AFTER verified_by,
  ADD COLUMN review_comment TEXT NULL AFTER verified_at;

-- Old `status` was a free-text VARCHAR('OPEN'/'CLOSED'); convert existing
-- rows to the new workflow before changing the column type.
UPDATE logbooks SET status = 'CLOSED' WHERE status = 'CLOSED';
UPDATE logbooks SET status = 'DRAFT' WHERE status NOT IN ('CLOSED');

ALTER TABLE logbooks
  MODIFY COLUMN status ENUM('DRAFT','SUBMITTED','VERIFIED','RETURNED','CLOSED') NOT NULL DEFAULT 'DRAFT';

ALTER TABLE logbooks
  ADD CONSTRAINT fk_logbooks_verifier FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- FUEL_REQUESTS — progress snapshot + expanded status workflow
-- ------------------------------------------------------------

ALTER TABLE fuel_requests
  ADD COLUMN route_distance_km FLOAT NULL AFTER litres_calculated,
  ADD COLUMN completed_km FLOAT NULL AFTER route_distance_km,
  ADD COLUMN remaining_km FLOAT NULL AFTER completed_km,
  ADD COLUMN previous_fuel_issued FLOAT NULL AFTER remaining_km,
  ADD COLUMN exceeds_estimate BOOLEAN NOT NULL DEFAULT FALSE AFTER previous_fuel_issued;

ALTER TABLE fuel_requests
  MODIFY COLUMN status ENUM('PENDING','UNDER_REVIEW','APPROVED','REJECTED','RETURNED','RELEASED','COMPLETED')
  NOT NULL DEFAULT 'PENDING';

-- ------------------------------------------------------------
-- Done. Verify with:
--   DESCRIBE logbooks;
--   DESCRIBE fuel_requests;
-- ------------------------------------------------------------
