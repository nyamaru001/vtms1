# VTMS Workflow Upgrade

## Vehicle request flow
1. Officer creates a vehicle request.
2. Request goes directly to R3 (`R3_REVIEW`).
3. R3 Approve -> `TRANSPORT_REVIEW`; Reject -> `R3_REJECTED`; Return -> `R3_RETURNED`.
4. Transport Officer selects an available vehicle and driver and assigns both.
5. A trip is created automatically with status `DRIVER_ASSIGNED`.
6. Driver accepts or rejects the assignment. Rejection requires a reason.
7. After acceptance, driver can start the trip with the starting odometer.

## Fuel flow
1. Driver requests fuel from the Driver portal.
2. Fuel request goes directly to HPMU (`HPMU_REVIEW`). Transport Officer does not approve or release driver fuel.
3. HPMU approves/returns/rejects the request.
4. HPMU releases the physical fuel and records litres issued, optional odometer and station/voucher reference.
5. The release automatically creates an HPMU Fuel Issue Logbook entry.
6. Driver confirms the actual litres received.

## Trip flexibility
During an accepted/active trip, the driver can report a route change, unplanned stop, breakdown, incident or other operational challenge. A reason is mandatory and GPS coordinates are captured when available. The officer and transport officer are notified.

## UI
- Officer dashboard has direct **Request Vehicle** and **View My Trips** actions.
- Transport Officer owns vehicle + driver assignment.
- HPMU has a **Fuel Issue Logbook**.
- Transport and R3 fuel action pages are removed from their portal navigation because they are not approval/release roles in this workflow.
- Login uses a compact clean panel with a dark-blue transparent overlay over a Land Cruiser themed vehicle image.

## Database
The application uses Sequelize `sync()` in the supplied backend. If database sync is disabled in your deployment, run:
`backend/sql/2026_workflow_upgrade.sql`
before starting the server.
