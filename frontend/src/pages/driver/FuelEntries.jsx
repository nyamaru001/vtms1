import { useEffect, useState } from 'react';
import { driverFuelApi } from '../../services/resources';
import Loading from '../../components/Loading';
import Pagination from '../../components/Pagination';

export default function DriverFuelEntries() {
  const [entries, setEntries] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ tripId: '', stationName: '', litres: '', amount: '', entryDate: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await driverFuelApi.list({ page, limit: 10 });
      setEntries(res.data || res || []);
      setMeta({ page: res.page || 1, limit: res.limit || 10, total: res.total || 0 });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load fuel entries.');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    if (!form.tripId || !form.litres) {
      setError('Trip ID and litres are required.');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('tripId', form.tripId);
      fd.append('litres', form.litres);
      if (form.stationName) fd.append('stationName', form.stationName);
      if (form.amount) fd.append('amount', form.amount);
      if (form.entryDate) fd.append('entryDate', form.entryDate);
      if (form.notes) fd.append('notes', form.notes);
      if (file) fd.append('receipt', file);
      await driverFuelApi.create(fd);
      setMsg('Fuel entry saved.');
      setForm({ tripId: '', stationName: '', litres: '', amount: '', entryDate: '', notes: '' });
      setFile(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save fuel entry.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await driverFuelApi.remove(id);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete entry.');
    }
  };

  if (loading && !entries.length && !msg) return <Loading />;

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">MY FUEL ENTRIES</span>
            <h3>Fuel List & Receipts</h3>
            <p className="field-hint">Upload fuel purchases with receipts for verification.</p>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}
        {msg && <div className="callout callout-success" data-testid="fuel-entry-msg">{msg}</div>}

        <form onSubmit={submit} className="form-grid" data-testid="fuel-entry-form">
          <div>
            <label className="field-label">Trip ID *</label>
            <input className="input" type="number" value={form.tripId} onChange={(e) => setForm({ ...form, tripId: e.target.value })} required />
          </div>
          <div>
            <label className="field-label">Station</label>
            <input className="input" value={form.stationName} onChange={(e) => setForm({ ...form, stationName: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Litres *</label>
            <input className="input" type="number" step="0.1" value={form.litres} onChange={(e) => setForm({ ...form, litres: e.target.value })} required />
          </div>
          <div>
            <label className="field-label">Amount</label>
            <input className="input" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Entry Date</label>
            <input className="input" type="date" value={form.entryDate} onChange={(e) => setForm({ ...form, entryDate: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Receipt (PDF/Image)</label>
            <input className="input" type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div className="form-grid-full">
            <label className="field-label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="form-grid-full">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save Fuel Entry'}
            </button>
          </div>
        </form>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h3>Entries</h3>
        </div>
        {!entries.length ? (
          <div className="empty-state">No fuel entries yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Trip</th><th>Station</th><th>Litres</th><th>Amount</th><th>Receipt</th><th></th></tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} data-testid="fuel-entry-row">
                  <td>{e.entryDate ? String(e.entryDate).slice(0, 10) : '—'}</td>
                  <td>{e.tripId}</td>
                  <td>{e.stationName || '—'}</td>
                  <td>{e.litres}</td>
                  <td>{e.amount ?? '—'}</td>
                  <td>{e.receiptPath ? <a href={`/uploads/fuel/${e.receiptPath}`} target="_blank" rel="noreferrer">View</a> : '—'}</td>
                  <td><button className="btn btn-ghost" onClick={() => remove(e.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination meta={meta} onPageChange={setPage} />
      </div>
    </div>
  );
}
