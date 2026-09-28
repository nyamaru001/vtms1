# VTMS — Vehicle & Transport Management System

A role-based React + Node/Express + MySQL system for vehicle requests, route planning, fleet assignment, fuel control, live trip tracking and digital logbooks.

## Portals

- **Admin:** System administration — manage users, roles, drivers, vehicles, view system-wide statistics, audit logs, monitor all requests/trips/fuel workflows
- **Officer:** Request vehicle, select origin/destination on map, see automatic route distance, approval status, assigned vehicle/driver and live trip
- **Driver:** See assigned vehicle requests/trips, start/track trip, request fuel using calculated remaining distance, complete digital logbook
- **Transport Officer:** Review/assign vehicle and driver, calculate route/fuel from vehicle consumption, review driver fuel requests, verify logbooks, release approved fuel, monitor fleet
- **NEST:** Review vehicle requests and fuel requests, provide RECOMMEND / NOT_RECOMMEND / RETURN recommendations
- **R3:** Verify vehicle/fuel workflow, request NEST recommendations, make final fuel approval decisions

## Main Workflows

### Vehicle Request
**Officer → Transport Officer (route + vehicle/driver assignment) → NEST recommendation → R3 approval → Driver Assigned → Trip → Logbook → Close**

The route is calculated from map coordinates using OSRM when `OSRM_BASE_URL` is configured. If OSRM is unavailable, the API returns a clearly marked estimated route using haversine distance + a road correction factor.

### Fuel Request
**Driver → Transport Officer review → R3 verification → NEST recommendation → R3 final approval → Transport Officer release → Completed**

Fuel is calculated from:
`round-trip route KM ÷ vehicle KM/L`, with the configured buffer for the planned trip. Mid-trip fuel requests use the remaining route distance and the vehicle's real consumption value.

## Installation

### Prerequisites
- Node.js 18+
- MySQL 8.0+
- npm or yarn

### Database Setup
1. Create the MySQL database:
   ```sql
   CREATE DATABASE vehicle_transport_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
2. The backend will auto-create tables on first run via `sequelize.sync()`. For production, use the SQL migration files in `database/` directory.

### Backend Configuration
1. Copy `backend/.env.example` to `backend/.env` (or use the root `.env`):
   ```env
   PORT=5000
   NODE_ENV=development
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=vehicle_transport_management
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   JWT_SECRET=your_super_secret_jwt_key_change_in_production
   CORS_ORIGIN=http://localhost:5173
   OSRM_BASE_URL=https://router.project-osrm.org
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your_secure_admin_password
   ADMIN_EMAIL=admin@yourdomain.com
   ```

### Admin User Creation
The admin user is created via a secure seed script that requires `ADMIN_PASSWORD` from environment variables:
```bash
cd backend
node seed/seedAdmin.js
```
This creates/updates the admin user with the configured password (bcrypt hashed).

### Demo Users Seed (Optional)
To create test users for all roles (password: `Password123!`):
```bash
cd backend
node seed/seed.js
```
Test accounts created:
- `officer1` (OFFICER)
- `driver1`, `driver2` (DRIVER)
- `transport1` (TRANSPORT_OFFICER)
- `nest1` (NEST)
- `r3approver1` (R3)

### Running Locally

#### Development
```bash
# Terminal 1 - Backend
cd backend
npm install
npm run dev

# Terminal 2 - Frontend
cd frontend
npm install
npm run dev
```
- Backend API: http://localhost:5000/api
- Frontend: http://localhost:5173

#### Production Build
```bash
# Build frontend
cd frontend
npm run build

# Start backend (production mode)
cd backend
NODE_ENV=production node server.js
```
Serve the `frontend/dist` folder with a static file server (nginx, Apache, or Node `serve`).

## Deployment Checklist

### Environment Variables (Production)
- `NODE_ENV=production`
- `JWT_SECRET` — strong random string (min 32 chars)
- `DB_PASSWORD` — secure database password
- `ADMIN_PASSWORD` — strong admin password (min 12 chars)
- `CORS_ORIGIN` — your frontend domain (e.g., `https://vtms.yourdomain.com`)
- `OSRM_BASE_URL` — keep default or use self-hosted OSRM instance

### Database
- Run migrations from `database/` in order for production deployments
- Ensure MySQL user has appropriate permissions
- Configure connection pooling for production loads

