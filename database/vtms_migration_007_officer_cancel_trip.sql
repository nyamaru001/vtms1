-- ============================================================
-- VTMS MIGRATION 007 — Officer cancel trip status
-- Adds CANCELLED to trips.status so officer cancellation of
-- not-yet-complete trips can be recorded without deleting rows.
-- vehicle_requests already has CANCELLED + cancellation_reason,
-- cancelled_at, cancelled_by (migration 005).
-- ============================================================

USE vehicle_transport_management;

ALTER TABLE trips
  MODIFY COLUMN status ENUM(
    'NOT_STARTED',
    'DRIVER_ASSIGNED',
    'DRIVER_ACCEPTED',
    'DRIVER_CANCELLED',
    'TRIP_STARTED',
    'IN_PROGRESS',
    'TRIP_COMPLETED',
    'CLOSED',
    'CANCELLED'
  ) NOT NULL DEFAULT 'NOT_STARTED';
