# VTMS System Update Summary

## Overview
Complete update of the Vehicle & Transport Management System (VTMS) to implement the final workflow as specified. All changes have been made to the database, backend API, and frontend React application.

---

## 1. Database Changes

### Migration File: `vtms_migration_005_nest_to_hpmu_workflow.sql`
- **User Role**: Changed `NEST` to `HPMU` in users table
- **VehicleRequest Status Enum**: Updated to new workflow:
  - `PENDING` → `R3_REVIEW` → `R3_APPROVED`/`R3_REJECTED`/`R3_RETURNED` → `TRANSPORT_REVIEW` → `DRIVER_ASSIGNED` → `DRIVER_ACCEPTED`/`DRIVER_CANCELLED` → `FUEL_REQUESTED` → `HPMU_REVIEW` → `HPMU_APPROVED`/`HPMU_REJECTED`/`HPMU_RETURNED` → `HPMU_RELEASED` → `DRIVER_CONFIRMED` → `TRIP_STARTED` → `TRIP_COMPLETED` → `CLOSED`/`CANCELLED`
- **FuelRequest Status Enum**: Updated to HPMU workflow:
  - `PENDING` → `HPMU_REVIEW` → `HPMU_APPROVED`/`HPMU_REJECTED`/`HPMU_RETURNED` → `HPMU_RELEASED` → `DRIVER_CONFIRMED` → `COMPLETED`
- **Trip Status Enum**: Added `DRIVER_ASSIGNED`, `DRIVER_ACCEPTED`, `DRIVER_CANCELLED`, `endLat`, `endLng`
- **Driver Status Enum**: Added `BUSY`, `UNAVAILABLE`, `CANCELLED_ASSIGNMENT`
- **New Tables**: `hpmu_recommendations` (renamed from `nest_recommendations`), `extra_fuel_requests`
- **New Columns**: Cancellation fields, HPMU review/release fields, driver confirmation fields, extra fuel request fields

---

## 2. Backend Model Updates

### Updated Models:
- **User.js**: Role enum includes `HPMU`
- **VehicleRequest.js**: New statuses, cancellation fields (`cancellationReason`, `cancelledAt`, `cancelledBy`)
- **Driver.js**: New availability statuses
- **Trip.js**: New statuses, `endLat`, `endLng`
- **FuelRequest.js**: HPMU workflow statuses, review/release/confirmation fields
- **HPMURecommendation.js**: Renamed table to `hpmu_recommendations`
- **Notification.js**: Added `type`, `referenceId`, `referenceType`
- **AuditLog.js**: Added `metadata` JSON column
- **ExtraFuelRequest.js**: New model for officer emergency fuel requests

### Associations (models/index.js):
- Updated all associations to use new models and fields
- Added associations for `ExtraFuelRequest` and `HPMURecommendation`

---

## 3. Backend API Routes

### requests.js (Vehicle Requests)
- **Create Request**: Now accessible by `OFFICER`, `R3`, `HPMU` (initial status: `R3_REVIEW`)
- **R3 Review First**: R3 reviews before Transport Officer assignment
- **Assign Vehicle+Driver**: Only from `R3_APPROVED` or `TRANSPORT_REVIEW` → sets `DRIVER_ASSIGNED`
- **Notifications**: R3 notified on create, HPMU notified on assignment (for fuel review)
- **Cancel Request**: With reason, notifies all relevant parties
- **Return Request**: Different return statuses based on role (`R3_RETURNED`, `HPMU_RETURNED`)

### hpmu.js (HPMU Portal)
- **Vehicle Request Fuel Review**: Reviews fuel for `DRIVER_ASSIGNED`/`FUEL_REQUESTED` requests
- **Fuel Request Decision**: `HPMU_APPROVED`/`HPMU_REJECTED`/`HPMU_RETURNED`
- **Extra Fuel Request Decision**: Same workflow
- **Release Fuel**: For both regular and extra fuel requests
- **Notifications**: Driver, Officer, Transport Officer notified appropriately

### fuel.js (Fuel Requests)
- **Removed**: Transport Officer release/complete endpoints
- **Added**: Driver confirm receipt endpoint (`/fuel/:id/confirm-receipt`)
- **Added**: Driver confirm extra fuel receipt endpoint
- **Added**: Officer create extra fuel request endpoint (`/fuel/extra`)
- **Driver fuel creation**: Only after trip is in progress

### trips.js (Trips)
- **Driver Accept Assignment**: `/trips/:id/accept` (DRIVER_ASSIGNED → DRIVER_ACCEPTED)
- **Driver Cancel Assignment**: `/trips/:id/cancel-assignment` with reason
- **Officer End Trip**: `/trips/:id/end-trip` (can end trip with end KM, location, reason)
- **Notifications**: All role-appropriate notifications sent

---

## 4. Frontend Updates

### Routes (App.jsx)
- **Renamed**: `/nest` → `/hpmu`
- **Updated**: Role guard from `NEST` to `HPMU`
- **Added**: Reports routes for all roles

### Officer Portal
- **RequestVehicle**: Clean form with GPS/route calculation
- **MyRequests**: Status filter with new statuses
- **RequestDetail**: Cancel with reason, shows review history
- **TripTracking**: Extra fuel request button during active trip
- **Reports**: New page with print functionality (requests, trips, fuel)

### Driver Portal
- **Dashboard**: Shows assignments, active trip with map
- **TripDetail**: Accept/Cancel assignment buttons, end trip
- **FuelStatus**: Confirm receipt button for HPMU_RELEASED fuel
- **FuelRequestForm**: Only allows fuel request after trip started
- **Logbook**: Complete logbook with print
- **Reports**: New page with print functionality

