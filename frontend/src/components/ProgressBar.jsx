export default function ProgressBar({
  percent = 0,
  completedKm,
  remainingKm,
  totalKm,
}) {
  const numericPercent = Number(percent);

  const clamped = Number.isFinite(numericPercent)
    ? Math.max(0, Math.min(100, numericPercent))
    : 0;

  const formatKm = (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
      return null;
    }

    return number < 10
      ? number.toFixed(2)
      : number.toFixed(1);
  };

  const completed = formatKm(completedKm);
  const remaining = formatKm(remainingKm);
  const total = formatKm(totalKm);

  return (
    <div className="progress-wrap">
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{
            width: `${clamped}%`,
          }}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="Trip progress"
        />
      </div>

      <div className="progress-meta">
        <span>
          {completed !== null
            ? `${completed} KM completed`
            : '0 KM completed'}
        </span>

        <span className="progress-percent">
          {Math.round(clamped)}%
        </span>

        <span>
          {remaining !== null
            ? `${remaining} KM remaining`
            : '0 KM remaining'}
        </span>
      </div>

      {total !== null && (
        <div className="field-hint">
          Total route: {total} KM
        </div>
      )}
    </div>
  );
}