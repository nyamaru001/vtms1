-- ============================================================
-- VEHICLE & TRANSPORT MANAGEMENT SYSTEM (VTMS)
-- Full MySQL schema
--
-- This matches the Sequelize models exactly (table/column names,
-- types, enums, foreign keys). You can run this directly in MySQL
-- instead of relying on sequelize.sync() to create the tables.
--
-- Usage:
--   mysql -u root -p < vtms_database.sql
-- or paste into MySQL Workbench / phpMyAdmin / your MySQL client.
-- ============================================================

CREATE DATABASE IF NOT EXISTS vehicle_transport_management
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE vehicle_transport_management;

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- 1. USERS
-- ------------------------------------------------------------
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  role ENUM('OFFICER','DRIVER','TRANSPORT_OFFICER','R3','NEST') NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  profile_photo VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role),
  INDEX idx_users_status (status)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 2. VEHICLES
-- ------------------------------------------------------------
DROP TABLE IF EXISTS vehicles;
CREATE TABLE vehicles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  registration_number VARCHAR(50) NOT NULL UNIQUE,
  model VARCHAR(150) NOT NULL,
  type VARCHAR(100) NULL,
  fuel_type VARCHAR(50) NULL,
  fuel_consumption_km_per_litre FLOAT NOT NULL DEFAULT 10,
  current_odometer FLOAT NOT NULL DEFAULT 0,
  status ENUM('AVAILABLE','ASSIGNED','IN_TRIP','MAINTENANCE','INACTIVE') NOT NULL DEFAULT 'AVAILABLE',
  service_date DATE NULL,
  insurance_expiry DATE NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_vehicles_status (status)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 3. DRIVERS