### Transport Officer Portal
- **Requests**: Assign vehicle+driver only for R3_APPROVED requests
- **Drivers**: Shows real availability (AVAILABLE, ASSIGNED, ON_TRIP, etc.)
- **Reports**: Comprehensive reports with print

### R3 Portal
- **Requests**: Reviews vehicle requests in R3_REVIEW status
- **Reports**: Review history with print

### HPMU Portal (formerly NEST)
- **Dashboard**: Fuel review workspace
- **Requests**: Fuel review decisions (APPROVE/REJECT/RETURN)
- **FuelRequests**: Review and release fuel
- **Reports**: Fuel review reports with print

### Admin Portal
- **Reports**: System-wide reports with print
- **Users/Drivers/Vehicles**: Full management

---

## 5. New Components

### PrintReport.jsx
- Reusable print component for all reports
- Professional print layout with header, filters, table, totals, signature
- CSS print media queries hide navigation/sidebar/buttons

### ConfirmDialog.jsx
- Used for cancel/confirm actions with custom content

---

## 5. Key Workflow Changes

### OLD Workflow:
```
OFFICER → TRANSPORT_REVIEW → NEST_REVIEW → R3_REVIEW → APPROVED → (Transport releases fuel)
```

### NEW Workflow:
```
OFFICER/R3/HPMU creates request
    ↓
R3_REVIEW (R3: APPROVE/REJECT/RETURN)
    ↓
R3_APPROVED → TRANSPORT_REVIEW (Transport assigns vehicle+driver)
    ↓
DRIVER_ASSIGNED → Driver ACCEPTS/CANCELS
    ↓
DRIVER_ACCEPTED → Driver requests fuel
    ↓
HPMU_REVIEW (HPMU: APPROVE/REJECT/RETURN)
    ↓
HPMU_APPROVED → HPMU_RELEASED (HPMU releases actual litres)
    ↓
Driver CONFIRMS RECEIPT (records actual litres)
    ↓
TRIP_STARTED → TRIP_COMPLETED → CLOSED
```

---

## 6. Files Changed

### Backend
- `backend/models/User.js`
- `backend/models/VehicleRequest.js`
- `backend/models/Driver.js`
- `backend/models/Trip.js`
- `backend/models/FuelRequest.js`
- `backend/models/HPMURecommendation.js` (renamed from NestRecommendation)
- `backend/models/Notification.js`
- `backend/models/AuditLog.js`
- `backend/models/ExtraFuelRequest.js` (new)
- `backend/models/index.js`
- `backend/routes/requests.js`
- `backend/routes/hpmu.js` (renamed from nest.js)
- `backend/routes/fuel.js`
- `backend/routes/trips.js`
- `backend/services/notificationService.js`
- `database/vtms_migration_005_nest_to_hpmu_workflow.sql` (new)

### Frontend
- `frontend/src/App.jsx` (routes, menus, imports)
- `frontend/src/pages/hpmu/*` (renamed from nest/*)
- `frontend/src/pages/officer/Reports.jsx` (new)
- `frontend/src/pages/officer/TripTracking.jsx` (extra fuel request)
- `frontend/src/pages/officer/RequestDetail.jsx` (cancel with reason)
- `frontend/src/pages/officer/MyRequests.jsx` (new statuses)
- `frontend/src/pages/driver/TripDetail.jsx` (accept/cancel assignment)
- `frontend/src/pages/driver/FuelStatus.jsx` (confirm receipt)
- `frontend/src/pages/driver/Reports.jsx` (new)
- `frontend/src/pages/driver/FuelRequestForm.jsx` (validation)
- `frontend/src/pages/transport/Reports.jsx` (new)
- `frontend/src/pages/transport/Requests.jsx` (R3_APPROVED check)
- `frontend/src/pages/transport/RequestDetail.jsx`
- `frontend/src/pages/r3/Reports.jsx` (new)
- `frontend/src/pages/r3/Requests.jsx` (new workflow)
- `frontend/src/pages/hpmu/Dashboard.jsx` (updated)
- `frontend/src/pages/hpmu/Requests.jsx` (new)
- `frontend/src/pages/hpmu/RequestDetail.jsx` (updated)
- `frontend/src/pages/hpmu/FuelRequests.jsx` (updated)
- `frontend/src/pages/admin/Reports.jsx` (new)
- `frontend/src/services/resources.js` (new API methods)
- `frontend/src/components/PrintReport.jsx` (new)
- `frontend/src/styles/index.css` (print styles)

---

## 7. Testing Checklist

### Database
- [ ] Run migration `vtms_migration_005_nest_to_hpmu_workflow.sql`
- [ ] Verify all enum values updated
- [ ] Check foreign key constraints

### Backend API
- [ ] Start backend server
- [ ] Test login for all roles
- [ ] Test vehicle request creation (OFFICER, R3, HPMU)
- [ ] Test R3 review workflow
- [ ] Test Transport Officer assignment
- [ ] Test Driver accept/cancel
- [ ] Test Fuel request workflow (HPMU review/release)
- [ ] Test Driver confirm receipt
- [ ] Test Officer extra fuel request
- [ ] Test Officer end trip
- [ ] Test all notifications

### Frontend
- [ ] Build frontend (`npm run build`)
- [ ] Test all portals load correctly
- [ ] Test navigation and menus
- [ ] Test report printing
- [ ] Test responsive layout

---

## 8. Remaining Items
1. **Seed Data**: Update seed script to create users with HPMU role
2. **Environment**: Ensure `OSRM_BASE_URL` is set for route calculation
3. **Socket.IO**: Verify real-time updates work
4. **File Uploads**: If profile photos needed, add upload handling
5. **Email Notifications**: Optional enhancement for email alerts

---

*Generated: 2026-09-18*
*VTMS Version: 2.0*