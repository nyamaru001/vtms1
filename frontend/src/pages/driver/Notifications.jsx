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
          <span className="notifications-eyebrow">ACTIVITY CENTER</span>
          <h1>Notifications</h1>
          <p>Stay updated with your latest system activities.</p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            className="notifications-read-all"
            onClick={markAllRead}
            disabled={actionId === 'all'}
          >
            {actionId === 'all' ? 'Updating...' : 'Mark all as read'}
          </button>
        )}
      </div>

      <div className="notifications-summary">
        <div className="notifications-summary-icon">♢</div>
        <div>
          <strong>{notifications.length}</strong>
          <span>Total notifications</span>
        </div>
        <div className="notifications-summary-divider" />
        <div>
          <strong className="unread-number">{unreadCount}</strong>
          <span>Unread</span>
        </div>
      </div>

      <section className="notifications-card">
        <div className="notifications-card-header">
          <div>
            <h2>Recent notifications</h2>
            <p>Your latest alerts and system updates.</p>
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="notifications-empty">
            <div className="notifications-empty-icon">✓</div>
            <h3>No notifications yet</h3>
            <p>You're all caught up. New notifications will appear here.</p>
          </div>
        ) : (
          <div className="notifications-list">
            {notifications.map((notification) => {
              const isDeleting = actionId === `delete-${notification.id}`;
              const isMarking = actionId === notification.id;

              return (
                <article
                  key={notification.id}
                  className={`notification-item ${notification.isRead ? '' : 'notification-unread'}`}
                >
                  <div className={`notification-icon ${notification.isRead ? 'notification-icon-read' : 'notification-icon-unread'}`}>
                    {notification.isRead ? '✓' : '●'}
                  </div>

                  <div className="notification-content">
                    <div className="notification-title-row">
                      <h3>{notification.title}</h3>
                      {!notification.isRead && <span className="notification-new">NEW</span>}
                    </div>
                    <p>{notification.message}</p>
                    <span className="notification-time">
                      {notification.createdAt ? new Date(notification.createdAt).toLocaleString() : '-'}
                    </span>
                  </div>

                  <div className="notification-actions">
                    {!notification.isRead && (
                      <button
                        type="button"
                        className="notification-action"
                        onClick={() => markRead(notification.id)}
                        disabled={isMarking || isDeleting}
                      >
                        {isMarking ? 'Saving...' : 'Mark read'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="notification-action notification-delete"
                      onClick={() => removeNotification(notification.id)}
                      disabled={isMarking || isDeleting}
                    >
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
