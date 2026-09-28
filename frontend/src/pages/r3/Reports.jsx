import { useEffect, useState } from 'react';
import { requestsApi, fuelApi } from '../../services/resources';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Loading from '../../components/Loading';
import PrintReport from '../../components/PrintReport';
import Pagination from '../../components/Pagination';

const REPORT_TYPES = [
  { value: 'requests', label: 'Vehicle Requests Reviewed' },
  { value: 'fuel', label: 'Fuel Requests Reviewed' },
];

const LIMIT = 15;

function normalizeRows(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.rows)) return res.rows;
  if (Array.isArray(res?.results)) return res.results;
  return [];
}

function extractTotal(res) {
  if (typeof res?.total === 'number') return res.total;
  if (typeof res?.count === 'number') return res.count;
  return normalizeRows(res).length;
}

export default function R3Reports() {
  const [reportType, setReportType] = useState('requests');
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [date, setDate] = useState('');
  const [search, setSearch] = useState('');
  const [printing, setPrinting] = useState(false);

  const loadReport = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: LIMIT };
      if (date) {
        params.startDate = date;
        params.endDate = date;
      }
      if (search.trim()) params.search = search.trim();

      let response;
      if (reportType === 'requests') {
        response = await requestsApi.list(params);
      } else {
        response = await fuelApi.list(params);
      }

      setData(normalizeRows(response));
      setTotal(extractTotal(response));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report.');
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setPage(1); }, [reportType, date, search]);
  useEffect(() => { loadReport(); }, [reportType, page]);

  const handlePrint = () => {
    setPrinting(true);
  };

  const vehicleColumns = [
    { key: 'requestNumber', header: 'Request #', render: (r) => r.requestNumber || `REQ-${r.id}` },
    { key: 'officer', header: 'Officer', render: (r) => r.officer?.fullName || '—' },
    { key: 'route', header: 'Route', render: (r) => `${r.originName || '—'} → ${r.destinationName || '—'}` },
    { key: 'departureDate', header: 'Departure', render: (r) => r.departureDate || '—' },
    { key: 'vehicle', header: 'Vehicle', render: (r) => r.vehicle?.registrationNumber || '—' },
    { key: 'driver', header: 'Driver', render: (r) => r.driver?.user?.fullName || '—' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'r3Decision', header: 'Decision', render: (r) => r.r3Approvals?.[0]?.decision || '—' },
    { key: 'date', header: 'Date', render: (r) => r.r3Approvals?.[0]?.createdAt ? new Date(r.r3Approvals[0].createdAt).toLocaleDateString() : '—' },
  ];

  const fuelColumns = [
    { key: 'trip', header: 'Trip', render: (r) => r.trip?.tripNumber || '—' },
    { key: 'driver', header: 'Driver', render: (r) => r.driver?.user?.fullName || '—' },
    { key: 'vehicle', header: 'Vehicle', render: (r) => r.vehicle?.registrationNumber || '—' },
    { key: 'litresRequested', header: 'Requested (L)', render: (r) => r.litresRequested ?? '—' },
    { key: 'litresReleased', header: 'Released (L)', render: (r) => r.litresReleased ?? '—' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'date', header: 'Date', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—' },
  ];

  const columns = reportType === 'requests' ? vehicleColumns : fuelColumns;

  const getTotals = () => {
    if (reportType === 'requests') {
      const byStatus = data.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
      return { Total: data.length, ...byStatus };
    }
    const totalRequested = data.reduce((sum, r) => sum + (r.litresRequested || 0), 0);
    const totalReleased = data.reduce((sum, r) => sum + (r.litresReleased || 0), 0);
    return { Total: data.length, 'Total Requested (L)': totalRequested.toFixed(1), 'Total Released (L)': totalReleased.toFixed(1) };
  };

  const reportTitle = REPORT_TYPES.find((t) => t.value === reportType)?.label || 'Report';

  return (
    <div className="r3-reports-page">
      <div className="report-header">
        <div>
          <span className="eyebrow">R3 PORTAL</span>
          <h1>Reports</h1>
        </div>
        <button className="btn btn-primary no-print" onClick={handlePrint}>
          Print Report
        </button>
      </div>

      <div className="report-filters no-print">
        <select className="input" value={reportType} onChange={(e) => setReportType(e.target.value)}>
          {REPORT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input className="input" type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="btn btn-ghost" onClick={() => { setDate(''); setSearch(''); setPage(1); }}>Clear</button>
      </div>

      {error && <div className="callout callout-error">{error}</div>}

      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="report-table">
            <DataTable columns={columns} rows={data} emptyMessage="No data found." />
          </div>

          <div className="report-totals">
            {Object.entries(getTotals()).map(([key, val]) => (
              <div key={key} className="total-item">
                <span className="total-label">{key}</span>
                <span className="total-value">{val}</span>
              </div>
            ))}
          </div>

          <Pagination page={page} limit={LIMIT} total={total} onChange={setPage} />
        </>
      )}

      {printing && (
        <PrintReport
          title={reportTitle}
          subtitle={date ? `Date: ${date}` : 'All Dates'}
          user={{ fullName: 'R3 Approver', role: 'R3' }}
          filters={{ date, search }}
          columns={columns}
          data={data}
          totals={getTotals()}
          onPrint={true}
          onPrinted={() => setPrinting(false)}
        />
      )}
    </div>
  );
}
