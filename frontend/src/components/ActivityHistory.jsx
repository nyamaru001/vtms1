import { useEffect, useState } from 'react';
import { timelineApi } from '../services/resources';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/*
 * Real workflow actions recorded in request_activities / assignment_histories /
 * r3_approvals / hpmu_recommendations (see backend routes/requests.js).
 * Unknown actions fall back to a readable version of the stored action name.
 */
const ACTION_META = {
  CREATE_REQUEST: { label: 'Vehicle Request Submitted', tone: 'neutral' },
  ASSIGN_VEHICLE_DRIVER: { label: 'Vehicle & Driver Assigned', tone: 'info' },
  ASSIGNED: { label: 'Vehicle & Driver Assigned', tone: 'info' },
  REASSIGNED: { label: 'Driver Reassigned', tone: 'info' },
  REJECTED: { label: 'Assignment Rejected', tone: 'danger' },
  CANCELLED: { label: 'Assignment Cancelled', tone: 'danger' },
  APPROVE: { label: 'Request Approved', tone: 'success' },
  APPROVED: { label: 'Request Approved', tone: 'success' },
  REJECT: { label: 'Request Rejected', tone: 'danger' },
  RETURN: { label: 'Request Returned', tone: 'warning' },
  RETURNED: { label: 'Request Returned', tone: 'warning' },
  R3_APPROVE: { label: 'Request Approved', tone: 'success' },
  R3_REJECT: { label: 'Request Rejected', tone: 'danger' },
  R3_RETURN: { label: 'Request Returned', tone: 'warning' },
  DRIVER_ACCEPTED_ASSIGNMENT: { label: 'Driver Accepted Assignment', tone: 'success' },
  DRIVER_REJECTED_ASSIGNMENT: { label: 'Driver Assignment Rejected', tone: 'danger' },
  TRIP_STARTED: { label: 'Trip Started', tone: 'info' },
  COMPLETION_CONFIRMED: { label: 'Completion Confirmed', tone: 'info' },
  TRIP_COMPLETED: { label: 'Trip Completed', tone: 'success' },
  LOGBOOK_SUBMITTED: { label: 'Logbook Submitted', tone: 'neutral' },
  LOGBOOK_APPROVED: { label: 'Logbook Verified', tone: 'success' },
  LOGBOOK_RETURNED: { label: 'Logbook Returned', tone: 'warning' },
  FUEL_LIST_ENTRY_ADDED: { label: 'Fuel List Entry Added', tone: 'neutral' },
  REQUEST_CANCELLED: { label: 'Request Cancelled', tone: 'danger' },
};

const TONE_GLYPH = {
  success: '\u2713',
  danger: '\u2715',
  warning: '!',
  info: '\u2192',
  neutral: '\u2022',
};

function describeAction(item) {
  const meta = ACTION_META[item.action];
  if (meta) return meta;

  if (item.type === 'R3_DECISION') {
    return {
      label: `R3 ${String(item.action || '').toLowerCase()}`,
      tone: item.action === 'APPROVE' ? 'success' : item.action === 'REJECT' ? 'danger' : 'warning',
    };
  }

  if (item.type === 'HPMU_DECISION') {
    return {
      label: `HPMU ${String(item.action || '').toLowerCase()} (fuel review)`,
      tone: item.action === 'APPROVE' ? 'success' : item.action === 'REJECT' ? 'danger' : 'warning',
    };
  }

  const readable = String(item.action || 'Activity')
    .replace(/_/g, ' ')
    .toLowerCase();

  return { label: readable, tone: 'neutral' };
}

export function formatActivityTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day} ${month} ${year} \u2022 ${hours}:${minutes}`;
}

export function roleBadgeClass(role) {
  if (!role) return 'role-system';
  return `role-${String(role).toLowerCase().replace(/[^a-z]/g, '')}`;
}

export function ActivityItem({ item }) {
  const { label, tone } = describeAction(item);
  const role = item.role || null;

  return (
    <li className={`activity-item tone-${tone}`} data-testid="activity-item">
      <div className="activity-icon" aria-hidden="true">
        {TONE_GLYPH[tone] || TONE_GLYPH.neutral}
      </div>

      <div className="activity-body">
        <div className="activity-action">{label}</div>

        <div className="activity-meta">
          {role && (
            <span className={`activity-role-badge ${roleBadgeClass(role)}`}>
              Role: {role}
            </span>
          )}
          <span className="activity-time">{formatActivityTime(item.at)}</span>
        </div>

        {item.actor && (
          <div className="activity-actor">
            {item.actor}
            {item.driver && item.driver !== item.actor ? ` \u2022 driver: ${item.driver}` : ''}
          </div>
        )}

        {!item.actor && item.driver && (
          <div className="activity-actor">Driver: {item.driver}</div>
        )}

        {item.comment && (
          <p className="activity-comment">
            <span className="activity-comment-label">
              {tone === 'danger' ? 'Reason' : 'Comment'}:
            </span>{' '}
            {item.comment}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * Chronological, database-backed activity history for one vehicle request.
 * Fetches GET /api/requests/:id/activities (actor role comes from users.role).
 */
export default function ActivityHistory({
  requestId,
  activities: providedActivities,
  emptyMessage = 'No activity recorded yet.',
}) {
  const [items, setItems] = useState(Array.isArray(providedActivities) ? providedActivities : null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (Array.isArray(providedActivities)) {
      setItems(providedActivities);
      setError('');
      return undefined;
    }
    if (!requestId) return undefined;

    let active = true;
    setError('');

    timelineApi
      .activities(requestId)
      .then((response) => {
        if (!active) return;
        setItems(Array.isArray(response) ? response : response?.data || []);
      })
      .catch((err) => {
        if (!active) return;
        setItems([]);
        setError(err.response?.data?.message || 'Failed to load activity history.');
      });

    return () => {
      active = false;
    };
  }, [requestId, providedActivities]);

  if (error) {
    return <div className="form-error">{error}</div>;
  }

  if (items === null) {
    return <div className="field-hint">Loading activity history&hellip;</div>;
  }

  if (!items.length) {
    return <div className="activity-empty">{emptyMessage}</div>;
  }

  return (
    <ol className="activity-history" data-testid="activity-history">
      {items.map((item) => (
        <ActivityItem key={item.id ?? `${item.at}-${item.action}`} item={item} />
      ))}
    </ol>
  );
}
