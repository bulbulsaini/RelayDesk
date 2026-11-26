import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminApi } from '../api/endpoints';
import { ActivityEntry, PaginationMeta } from '../types';
import { formatDateTime, formatTicketCode } from '../utils/format';

const EVENT_OPTIONS = [
  { value: '', label: 'All Event Types' },
  { value: 'TICKET_CREATED', label: 'Ticket Created' },
  { value: 'TICKET_UPDATED', label: 'Ticket Updated' },
  { value: 'STATUS_CHANGED', label: 'Status Changed' },
  { value: 'COMMENT_ADDED', label: 'Comment Added' },
  { value: 'TICKET_RESOLVED', label: 'Ticket Resolved' },
];

export function ActivityLogPage() {
  const [items, setItems] = useState<ActivityEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 1,
  });
  const [eventType, setEventType] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    adminApi
      .listActivity({ eventType: eventType || undefined, page, limit: 15 })
      .then((res) => {
        if (active) {
          setItems(res.items);
          setPagination(res.pagination);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [eventType, page]);

  return (
    <div className="card">
      <div className="toolbar">
        <div>
          <h2 className="card-title">System Event &amp; Audit Log</h2>
          <p className="card-subtitle">
            Automated records emitted by ticket lifecycle and comment events
          </p>
        </div>

        <select
          className="select select-inline"
          value={eventType}
          onChange={(e) => {
            setEventType(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by event type"
        >
          {EVENT_OPTIONS.map((opt) => (
            <option key={opt.label} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="empty-state">Loading audit events...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">No events recorded for this filter.</div>
        ) : (
          <table className="ticket-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Summary</th>
                <th>Ticket</th>
                <th>Actor</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className="badge" style={{ background: 'var(--bg-subtle)' }}>
                      <span className="mono" style={{ fontSize: 11 }}>
                        {item.event_type}
                      </span>
                    </span>
                  </td>
                  <td style={{ fontSize: 13.5 }}>{item.summary}</td>
                  <td>
                    {item.ticket_id ? (
                      <Link to={`/tickets/${item.ticket_id}`} className="ticket-link-title">
                        <span className="mono">{formatTicketCode(item.ticket_id)}</span>
                        {item.ticket_title ? ` · ${item.ticket_title}` : ''}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {item.actor_name || 'System'}
                  </td>
                  <td style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                    {formatDateTime(item.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="pagination-bar">
        <span>Total events: {pagination.total}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={pagination.page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="mono" style={{ fontSize: 12 }}>
            Page {pagination.page} / {pagination.totalPages}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
