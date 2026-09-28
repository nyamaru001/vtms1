import { useEffect, useState } from 'react';
import { auditApi } from '../../services/resources';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import Loading from '../../components/Loading';

export default function Audit() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');

  useEffect(() => { auditApi.list({ page, limit: 20, action: action || undefined }).then(setData); }, [page, action]);
  if (!data) return <Loading />;

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Audit Logs</h3>
        <input className="input select-inline" placeholder="Filter by action..." value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} />
      </div>

      <DataTable
        columns={[
          { key: 'createdAt', header: 'Time', render: (a) => new Date(a.createdAt).toLocaleString() },
          { key: 'user', header: 'User', render: (a) => a.user?.fullName || 'System' },
          { key: 'action', header: 'Action' },
          { key: 'entity', header: 'Entity', render: (a) => a.entity ? `${a.entity} #${a.entityId}` : '—' },
          { key: 'description', header: 'Description' },
          { key: 'ipAddress', header: 'IP' },
        ]}
        rows={data.data}
        emptyMessage="No audit entries yet."
      />
      <Pagination page={data.page} limit={data.limit} total={data.total} onChange={setPage} />
    </div>
  );
}
