export default function Pagination({ page, limit, total, onChange }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) return null;

  return (
    <div className="pagination">
      <button className="btn btn-ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>Prev</button>
      <span>Page {page} of {totalPages}</span>
      <button className="btn btn-ghost" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</button>
    </div>
  );
}
