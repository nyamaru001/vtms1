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
    <div className="notifications-page">
      <div className="notifications-header">
        <div>
          <span className="notifications-kicker">SYSTEM CENTER</span>
          <div className="notifications-title-row">
            <h1>Notifications</h1>
            {unreadCount > 0 && (
              <span className="notifications-count">{unreadCount} unread</span>
            )}
          </div>
          <p>View updates, alerts and important messages related to your transport activities.</p>
        </div>
        <button
          type="button"
          className="notifications-mark-all"
          onClick={markAllRead}
          disabled={unreadCount === 0 || actionId === 'all'}
        >
          <span>✓</span>
          {actionId === 'all' ? 'Marking...' : 'Mark all as read'}
        </button>
      </div>

      <div className="notifications-summary">
        <div className="notification-summary-card">
          <div className="notification-summary-icon total">◉</div>
          <div>
            <span>Total notifications</span>
            <strong>{notifications.length}</strong>
          </div>
        </div>
        <div className="notification-summary-card">
          <div className="notification-summary-icon unread">●</div>
          <div>
            <span>Unread</span>
            <strong>{unreadCount}</strong>
          </div>
        </div>
        <div className="notification-summary-card">
          <div className="notification-summary-icon read">✓</div>
          <div>
            <span>Read</span>
            <strong>{notifications.length - unreadCount}</strong>
          </div>
        </div>
      </div>

      <div className="notifications-card">
        <div className="notifications-card-header">
          <div>
            <h2>Recent notifications</h2>
            <span>{notifications.length} notification{notifications.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="notifications-empty">
            <div className="notifications-empty-icon">✓</div>
            <h3>No notifications yet</h3>
            <p>You are all caught up. New system updates and activity notifications will appear here.</p>
          </div>
        ) : (
          <div className="notifications-list">
            {notifications.map((notification) => {
              const isUnread = !notification.isUnread;
              const isDeleting = actionId === `delete-${notification.id}`;
              const isMarking = actionId === `read-${notification.id}`;

              return (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.isRead ? 'notification-unread' : ''}`}
                >
                  <div className={`notification-icon ${!notification.isRead ? 'notification-icon-unread' : ''}`}>
                    {!notification.isRead ? '!' : '✓'}
                  </div>
                  <div className="notification-content">
                    <div className="notification-top">
                      <div className="notification-heading">
                        <h3>{notification.title}</h3>
                        {!notification.isRead && <span className="notification-new">NEW</span>}
                      </div>
                      <span className="notification-time">
                        {notification.createdAt ? new Date(notification.createdAt).toLocaleString() : '—'}
                      </span>
                    </div>
                    <p className="notification-message">{notification.message}</p>
                    <div className="notification-actions">
                      {!notification.isRead && (
                        <button
                          type="button"
                          className="notification-action read-action"
                          onClick={() => markRead(notification.id)}
                          disabled={isMarking || isDeleting}
                        >
                          {isMarking ? 'Marking...' : '✓ Mark as read'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="notification-action delete-action"
                        onClick={() => removeNotification(notification.id)}
                        disabled={isMarking || isDeleting}
                      >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
