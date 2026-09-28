import { useEffect, useState } from 'react';
import { auditApi } from '../../services/resources';
import DataTable from '../../components/DataTable';
import Loading from '../../components/Loading';
import Pagination from '../../components/Pagination';

export default function AdminAudit() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState('');
  const [action, setAction] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {
        page,
        limit: 50,
        userId: userId || undefined,
        action: action || undefined,
      };
      if (date) { params.startDate = date; params.endDate = date; }
      const response = await auditApi.list(params);
      setData(response);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      setError(err.response?.data?.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, [page, userId, action, date]);

  if (loading && !data) return <Loading />;

  const rows = Array.isArray(data?.data) ? data.data : [];

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Audit Logs</h3>
      </div>

      <div className="filters-row">
        <input
          className="input"
          placeholder="User ID"
          value={userId}
          onChange={(e) => { setUserId(e.target.value); setPage(1); }}
        />
        <input
          className="input"
          placeholder="Action (e.g. CREATE_REQUEST, LOGIN...)"
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
        />
        <input
          className="input"
          type="date"
          value={date}
          onChange={(e) => { setDate(e.target.value); setPage(1); }}
        />
        <button className="btn btn-ghost" onClick={() => { setUserId(''); setAction(''); setDate(''); setPage(1); }}>
          Clear
        </button>
      </div>

      {error && <div className="callout callout-error">{error}</div>}

      <DataTable
        columns={[
          { key: 'id', header: 'ID', render: (a) => a.id },
          { key: 'createdAt', header: 'Timestamp', render: (a) => new Date(a.createdAt).toLocaleString() },
          { key: 'user', header: 'User', render: (a) => a.user ? `${a.user.fullName} (${a.user.username}) [${a.user.role}]` : 'System' },
          { key: 'action', header: 'Action', render: (a) => <code>{a.action}</code> },
          { key: 'entity', header: 'Entity', render: (a) => a.entity || '—' },
          { key: 'entityId', header: 'Entity ID', render: (a) => a.entityId || '—' },
          { key: 'description', header: 'Description', render: (a) => a.description || '—' },
          { key: 'ipAddress', header: 'IP Address', render: (a) => a.ipAddress || '—' },
        ]}
        rows={rows}
        emptyMessage="No audit logs found."
      />

      {data && (
        <Pagination
          page={data.page || page}
          limit={data.limit || 50}
          total={data.total || 0}
          onChange={setPage}
        />
      )}
    </div>
  );
}