-- ------------------------------------------------------------
DROP TABLE IF EXISTS drivers;
CREATE TABLE drivers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  license_number VARCHAR(100) NOT NULL,
  license_expiry DATE NULL,
  status ENUM('AVAILABLE','ASSIGNED','ON_TRIP','INACTIVE') NOT NULL DEFAULT 'AVAILABLE',
  assigned_vehicle_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_drivers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_drivers_vehicle FOREIGN KEY (assigned_vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
  INDEX idx_drivers_status (status)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 4. VEHICLE REQUESTS
-- ------------------------------------------------------------
DROP TABLE IF EXISTS vehicle_requests;
CREATE TABLE vehicle_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_number VARCHAR(50) NOT NULL UNIQUE,
  officer_id INT NOT NULL,

  purpose TEXT NOT NULL,
  origin_name VARCHAR(255) NOT NULL,
  origin_lat FLOAT NOT NULL,
  origin_lng FLOAT NOT NULL,
  destination_name VARCHAR(255) NOT NULL,
  destination_lat FLOAT NOT NULL,
  destination_lng FLOAT NOT NULL,

  departure_date DATE NOT NULL,
  departure_time VARCHAR(20) NOT NULL,
  return_date DATE NULL,
  return_time VARCHAR(20) NULL,
  passengers INT NOT NULL DEFAULT 1,
  additional_notes TEXT NULL,

  one_way_km FLOAT NULL,
  round_trip_km FLOAT NULL,
  duration_minutes FLOAT NULL,
  route_geometry JSON NULL,

  base_fuel_litres FLOAT NULL,
  fuel_buffer_percent FLOAT NULL,
  total_fuel_litres FLOAT NULL,

  vehicle_id INT NULL,
  driver_id INT NULL,

  status ENUM(
    'PENDING','TRANSPORT_REVIEW','NEST_REVIEW','R3_REVIEW',
    'APPROVED','REJECTED','RETURNED','CANCELLED',
    'DRIVER_ASSIGNED','TRIP_STARTED','TRIP_COMPLETED','CLOSED'
  ) NOT NULL DEFAULT 'PENDING',

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_requests_officer FOREIGN KEY (officer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_requests_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
  CONSTRAINT fk_requests_driver FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
  INDEX idx_requests_status (status),
  INDEX idx_requests_officer (officer_id),
  INDEX idx_requests_departure_date (departure_date)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 5. TRIPS
-- ------------------------------------------------------------
DROP TABLE IF EXISTS trips;
CREATE TABLE trips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trip_number VARCHAR(50) NOT NULL UNIQUE,
  request_id INT NOT NULL UNIQUE,
  vehicle_id INT NOT NULL,
  driver_id INT NOT NULL,
  officer_id INT NOT NULL,

  start_km FLOAT NULL,
  end_km FLOAT NULL,
  total_odometer_km FLOAT NULL,

  start_time DATETIME NULL,
  end_time DATETIME NULL,
  start_lat FLOAT NULL,
  start_lng FLOAT NULL,

  status ENUM('NOT_STARTED','IN_PROGRESS','COMPLETED','CLOSED') NOT NULL DEFAULT 'NOT_STARTED',

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_trips_request FOREIGN KEY (request_id) REFERENCES vehicle_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_trips_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  CONSTRAINT fk_trips_driver FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  CONSTRAINT fk_trips_officer FOREIGN KEY (officer_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_trips_status (status)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 6. TRIP LOCATIONS (GPS history)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS trip_locations;
CREATE TABLE trip_locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trip_id INT NOT NULL,
  driver_id INT NOT NULL,
  vehicle_id INT NOT NULL,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_triplocations_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT fk_triplocations_driver FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  CONSTRAINT fk_triplocations_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  INDEX idx_triplocations_trip (trip_id),
  INDEX idx_triplocations_recorded (recorded_at)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 7. FUEL REQUESTS
-- ------------------------------------------------------------
DROP TABLE IF EXISTS fuel_requests;
CREATE TABLE fuel_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trip_id INT NOT NULL,
  vehicle_id INT NOT NULL,
  driver_id INT NOT NULL,

  current_km FLOAT NOT NULL,
  litres_requested FLOAT NOT NULL,
  litres_calculated FLOAT NULL,

  -- Snapshot of the trip-progress math at request time (from real GPS +
  -- route data), so review screens and history always match what the
  -- driver saw when they submitted.
  route_distance_km FLOAT NULL,
  completed_km FLOAT NULL,
  remaining_km FLOAT NULL,
  previous_fuel_issued FLOAT NULL,
  exceeds_estimate BOOLEAN NOT NULL DEFAULT FALSE,

  reason TEXT NULL,
  notes TEXT NULL,

  status ENUM('PENDING','R3_REVIEW','NEST_REVIEW','R3_FINAL_REVIEW','APPROVED','REJECTED','RETURNED','RELEASED','COMPLETED') NOT NULL DEFAULT 'PENDING',
  reviewed_by INT NULL,
  review_comment TEXT NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_fuel_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT fk_fuel_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  CONSTRAINT fk_fuel_driver FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  CONSTRAINT fk_fuel_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_fuel_status (status)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 8. LOGBOOKS  (DRIVER-owned — Transport Officer only verifies/returns,
--    never creates or edits entries directly)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS logbooks;
CREATE TABLE logbooks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trip_id INT NOT NULL UNIQUE,
  entry_date DATE NOT NULL,
  vehicle_id INT NOT NULL,
  driver_id INT NOT NULL,
  officer_id INT NOT NULL,
  purpose TEXT NULL,
  origin VARCHAR(255) NOT NULL,
  destination VARCHAR(255) NOT NULL,
  route_distance_km FLOAT NULL,
  start_time DATETIME NULL,
  end_time DATETIME NULL,

  -- Auto-filled from the trip — never hand-typed by the driver.
  start_km FLOAT NOT NULL,
  end_km FLOAT NOT NULL,
  total_km FLOAT NOT NULL,

  fuel_used_litres FLOAT NULL,
  fuel_issued_litres FLOAT NULL,
  remarks TEXT NULL,

  status ENUM('DRAFT','SUBMITTED','VERIFIED','RETURNED','CLOSED') NOT NULL DEFAULT 'DRAFT',
  submitted_at DATETIME NULL,
  verified_by INT NULL,
  verified_at DATETIME NULL,
  review_comment TEXT NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_logbooks_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT fk_logbooks_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  CONSTRAINT fk_logbooks_driver FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  CONSTRAINT fk_logbooks_officer FOREIGN KEY (officer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_logbooks_verifier FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 9. NOTIFICATIONS
-- ------------------------------------------------------------
DROP TABLE IF EXISTS notifications;
CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(500) NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notifications_user_read (user_id, is_read)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 10. AUDIT LOGS
-- ------------------------------------------------------------
DROP TABLE IF EXISTS audit_logs;
CREATE TABLE audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(100) NULL,
  entity_id INT NULL,
  description TEXT NULL,
  ip_address VARCHAR(50) NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_action (action),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 11. NEST RECOMMENDATIONS
-- ------------------------------------------------------------
DROP TABLE IF EXISTS nest_recommendations;
CREATE TABLE nest_recommendations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  reviewed_by INT NOT NULL,
  decision ENUM('RECOMMEND','NOT_RECOMMEND','RETURN') NOT NULL,
  comment TEXT NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_nest_request FOREIGN KEY (request_id) REFERENCES vehicle_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_nest_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 12. R3 APPROVALS
-- ------------------------------------------------------------
DROP TABLE IF EXISTS r3_approvals;
CREATE TABLE r3_approvals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  reviewed_by INT NOT NULL,
  decision ENUM('APPROVE','REJECT','RETURN') NOT NULL,
  comment TEXT NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_r3_request FOREIGN KEY (request_id) REFERENCES vehicle_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_r3_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- OPTIONAL SAMPLE DATA — vehicles only.
--
-- Users are intentionally NOT seeded here because passwords must be
-- bcrypt-hashed (not plain SQL-safe). Use the backend's seed script
-- instead, which hashes them correctly:
--
--   cd backend && npm run seed
--
-- That creates: officer1, driver1, driver2, transport1, nest1,
-- r3approver1 — all with password "Password123!".
-- ============================================================

INSERT INTO vehicles (registration_number, model, type, fuel_type, fuel_consumption_km_per_litre, current_odometer, status)
VALUES
  ('T 123 ABC', 'Toyota Land Cruiser', 'SUV', 'Diesel', 10, 45000, 'AVAILABLE'),
  ('T 456 DEF', 'Toyota Hiace', 'Van', 'Diesel', 8, 62000, 'AVAILABLE'),
  ('T 789 GHI', 'Toyota Corolla', 'Sedan', 'Petrol', 14, 30000, 'AVAILABLE');
