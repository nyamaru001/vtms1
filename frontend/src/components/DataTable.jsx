export default function DataTable({ columns, rows, emptyMessage = 'No records found.' }) {
  if (!rows || rows.length === 0) {
    return <div className="empty-state">{emptyMessage}</div>;
  }
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? i}>
              {columns.map((c) => <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
