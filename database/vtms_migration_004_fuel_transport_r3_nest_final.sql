-- VTMS MIGRATION 004
-- Fuel approval chain:
-- DRIVER -> TRANSPORT OFFICER -> R3 -> NEST recommendation -> R3 FINAL -> TRANSPORT release
USE vehicle_transport_management;

ALTER TABLE fuel_requests
  MODIFY COLUMN status ENUM(
    'PENDING','R3_REVIEW','NEST_REVIEW','R3_FINAL_REVIEW',
    'APPROVED','REJECTED','RETURNED','RELEASED','COMPLETED'
  ) NOT NULL DEFAULT 'PENDING';
