-- =============================================================
-- FILE : sql/04_auth.sql
-- DESC : Add authentication columns and support
-- =============================================================

USE final;

-- 1. Add password_hash column to staff table
ALTER TABLE staff ADD COLUMN password_hash VARCHAR(255) NULL;

-- Note: Password hashes will be automatically generated and populated
-- by accessing/running the api/setup_db.php endpoint in the browser or command line.
-- Default passwords will be set as: [first_name_lowercase]123 (e.g. james123, kevin123).
