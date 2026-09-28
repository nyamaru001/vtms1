const COLORS = {
  PENDING: '#8a8f98', TRANSPORT_REVIEW: '#2563eb', HPMU_REVIEW: '#7c3aed',
  R3_REVIEW: '#9333ea', R3_APPROVED: '#16a34a', R3_REJECTED: '#dc2626', R3_RETURNED: '#d97706',
  APPROVED: '#16a34a', REJECTED: '#dc2626', RETURNED: '#d97706',
  CANCELLED: '#6b7280', DRIVER_ASSIGNED: '#0891b2', DRIVER_ACCEPTED: '#0284c7',
  DRIVER_CANCELLED: '#6b7280', FUEL_REQUESTED: '#7c3aed',
  HPMU_APPROVED: '#16a34a', HPMU_REJECTED: '#dc2626', HPMU_RETURNED: '#d97706',
  HPMU_RELEASED: '#059669',
  DRIVER_CONFIRMED: '#0284c7', TRIP_STARTED: '#0284c7',
  DRIVER_COMPLETED: '#0d9488', OFFICER_COMPLETED: '#0891b2',
  TRIP_COMPLETED: '#059669', CLOSED: '#334155',
  AVAILABLE: '#16a34a', ASSIGNED: '#2563eb', IN_TRIP: '#0284c7',
  MAINTENANCE: '#d97706', INACTIVE: '#6b7280', ACTIVE: '#16a34a',
  ON_TRIP: '#0284c7', NOT_STARTED: '#8a8f98', IN_PROGRESS: '#0284c7', COMPLETED: '#16a34a',
  DRAFT: '#8a8f98', SUBMITTED: '#2563eb', VERIFIED: '#16a34a',
  UNDER_REVIEW: '#7c3aed', RELEASED: '#0891b2',
};

export default function StatusBadge({ status }) {
  const color = COLORS[status] || '#8a8f98';
  return (
    <span className="status-badge" style={{ '--badge-color': color }}>
      {String(status).replace(/_/g, ' ')}
    </span>
  );
}