### Reverse Proxy (nginx example)
```nginx
server {
    listen 80;
    server_name vtms.yourdomain.com;

    # Frontend
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### PM2 Process Manager (Recommended)
```bash
cd backend
npm install -g pm2
pm2 start server.js --name vtms-backend
pm2 startup
pm2 save
```

## API Endpoints Summary

### Authentication
- `POST /api/auth/login` — username + password
- `POST /api/auth/logout`
- `GET /api/auth/me` — current user

### Admin (ADMIN only)
- `GET /api/admin/stats` — system statistics
- `GET /api/users` — list users with pagination/filter
- `POST /api/users` — create user
- `PUT /api/users/:id` — update user
- `PATCH /api/users/:id/status` — activate/deactivate
- `POST /api/users/:id/reset-password` — reset password
- `DELETE /api/users/:id` — delete user
- `GET /api/drivers` — list drivers
- `PUT /api/drivers/:id` — update driver
- `GET /api/vehicles` — list vehicles
- `POST /api/vehicles` — create vehicle
- `PUT /api/vehicles/:id` — update vehicle
- `GET /api/audit` — audit logs

### Officer (OFFICER)
- `GET /api/requests` — my requests
- `POST /api/requests` — create vehicle request
- `GET /api/trips` — my trips
- `GET /api/fuel` — my fuel requests

### Driver (DRIVER)
- `GET /api/trips` — assigned trips
- `POST /api/trips/:id/start` — start trip (with startKm)
- `POST /api/trips/:id/location` — GPS location update
- `POST /api/trips/:id/complete` — complete trip (with endKm)
- `GET /api/fuel/calc/:tripId` — fuel calculation
- `POST /api/fuel` — create fuel request

### Transport Officer (TRANSPORT_OFFICER)
- `GET /api/requests` — all requests (filterable)
- `POST /api/requests/:id/assign` — assign vehicle + driver (creates Trip)
- `GET /api/vehicles` — manage fleet
- `GET /api/drivers` — manage drivers
- `GET /api/fuel` — all fuel requests
- `POST /api/fuel/:id/forward` — review/forward fuel to R3
- `PATCH /api/fuel/:id/release` — release approved fuel
- `PATCH /api/fuel/:id/complete` — mark fuel completed

### NEST (NEST)
- `GET /api/requests` — vehicle requests needing recommendation
- `POST /api/nest/:id/recommend` — RECOMMEND/NOT_RECOMMEND/RETURN
- `GET /api/fuel` — fuel requests needing recommendation
- `POST /api/fuel/:id/nest-decide` — RECOMMEND/NOT_RECOMMEND/RETURN

### R3 (R3)
- `GET /api/requests` — vehicle requests for final approval
- `POST /api/r3/:id/decide` — APPROVE/REJECT/RETURN
- `GET /api/fuel` — fuel requests for verification/final approval
- `POST /api/fuel/:id/r3-decide` — APPROVE/REJECT/RETURN
- `POST /api/fuel/:id/request-nest` — send to NEST for recommendation

## Demo Credentials (After Running Seeds)

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | Password123! |
| Officer | officer1 | Password123! |
| Driver | driver1 | Password123! |
| Driver | driver2 | Password123! |
| Transport Officer | transport1 | Password123! |
| HPMU | hpmu1 | Password123! |
| R3 | r3approver1 | Password123! |
| Officer | fideli | Password123! |
| R3 | r3user | Password123! |

Notes:
- `nest1` was removed by the NEST → HPMU migration; use `hpmu1`.
- All demo passwords above were verified with a successful login against `POST /api/auth/login`.

**⚠️ Change all default passwords in production!**

## Project Structure

```
vtms/
├── backend/
│   ├── config/database.js       # Sequelize MySQL connection
│   ├── middleware/auth.js       # JWT auth + role authorization
│   ├── models/                  # Sequelize models
│   ├── routes/                  # Express routes per feature
│   ├── services/                # Business logic (routing, fuel, numbers)
│   ├── sockets/                 # Socket.IO real-time events
│   ├── seed/                    # Database seeding scripts
│   └── server.js                # Entry point
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   ├── context/AuthContext.jsx  # Auth state management
│   │   ├── layouts/PortalLayout.jsx # Sidebar + header per portal
│   │   ├── pages/               # Pages per portal/role
│   │   ├── routes/ProtectedRoute.jsx # Role-based route guard
│   │   ├── services/api.js      # Axios instance + interceptors
│   │   ├── services/resources.js # API endpoint wrappers
│   │   ├── styles/index.css     # Global styles
│   │   ├── App.jsx              # Router + portal definitions
│   │   └── main.jsx             # Entry point
│   └── vite.config.js
├── database/                    # SQL migration files
└── .env                         # Environment variables (root)
```

## Important Notes

- **Do not** run multiple backend instances on the same port (5000 default)
- **Do not** commit `.env` with real secrets to version control
- The frontend uses `VITE_API_URL` or defaults to `http://localhost:5000/api`
- Socket.IO runs on the same port as HTTP for real-time updates
- All sensitive API endpoints require both authentication and role authorization
- Driver trips are filtered by `drivers.user_id = users.id` → `trips.driver_id = drivers.id`
- Fuel workflow statuses must progress in order — skipping steps is blocked by backend validation

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `EADDRINUSE` on port 5000 | Kill existing Node process or change PORT in .env |
| Database connection failed | Verify MySQL is running, credentials in .env are correct |
| Admin seed fails | Ensure ADMIN_PASSWORD is set in .env, run enum update script |
| Frontend build fails | Check for missing imports, run `npm install` in frontend |
| Role authorization errors | Verify user role in database matches expected portal |

## License

Internal use — Vehicle & Transport Management System