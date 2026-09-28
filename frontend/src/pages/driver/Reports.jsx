import { useEffect, useState } from 'react';
import { tripsApi, fuelApi, logbooksApi } from '../../services/resources';
import DataTable from '../../components/DataTable';
import Loading from '../../components/Loading';
import PrintReport from '../../components/PrintReport';

export default function DriverReports() {
  const [reportType, setReportType] = useState('trips');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [date, setDate] = useState('');
  const [search, setSearch] = useState('');
  const [printing, setPrinting] = useState(false);

  const reportTypes = [
    { value: 'trips', label: 'My Trips' },
    { value: 'fuel', label: 'My Fuel Requests' },
    { value: 'logbooks', label: 'My Logbooks' },
  ];

  const loadReport = async () => {
    setLoading(true);
    setError('');
    try {
      let result = [];
      const params = {};
      if (date) { params.startDate = date; params.endDate = date; }
      if (search.trim()) params.search = search.trim();

      if (reportType === 'trips') {
        const response = await tripsApi.list(params);
        result = Array.isArray(response) ? response : response?.data || [];
      } else if (reportType === 'fuel') {
        const response = await fuelApi.list(params);
        result = Array.isArray(response) ? response : response?.data || [];
      } else if (reportType === 'logbooks') {
        const response = await logbooksApi.list(params);
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
    if (reportType === 'trips') {
      return [
        { key: 'tripNumber', header: 'Trip #', render: (r) => r.tripNumber },
        { key: 'route', header: 'Route', render: (r) => `${r.request?.originName} → ${r.request?.destinationName}` },
        { key: 'vehicle', header: 'Vehicle', render: (r) => r.vehicle?.registrationNumber || '—' },
        { key: 'status', header: 'Status', render: (r) => r.status },
        { key: 'totalOdometerKm', header: 'Distance (KM)', render: (r) => r.totalOdometerKm || '—' },
        { key: 'createdAt', header: 'Date', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—' },
      ];
    } else if (reportType === 'fuel') {
      return [
        { key: 'trip', header: 'Trip', render: (r) => r.trip?.tripNumber || '—' },
        { key: 'vehicle', header: 'Vehicle', render: (r) => r.vehicle?.registrationNumber || '—' },
        { key: 'litresRequested', header: 'Requested (L)', render: (r) => r.litresRequested },
        { key: 'litresReleased', header: 'Released (L)', render: (r) => r.litresReleased || '—' },
        { key: 'status', header: 'Status', render: (r) => r.status },
        { key: 'createdAt', header: 'Date', render: (r) => new Date(r.createdAt).toLocaleDateString() },
      ];
    } else {
      return [
        { key: 'trip', header: 'Trip', render: (r) => r.trip?.tripNumber || '—' },
        { key: 'vehicle', header: 'Vehicle', render: (r) => r.vehicle?.registrationNumber || '—' },
        { key: 'totalKm', header: 'Total KM', render: (r) => r.totalKm },
        { key: 'fuelUsedLitres', header: 'Fuel Used (L)', render: (r) => r.fuelUsedLitres || '—' },
        { key: 'status', header: 'Status', render: (r) => r.status },
        { key: 'entryDate', header: 'Date', render: (r) => r.entryDate },
      ];
    }
  };

  const getTotals = () => {
    if (reportType === 'trips') {
      const totalKm = data.reduce((sum, r) => sum + (r.totalOdometerKm || 0), 0);
      return { Total: data.length, 'Total KM': totalKm.toFixed(1) };
    } else if (reportType === 'fuel') {
      const totalRequested = data.reduce((sum, r) => sum + (r.litresRequested || 0), 0);
      const totalReleased = data.reduce((sum, r) => sum + (r.litresReleased || 0), 0);
      return { Total: data.length, 'Total Requested (L)': totalRequested.toFixed(1), 'Total Released (L)': totalReleased.toFixed(1) };
    } else {
      const totalKm = data.reduce((sum, r) => sum + (r.totalKm || 0), 0);
      const totalFuel = data.reduce((sum, r) => sum + (r.fuelUsedLitres || 0), 0);
      return { Total: data.length, 'Total KM': totalKm.toFixed(1), 'Total Fuel Used (L)': totalFuel.toFixed(1) };
    }
  };

  const reportTitle = reportTypes.find(t => t.value === reportType)?.label || 'Report';

  return (
    <div className="driver-reports-page">
      <div className="report-header">
        <div>
          <span className="eyebrow">DRIVER PORTAL</span>
          <h1>Reports</h1>
          <p>View and print reports for your trips, fuel requests, and logbooks.</p>
        </div>
        <button className="btn btn-primary no-print" onClick={handlePrint}>
          Print Report
        </button>
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
          user={{ fullName: 'Driver', role: 'DRIVER' }}
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
