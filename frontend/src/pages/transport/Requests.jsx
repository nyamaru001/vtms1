
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  requestsApi,
  vehiclesApi,
  driversApi,
} from '../../services/resources';

import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import Loading from '../../components/Loading';
import Pagination from '../../components/Pagination';

const STATUSES = [
  'PENDING',
  'TRANSPORT_REVIEW',
  'HPMU_REVIEW',
  'R3_REVIEW',
  'APPROVED',
  'REJECTED',
  'RETURNED',
  'CANCELLED',
  'DRIVER_ASSIGNED',
  'TRIP_STARTED',
  'TRIP_COMPLETED',
  'CLOSED',
];

export default function TransportRequests() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('TRANSPORT_REVIEW');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [assignModal, setAssignModal] = useState(false);
  const [assignRequest, setAssignRequest] = useState(null);

  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [availableDrivers, setAvailableDrivers] = useState([]);

  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);

  const [assigning, setAssigning] = useState(false);

  /*
   * ============================================================
   * LOAD VEHICLE REQUESTS
   * ============================================================
   */
  const loadRequests = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await requestsApi.list({
        page,
        limit: 10,
        status: status || undefined,
      });

      setData(response);
    } catch (err) {
      console.error('Failed to load vehicle requests:', err);

      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to load vehicle requests.'
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * ============================================================
   * LOAD REQUESTS WHEN PAGE OR STATUS CHANGES
   * ============================================================
   */
  useEffect(() => {
    loadRequests();
  }, [page, status]);

  /*
   * ============================================================
   * LOAD AVAILABLE VEHICLES AND DRIVERS
   * ============================================================
   */
  useEffect(() => {
    const loadResources = async () => {
      try {
        const [vehicles, drivers] = await Promise.all([
          vehiclesApi.available(),
          driversApi.available(),
        ]);

        setAvailableVehicles(Array.isArray(vehicles) ? vehicles : []);
        setAvailableDrivers(Array.isArray(drivers) ? drivers : []);
      } catch (err) {
        console.error(
          'Failed to load available vehicles/drivers:',
          err
        );

        setAvailableVehicles([]);
        setAvailableDrivers([]);
      }
    };

    loadResources();
  }, []);

  /*
   * ============================================================
   * OPEN ASSIGN MODAL
   * ============================================================
   */
  const openAssignModal = (request) => {
    setAssignRequest(request);
    setSelectedVehicle(null);
    setSelectedDriver(null);
    setAssignModal(true);
  };

  /*
   * ============================================================
   * CLOSE ASSIGN MODAL
   * ============================================================
   */
  const closeAssignModal = () => {
    if (assigning) {
      return;
    }

    setAssignModal(false);
    setAssignRequest(null);
    setSelectedVehicle(null);
    setSelectedDriver(null);
  };

  /*
   * ============================================================
   * ASSIGN VEHICLE + DRIVER
   * ============================================================
   */
  const handleAssign = async () => {
    if (!assignRequest) {
      return;
    }

    if (!selectedVehicle || !selectedDriver) {
      return;
    }

    try {
      setAssigning(true);

      await requestsApi.assign(assignRequest.id, {
        vehicleId: selectedVehicle.id,
        driverId: selectedDriver.id,
      });

      setAssignModal(false);
      setAssignRequest(null);
      setSelectedVehicle(null);
      setSelectedDriver(null);

      /*
       * Refresh the request list after successful assignment.
       */
      await loadRequests();

      /*
       * Refresh available resources because the assigned
       * vehicle and driver may no longer be available.
       */
      try {
        const [vehicles, drivers] = await Promise.all([
          vehiclesApi.available(),
          driversApi.available(),
        ]);

        setAvailableVehicles(Array.isArray(vehicles) ? vehicles : []);
        setAvailableDrivers(Array.isArray(drivers) ? drivers : []);
      } catch (resourceError) {
        console.error(
          'Failed to refresh available resources:',
          resourceError
        );
      }
    } catch (err) {
      console.error('Assign failed:', err);

      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to assign vehicle and driver.'
      );
    } finally {
      setAssigning(false);
    }
  };

  /*
   * ============================================================
   * LOADING
   * ============================================================
   */
  if (loading && !data) {
    return <Loading />;
  }

  /*
   * ============================================================
   * ERROR
   * ============================================================
   */
  if (!data && error) {
    return (
      <div className="panel">
        <div className="panel-header">
          <h3>Vehicle Requests</h3>
        </div>

        <div className="alert alert-error">
          {error}
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={loadRequests}
        >
          Try Again
        </button>
      </div>
    );
  }

  /*
   * ============================================================
   * NORMALIZE PAGINATION DATA
   * ============================================================
   */
  const rows = Array.isArray(data?.data) ? data.data : [];

  return (
    <div className="panel">
      {/* ======================================================
          HEADER
      ====================================================== */}
      <div className="panel-header">
        <h3>Vehicle Requests</h3>

        <select
          className="input select-inline"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>

          {STATUSES.map((item) => (
            <option key={item} value={item}>
              {item.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      {/* ======================================================
          ERROR MESSAGE
      ====================================================== */}
      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {/* ======================================================
          REQUEST TABLE
      ====================================================== */}
      <DataTable
        columns={[
          {
            key: 'requestNumber',
            header: 'Request #',
            render: (request) => (
              <Link to={`/transport/requests/${request.id}`}>
                {request.requestNumber || '—'}
              </Link>
            ),
          },

          {
            key: 'officer',
            header: 'Officer',
            render: (request) =>
              request.officer?.fullName ||
              request.officer?.name ||
              '—',
          },

          {
            key: 'route',
            header: 'Route',
            render: (request) =>
              `${request.originName || '—'} → ${
                request.destinationName || '—'
              }`,
          },

          {
            key: 'departureDate',
            header: 'Departure',
            render: (request) =>
              request.departureDate || '—',
          },

          {
            key: 'status',
            header: 'Status',
            render: (request) => (
              <StatusBadge status={request.status} />
            ),
          },

          {
            key: 'actions',
            header: '',
            render: (request) =>
              request.status === 'TRANSPORT_REVIEW' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => openAssignModal(request)}
                  >
                    Assign / Reassign
                  </button>
                  <span className="field-hint" data-testid="reassign-hint">Ready for driver assignment</span>
                </div>
              ) : null,
          },
        ]}
        rows={rows}
        emptyMessage="No requests match this filter."
      />

      {/* ======================================================
          PAGINATION
      ====================================================== */}
      {data && (
        <Pagination
          page={data.page || page}
          limit={data.limit || 10}
          total={data.total || 0}
          onChange={setPage}
        />
      )}

      {/* ======================================================
          ASSIGN VEHICLE + DRIVER MODAL
      ====================================================== */}
      <Modal
        open={assignModal}
        title={`Assign Vehicle & Driver - ${
          assignRequest?.requestNumber || ''
        }`}
        onClose={closeAssignModal}
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={closeAssignModal}
              disabled={assigning}
            >
              Cancel
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAssign}
              disabled={
                assigning ||
                !selectedVehicle ||
                !selectedDriver
              }
            >
              {assigning
                ? 'Assigning...'
                : 'Assign & Create Trip'}
            </button>
          </>
        }
      >
        {assignRequest && (
          <>
            {/* ==================================================
                REQUEST INFORMATION
            ================================================== */}
            <div className="detail-grid">
              <div>
                <span className="field-label">
                  Request
                </span>

                <p>
                  {assignRequest.requestNumber || '—'}
                </p>
              </div>

              <div>
                <span className="field-label">
                  Purpose
                </span>

                <p>
                  {assignRequest.purpose || '—'}
                </p>
              </div>

              <div>
                <span className="field-label">
                  Route
                </span>

                <p>
                  {assignRequest.originName || '—'}
                  {' → '}
                  {assignRequest.destinationName || '—'}
                </p>
              </div>

              <div>
                <span className="field-label">
                  Departure
                </span>

                <p>
                  {assignRequest.departureDate || '—'}
                </p>
              </div>
            </div>

            {/* ==================================================
                VEHICLE
            ================================================== */}
            <div className="section-title">
              Vehicle
            </div>

            <div>
              {availableVehicles.length === 0 ? (
                <p>No available vehicles.</p>
              ) : (
                <select
                  className="input"
                  value={selectedVehicle?.id || ''}
                  onChange={(e) => {
                    const vehicle =
                      availableVehicles.find(
                        (item) =>
                          String(item.id) === e.target.value
                      );

                    setSelectedVehicle(
                      vehicle || null
                    );
                  }}
                  disabled={assigning}
                >
                  <option value="">
                    -- Select vehicle --
                  </option>

                  {availableVehicles.map((vehicle) => (
                    <option
                      key={vehicle.id}
                      value={vehicle.id}
                    >
                      {vehicle.registrationNumber ||
                        vehicle.registration ||
                        'No registration'}{' '}
                      {vehicle.model
                        ? `(${vehicle.model})`
                        : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* ==================================================
                DRIVER
            ================================================== */}
            <div className="section-title">
              Driver
            </div>

            <div>
              {availableDrivers.length === 0 ? (
                <p>No available drivers.</p>
              ) : (
                <select
                  className="input"
                  value={selectedDriver?.id || ''}
                  onChange={(e) => {
                    const driver =
                      availableDrivers.find(
                        (item) =>
                          String(item.id) === e.target.value
                      );

                    setSelectedDriver(
                      driver || null
                    );
                  }}
                  disabled={assigning}
                >
                  <option value="">
                    -- Select driver --
                  </option>

                  {availableDrivers.map((driver) => (
                    <option
                      key={driver.id}
                      value={driver.id}
                    >
                      {driver.user?.fullName ||
                        driver.user?.name ||
                        driver.fullName ||
                        driver.name ||
                        'Unnamed Driver'}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
