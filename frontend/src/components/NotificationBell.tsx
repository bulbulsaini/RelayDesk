import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../api/endpoints';
import { NotificationItem } from '../types';
import { formatRelativeTime } from '../utils/format';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const loadNotifications = async () => {
    try {
      const data = await notificationsApi.list();
      setItems(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // Ignore transient polling failures
    }
  };

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 20_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenItem = async (item: NotificationItem) => {
    if (!item.is_read) {
      await notificationsApi.markRead(item.id).catch(() => null);
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    if (item.ticket_id) {
      navigate(`/tickets/${item.ticket_id}`);
    }
  };

  const handleMarkAll = async () => {
    await notificationsApi.markAllRead();
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  return (
    <div className="notif-wrapper" ref={containerRef}>
      <button
        type="button"
        className="icon-btn"
        aria-label="Notifications"
        onClick={() => {
          setOpen((v) => !v);
          loadNotifications();
        }}
      >
        <Bell size={17} />
        {unreadCount > 0 && <span className="notif-count">{unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-popover">
          <div className="card-header" style={{ padding: '12px 16px' }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Notifications</span>
            {unreadCount > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleMarkAll}>
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {items.length === 0 ? (
              <div className="empty-state" style={{ padding: '28px 16px' }}>
                No notifications yet.
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className={`notif-item ${!item.is_read ? 'unread' : ''}`}
                  onClick={() => handleOpenItem(item)}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 3,
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{item.title}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {formatRelativeTime(item.created_at)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    {item.message}
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
