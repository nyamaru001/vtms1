@echo off
set NODE_ENV=development
set PORT=5000
set DB_HOST=localhost
set DB_PORT=3306
set DB_NAME=vehicle_transport_management
set DB_USER=root
set DB_PASSWORD=Nyamaru@1974
set JWT_SECRET=vtms_super_secret_key_change_this_2026
set CORS_ORIGIN=http://localhost:5173
set OSRM_BASE_URL=https://router.project-osrm.org

echo Starting VTMS Backend...
echo.
node server.js