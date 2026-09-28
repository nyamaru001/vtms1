import { useEffect, useState } from 'react';
import { timelineApi } from '../services/resources';
import StatusBadge from './StatusBadge';
import ActivityHistory, { formatActivityTime, roleBadgeClass } from './ActivityHistory';

const ACTION_LABELS = {
  CREATE_REQUEST: 'Vehicle Request Submitted',
  ASSIGN_VEHICLE_DRIVER: 'Vehicle & Driver Assigned',
  DRIVER_ACCEPTED_ASSIGNMENT: 'Driver Accepted Assignment',
  DRIVER_REJECTED_ASSIGNMENT: 'Driver Assignment Rejected',
  TRIP_STARTED: 'Trip Started',
  COMPLETION_CONFIRMED: 'Completion Confirmed',
  TRIP_COMPLETED: 'Trip Completed',
  LOGBOOK_SUBMITTED: 'Logbook Submitted',
  LOGBOOK_APPROVED: 'Logbook Verified',
  LOGBOOK_RETURNED: 'Logbook Returned',
  FUEL_LIST_ENTRY_ADDED: 'Fuel List Entry Added',
  R3_APPROVE: 'Request Approved',
  R3_REJECT: 'Request Rejected',
  R3_RETURN: 'Request Returned',
  REQUEST_CANCELLED: 'Request Cancelled',
};

function stepLabel(step) {
  return ACTION_LABELS[step.action] || step.label || step.status || 'Activity';
}

export default function RequestTimeline({ requestId, status }) {
  const [timeline, setTimeline] = useState(null);
  const [tab, setTab] = useState('timeline');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!requestId) return;
    timelineApi
      .get(requestId)
      .then((tl) => {
        setTimeline(Array.isArray(tl) ? tl : tl?.steps || []);
      })
      .catch((e) => {
        setError(e.response?.data?.message || 'Failed to load timeline.');
        setTimeline([]);
      });
  }, [requestId]);

  if (error && tab === 'timeline') return <div className="form-error">{error}</div>;

  return (
    <div className="panel" data-testid="request-timeline">
      <div className="panel-header">
        <h3>Request Timeline</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn ${tab === 'timeline' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab('timeline')}
          >
            Workflow
          </button>
          <button
            className={`btn ${tab === 'history' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab('history')}
            data-testid="activity-history-tab"
          >
            Activity History
          </button>
        </div>
      </div>

      {tab === 'timeline' && (
        <ol className="activity-history" data-testid="timeline-list">
          {(timeline || []).map((step, idx) => {
            const time = formatActivityTime(step.at);
            const isCurrent = Boolean(step.current);

            return (
              <li
                key={step.key ?? idx}
                className={`activity-item tone-${isCurrent ? 'info' : step.pending ? 'warning' : 'neutral'}${isCurrent ? ' is-current' : ''}`}
                data-testid="timeline-step"
              >
                <div className="activity-icon" aria-hidden="true">
                  {isCurrent ? '\u25CF' : step.pending ? '!' : '\u2022'}
                </div>

                <div className="activity-body">
                  <div className="activity-action">{stepLabel(step)}</div>

                  <div className="activity-meta">
                    {step.role && (
                      <span className={`activity-role-badge ${roleBadgeClass(step.role)}`}>
                        Role: {step.role}
                      </span>
                    )}
                    {time && <span className="activity-time">{time}</span>}
                    {isCurrent && status ? <StatusBadge status={status} /> : null}
                    {step.pending ? <span className="activity-pending">Pending</span> : null}
                  </div>

                  {step.actor && <div className="activity-actor">{step.actor}</div>}

                  {step.comment && (
                    <p className="activity-comment">
                      <span className="activity-comment-label">Comment:</span> {step.comment}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
          {timeline && !timeline.length && (
            <li className="activity-empty">No timeline steps yet.</li>
          )}
          {!timeline && <li className="field-hint">Loading&hellip;</li>}
        </ol>
      )}

      {tab === 'history' && (
        <ActivityHistory requestId={requestId} />
      )}
    </div>
  );
}
