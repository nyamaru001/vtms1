import { useEffect, useState } from 'react';
import { requestsApi, fuelApi } from '../../services/resources';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Loading from '../../components/Loading';
import PrintReport from '../../components/PrintReport';
import api from '../../services/api';

export default function HPMUReports() {
  const [reportType, setReportType] = useState('vehicle-fuel');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [date, setDate] = useState('');
  const [search, setSearch] = useState('');
  const [printing, setPrinting] = useState(false);

  const reportTypes = [
    { value: 'vehicle-fuel', label: 'Vehicle Fuel Reviews' },
    { value: 'fuel', label: 'Fuel Requests' },
  ];

  const loadReport = async () => {
    setLoading(true);
    setError('');
    try {
      let result = [];
      const params = {};
      if (date) { params.startDate = date; params.endDate = date; }
      if (search.trim()) params.search = search.trim();

      if (reportType === 'vehicle-fuel') {
        const response = await requestsApi.list({ ...params, status: ['HPMU_REVIEW', 'HPMU_APPROVED', 'HPMU_REJECTED', 'HPMU_RETURNED', 'HPMU_RELEASED', 'DRIVER_CONFIRMED'] });
        result = Array.isArray(response) ? response : response?.data || [];
      } else if (reportType === 'fuel') {
        const response = await fuelApi.list(params);
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

  const handlePrint = async () => {
    // Ensure the on-screen data is current before printing.
    if (!loading) {
      await loadReport();
    }
    setPrinting(true);
  };

  const getColumns = () => {
    if (reportType === 'vehicle-fuel') {
      return [
        { key: 'requestNumber', header: 'Request #', render: (r) => r.requestNumber },
        { key: 'officer', header: 'Officer', render: (r) => r.officer?.fullName || '—' },
        { key: 'route', header: 'Route', render: (r) => `${r.originName} → ${r.destinationName}` },
        { key: 'departureDate', header: 'Departure', render: (r) => r.departureDate },
        { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        { key: 'vehicle', header: 'Vehicle', render: (r) => r.vehicle?.registrationNumber || '—' },
        { key: 'driver', header: 'Driver', render: (r) => r.driver?.user?.fullName || '—' },
        { key: 'totalFuelLitres', header: 'Total Fuel (L)', render: (r) => r.totalFuelLitres || '—' },
      ];
    } else {
      return [
        { key: 'trip', header: 'Trip', render: (r) => r.trip?.tripNumber || '—' },
        { key: 'driver', header: 'Driver', render: (r) => r.driver?.user?.fullName || '—' },
        { key: 'vehicle', header: 'Vehicle', render: (r) => r.vehicle?.registrationNumber || '—' },
        { key: 'litresRequested', header: 'Requested (L)', render: (r) => r.litresRequested },
        { key: 'litresReleased', header: 'Released (L)', render: (r) => r.litresReleased || '—' },
        { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        { key: 'createdAt', header: 'Date', render: (r) => new Date(r.createdAt).toLocaleDateString() },
      ];
    }
  };

  const getTotals = () => {
    if (reportType === 'vehicle-fuel') {
      const byStatus = data.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
      return { Total: data.length, ...byStatus };
    } else {
      const totalRequested = data.reduce((sum, r) => sum + (r.litresRequested || 0), 0);
      const totalReleased = data.reduce((sum, r) => sum + (r.litresReleased || 0), 0);
      return { Total: data.length, 'Total Requested (L)': totalRequested.toFixed(1), 'Total Released (L)': totalReleased.toFixed(1) };
    }
  };

  const reportTitle = reportTypes.find(t => t.value === reportType)?.label || 'Report';

  return (
    <div className="hpmu-reports-page">
      <div className="report-header">
        <div>
          <span className="eyebrow">HPMU PORTAL</span>
          <h1>Reports</h1>
          <p>View and print reports for fuel reviews and releases.</p>
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
          user={{ fullName: 'HPMU Staff', role: 'HPMU' }}
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
