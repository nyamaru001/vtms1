import { useEffect, useState } from 'react';
import { notificationsApi } from '../../services/resources';
import Loading from '../../components/Loading';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(null);
  const [actionId, setActionId] = useState(null);

  const load = async () => {
    try {
      const response = await notificationsApi.list();
      const items = Array.isArray(response) ? response : response?.data || [];
      setNotifications(items);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setNotifications([]);
    }
  };

  useEffect(() => { load(); }, []);

  const markAllRead = async () => {
    try {
      setActionId('all');
      await notificationsApi.markAllRead();
      await load();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    } finally {
      setActionId(null);
    }
  };

  const markRead = async (id) => {
    try {
      setActionId(id);
      await notificationsApi.markRead(id);
      await load();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    } finally {
      setActionId(null);
    }
  };

  const removeNotification = async (id) => {
    try {
      setActionId(`delete-${id}`);
      await notificationsApi.remove(id);
      await load();
    } catch (error) {
      console.error('Failed to delete notification:', error);
    } finally {
      setActionId(null);
    }
  };

  if (notifications === null) return <Loading />;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Notifications</h3>
        {unreadCount > 0 && (
          <button className="link-btn" onClick={markAllRead} disabled={actionId === 'all'}>
            {actionId === 'all' ? 'Marking...' : 'Mark all as read'}
          </button>
        )}
      </div>
      {notifications.length === 0 && <div className="empty-state">No notifications yet.</div>}
      {notifications.map((n) => (
        <div key={n.id} className={`notif-row ${n.isRead ? '' : 'unread'}`}>
          <div>
            <strong>{n.title}</strong>
            <p>{n.message}</p>
            <span className="field-hint">{new Date(n.createdAt).toLocaleString()}</span>
          </div>
          <div className="notif-row-actions">
            {!n.isRead && (
              <button className="link-btn" onClick={() => markRead(n.id)} disabled={actionId === n.id}>
                {actionId === n.id ? 'Saving...' : 'Mark read'}
              </button>
            )}
            <button className="link-btn danger" onClick={() => removeNotification(n.id)} disabled={actionId === `delete-${n.id}`}>
              {actionId === `delete-${n.id}` ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
