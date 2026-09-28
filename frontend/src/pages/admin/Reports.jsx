import { useEffect, useState } from 'react';
import { requestsApi, tripsApi, fuelApi, reportsApi, usersApi, vehiclesApi, driversApi, adminApi } from '../../services/resources';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Loading from '../../components/Loading';
import PrintReport from '../../components/PrintReport';

export default function AdminReports() {
  const [reportType, setReportType] = useState('overview');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [date, setDate] = useState('');
  const [search, setSearch] = useState('');
  const [printing, setPrinting] = useState(false);

  const reportTypes = [
    { value: 'overview', label: 'System Overview' },
    { value: 'requests', label: 'All Requests' },
    { value: 'trips', label: 'All Trips' },
    { value: 'fuel', label: 'All Fuel' },
    { value: 'users', label: 'Users' },
    { value: 'vehicles', label: 'Vehicles' },
  ];

  const loadReport = async () => {
    setLoading(true);
    setError('');
    try {
      let result = [];
      const params = {};
      if (date) { params.startDate = date; params.endDate = date; }
      if (search.trim()) params.search = search.trim();

      if (reportType === 'overview') {
        const [stats, drivers] = await Promise.all([
          adminApi.stats(),
          driversApi.list({ limit: 1 }),
        ]);
        result = [{
          totalUsers: stats?.totalUsers ?? 0,
          totalVehicles: stats?.totalVehicles ?? 0,
          totalDrivers: drivers?.total ?? 0,
          totalRequests: stats?.totalRequests ?? 0,
          totalTrips: stats?.totalTrips ?? 0,
          totalFuelRequests: stats?.pendingFuelRequests ?? 0,
        }];
      } else if (reportType === 'requests') {
        const response = await requestsApi.list(params);
        result = Array.isArray(response) ? response : response?.data || [];
      } else if (reportType === 'trips') {
        const response = await tripsApi.list(params);
        result = Array.isArray(response) ? response : response?.data || [];
      } else if (reportType === 'fuel') {
        const response = await fuelApi.list(params);
        result = Array.isArray(response) ? response : response?.data || [];
      } else if (reportType === 'users') {
        const response = await usersApi.list(params);
        result = Array.isArray(response) ? response : response?.data || [];
      } else if (reportType === 'vehicles') {
        const response = await vehiclesApi.list(params);
        result = Array.isArray(response) ? response : response?.data || [];
      }

      setData(result);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report.');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReport(); }, [reportType, date, search]);

  const handlePrint = () => {
    setPrinting(true);
  };

  const getColumns = () => {
    if (reportType === 'overview') {
      return [
        { key: 'totalUsers', header: 'Total Users' },
        { key: 'totalVehicles', header: 'Total Vehicles' },
        { key: 'totalDrivers', header: 'Total Drivers' },
        { key: 'totalRequests', header: 'Total Requests' },
        { key: 'totalTrips', header: 'Total Trips' },
        { key: 'totalFuelRequests', header: 'Total Fuel Requests' },
      ];
    } else if (reportType === 'requests') {
      return [
        { key: 'requestNumber', header: 'Request #', render: (r) => r.requestNumber || `REQ-${r.id}` },
        { key: 'officer', header: 'Officer', render: (r) => r.officer?.fullName || '—' },
        { key: 'route', header: 'Route', render: (r) => `${r.originName || '—'} → ${r.destinationName || '—'}` },
        { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        { key: 'createdAt', header: 'Date', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—' },
      ];
    } else if (reportType === 'trips') {
      return [
        { key: 'tripNumber', header: 'Trip #', render: (r) => r.tripNumber || `TRIP-${r.id}` },
        { key: 'route', header: 'Route', render: (r) => `${r.request?.originName || '—'} → ${r.request?.destinationName || '—'}` },
        { key: 'vehicle', header: 'Vehicle', render: (r) => r.vehicle?.registrationNumber || '—' },
        { key: 'driver', header: 'Driver', render: (r) => r.driver?.user?.fullName || '—' },
        { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        { key: 'createdAt', header: 'Date', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—' },
      ];
    } else if (reportType === 'fuel') {
      return [
        { key: 'trip', header: 'Trip', render: (r) => r.trip?.tripNumber || '—' },
        { key: 'driver', header: 'Driver', render: (r) => r.driver?.user?.fullName || '—' },
        { key: 'vehicle', header: 'Vehicle', render: (r) => r.vehicle?.registrationNumber || '—' },
        { key: 'litresRequested', header: 'Requested (L)', render: (r) => r.litresRequested },
        { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        { key: 'createdAt', header: 'Date', render: (r) => new Date(r.createdAt).toLocaleDateString() },
      ];
    } else if (reportType === 'users') {
      return [
        { key: 'username', header: 'Username' },
        { key: 'fullName', header: 'Full Name' },
        { key: 'role', header: 'Role' },
        { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ];
    } else {
      return [
        { key: 'registrationNumber', header: 'Registration' },
        { key: 'model', header: 'Model' },
        { key: 'type', header: 'Type' },
        { key: 'fuelType', header: 'Fuel' },
        { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ];
    }
  };

  const getTotals = () => {
    if (reportType === 'overview') return {};
    if (reportType === 'requests') {
      const byStatus = data.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
      return { Total: data.length, ...byStatus };
    }
    if (reportType === 'trips') {
      const totalKm = data.reduce((sum, r) => sum + (r.totalOdometerKm || 0), 0);
      return { Total: data.length, 'Total KM': totalKm.toFixed(1) };
    }
    if (reportType === 'fuel') {
      const totalRequested = data.reduce((sum, r) => sum + (r.litresRequested || 0), 0);
      return { Total: data.length, 'Total Requested (L)': totalRequested.toFixed(1) };
    }
    return { Total: data.length };
  };

  const reportTitle = reportTypes.find(t => t.value === reportType)?.label || 'Report';

  return (
    <div className="admin-reports-page">
      <div className="report-header">
        <div>
          <span className="eyebrow">ADMIN PORTAL</span>
          <h1>Reports</h1>
          <p>Generate and print system-wide reports.</p>
        </div>
        <button className="btn btn-primary no-print" onClick={handlePrint}>Print Report</button>
      </div>

      <div className="report-tabs no-print">
        {reportTypes.map(t => (
          <button key={t.value} className={`tab ${reportType === t.value ? 'active' : ''}`} onClick={() => setReportType(t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="report-filters no-print">
        <input className="input" type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn btn-ghost" onClick={() => { setDate(''); setSearch(''); }}>Clear</button>
      </div>

      {error && <div className="callout callout-error">{error}</div>}

      {loading ? <Loading /> : (
        <div className="report-table">
          <DataTable columns={getColumns()} rows={data} emptyMessage="No data found." />
        </div>
      )}

      <div className="report-totals">
        {Object.entries(getTotals()).map(([k, v]) => (
          <span key={k}><strong>{v}</strong> {k}</span>
        ))}
      </div>

      {printing && (
        <PrintReport
          title={reportTitle}
          subtitle={date ? `Date: ${date}` : 'All Dates'}
          user={{ fullName: 'Administrator', role: 'ADMIN' }}
          filters={{ date, search }}
          columns={getColumns()}
          data={data}
          totals={getTotals()}
          onPrint={true}
          onPrinted={() => setPrinting(false)}
        />
      )}
    </div>
  );
}
