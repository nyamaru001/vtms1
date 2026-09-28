-- VTMS workflow upgrade: driver trip events + HPMU fuel issue logbook
-- Safe to run on an existing MySQL database. The application also creates
-- these tables automatically through Sequelize sync when enabled.

CREATE TABLE IF NOT EXISTS trip_events (
  id INT NOT NULL AUTO_INCREMENT,
  trip_id INT NOT NULL,
  driver_id INT NOT NULL,
  type ENUM('ROUTE_CHANGE','UNPLANNED_STOP','BREAKDOWN','INCIDENT','OTHER') NOT NULL DEFAULT 'ROUTE_CHANGE',
  location_name VARCHAR(255) NULL,
  latitude DOUBLE NULL,
  longitude DOUBLE NULL,
  reason TEXT NOT NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_trip_events_trip (trip_id),
  KEY idx_trip_events_driver (driver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fuel_issue_logs (
  id INT NOT NULL AUTO_INCREMENT,
  fuel_request_id INT NOT NULL,
  trip_id INT NOT NULL,
  vehicle_id INT NOT NULL,
  driver_id INT NOT NULL,
  hpmu_user_id INT NOT NULL,
  litres_issued DOUBLE NOT NULL,
  issue_odometer_km DOUBLE NULL,
  station_reference VARCHAR(255) NULL,
  notes TEXT NULL,
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_fuel_issue_logs_request (fuel_request_id),
  KEY idx_fuel_issue_logs_trip (trip_id),
  KEY idx_fuel_issue_logs_driver (driver_id),
  KEY idx_fuel_issue_logs_hpmu (hpmu_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
