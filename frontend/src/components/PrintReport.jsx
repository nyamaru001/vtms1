
import { useEffect, useState } from 'react';

export default function PrintReport({
  title,
  subtitle,
  user,
  filters,
  columns = [],
  data = [],
  totals,
  footer,
  onPrint,
  onPrinted,
}) {
  const [printData, setPrintData] = useState(data || []);

  useEffect(() => {
    setPrintData(data || []);
  }, [data]);

  useEffect(() => {
    if (!onPrint) return undefined;

    let cancelled = false;

    const fire = () => {
      if (cancelled) return;
      // Wait until after paint so the sheet is in the DOM before print().
      window.print();
      if (typeof onPrinted === 'function') onPrinted();
    };

    const raf = requestAnimationFrame(() => {
      setTimeout(fire, 80);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPrint]);

  const renderCellValue = (row, column) => {
    if (typeof column.render === 'function') {
      return column.render(row);
    }

    const value = row?.[column.key];

    return value !== undefined &&
      value !== null &&
      value !== ''
      ? value
      : '—';
  };

  const renderTable = () => {
    if (!printData || printData.length === 0) {
      return (
        <div className="print-empty">
          No data to display
        </div>
      );
    }

    return (
      <table className="print-table">
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th
                key={column.key || index}
                style={{
                  width: column.width || 'auto',
                  textAlign: column.align || 'left',
                }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {printData.map((row, rowIndex) => (
            <tr key={row.id || rowIndex}>
              {columns.map((column, columnIndex) => (
                <td
                  key={column.key || columnIndex}
                  style={{
                    textAlign: column.align || 'left',
                  }}
                >
                  {renderCellValue(row, column)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="print-sheet">
      {/* ================= HEADER ================= */}
      <div className="print-header">
        <h2>
          Vehicle &amp; Transport Management System
        </h2>

        {title && <h3>{title}</h3>}

        {subtitle && (
          <p className="print-sub">
            {subtitle}
          </p>
        )}

        <div className="print-meta">
          <span>
            Generated:{' '}
            {new Date().toLocaleString()}
          </span>

          <span>
            User:{' '}
            {user?.fullName ||
              user?.username ||
              '—'}
          </span>

          <span>
            Role:{' '}
            {user?.role || '—'}
          </span>
        </div>

        {/* ================= FILTERS ================= */}
        {filters &&
          Object.keys(filters).length > 0 && (
            <div className="print-filters">
              <strong>Filters:</strong>

              {Object.entries(filters).map(
                ([key, value]) => {
                  if (
                    value === undefined ||
                    value === null ||
                    value === ''
                  ) {
                    return null;
                  }

                  return (
                    <span
                      key={key}
                      className="filter-tag"
                    >
                      {key}: {String(value)}
                    </span>
                  );
                }
              )}
            </div>
          )}
      </div>

      {/* ================= TABLE ================= */}
      {renderTable()}

      {/* ================= TOTALS ================= */}
      {totals &&
        Object.keys(totals).length > 0 && (
          <div className="print-totals">
            {Object.entries(totals).map(
              ([key, value]) => (
                <div
                  key={key}
                  className="total-item"
                >
                  <span>{key}:</span>

                  <strong>
                    {value}
                  </strong>
                </div>
              )
            )}
          </div>
        )}

      {/* ================= FOOTER ================= */}
      {footer && (
        <div className="print-footer">
          {footer}
        </div>
      )}

      {/* ================= SIGNATURES ================= */}
      <div className="print-signature">
        <div className="signature-block">
          <div className="signature-line" />
          <span>Prepared By</span>
        </div>

        <div className="signature-block">
          <div className="signature-line" />
          <span>Verified By</span>
        </div>
      </div>
    </div>
  );
}
