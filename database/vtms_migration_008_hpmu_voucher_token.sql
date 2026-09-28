-- Migration 008: HPMU manual fuel voucher tokens
-- Voucher tokens are now entered manually by HPMU and must contain at least
-- 20 characters, so the column is widened beyond the original 32 characters.
USE vehicle_transport_management;

ALTER TABLE fuel_requests MODIFY COLUMN voucher_number VARCHAR(64) NULL;
