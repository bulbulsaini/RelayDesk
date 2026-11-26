
import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, History } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { ticketsApi } from '../api/endpoints';
import { PriorityBadge } from '../components/PriorityBadge';
import { StatusBadge } from '../components/StatusBadge';
import { Ticket } from '../types';
import {
  formatCategoryLabel,
  formatRelativeTime,
  formatTicketCode,
} from '../utils/format';

const PAGE_SIZE = 10;
const API_LIMIT = 50;

export function HistoryPage({ refreshKey }: { refreshKey: number }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      setLoading(true);
      setError('');

      try {
        const statuses = ['resolved', 'closed'] as const;

        const results = await Promise.all(
          statuses.map(async (status) => {
            const first = await ticketsApi.list({
              status,
              page: 1,
              limit: API_LIMIT,
              sortBy: 'updated_at',
              sortOrder: 'desc',
            });

            const otherPages = await Promise.all(
              Array.from(
                { length: first.pagination.totalPages - 1 },
                (_, index) =>
                  ticketsApi.list({
                    status,
                    page: index + 2,
                    limit: API_LIMIT,
                    sortBy: 'updated_at',
                    sortOrder: 'desc',
                  }),
              ),
            );

            return [
              ...first.items,
              ...otherPages.flatMap((result) => result.items),
            ];
          }),
        );

        if (!active) return;

        const allTickets = results
          .flat()
          .sort(
            (a, b) =>
              new Date(b.updated_at).getTime() -
              new Date(a.updated_at).getTime(),
          );

        setTickets(allTickets);
        setPage(1);
      } catch {
        if (active) {
          setError('Unable to load ticket history. Please try again.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadHistory();

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const totalPages = Math.max(1, Math.ceil(tickets.length / PAGE_SIZE));

  const visibleTickets = tickets.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const handleBack = () => {
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 18,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Ticket History</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            View your resolved and closed tickets
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleBack}
        >
          <ArrowLeft size={14} />
          Back
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Completed Tickets</h3>
            <p className="card-subtitle">
              {tickets.length} completed tickets
            </p>
          </div>
          <History size={20} color="var(--text-muted)" />
        </div>

        <div className="table-wrap">
          {loading ? (
            <div className="empty-state">Loading history...</div>
          ) : error ? (
            <div className="empty-state">{error}</div>
          ) : visibleTickets.length === 0 ? (
            <div className="empty-state">
              No resolved or closed tickets yet.
            </div>
          ) : (
            <table className="ticket-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Category</th>
                  <th>Last Updated</th>
                </tr>
              </thead>

              <tbody>
                {visibleTickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <Link
                        to={`/tickets/${ticket.id}`}
                        state={{
                          from: location.pathname + location.search,
                        }}
                        className="ticket-link-title"
                      >
                        {ticket.title}
                      </Link>

                      <div className="ticket-sub">
                        <span className="mono">
                          {formatTicketCode(ticket.id)}
                        </span>
                      </div>
                    </td>

                    <td>
                      <StatusBadge status={ticket.status} />
                    </td>

                    <td>
                      <PriorityBadge priority={ticket.priority} />
                    </td>

                    <td>{formatCategoryLabel(ticket.category)}</td>

                    <td style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>
                      {formatRelativeTime(ticket.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && !error && tickets.length > 0 && (
          <div className="pagination-bar">
            <span>
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, tickets.length)} of {tickets.length}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page === 1}
                onClick={() => setPage((current) => current - 1)}
              >
                <ChevronLeft size={14} />
                Prev
              </button>

              <span className="mono" style={{ fontSize: 12 }}>
                Page {page} / {totalPages}
              </span>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page === totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
