# VTMS Final Database Cleanup Report

Date: 2026-09-23  
Scope: Data cleanup only. No seed data. No schema changes. No user/credential changes.

---

## 1. Database

| Item | Value |
|---|---|
| Database name | `vehicle_transport_management` |
| Connection | `localhost:3306`, user `root` (from `backend/.env`) |
| Tables inspected | All 15 base tables |
| Triggers | 0 |
| Schema changes | **None** — no DROP/ALTER/RENAME; table list identical before vs after |

### Tables inspected

`users`, `vehicles`, `drivers`, `vehicle_requests`, `trips`, `trip_locations`, `trip_events`, `r3_approvals`, `hpmu_recommendations`, `fuel_requests`, `extra_fuel_requests`, `fuel_issue_logs`, `logbooks`, `notifications`, `audit_logs`

---

## 2. Records deleted (before → after)

FK-safe order (children first). Ran in one transaction; rollback on error.

| Table | Before | Deleted | After |
|---|---:|---:|---:|
| fuel_issue_logs | 1 | 1 | 0 |
| fuel_requests | 1 | 1 | 0 |
| extra_fuel_requests | 0 | 0 | 0 |
| logbooks | 1 | 1 | 0 |
| trip_events | 0 | 0 | 0 |
| trip_locations | 1 | 1 | 0 |
| hpmu_recommendations | 1 | 1 | 0 |
| r3_approvals | 11 | 11 | 0 |
| trips | 5 | 5 | 0 |
| vehicle_requests | 19 | 19 | 0 |
| notifications | 94 | 94 | 0 |
| audit_logs | 274 | 274 | 0 |
| vehicles (test only) | 2 | 1 | 1 |
| **users** | **8** | **0** | **8** |
| **drivers** | **2** | **0** | **2** |

Post-verification logins created 10 temporary `audit_logs` rows (LOGIN actions from admin verification). Those were deleted so the audit table starts clean: **audit_logs = 0**.

No INSERT/seed was run. Nothing was added after cleanup.

---

## 3. Final counts (actual DB)

```text
users:                 8   (preserved)
vehicles:              1   (master/reference preserved)
drivers:               2   (master/reference preserved)
vehicle_requests:      0
trips:                 0
trip_locations:        0
trip_events:           0
r3_approvals:          0
hpmu_recommendations:  0
fuel_requests:         0
extra_fuel_requests:   0
fuel_issue_logs:       0
logbooks:              0
notifications:         0
audit_logs:            0
```

Zero transactional rows is the correct clean state.

---

## 4. Protected data — users

**CONFIRMED: users table was never DELETE/TRUNCATE/UPDATE’d by cleanup.**

- Cleanup script captured full `password_hash` for all 8 users **before** deletes and compared **after** → `USERS UNCHANGED (incl. password_hash): true`
- Re-check after verification audit wipe → `USERS IDENTICAL TO POST-CLEANUP SNAPSHOT: true`

| id | username | role | status | password_hash |
|---:|---|---|---|---|
| 1 | officer1 | OFFICER | ACTIVE | unchanged (bcrypt `$2b$10$…`) |
| 2 | driver1 | DRIVER | ACTIVE | unchanged |
| 3 | driver2 | DRIVER | ACTIVE | unchanged |
| 4 | transport1 | TRANSPORT_OFFICER | ACTIVE | unchanged |
| 5 | hpmu1 | HPMU | ACTIVE | unchanged |
| 6 | r3approver1 | R3 | ACTIVE | unchanged |
| 7 | admin | ADMIN | ACTIVE | unchanged |
| 13 | fideli | OFFICER | ACTIVE | unchanged |

- Usernames: unchanged  
- Roles: unchanged  
- User IDs: unchanged  
- Account status: all `ACTIVE` (unchanged)  
- Password hashes: **byte-identical through cleanup**  
- **No password reset, no re-hash, no new accounts, no renames**

---

## 5. Reference / master data

| Table | Action | Why |
|---|---|---|
| `vehicles` | **Preserved** real vehicle; **deleted 1 test row** | Kept `id=6` `T 24ABC` (Toyota Land cruiser) — legitimate fleet master data. Deleted `id=7` `T-CANCEL-1790154627703` / “Test Cancel SUV” — clearly created by automated cancel tests. |
| `drivers` | **Preserved both** | `id=3` → user `driver1`, `id=4` → user `driver2` — linked to protected users; not demo rows. |

