import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fuelApi } from '../../services/resources';
import StatusBadge from '../../components/StatusBadge';
import Pagination from '../../components/Pagination';
import Modal from '../../components/Modal';
import Loading from '../../components/Loading';
import DataTable from '../../components/DataTable';

const STATUS_OPTIONS = [
  'ALL',
  'PENDING',
  'HPMU_REVIEW',
  'HPMU_APPROVED',
  'HPMU_REJECTED',
  'HPMU_RETURNED',
  'HPMU_RELEASED',
  'DRIVER_CONFIRMED',
  'COMPLETED',
];

const PAGE_SIZE = 10;

export default function FuelStatus() {
  const navigate = useNavigate();

  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState('normal');

  const [normalStatus, setNormalStatus] = useState('ALL');
  const [normalDate, setNormalDate] = useState('');
  const [normalPage, setNormalPage] = useState(1);

  const [emergencyStatus, setEmergencyStatus] = useState('ALL');
  const [emergencyDate, setEmergencyDate] = useState('');
  const [emergencyPage, setEmergencyPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState(null);
  const [actualLitres, setActualLitres] = useState('');
  const [confirmNotes, setConfirmNotes] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fuelApi.list();
      const data = Array.isArray(response)
        ? response
        : response?.data || response?.requests || [];
      setAllRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load fuel requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = useMemo(() => {
    const total = allRequests.length;
    const pending = allRequests.filter((r) =>
      ['PENDING', 'HPMU_REVIEW', 'HPMU_APPROVED'].includes(
        String(r.status || '').toUpperCase()
      )
    ).length;
    const approved = allRequests.filter((r) =>
      ['HPMU_APPROVED'].includes(String(r.status || '').toUpperCase())
    ).length;
    const released = allRequests.filter((r) =>
      ['HPMU_RELEASED'].includes(String(r.status || '').toUpperCase())
    ).length;
    return { total, pending, approved, released };
  }, [allRequests]);

  const normalRequests = useMemo(() => {
    return allRequests.filter((r) => !r.isAdditional && !r.isEmergency);
  }, [allRequests]);

  const emergencyRequests = useMemo(() => {
    return allRequests.filter((r) => r.isAdditional || r.isEmergency);
  }, [allRequests]);

  const applyFilters = useCallback(
    (items, status, dateFilter) => {
      let result = items;

      if (status && status !== 'ALL') {
        result = result.filter(
          (r) => String(r.status || '').toUpperCase() === status
        );
      }

      if (dateFilter) {
        const filterDate = new Date(dateFilter);
        const nextDay = new Date(dateFilter);
        nextDay.setDate(nextDay.getDate() + 1);
        result = result.filter(
          (r) => {
            const itemDate = new Date(r.createdAt || r.date);
            return itemDate >= filterDate && itemDate < nextDay;
          }
        );
      }

      return result;
    },
    []
  );

  const filteredNormal = useMemo(
    () => applyFilters(normalRequests, normalStatus, normalDate),
    [normalRequests, normalStatus, normalDate, applyFilters]
  );

  const filteredEmergency = useMemo(
    () => applyFilters(emergencyRequests, emergencyStatus, emergencyDate),
    [emergencyRequests, emergencyStatus, emergencyDate, applyFilters]
  );

  const pagedNormal = useMemo(() => {
    const start = (normalPage - 1) * PAGE_SIZE;
    return filteredNormal.slice(start, start + PAGE_SIZE);
  }, [filteredNormal, normalPage]);

  const pagedEmergency = useMemo(() => {
    const start = (emergencyPage - 1) * PAGE_SIZE;
    return filteredEmergency.slice(start, start + PAGE_SIZE);
  }, [filteredEmergency, emergencyPage]);

  useEffect(() => {
    setNormalPage(1);
  }, [normalStatus, normalDate]);

  useEffect(() => {
    setEmergencyPage(1);
  }, [emergencyStatus, emergencyDate]);

  const openConfirmModal = (fuel) => {
    setModalItem(fuel);
    setActualLitres(String(fuel.litresReleased || fuel.litresRequested || ''));
    setConfirmNotes('');
    setConfirmError('');
    setModalOpen(true);
  };

  const closeConfirmModal = () => {
    if (confirmLoading) return;
    setModalOpen(false);
    setModalItem(null);
    setActualLitres('');
    setConfirmNotes('');
    setConfirmError('');
  };

  const handleConfirmReceipt = async () => {
    setConfirmError('');

    if (!modalItem?.id) {
      setConfirmError('Invalid fuel request.');
      return;
    }

    if (!actualLitres || Number(actualLitres) <= 0) {
      setConfirmError('Enter actual litres received.');
      return;
    }

    setConfirmLoading(true);

    try {
      await fuelApi.confirmReceipt(modalItem.id, {
        actualLitresReceived: Number(actualLitres),
        notes: confirmNotes.trim(),
      });
      closeConfirmModal();
      await loadData();
    } catch (err) {
      setConfirmError(err?.response?.data?.message || 'Failed to confirm receipt.');
    } finally {
      setConfirmLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const normalColumns = [
    {
      key: 'trip',
      header: 'Trip #',
      render: (row) => (
        <button
          type="button"
          className="link-btn"
          onClick={() => row.trip?.id && navigate(`/driver/route-map?tripId=${row.trip.id}`)}
        >
          {row.trip?.tripNumber || `Trip #${row.trip?.id || '—'}`}
        </button>
      ),
    },
    {
      key: 'route',
      header: 'Route',
      render: (row) => {
        const req = row.trip?.request;
        return (
          <span>
            {req?.originName || row.trip?.originName || '—'} →{' '}
            {req?.destinationName || row.trip?.destinationName || '—'}
          </span>
        );
      },
    },
    {
      key: 'vehicle',
      header: 'Vehicle',
      render: (row) =>
        row.trip?.vehicle?.registrationNumber ||
        row.trip?.vehicle?.plateNumber ||
        '—',
    },
    {
      key: 'requested',
      header: 'Requested (L)',
      render: (row) => <strong>{row.litresRequested ?? '—'} L</strong>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'date',
      header: 'Date',
      render: (row) => formatDate(row.createdAt || row.date),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => {
        const status = String(row.status || '').toUpperCase();
        if (status === 'HPMU_RELEASED') {
          return (
            <button
              type="button"
              className="link-btn"
              onClick={() => openConfirmModal(row)}
              disabled={confirmLoading}
            >
              Confirm Receipt
            </button>
          );
        }
        return '—';
      },
    },
  ];

  const emergencyColumns = [
    {
      key: 'trip',
      header: 'Trip #',
      render: (row) => (
        <button
          type="button"
          className="link-btn"
          onClick={() => row.trip?.id && navigate(`/driver/route-map?tripId=${row.trip.id}`)}
        >
          {row.trip?.tripNumber || `Trip #${row.trip?.id || '—'}`}
        </button>
      ),
    },
    {
      key: 'location',
      header: 'Current Location',
      render: (row) => row.currentLocation || row.trip?.currentLocation || '—',
    },
    {
      key: 'vehicle',
      header: 'Vehicle',
      render: (row) =>
        row.trip?.vehicle?.registrationNumber ||
        row.trip?.vehicle?.plateNumber ||
        '—',
    },
    {
      key: 'requested',
      header: 'Requested (L)',
      render: (row) => <strong>{row.litresRequested ?? '—'} L</strong>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'date',
      header: 'Date',
      render: (row) => formatDate(row.createdAt || row.date),
    },
  ];

  if (loading) {
    return <Loading label="Loading fuel requests..." />;
  }

  return (
    <div className="driver-fuel-status-page">

      <div className="driver-hero">
        <div className="driver-hero-content">
          <span className="driver-eyebrow">DRIVER PORTAL</span>
          <h1>Fuel Requests</h1>
          <p>Track and manage your fuel requests for assigned trips.</p>
        </div>
      </div>

      {error && (
        <div className="driver-fuel-error">
          <strong>Error</strong>
          <span>{error}</span>
          <button type="button" onClick={loadData}>Retry</button>
        </div>
      )}

      <div className="driver-stats">
        <div className="driver-stat-card">
          <div className="driver-stat-icon blue">⛽</div>
          <div>
            <span>Total Requests</span>
            <strong>{summary.total}</strong>
          </div>
        </div>
        <div className="driver-stat-card">
          <div className="driver-stat-icon orange">⏳</div>
          <div>
            <span>Pending</span>
            <strong>{summary.pending}</strong>
          </div>
        </div>
        <div className="driver-stat-card">
          <div className="driver-stat-icon green">✅</div>
          <div>
            <span>Approved</span>
            <strong>{summary.approved}</strong>
          </div>
        </div>
        <div className="driver-stat-card">
          <div className="driver-stat-icon purple">⛽</div>
          <div>
            <span>Released</span>
            <strong>{summary.released}</strong>
          </div>
        </div>
      </div>

      <div className="driver-fuel-tabs">
        <button
          type="button"
          className={`driver-fuel-tab ${activeTab === 'normal' ? 'active' : ''}`}
          onClick={() => setActiveTab('normal')}
        >
          Normal Fuel Requests
        </button>
        <button
          type="button"
          className={`driver-fuel-tab ${activeTab === 'emergency' ? 'active' : ''}`}
          onClick={() => setActiveTab('emergency')}
        >
          Emergency Fuel Requests
        </button>
      </div>

      {activeTab === 'normal' && (
        <section className="driver-table-card">
          <div className="driver-card-header">
            <div>
              <span>NORMAL FUEL REQUESTS</span>
              <h2>Fuel Requests</h2>
            </div>
            <button
              type="button"
              className="driver-primary-btn"
              onClick={() => navigate('/driver/fuel-entries')}
            >
              My Fuel Entries
            </button>
            <button
              type="button"
              className="driver-primary-btn"
              onClick={() => navigate('/driver/fuel/new')}
            >
              + New Fuel Request
            </button>
          </div>

          <div className="driver-fuel-filters">
            <div className="driver-fuel-filter">
              <label className="field-label">Status</label>
              <select
                className="input"
                value={normalStatus}
                onChange={(e) => setNormalStatus(e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s === 'ALL' ? 'All Statuses' : s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="driver-fuel-filter">
              <label className="field-label">Date</label>
              <input
                type="date"
                className="input"
                value={normalDate}
                onChange={(e) => setNormalDate(e.target.value)}
              />
            </div>
          </div>

          <DataTable
            columns={normalColumns}
            rows={pagedNormal}
            emptyMessage="No normal fuel requests found."
          />

          <Pagination
            page={normalPage}
            limit={PAGE_SIZE}
            total={filteredNormal.length}
            onChange={setNormalPage}
          />
        </section>
      )}

      {activeTab === 'emergency' && (
        <section className="driver-table-card">
          <div className="driver-card-header">
            <div>
              <span>EMERGENCY FUEL REQUESTS</span>
              <h2>Additional Fuel Requests</h2>
            </div>
            <button
              type="button"
              className="driver-warning-btn"
              onClick={() => navigate('/driver/fuel/additional')}
            >
              + New Emergency Request
            </button>
          </div>

          <div className="driver-fuel-filters">
            <div className="driver-fuel-filter">
              <label className="field-label">Status</label>
              <select
                className="input"
                value={emergencyStatus}
                onChange={(e) => setEmergencyStatus(e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s === 'ALL' ? 'All Statuses' : s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="driver-fuel-filter">
              <label className="field-label">Date</label>
              <input
                type="date"
                className="input"
                value={emergencyDate}
                onChange={(e) => setEmergencyDate(e.target.value)}
              />
            </div>
          </div>

          <DataTable
            columns={emergencyColumns}
            rows={pagedEmergency}
            emptyMessage="No emergency fuel requests found."
          />

          <Pagination
            page={emergencyPage}
            limit={PAGE_SIZE}
            total={filteredEmergency.length}
            onChange={setEmergencyPage}
          />
        </section>
      )}

      <Modal
        open={modalOpen}
        title="Confirm Fuel Receipt"
        onClose={closeConfirmModal}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={closeConfirmModal}
              disabled={confirmLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmReceipt}
              disabled={confirmLoading}
            >
              {confirmLoading ? 'Confirming...' : 'Confirm Receipt'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {confirmError && (
            <div className="driver-fuel-error" style={{ marginBottom: 0 }}>
              <span>{confirmError}</span>
            </div>
          )}

          <div>
            <label className="field-label">Driver</label>
            <div className="input" style={{ background: 'var(--surface-2)', pointerEvents: 'none' }}>
              {modalItem?.driver?.fullName || modalItem?.trip?.driver?.fullName || '—'}
            </div>
          </div>

          <div>
            <label className="field-label">Vehicle</label>
            <div className="input" style={{ background: 'var(--surface-2)', pointerEvents: 'none' }}>
              {modalItem?.trip?.vehicle?.registrationNumber ||
                modalItem?.trip?.vehicle?.plateNumber ||
                '—'}
            </div>
          </div>

          <div>
            <label className="field-label">Litres Released by HPMU</label>
            <div className="input" style={{ background: 'var(--surface-2)', pointerEvents: 'none' }}>
              {modalItem?.litresReleased ? `${modalItem.litresReleased} L` : '—'}
            </div>
          </div>

          <div>
            <label className="field-label">Actual Litres Received *</label>
            <input
              className="input"
              type="number"
              min="0.1"
              step="0.1"
              value={actualLitres}
              onChange={(e) => setActualLitres(e.target.value)}
              placeholder="Enter actual litres you received"
              disabled={confirmLoading}
            />
          </div>

          <div>
            <label className="field-label">Notes (optional)</label>
            <textarea
              className="input"
              rows="3"
              value={confirmNotes}
              onChange={(e) => setConfirmNotes(e.target.value)}
              placeholder="Any notes about the fuel receipt..."
              disabled={confirmLoading}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
