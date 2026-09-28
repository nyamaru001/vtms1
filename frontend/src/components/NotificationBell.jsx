import { useCallback, useEffect, useRef, useState } from 'react';
import { notificationsApi } from '../services/resources';
import { useSocket } from '../utils/useSocket';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);

  const ref = useRef(null);
  const socket = useSocket();

  const load = useCallback(async () => {
    const token = localStorage.getItem('vtms_token');

    // Don't request notifications if user is not logged in
    if (!token) {
      setItems([]);
      setUnreadCount(0);
      return;
    }

    try {
      setLoading(true);

      const res = await notificationsApi.list();

      setItems(Array.isArray(res?.data) ? res.data : []);
      setUnreadCount(Number(res?.unreadCount || 0));
    } catch (error) {
      console.error('Failed to load notifications:', error);

      // Keep the UI stable if the request fails
      setItems([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  /*
   * Load notifications when component mounts.
   */
  useEffect(() => {
    load();
  }, [load]);

  /*
   * Listen for real-time notifications.
   */
  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handleNewNotification = () => {
      load();
      setHasNewNotifications(true);
    };

    socket.on('notification:new', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [socket, load]);

  /*
   * Close dropdown when clicking outside.
   */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        ref.current &&
        !ref.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Reset new notifications flag when dropdown is opened
  const handleOpen = () => {
    setOpen((current) => !current);
    if (hasNewNotifications) {
      setHasNewNotifications(false);
    }
  };

  /*
   * Mark all notifications as read.
   */
  const markAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      await load();
      setHasNewNotifications(false);
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    }
  };

  /*
   * Mark one notification as read.
   */
  const markOneRead = async (id) => {
    if (!id) return;

    try {
      await notificationsApi.markRead(id);
      await load();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  return (
    <div className="notif-bell" ref={ref}>
      <button
        type="button"
        className={`icon-btn ${hasNewNotifications ? 'has-new' : ''}`}
        onClick={handleOpen}
        aria-label="Notifications"
        aria-expanded={open}
      >
        🔔

        {unreadCount > 0 && (
          <span className="notif-count">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}

        {hasNewNotifications && (
          <span className="notif-new-indicator">NEW</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <strong>Notifications</strong>

            {unreadCount > 0 && (
              <button
                type="button"
                className="link-btn"
                onClick={markAllRead}
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="notif-list">
            {loading ? (
              <div className="empty-state">
                Loading notifications...
              </div>
            ) : items.length === 0 ? (
              <div className="empty-state">
                No notifications yet.
              </div>
            ) : (
              items.map((notification) => (
                <div
                  key={notification.id}
                  className={`notif-item ${
                    notification.isRead ? '' : 'unread'
                  }`}
                  onClick={() => markOneRead(notification.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' ||
                      event.key === ' '
                    ) {
                      markOneRead(notification.id);
                    }
                  }}
                >
                  <div className="notif-title">
                    {notification.title}
                    {!notification.isRead && <span className="new-badge">NEW</span>}
                  </div>

                  <div className="notif-message">
                    {notification.message}
                  </div>

                  <div className="notif-time">
                    {notification.createdAt
                      ? new Date(
                          notification.createdAt
                        ).toLocaleString()
                      : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}