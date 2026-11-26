import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { adminApi, ticketsApi } from '../api/endpoints';
import { PriorityBadge } from '../components/PriorityBadge';
import { StatusBadge } from '../components/StatusBadge';
import { TicketModal } from '../components/TicketModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  PaginationMeta,
  Ticket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  User,
} from '../types';
import { formatCategoryLabel, formatRelativeTime, formatTicketCode } from '../utils/format';

const STATUS_TABS: Array<{ value: '' | TicketStatus; label: string }> = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export function TicketsPage({
  refreshKey,
  onMutated,
}: {
  refreshKey: number;
  onMutated: () => void;
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 8,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [usersList, setUsersList] = useState<User[]>([]);

  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);

  const status = (searchParams.get('status') || '') as '' | TicketStatus;
  const priority = (searchParams.get('priority') || '') as '' | TicketPriority;
  const category = (searchParams.get('category') || '') as '' | TicketCategory;
  const userId = searchParams.get('userId') ? Number(searchParams.get('userId')) : '';
  const sortBy = (searchParams.get('sortBy') || 'created_at') as
    | 'created_at'
    | 'updated_at'
    | 'priority'
    | 'status';
  const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
  const page = Number(searchParams.get('page') || '1');
  const q = searchParams.get('q') || '';

  useEffect(() => {
    if (user?.role === 'admin') {
      adminApi
        .listUsers()
        .then((res) => setUsersList(res.users))
        .catch(() => null);
    }
  }, [user?.role]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (searchInput.trim()) {
        next.set('q', searchInput.trim());
      } else {
        next.delete('q');
      }
      if (next.get('q') !== searchParams.get('q')) {
        next.set('page', '1');
        setSearchParams(next);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    ticketsApi
      .list({
        q,
        status,
        priority,
        category,
        userId,
        sortBy,
        sortOrder,
        page,
        limit: 8,
      })
      .then((res) => {
        if (active) {
          setTickets(res.items);
          setPagination(res.pagination);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [q, status, priority, category, userId, sortBy, sortOrder, page, refreshKey]);

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.set('page', '1');
    setSearchParams(next);
  };

  const setPage = (targetPage: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(targetPage));
    setSearchParams(next);
  };

  const handleDelete = async (ticket: Ticket) => {
    if (!window.confirm(`Delete ticket ${formatTicketCode(ticket.id)} ("${ticket.title}")?`)) {
      return;
    }
    try {
      await ticketsApi.remove(ticket.id);
      showToast(`Ticket ${formatTicketCode(ticket.id)} deleted`);
      onMutated();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Delete failed', 'error');
    }
  };

  return (
    <div className="card">
      <div className="toolbar">
        <div className="segmented-tabs" role="tablist" aria-label="Filter by status">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.label}
              type="button"
              className={`seg-btn ${status === tab.value ? 'active' : ''}`}
              onClick={() => updateFilter('status', tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="filter-controls">
          <div className="search-box">
            <Search size={15} />
            <input
              className="input"
              placeholder="Search #ID or keyword..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <select
            className="select select-inline"
            value={priority}
            onChange={(e) => updateFilter('priority', e.target.value)}
            aria-label="Filter by priority"
          >
            <option value="">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            className="select select-inline"
            value={category}
            onChange={(e) => updateFilter('category', e.target.value)}
            aria-label="Filter by category"
          >
            <option value="">All Categories</option>
            <option value="technical">Technical</option>
            <option value="billing">Billing</option>
            <option value="account">Account &amp; Auth</option>
            <option value="feature_request">Feature Request</option>
            <option value="other">Other</option>
          </select>

          {user?.role === 'admin' && usersList.length > 0 && (
            <select
              className="select select-inline"
              value={userId ? String(userId) : ''}
              onChange={(e) => updateFilter('userId', e.target.value)}
              aria-label="Filter by requester"
            >
              <option value="">All Users</option>
              {usersList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}

          <select
            className="select select-inline"
            value={`${sortBy}:${sortOrder}`}
            onChange={(e) => {
              const [field, dir] = e.target.value.split(':');
              const next = new URLSearchParams(searchParams);
              next.set('sortBy', field);
              next.set('sortOrder', dir);
              next.set('page', '1');
              setSearchParams(next);
            }}
            aria-label="Sort tickets"
          >
            <option value="created_at:desc">Newest first</option>
            <option value="updated_at:desc">Recently updated</option>
            <option value="priority:desc">Highest priority</option>
            <option value="created_at:asc">Oldest first</option>
          </select>
        </div>
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="empty-state">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="empty-state">
            No support tickets matched your current filters.
          </div>
        ) : (
          <table className="ticket-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Status</th>
                <th>Priority</th>
                {user?.role === 'admin' && <th>Requester</th>}
                <th>Comments</th>
                <th>Updated</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => {
                const canEdit =
                  user?.role === 'admin' ||
                  (ticket.status !== 'resolved' && ticket.status !== 'closed');
                const canDelete = user?.role === 'admin' || ticket.status === 'open';

                return (
                  <tr key={ticket.id}>
                    <td style={{ maxWidth: 420 }}>
                      <Link to={`/tickets/${ticket.id}`} className="ticket-link-title">
                        {ticket.title}
                      </Link>
                      <div className="ticket-sub">
                        <span className="mono">{formatTicketCode(ticket.id)}</span>
                        <span>·</span>
                        <span>{formatCategoryLabel(ticket.category)}</span>
                        {ticket.assignee_name && (
                          <>
                            <span>·</span>
                            <span>Assigned to {ticket.assignee_name}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td>
                      <PriorityBadge priority={ticket.priority} />
                    </td>
                    {user?.role === 'admin' && (
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {ticket.submitter_name}
                      </td>
                    )}
                    <td>
                      <span
                        className="mono"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: 12.5,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <MessageSquare size={13} />
                        {ticket.comment_count}
                      </span>
                    </td>
                    <td style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                      {formatRelativeTime(ticket.updated_at)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        {canEdit && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            title="Edit ticket"
                            onClick={() => setEditingTicket(ticket)}
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            title="Delete ticket"
                            style={{ color: '#b91c1c' }}
                            onClick={() => handleDelete(ticket)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="pagination-bar">
        <span>
          Showing {tickets.length === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}–
          {(pagination.page - 1) * pagination.limit + tickets.length} of {pagination.total} tickets
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={pagination.page <= 1}
            onClick={() => setPage(pagination.page - 1)}
          >
            <ChevronLeft size={14} />
            Prev
          </button>
          <span className="mono" style={{ fontSize: 12 }}>
            Page {pagination.page} / {pagination.totalPages}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setPage(pagination.page + 1)}
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <TicketModal
        open={Boolean(editingTicket)}
        ticket={editingTicket}
        onClose={() => setEditingTicket(null)}
        onSaved={() => onMutated()}
      />
    </div>
  );
}
