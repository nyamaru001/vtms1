import { useEffect, useState } from 'react';
import { requestsApi, tripsApi, fuelApi } from '../../services/resources';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Loading from '../../components/Loading';
import PrintReport from '../../components/PrintReport';
import Pagination from '../../components/Pagination';

export default function OfficerReports() {
  const [reportType, setReportType] = useState('requests');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [printing, setPrinting] = useState(false);
  const [date, setDate] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const limit = 10;

  const reportTypes = [
    { value: 'requests', label: 'Vehicle Requests' },
    { value: 'trips', label: 'Trips' },
    { value: 'fuel', label: 'Fuel Requests' },
  ];

  const statusButtons = [
    '', 'PENDING', 'R3_REVIEW', 'R3_APPROVED', 'TRANSPORT_REVIEW', 'DRIVER_ASSIGNED',
    'TRIP_STARTED', 'TRIP_COMPLETED', 'CLOSED', 'CANCELLED'
  ];

  const loadReport = async () => {
    setLoading(true);
    setError('');
    try {
      let result = [];
      let totalCount = 0;
      const params = { page, limit };
      if (date) { params.startDate = date; params.endDate = date; }
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;

      if (reportType === 'requests') {
        const response = await requestsApi.list(params);
        result = Array.isArray(response) ? response : response?.data || [];
        totalCount = response?.total || result.length;
      } else if (reportType === 'trips') {
        const response = await tripsApi.list(params);
        result = Array.isArray(response) ? response : response?.data || [];
        totalCount = response?.total || result.length;
      } else if (reportType === 'fuel') {
        const response = await fuelApi.list(params);
        result = Array.isArray(response) ? response : response?.data || [];
        totalCount = response?.total || result.length;
      }
      setData(result);
      setTotal(totalCount);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report.');
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setPage(1); }, [reportType, date, statusFilter, search]);
  useEffect(() => { loadReport(); }, [reportType, page]);

  const handlePrint = () => {
    setPrinting(true);
  };

  const columns = {
    requests: [
      { key: 'requestNumber', header: 'Request #', render: (r) => r.requestNumber || `REQ-${r.id}` },
      { key: 'route', header: 'Route', render: (r) => `${r.originName || '—'} → ${r.destinationName || '—'}` },
      { key: 'departureDate', header: 'Departure', render: (r) => r.departureDate || '—' },
      { key: 'vehicle', header: 'Vehicle', render: (r) => r.vehicle?.registrationNumber || '—' },
      { key: 'driver', header: 'Driver', render: (r) => r.driver?.user?.fullName || r.driver?.name || '—' },
      { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      { key: 'createdAt', header: 'Date', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—' },
    ],
    trips: [
      { key: 'tripNumber', header: 'Trip #', render: (r) => r.tripNumber || `TRIP-${r.id}` },
      { key: 'route', header: 'Route', render: (r) => `${r.request?.originName || '—'} → ${r.request?.destinationName || '—'}` },
      { key: 'vehicle', header: 'Vehicle', render: (r) => r.vehicle?.registrationNumber || '—' },
      { key: 'driver', header: 'Driver', render: (r) => r.driver?.user?.fullName || r.driver?.name || '—' },
      { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      { key: 'createdAt', header: 'Date', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—' },
    ],
    fuel: [
      { key: 'trip', header: 'Trip', render: (r) => r.trip?.tripNumber || '—' },
      { key: 'driver', header: 'Driver', render: (r) => r.driver?.user?.fullName || r.driver?.name || '—' },
      { key: 'vehicle', header: 'Vehicle', render: (r) => r.vehicle?.registrationNumber || '—' },
      { key: 'litresRequested', header: 'Requested (L)', render: (r) => r.litresRequested ?? '—' },
      { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      { key: 'createdAt', header: 'Date', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—' },
    ],
  };

  const totals = (() => {
    if (reportType === 'requests') {
      const byStatus = data.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
      return { Total: data.length, ...byStatus };
    } else if (reportType === 'trips') {
      const totalKm = data.reduce((sum, r) => sum + (r.totalOdometerKm || 0), 0);
      return { Total: data.length, 'Total KM': totalKm.toFixed(1) };
    } else {
      const totalReq = data.reduce((sum, r) => sum + (r.litresRequested || 0), 0);
      return { Total: data.length, 'Total Requested (L)': totalReq.toFixed(1) };
    }
  })();

  const reportTitle = reportTypes.find(t => t.value === reportType)?.label || 'Report';

  return (
    <div className="officer-reports-page">
      <div className="report-header">
        <div>
          <span className="eyebrow">OFFICER PORTAL</span>
          <h1>Reports</h1>
          <p>Generate and print reports for your requests, trips, and fuel.</p>
        </div>
        <button className="btn btn-primary no-print" onClick={handlePrint}>Print Report</button>
      </div>

      <div className="report-tabs no-print">
        {reportTypes.map(t => (
          <button key={t.value} className={`tab ${reportType === t.value ? 'active' : ''}`} onClick={() => { setReportType(t.value); setPage(1); }}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="report-filters no-print">
        <input className="input" type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="status-buttons">
          {statusButtons.map(s => (
            <button
              key={s}
              className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStatusFilter(s)}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost" onClick={() => { setDate(''); setSearch(''); setStatusFilter(''); setPage(1); }}>Clear</button>
      </div>

      {error && <div className="callout callout-error">{error}</div>}

      {loading ? <Loading /> : (
        <>
          <div className="report-totals">
            {Object.entries(totals).map(([k, v]) => (
              <span key={k}><strong>{v}</strong> {k}</span>
            ))}
          </div>
          <div className="report-table">
            <DataTable columns={columns[reportType]} rows={data} emptyMessage="No data found." />
          </div>
          {total > 0 && <Pagination page={page} limit={limit} total={total} onChange={setPage} />}
        </>
      )}

      {printing && (
        <PrintReport
          title={reportTitle}
          subtitle={date ? `Date: ${date}` : 'All Dates'}
          user={{ fullName: 'Officer', role: 'OFFICER' }}
          filters={{ date, search, status: statusFilter }}
          columns={columns[reportType]}
          data={data}
          totals={totals}
          onPrint={true}
          onPrinted={() => setPrinting(false)}
        />
      )}
    </div>
  );
}
