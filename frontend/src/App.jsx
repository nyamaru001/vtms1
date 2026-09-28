
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import PortalLayout from './layouts/PortalLayout';
import Login from './pages/auth/Login';
import Unauthorized from './pages/Unauthorized';
import NotFound from './pages/NotFound';

// ==================== OFFICER ====================
import OfficerDashboard from './pages/officer/Dashboard';
import RequestVehicle from './pages/officer/RequestVehicle';
import MyRequests from './pages/officer/MyRequests';
import OfficerRequestDetail from './pages/officer/RequestDetail';
import MyTrips from './pages/officer/MyTrips';
import TripTracking from './pages/officer/TripTracking';
import OfficerNotifications from './pages/officer/Notifications';
import OfficerFuelRequests from './pages/officer/FuelRequests';


// ==================== DRIVER ====================
import DriverDashboard from './pages/driver/Dashboard';
import DriverTrips from './pages/driver/Trips';
import DriverTripDetail from './pages/driver/TripDetail';
import AdditionalFuelRequestForm from './pages/driver/AdditionalFuelRequestForm';
import DriverNotifications from './pages/driver/Notifications';
import OfficerLogbook from './pages/officer/Logbook';
import TransportLogbook from './pages/transport/Logbook';
import DriverRouteMap from './pages/driver/RouteMapPage';
import RequestFuel from './pages/driver/RequestFuel';
import DriverMyRequests from './pages/driver/MyRequests';
import DriverLogbook from './pages/driver/Logbook';

// ==================== TRANSPORT OFFICER ====================
import TransportDashboard from './pages/transport/Dashboard';
import TransportRequests from './pages/transport/Requests';
import TransportRequestDetail from './pages/transport/RequestDetail';
import TransportTrips from './pages/transport/Trips';
import TransportTripDetail from './pages/transport/TripDetail';
import TransportVehicles from './pages/transport/Vehicles';
import FleetTracking from './pages/transport/FleetTracking';
import RouteCalculator from './pages/transport/RouteCalculator';
import TransportReports from './pages/transport/Reports';
import TransportFuel from './pages/transport/Fuel';
import TransportDrivers from './pages/transport/Drivers';
import TransportNotifications from './pages/transport/Notifications';
import TransportSettings from './pages/transport/TransportSettings';

// ==================== HPMU ====================
import HPMUDashboard from './pages/hpmu/Dashboard';
import HPMURequests from './pages/hpmu/Requests';
import HPMURequestDetail from './pages/hpmu/RequestDetail';
import HPMUFuelRequests from './pages/hpmu/FuelRequests';
import HPMUNotifications from './pages/hpmu/Notifications';
import HPMUReports from './pages/hpmu/Reports';
import FuelIssueLogbook from './pages/hpmu/FuelIssueLogbook';

// ==================== R3 ====================
import R3Dashboard from './pages/r3/Dashboard';
import R3Requests from './pages/r3/Requests';
import R3RequestDetail from './pages/r3/RequestDetail';
import R3Notifications from './pages/r3/Notifications';
import R3Reports from './pages/r3/Reports';
import R3FuelRequests from './pages/r3/FuelRequests';



// ==================== ADMIN ====================
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminAudit from './pages/admin/Audit';
import AdminReports from './pages/admin/Reports';
import SystemMonitoring from './pages/admin/SystemMonitoring';
import TrainingPortal from './pages/admin/TrainingPortal';
import AdminRequestVehicle from './pages/admin/AdminRequestVehicle';

// ==================== COMMON ====================
import ProfilePage from './components/ProfilePage';
import SettingsPage from './components/SettingsPage';

// =====================================================
// OFFICER MENU
// =====================================================
const officerMenu = [
  { to: '/officer', end: true, label: 'Dashboard', icon: '🏠' },
  { to: '/officer/request-vehicle', label: 'Request Vehicle', icon: '🚗' },
  { to: '/officer/requests', label: 'My Requests', icon: '📋' },
  { to: '/officer/trips', label: 'Trips', icon: '🧭' },
  { to: '/officer/trip-tracking', label: 'Map / Tracking', icon: '🗺️' },
  { to: '/officer/fuel', label: 'Fuel', icon: '⛽' },
  { to: '/officer/logbook', label: 'Logbook', icon: '📒' },
  { to: '/officer/notifications', label: 'Notifications', icon: '🔔' },
  { to: '/officer/profile', label: 'Profile', icon: '👤' },
  { to: '/officer/settings', label: 'Settings', icon: '⚙️' },
];

