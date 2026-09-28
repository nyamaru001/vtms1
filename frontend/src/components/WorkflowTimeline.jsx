const STEPS = [
  ['PENDING', 'Request submitted'],
  ['TRANSPORT_REVIEW', 'Transport review'],
  ['HPMU_REVIEW', 'HPMU review'],
  ['R3_REVIEW', 'R3 verification'],
  ['DRIVER_ASSIGNED', 'Vehicle & driver assigned'],
  ['TRIP_STARTED', 'Trip in progress'],
  ['TRIP_COMPLETED', 'Trip completed'],
  ['CLOSED', 'Closed'],
];

const ORDER = {
  PENDING: 0,
  TRANSPORT_REVIEW: 1,
  HPMU_REVIEW: 2,
  R3_REVIEW: 3,
  APPROVED: 4,
  DRIVER_ASSIGNED: 4,
  TRIP_STARTED: 5,
  TRIP_COMPLETED: 6,
  CLOSED: 7,
};

const STATUS_LABELS = {
  REJECTED: 'Request rejected',
  RETURNED: 'Request returned',
  CANCELLED: 'Request cancelled',
};

export default function WorkflowTimeline({ status }) {
  const normalizedStatus = String(status || 'PENDING').toUpperCase();

  const current = ORDER[normalizedStatus] ?? 0;

  const isTerminal =
    normalizedStatus === 'REJECTED' ||
    normalizedStatus === 'RETURNED' ||
    normalizedStatus === 'CANCELLED';

  return (
    <div className="workflow" role="list" aria-label="Request workflow">
      {STEPS.map(([key, label], index) => {
        const done = index < current;

        const active =
          key === normalizedStatus ||
          (normalizedStatus === 'APPROVED' &&
            key === 'DRIVER_ASSIGNED');

        const classes = [
          'workflow-step',
          done ? 'done' : '',
          active ? 'active' : '',
          isTerminal ? 'terminal-state' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <div
            className={classes}
            key={key}
            role="listitem"
          >
            <div className="workflow-dot">
              {done ? '✓' : index + 1}
            </div>

            <span className="workflow-label">
              {label}
            </span>
          </div>
        );
      })}

      {isTerminal && (
        <div
          className={`workflow-step workflow-terminal ${normalizedStatus.toLowerCase()}`}
          role="listitem"
        >
          <div className="workflow-dot">
            !
          </div>

          <span className="workflow-label">
            {STATUS_LABELS[normalizedStatus]}
          </span>
        </div>
      )}
    </div>
  );
}