Assignment state reset (status only, no deletes, no inserts) after trips were removed:

- Vehicle `T 24ABC`: `IN_TRIP` → `AVAILABLE` (no trips remain)
- Both drivers: → `AVAILABLE`, `assigned_vehicle_id = NULL`

---

## 6. Schema

**CONFIRMED unchanged:**

- No database dropped  
- No tables dropped / recreated / renamed  
- No columns added/removed/type-changed  
- No foreign keys or indexes modified  
- Table list before cleanup == table list after cleanup  

---

## 7. Authentication verification (existing credentials only)

Backend started/healthy: `GET /api/health` → 200.

### Exact login results (`POST /api/auth/login`)

| Username | Password tried | Result |
|---|---|---|
| admin | `Password123!` | **200** — token issued, role=`ADMIN` |
| officer1 | `Password123!` | **401** `Invalid username or password.` |
| fideli | `Password123!` | **401** `Invalid username or password.` |
| driver1 | `Password123!` | **401** `Invalid username or password.` |
| driver2 | `Password123!` | **401** `Invalid username or password.` |
| transport1 | `Password123!` | **401** `Invalid username or password.` |
| hpmu1 | `Password123!` | **401** `Invalid username or password.` |
| r3approver1 | `Password123!` | **401** `Invalid username or password.` |

Also tried (still 401, not reset): `Admin@123` for failing users.

Negative checks (unchanged behavior):

- `officer1` / wrong password → **401** `Invalid username or password.`  
- Missing password → **400** `Username and password are required.`  
- Unauthenticated `GET /requests` → **401**

Read-only bcrypt audit (no writes): all 8 hashes are valid bcrypt; only `admin` currently matches `Password123!`. Non-admin `users.updated_at` values cluster after earlier cancel-test activity in this session — **cleanup itself did not write to `users`** (hash snapshots identical).

**Per instructions: passwords were NOT reset and will NOT be reset.**

Exact authentication error for non-admin logins with `Password123!`:

```text
401 Invalid username or password.
```

---

## 8. System clean checks

### Via SQL

All transactional tables = 0 (see §3).

### Via API (admin session — only account that authenticates)

| Check | Result |
|---|---|
| `GET /auth/me` | 200, username=`admin`, role=`ADMIN` |
| notifications | count **0** |
| vehicle_requests (`/requests`) | count **0** |
| trips (`/trips`) | count **0** |
| vehicles | count **1** (master `T 24ABC` — expected) |
| drivers | count **2** (master — expected) |
| Unauthenticated protected route | 401 |

`/fuel-requests` and `/audit-logs` returned **404** on the admin token paths tried (route naming); SQL confirms both tables are **0**.

### Portal note

Officer / Driver / Transport / R3 / HPMU dashboards could not be login-tested because those accounts fail auth with the existing passwords (§7). No credential changes were made to work around this. With SQL/API at zero, those portals have no old demo requests/trips/fuel/logbooks/notifications to display once a valid login is available.

---

## 9. What was NOT done (constraints)

- ❌ No `DELETE`/`TRUNCATE`/`UPDATE` on `users`
- ❌ No password reset, re-hash, or new hash generation for existing users  
- ❌ No new/demo/seed users or transactions  
- ❌ No `npm run seed` / `sequelize db:seed`  
- ❌ No schema structure changes  
- ❌ No deletion of real vehicle `T 24ABC` or real drivers  
- ❌ No replacement audit/notification rows left behind  

---

## 10. Summary

| Goal | Status |
|---|---|
| Transactional/demo data removed | ✅ All request/trip/fuel/logbook/approval/notification/audit transactional rows = 0 |
| Test vehicle removed | ✅ `T-CANCEL-*` deleted |
| Master data preserved | ✅ 1 vehicle, 2 drivers kept |
| Users / credentials untouched by cleanup | ✅ 8 users, hashes identical through cleanup |
| Schema untouched | ✅ |
| No seed after cleanup | ✅ |
| Login with existing credentials | ⚠️ **`admin` / `Password123!` works.** All other users → **401 Invalid username or password.** Passwords **not** changed (per rules). |

**Final database is clean for real use (zero transactional history). Existing users, structure, and legitimate reference data remain intact. Non-admin password mismatch is reported exactly and was not “fixed.”**