// =====================================================
// DRIVER MENU
// =====================================================
const driverMenu = [
  { to: '/driver', end: true, label: 'Dashboard', icon: '🏠' },
  { to: '/driver/request-vehicle', label: 'Request Vehicle', icon: '🚗' },
  { to: '/driver/trips', label: 'My Assignments', icon: '🧭' },
  { to: '/driver/route-map', label: 'Route Map', icon: '🗺️' },
  { to: '/driver/fuel', label: 'Request Fuel', icon: '⛽' },
  { to: '/driver/my-requests', label: 'My Requests', icon: '📋' },
  { to: '/driver/logbook', label: 'Logbook', icon: '📒' },
  { to: '/driver/notifications', label: 'Notifications', icon: '🔔' },
  { to: '/driver/profile', label: 'Profile', icon: '👤' },
  { to: '/driver/settings', label: 'Settings', icon: '⚙️' },
];

// =====================================================
// TRANSPORT MENU
// =====================================================
const transportMenu = [
  { to: '/transport', end: true, label: 'Dashboard', icon: '🏠' },
  { to: '/transport/request-vehicle', label: 'Request Vehicle', icon: '🚗' },
  { to: '/transport/requests', label: 'Requests', icon: '📋' },
  { to: '/transport/vehicles', label: 'Vehicles', icon: '🚙' },
  { to: '/transport/drivers', label: 'Drivers', icon: '🧑‍✈️' },
  { to: '/transport/trips', label: 'Assignments', icon: '🧭' },
  { to: '/transport/fleet-tracking', label: 'Fleet Map', icon: '🗺️' },
  { to: '/transport/route-calculator', label: 'Route Calculator', icon: '📐' },
  { to: '/transport/fuel', label: 'Fuel', icon: '⛽' },
  { to: '/transport/logbook', label: 'Logbook', icon: '📒' },
  { to: '/transport/reports', label: 'Reports', icon: '📄' },
  { to: '/transport/notifications', label: 'Notifications', icon: '🔔' },
  { to: '/transport/profile', label: 'Profile', icon: '👤' },
  { to: '/transport/settings', label: 'Settings', icon: '⚙️' },
];

// =====================================================
// ADMIN MENU
// =====================================================
const adminMenu = [
  { to: '/admin', end: true, label: 'Dashboard', icon: '🏠' },
  { to: '/admin/request-vehicle', label: 'Request Vehicle', icon: '🚗' },
  { to: '/admin/users', label: 'Users', icon: '👥' },
  { to: '/admin/audit', label: 'Audit Logs', icon: '🛡️' },
  { to: '/admin/monitoring', label: 'System Monitoring', icon: '📊' },
  { to: '/admin/reports', label: 'Reports', icon: '📄' },
  { to: '/admin/training', label: 'Portal Training', icon: '🎓' },
  { to: '/admin/profile', label: 'Profile', icon: '👤' },
  { to: '/admin/settings', label: 'Settings', icon: '⚙️' },
];

// =====================================================
// HPMU MENU
// =====================================================
const hpmuMenu = [
  { to: '/hpmu', end: true, label: 'Dashboard', icon: '🏠' },
  { to: '/hpmu/request-vehicle', label: 'Request Vehicle', icon: '🚗' },
  { to: '/hpmu/requests', label: 'Requests', icon: '📋' },
  { to: '/hpmu/fuel-logbook', label: 'Fuel Logbook', icon: '📒' },
  { to: '/hpmu/fuel', label: 'Fuel Requests', icon: '🛢️' },
  { to: '/hpmu/reports', label: 'Reports', icon: '📄' },
  { to: '/hpmu/notifications', label: 'Notifications', icon: '🔔' },
  { to: '/hpmu/profile', label: 'Profile', icon: '👤' },
  { to: '/hpmu/settings', label: 'Settings', icon: '⚙️' },
];

