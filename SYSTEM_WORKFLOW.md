# VTMS completed workflow specification

## Vehicle
1. Officer opens **Request Vehicle**.
2. Officer selects origin and destination on the map and submits purpose/date/time/passengers.
3. Backend calculates road distance, round-trip distance, duration and stores route geometry.
4. Transport Officer opens the request queue, sees officer + route + map, selects an available vehicle and driver.
5. Backend calculates planned fuel from the selected vehicle's KM/L and marks the request `NEST_REVIEW`.
6. NEST reviews and recommends, rejects or returns the request.
7. R3 reviews the NEST decision and approves, rejects or returns.
8. On approval, the system creates/uses a Trip and notifies the assigned driver and requesting officer.
9. Driver starts the trip with starting odometer KM and can send live GPS.
10. Officer, Driver and Transport Officer can see the route map and progress.

## Fuel
1. Driver opens an active trip and selects **Request Fuel**.
2. Backend calculates remaining distance from trip route/GPS and estimates litres from vehicle KM/L.
3. Driver submits current KM, litres requested, reason and notes.
4. Transport Officer reviews the driver's fuel report and either forwards to R3, returns it or rejects it.
5. R3 verifies and sends it to NEST, or rejects/returns it.
6. NEST recommends or does not recommend.
7. A positive NEST recommendation goes to R3 for **final approval**.
8. Approved fuel appears to Transport Officer for physical release.
9. Transport marks released, then completed; driver receives notifications throughout.

## Logbook
1. After a trip is completed, Driver creates the logbook from the trip.
2. Route, vehicle, driver, origin, destination and odometer values are taken from the trip.
3. Driver records fuel actually used and remarks, then submits.
4. Transport Officer verifies or returns the logbook.
5. Verified logbook allows Transport Officer to close the trip.

## Calculation rules
- One-way route distance comes from OSRM where configured.
- Round-trip distance = one-way × 2.
- Planned base fuel = round-trip KM ÷ vehicle KM/L.
- Planned fuel = base fuel × (1 + configured buffer).
- Mid-trip fuel estimate = remaining route KM ÷ vehicle KM/L.
