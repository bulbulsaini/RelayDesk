
import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Inbox,
  Layers,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { adminApi, ticketsApi } from '../api/endpoints';
import { PriorityBadge } from '../components/PriorityBadge';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { ActivityEntry, Ticket, TicketStats } from '../types';
import {
  formatCategoryLabel,
  formatRelativeTime,
  formatTicketCode,
} from '../utils/format';

export function DashboardPage({ refreshKey }: { refreshKey: number }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<TicketStats | null>(null);
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [recentEvents, setRecentEvents] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const requests: Promise<unknown>[] = [
      ticketsApi.stats().then((res) => {
        if (active) setStats(res.stats);
      }),
      ticketsApi
        .list({ limit: 5, sortBy: 'updated_at', sortOrder: 'desc' })
        .then((res) => {
          if (active) setRecentTickets(res.items);
        }),
    ];

    if (user?.role === 'admin') {
      requests.push(
        adminApi.listActivity({ limit: 6, page: 1 }).then((res) => {
          if (active) setRecentEvents(res.items);
        })
      );
    }

    Promise.all(requests).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [user?.role, refreshKey]);

  if (loading || !stats) {
    return (
      <div className="card card-body" style={{ color: 'var(--text-muted)' }}>
        Loading workspace metrics...
      </div>
    );
  }

  const total = stats.total || 0;

  const pct = (count: number) =>
    total > 0 ? Math.round((count / total) * 100) : 0;

  const statusRows = [
    {
      key: 'open',
      label: 'Open',
      count: stats.byStatus.open,
      color: '#2563eb',
    },
    {
      key: 'in_progress',
      label: 'In Progress',
      count: stats.byStatus.in_progress,
      color: '#d97706',
    },
    {
      key: 'resolved',
      label: 'Resolved',
      count: stats.byStatus.resolved,
      color: '#059669',
    },
    {
      key: 'closed',
      label: 'Closed',
      count: stats.byStatus.closed,
      color: '#64748b',
    },
  ];

  const priorityRows = [
    {
      key: 'urgent',
      label: 'Urgent',
      count: stats.byPriority.urgent,
      color: '#dc2626',
    },
    {
      key: 'high',
      label: 'High',
      count: stats.byPriority.high,
      color: '#ea580c',
    },
    {
      key: 'medium',
      label: 'Medium',
      count: stats.byPriority.medium,
      color: '#0284c7',
    },
    {
      key: 'low',
      label: 'Low',
      count: stats.byPriority.low,
      color: '#64748b',
    },
  ];

  // Build the donut chart from live status counts.
  let chartPosition = 0;

  const chartSegments = statusRows.map((row) => {
    const start = chartPosition;
    chartPosition += total > 0 ? (row.count / total) * 100 : 0;

    return `${row.color} ${start}% ${chartPosition}%`;
  });

  const chartGradient =
    total > 0
      ? `conic-gradient(${chartSegments.join(', ')})`
      : '#e8f0fa';

  const maxPriority = Math.max(
    1,
    ...priorityRows.map((row) => row.count)
  );

  return (
    <div>
      {/* CLICKABLE STAT CARDS */}
      <div className="stats-grid">
        <Link to="/tickets" className="stat-card stat-card-link">
          <div className="stat-top">
            <span>Total Tickets</span>
            <span className="stat-icon">
              <Layers size={15} />
            </span>
          </div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-foot">
            {user?.role === 'admin'
              ? 'Across all workspace members'
              : 'Submitted by your account'}
          </div>
          <span className="stat-card-hint">View all tickets →</span>
        </Link>

        <Link
          to="/tickets?status=open"
          className="stat-card stat-card-link"
        >
          <div className="stat-top">
            <span>Open Queue</span>
            <span
              className="stat-icon"
              style={{ background: '#eff6ff', color: '#1d4ed8' }}
            >
              <Inbox size={15} />
            </span>
          </div>
          <div className="stat-value">{stats.byStatus.open}</div>
          <div className="stat-foot">Awaiting triage or response</div>
          <span className="stat-card-hint">View open tickets →</span>
        </Link>

        <Link
          to="/tickets?status=in_progress"
          className="stat-card stat-card-link"
        >
          <div className="stat-top">
            <span>In Progress</span>
            <span
              className="stat-icon"
              style={{ background: '#fffbeb', color: '#b45309' }}
            >
              <Clock3 size={15} />
            </span>
          </div>
          <div className="stat-value">
            {stats.byStatus.in_progress}
          </div>
          <div className="stat-foot">
            {stats.byPriority.urgent + stats.byPriority.high} high or urgent
            priority
          </div>
          <span className="stat-card-hint">
            View in-progress tickets →
          </span>
        </Link>

        <Link
          to="/tickets?status=resolved"
          className="stat-card stat-card-link"
        >
          <div className="stat-top">
            <span>Resolved</span>
            <span
              className="stat-icon"
              style={{ background: '#ecfdf5', color: '#047857' }}
            >
              <CheckCircle2 size={15} />
            </span>
          </div>
          <div className="stat-value">
            {stats.byStatus.resolved + stats.byStatus.closed}
          </div>
          <div className="stat-foot">
            {pct(stats.byStatus.resolved + stats.byStatus.closed)}%
            completion rate
          </div>
          <span className="stat-card-hint">
            View resolved tickets →
          </span>
        </Link>
      </div>

      {/* CHARTS */}
      <div className="dashboard-split">
        {/* STATUS DONUT CHART */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Status Distribution</h2>
              <p className="card-subtitle">
                Overview of your ticket status
              </p>
            </div>
          </div>

          <div className="card-body status-chart-body">
            <div
              className="status-donut"
              style={{ background: chartGradient }}
              role="img"
              aria-label="Ticket status distribution"
            >
              <div className="status-donut-center">
                <strong>{total}</strong>
                <span>Total Tickets</span>
              </div>
            </div>

            <div className="status-chart-legend">
              {statusRows.map((row) => (
                <Link
                  key={row.key}
                  to={`/tickets?status=${row.key}`}
                  className="status-legend-row"
                >
                  <span className="status-legend-name">
                    <span
                      className="swatch"
                      style={{ background: row.color }}
                    />
                    {row.label}
                  </span>

                  <span className="status-legend-value">
                    <strong>{row.count}</strong>
                    <span>{pct(row.count)}%</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ADMIN ACTIVITY OR PRIORITY BREAKDOWN */}
        {user?.role === 'admin' ? (
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Recent System Events</h2>
                <p className="card-subtitle">
                  Live audit stream from ticket workflows
                </p>
              </div>
              <Link to="/activity" className="btn btn-ghost btn-sm">
                View all <ArrowRight size={13} />
              </Link>
            </div>

            <div className="card-body">
              {recentEvents.length === 0 ? (
                <div className="empty-state" style={{ padding: 20 }}>
                  No activity recorded yet.
                </div>
              ) : (
                <div className="timeline">
                  {recentEvents.map((ev) => (
                    <div key={ev.id} className="timeline-item">
                      <span className="timeline-dot" />
                      <div className="timeline-event-tag">
                        {ev.event_type}
                        {ev.ticket_id
                          ? ` · ${formatTicketCode(ev.ticket_id)}`
                          : ''}
                      </div>
                      <div className="timeline-summary">{ev.summary}</div>
                      <div className="timeline-time">
                        {formatRelativeTime(ev.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card priority-card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Priority Breakdown</h2>
                <p className="card-subtitle">
                  Urgency across your submitted tickets
                </p>
              </div>
            </div>

            <div className="card-body priority-horizontal">
              {priorityRows.map((row) => (
                <Link
                  key={row.key}
                  to={`/tickets?priority=${row.key}`}
                  className="priority-tile"
                >
                  <div className="priority-tile-top">
                    <span
                      className="priority-dot"
                      style={{ background: row.color }}
                    />
                    <span>{row.label}</span>
                    <strong>{row.count}</strong>
                  </div>

                  <div className="priority-track">
                    <div
                      className="priority-fill"
                      style={{
                        width: `${(row.count / maxPriority) * 100}%`,
                        background: row.color,
                      }}
                    />
                  </div>
                </Link>
              ))}

              {stats.byPriority.urgent > 0 && (
                <div className="priority-alert">
                  <AlertTriangle size={15} />
                  You have {stats.byPriority.urgent} urgent ticket(s)
                  currently tracked.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* RECENT TICKETS */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Recently Updated Tickets</h2>
            <p className="card-subtitle">
              Latest activity across the queue
            </p>
          </div>

          <Link to="/tickets" className="btn btn-secondary btn-sm">
            Open Queue <ArrowRight size={13} />
          </Link>
        </div>

        <div className="table-wrap">
          {recentTickets.length === 0 ? (
            <div className="empty-state">
              No tickets yet. Use the <strong>New Ticket</strong> button
              to submit your first request.
            </div>
          ) : (
            <table className="ticket-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Status</th>
                  <th>Priority</th>
                  {user?.role === 'admin' && <th>Requester</th>}
                  <th>Updated</th>
                </tr>
              </thead>

              <tbody>
                {recentTickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <Link
                        to={`/tickets/${ticket.id}`}
                        className="ticket-link-title"
                      >
                        {ticket.title}
                      </Link>
                      <div className="ticket-sub">
                        <span className="mono">
                          {formatTicketCode(ticket.id)}
                        </span>
                        <span>·</span>
                        <span>
                          {formatCategoryLabel(ticket.category)}
                        </span>
                      </div>
                    </td>

                    <td>
                      <StatusBadge status={ticket.status} />
                    </td>

                    <td>
                      <PriorityBadge priority={ticket.priority} />
                    </td>

                    {user?.role === 'admin' && (
                      <td
                        style={{
                          color: 'var(--text-secondary)',
                          fontSize: 13,
                        }}
                      >
                        {ticket.submitter_name}
                      </td>
                    )}

                    <td
                      style={{
                        color: 'var(--text-muted)',
                        fontSize: 12.5,
                      }}
                    >
                      {formatRelativeTime(ticket.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