// =====================================================
// R3 MENU
// =====================================================
const r3Menu = [
  { to: '/r3', end: true, label: 'Dashboard', icon: '🏠' },
  { to: '/r3/request-vehicle', label: 'Request Vehicle', icon: '🚗' },
  { to: '/r3/requests', label: 'Reviews', icon: '📋' },
  { to: '/r3/fuel', label: 'Fuel', icon: '⛽' },
  { to: '/r3/reports', label: 'Reports', icon: '📄' },
  { to: '/r3/notifications', label: 'Notifications', icon: '🔔' },
  { to: '/r3/profile', label: 'Profile', icon: '👤' },
  { to: '/r3/settings', label: 'Settings', icon: '⚙️' },
];

// =====================================================
// TRAINING MENUS
// The training sidebar always mirrors the live portal menu,
// so no training link can point at a page that does not exist.
// =====================================================
const trainingMenu = (base, menu) =>
  menu.map((item) => ({
    ...item,
    to: `${base}${item.to.slice(1).replace(/^[^/]+/, '')}`,
  }));

const officerTrainingMenu = trainingMenu('/admin/training/officer', officerMenu);
const driverTrainingMenu = trainingMenu('/admin/training/driver', driverMenu);
const transportTrainingMenu = trainingMenu('/admin/training/transport', transportMenu);
const r3TrainingMenu = trainingMenu('/admin/training/r3', r3Menu);
const hpmuTrainingMenu = trainingMenu('/admin/training/hpmu', hpmuMenu);

export default function App() {
  return (
    <Routes>

      {/* =====================================================
          PUBLIC ROUTES
      ===================================================== */}
      <Route path="/login" element={<Login />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* =====================================================
          OFFICER PORTAL
      ===================================================== */}
      <Route
        path="/officer"
        element={
          <ProtectedRoute roles={['OFFICER']}>
            <PortalLayout
              title="Officer Portal"
              menu={officerMenu}
            />
          </ProtectedRoute>
        }
      >
        <Route index element={<OfficerDashboard />} />
        <Route path="request-vehicle" element={<RequestVehicle />} />
        <Route path="requests" element={<MyRequests />} />
        <Route path="requests/:id" element={<OfficerRequestDetail />} />
        <Route path="trips" element={<MyTrips />} />
        <Route path="trip-tracking" element={<TripTracking />} />
        <Route path="trip-tracking/:id" element={<TripTracking />} />
        <Route path="fuel" element={<OfficerFuelRequests />} />
        <Route path="logbook" element={<OfficerLogbook />} />
        <Route path="notifications" element={<OfficerNotifications />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* =====================================================
          DRIVER PORTAL
      ===================================================== */}
      <Route
        path="/driver"
        element={
          <ProtectedRoute roles={['DRIVER']}>
            <PortalLayout
              title="Driver Portal"
              menu={driverMenu}
            />
          </ProtectedRoute>
        }
      >
        <Route index element={<DriverDashboard />} />
        <Route path="trips" element={<DriverTrips />} />
        <Route path="trips/:id" element={<DriverTripDetail />} />
        <Route path="route-map" element={<DriverRouteMap />} />
        <Route path="requests/:id" element={<OfficerRequestDetail />} />

        <Route path="fuel" element={<RequestFuel />} />
        <Route path="fuel/new" element={<RequestFuel />} />
        <Route path="fuel/additional" element={<AdditionalFuelRequestForm />} />
        <Route path="my-requests" element={<DriverMyRequests />} />
        <Route path="logbook" element={<DriverLogbook />} />
        <Route path="logbook/:id" element={<DriverLogbook />} />
        <Route path="fuel-entries" element={<Navigate to="/driver/fuel" replace />} />
        <Route path="reports" element={<Navigate to="/driver" replace />} />

        <Route path="request-vehicle" element={<RequestVehicle />} />
        <Route
          path="notifications"
          element={<DriverNotifications />}
        />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* =====================================================
          TRANSPORT OFFICER PORTAL
      ===================================================== */}
      <Route
        path="/transport"
        element={
          <ProtectedRoute roles={['TRANSPORT_OFFICER']}>
            <PortalLayout
              title="Transport Officer Portal"
              menu={transportMenu}
            />
          </ProtectedRoute>
        }
      >
        <Route index element={<TransportDashboard />} />
        <Route path="vehicles" element={<TransportVehicles />} />
        <Route path="drivers" element={<TransportDrivers />} />
        <Route path="requests" element={<TransportRequests />} />
        <Route
          path="requests/:id"
          element={<TransportRequestDetail />}
        />
        <Route path="trips" element={<TransportTrips />} />
        <Route
          path="trips/:id"
          element={<TransportTripDetail />}
        />
        <Route
          path="fleet-tracking"
          element={<FleetTracking />}
        />
        <Route
          path="route-calculator"
          element={<RouteCalculator />}
        />
        <Route
          path="request-vehicle"
          element={<RequestVehicle />}
        />
        <Route path="reports" element={<TransportReports />} />
        <Route path="fuel" element={<TransportFuel />} />
        <Route path="logbook" element={<TransportLogbook />} />
        <Route
          path="notifications"
          element={<TransportNotifications />}
        />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* =====================================================
          ADMIN PORTAL
      ===================================================== */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <PortalLayout
              title="Admin Portal"
              menu={adminMenu}
            />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="request-vehicle" element={<AdminRequestVehicle />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="audit" element={<AdminAudit />} />
        <Route path="reports" element={<AdminReports />} />
        <Route
          path="monitoring"
          element={<SystemMonitoring />}
        />
        <Route
          path="training"
          element={<TrainingPortal />}
        />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* =====================================================
          ADMIN TRAINING - OFFICER
      ===================================================== */}
      <Route
        path="/admin/training/officer"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <PortalLayout title="Officer Portal" menu={officerTrainingMenu} />
          </ProtectedRoute>
        }
      >
        <Route index element={<OfficerDashboard />} />
        <Route path="request-vehicle" element={<RequestVehicle />} />
        <Route path="requests" element={<MyRequests />} />
        <Route path="requests/:id" element={<OfficerRequestDetail />} />
        <Route path="trips" element={<MyTrips />} />
        <Route path="trip-tracking" element={<TripTracking />} />
        <Route path="trip-tracking/:id" element={<TripTracking />} />
        <Route path="fuel" element={<OfficerFuelRequests />} />
        <Route path="logbook" element={<OfficerLogbook />} />
        <Route path="notifications" element={<OfficerNotifications />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* =====================================================
          ADMIN TRAINING - DRIVER
      ===================================================== */}
      <Route
        path="/admin/training/driver"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <PortalLayout title="Driver Portal" menu={driverTrainingMenu} />
          </ProtectedRoute>
        }
      >
        <Route index element={<DriverDashboard />} />
        <Route path="trips" element={<DriverTrips />} />
        <Route path="trips/:id" element={<DriverTripDetail />} />
        <Route path="route-map" element={<DriverRouteMap />} />
        <Route path="requests/:id" element={<OfficerRequestDetail />} />
        <Route path="fuel" element={<RequestFuel />} />
        <Route path="fuel/new" element={<RequestFuel />} />
        <Route path="fuel/additional" element={<AdditionalFuelRequestForm />} />
        <Route path="my-requests" element={<DriverMyRequests />} />
        <Route path="logbook" element={<DriverLogbook />} />
        <Route path="logbook/:id" element={<DriverLogbook />} />
        <Route path="fuel-entries" element={<Navigate to="/admin/training/driver/fuel" replace />} />
        <Route path="request-vehicle" element={<RequestVehicle />} />
        <Route path="notifications" element={<DriverNotifications />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* =====================================================
          ADMIN TRAINING - TRANSPORT
      ===================================================== */}
      <Route
        path="/admin/training/transport"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <PortalLayout
              title="Transport Officer Portal"
              menu={transportTrainingMenu}
            />
          </ProtectedRoute>
        }
      >
        <Route index element={<TransportDashboard />} />
        <Route path="requests" element={<TransportRequests />} />
        <Route path="requests/:id" element={<TransportRequestDetail />} />
        <Route path="vehicles" element={<TransportVehicles />} />
        <Route path="drivers" element={<TransportDrivers />} />
        <Route path="trips" element={<TransportTrips />} />
        <Route path="trips/:id" element={<TransportTripDetail />} />
        <Route path="fleet-tracking" element={<FleetTracking />} />
        <Route path="route-calculator" element={<RouteCalculator />} />
        <Route path="request-vehicle" element={<RequestVehicle />} />
        <Route path="reports" element={<TransportReports />} />
        <Route path="fuel" element={<TransportFuel />} />
        <Route path="logbook" element={<TransportLogbook />} />
        <Route path="notifications" element={<TransportNotifications />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* =====================================================
          ADMIN TRAINING - R3
      ===================================================== */}
      <Route
        path="/admin/training/r3"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <PortalLayout title="R3 Portal" menu={r3TrainingMenu} />
          </ProtectedRoute>
        }
      >
        <Route index element={<R3Dashboard />} />
        <Route path="requests" element={<R3Requests />} />
        <Route path="requests/:id" element={<R3RequestDetail />} />
        <Route path="fuel" element={<R3FuelRequests />} />
        <Route path="request-vehicle" element={<RequestVehicle />} />
        <Route path="reports" element={<R3Reports />} />
        <Route path="notifications" element={<R3Notifications />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* =====================================================
          ADMIN TRAINING - HPMU
      ===================================================== */}
      <Route
        path="/admin/training/hpmu"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <PortalLayout title="HPMU Portal" menu={hpmuTrainingMenu} />
          </ProtectedRoute>
        }
      >
        <Route index element={<HPMUDashboard />} />
        <Route path="request-vehicle" element={<RequestVehicle />} />
        <Route path="requests" element={<HPMURequests />} />
        <Route path="requests/:id" element={<HPMURequestDetail />} />
        <Route path="fuel" element={<HPMUFuelRequests />} />
        <Route path="fuel-logbook" element={<FuelIssueLogbook />} />
        <Route path="reports" element={<HPMUReports />} />
        <Route path="notifications" element={<HPMUNotifications />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* =====================================================
          HPMU PORTAL
      ===================================================== */}
      <Route
        path="/hpmu"
        element={
          <ProtectedRoute roles={['HPMU']}>
            <PortalLayout
              title="HPMU Portal"
              menu={hpmuMenu}
            />
          </ProtectedRoute>
        }
      >
        <Route index element={<HPMUDashboard />} />

        <Route path="fuel" element={<HPMUFuelRequests />} />

        <Route path="fuel-logbook" element={<FuelIssueLogbook />} />

        <Route path="requests" element={<HPMURequests />} />        <Route path="requests" element={<HPMURequests />} />
        <Route path="requests/:id" element={<HPMURequestDetail />} />

        <Route
          path="request-vehicle"
          element={<RequestVehicle />}
        />

        <Route
          path="notifications"
          element={<HPMUNotifications />}
        />

        <Route
          path="profile"
          element={<ProfilePage />}
        />

        <Route
          path="settings"
          element={<SettingsPage />}
        />

        <Route
          path="reports"
          element={<HPMUReports />}
        />
      </Route>

      {/* =====================================================
          R3 PORTAL
      ===================================================== */}
      <Route
        path="/r3"
        element={
          <ProtectedRoute roles={['R3']}>
            <PortalLayout
              title="R3 Portal"
              menu={r3Menu}
            />
          </ProtectedRoute>
        }
      >
        <Route index element={<R3Dashboard />} />
        <Route path="requests" element={<R3Requests />} />
        <Route path="fuel" element={<R3FuelRequests />} />
        <Route
          path="requests/:id"
          element={<R3RequestDetail />}
        />
        <Route
          path="request-vehicle"
          element={<RequestVehicle />}
        />
        <Route
          path="notifications"
          element={<R3Notifications />}
        />
        <Route
          path="profile"
          element={<ProfilePage />}
        />
        <Route
          path="settings"
          element={<SettingsPage />}
        />
        <Route
          path="reports"
          element={<R3Reports />}
        />
      </Route>

      {/* =====================================================
          NOT FOUND
      ===================================================== */}
      <Route path="*" element={<NotFound />} />

    </Routes>
  );
}
