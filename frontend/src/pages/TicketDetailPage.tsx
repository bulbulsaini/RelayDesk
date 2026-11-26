
import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Pencil,
  Send,
  Trash2,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { adminApi, ticketsApi } from '../api/endpoints';
import { PriorityBadge } from '../components/PriorityBadge';
import { StatusBadge } from '../components/StatusBadge';
import { TicketModal } from '../components/TicketModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

import {
  ActivityEntry,
  Ticket,
  TicketComment,
  TicketPriority,
  TicketStatus,
  User,
} from '../types';

import {
  formatCategoryLabel,
  formatDateTime,
  formatRelativeTime,
  formatTicketCode,
  getInitials,
} from '../utils/format';

export function TicketDetailPage({
  onMutated,
}: {
  onMutated: () => void;
}) {
  const { id } = useParams();
  const ticketId = Number(id);

  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [admins, setAdmins] = useState<User[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [replyBody, setReplyBody] = useState('');
  const [postingReply, setPostingReply] = useState(false);

  const [editOpen, setEditOpen] = useState(false);

  // Resolution confirmation state
  const [resolutionMessage, setResolutionMessage] = useState('');
  const [resolving, setResolving] = useState(false);

  // Load ticket, comments and activity.
  const loadAll = async () => {
    try {
      const [tRes, cRes, aRes] = await Promise.all([
        ticketsApi.get(ticketId),
        ticketsApi.listComments(ticketId),
        ticketsApi.listTicketActivity(ticketId),
      ]);

      setTicket(tRes.ticket);
      setComments(cRes.comments);
      setActivity(aRes.activity);
      setError('');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Unable to load ticket'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadAll();

    if (user?.role === 'admin') {
      adminApi
        .listUsers()
        .then((res) =>
          setAdmins(res.users.filter((u) => u.role === 'admin'))
        )
        .catch(() => null);
    }
  }, [ticketId, user?.role]);

  // Refresh ticket activity.
  const refreshActivity = async (id: number) => {
    try {
      const result = await ticketsApi.listTicketActivity(id);
      setActivity(result.activity);
    } catch {
      // Activity refresh failure should not block the main action.
    }
  };

  // Admin updates ticket properties.
  const handleAdminPatch = async (patch: {
    status?: TicketStatus;
    priority?: TicketPriority;
    assignedTo?: number | null;
  }) => {
    if (!ticket) return;

    try {
      const res = await ticketsApi.update(ticket.id, patch);

      setTicket(res.ticket);
      showToast('Ticket updated');

      onMutated();
      await refreshActivity(ticket.id);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Update failed',
        'error'
      );
    }
  };

  // Post a normal discussion comment.
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ticket || !replyBody.trim()) return;

    setPostingReply(true);

    try {
      const res = await ticketsApi.addComment(
        ticket.id,
        replyBody.trim()
      );

      setComments((prev) => [...prev, res.comment]);
      setReplyBody('');

      showToast('Comment posted');

      await refreshActivity(ticket.id);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Could not post comment',
        'error'
      );
    } finally {
      setPostingReply(false);
    }
  };

  // Admin resolves the ticket and sends a confirmation comment.
  const handleResolveTicket = async () => {
    if (!ticket || !resolutionMessage.trim()) {
      showToast('Please enter a resolution message', 'error');
      return;
    }

    if (user?.role !== 'admin') return;

    if (
      ticket.status === 'resolved' ||
      ticket.status === 'closed'
    ) {
      showToast('This ticket is already resolved or closed', 'error');
      return;
    }

    setResolving(true);

    try {
      // First send the resolution message to the customer.
      const commentRes = await ticketsApi.addComment(
        ticket.id,
        resolutionMessage.trim()
      );

      setComments((prev) => [...prev, commentRes.comment]);

      // Then change the ticket status to Resolved.
      const updateRes = await ticketsApi.update(ticket.id, {
        status: 'resolved',
      });

      setTicket(updateRes.ticket);
      setResolutionMessage('');

      showToast('Ticket resolved and confirmation posted');

      onMutated();
      await refreshActivity(ticket.id);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'Unable to resolve ticket',
        'error'
      );

      // Reload the ticket in case one of the two requests succeeded.
      await loadAll();
    } finally {
      setResolving(false);
    }
  };

  // Delete ticket.
  const handleDelete = async () => {
    if (!ticket) return;

    if (
      !window.confirm(
        `Delete ticket ${formatTicketCode(ticket.id)} permanently?`
      )
    ) {
      return;
    }

    try {
      await ticketsApi.remove(ticket.id);

      showToast('Ticket deleted');
      onMutated();
      navigate('/tickets');
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Delete failed',
        'error'
      );
    }
  };

  if (loading) {
    return (
      <div
        className="card card-body"
        style={{ color: 'var(--text-muted)' }}
      >
        Loading ticket details...
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="card card-body">
        <div className="alert-error">
          {error || 'Ticket not found'}
        </div>

        <Link to="/tickets" className="btn btn-secondary btn-sm">
          <ArrowLeft size={14} />
          Back to tickets
        </Link>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';

  const canEdit =
    isAdmin ||
    (ticket.status !== 'resolved' && ticket.status !== 'closed');

  const canDelete =
    isAdmin || ticket.status === 'open';

  const canResolve =
    isAdmin &&
    ticket.status !== 'resolved' &&
    ticket.status !== 'closed';

  return (
    <div>
      {/* Page actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          gap: 12,
        }}
      >
        <Link to="/tickets" className="btn btn-ghost btn-sm">
          <ArrowLeft size={14} />
          Back to Queue
        </Link>

        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setEditOpen(true)}
            >
              <Pencil size={13} />
              Edit
            </button>
          )}

          {canDelete && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={handleDelete}
            >
              <Trash2 size={13} />
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="detail-grid">
        {/* Main ticket content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          {/* Ticket description */}
          <div className="card">
            <div
              className="card-header"
              style={{ alignItems: 'flex-start' }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 6,
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: 12.5,
                      color: 'var(--text-muted)',
                    }}
                  >
                    {formatTicketCode(ticket.id)}
                  </span>

                  <StatusBadge status={ticket.status} />
                  <PriorityBadge priority={ticket.priority} />
                </div>

                <h2
                  style={{
                    margin: 0,
                    fontSize: 19,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {ticket.title}
                </h2>
              </div>
            </div>

            <div className="card-body">
              <div className="ticket-description">
                {ticket.description}
              </div>
            </div>
          </div>

          {/* Discussion */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">
                  Discussion ({comments.length})
                </h3>

                <p className="card-subtitle">
                  Direct replies between {ticket.submitter_name} and
                  support staff
                </p>
              </div>
            </div>

            <div className="card-body">
              <div
                className="comments-stack"
                style={{ marginBottom: 18 }}
              >
                {comments.length === 0 ? (
                  <div
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: 13,
                    }}
                  >
                    No replies yet. Add a message below to start the
                    conversation.
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div
                      key={comment.id}
                      className={`comment-card ${
                        comment.author_role === 'admin'
                          ? 'admin-reply'
                          : ''
                      }`}
                    >
                      <div className="comment-header">
                        <div className="comment-author">
                          <div
                            className={`avatar ${
                              comment.author_role === 'admin'
                                ? 'admin'
                                : ''
                            }`}
                            style={{
                              width: 26,
                              height: 26,
                              fontSize: 10.5,
                            }}
                          >
                            {getInitials(comment.author_name)}
                          </div>

                          <span>{comment.author_name}</span>

                          {comment.author_role === 'admin' && (
                            <span className="staff-pill">
                              Support Admin
                            </span>
                          )}
                        </div>

                        <span
                          style={{
                            fontSize: 12,
                            color: 'var(--text-muted)',
                          }}
                          title={formatDateTime(comment.created_at)}
                        >
                          {formatRelativeTime(comment.created_at)}
                        </span>
                      </div>

                      <div className="comment-body">
                        {comment.body}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {ticket.status === 'closed' ? (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: 'var(--bg-subtle)',
                    color: 'var(--text-secondary)',
                    fontSize: 13,
                  }}
                >
                  This ticket is closed. Reopen it to add additional
                  comments.
                </div>
              ) : (
                <form onSubmit={handlePostComment}>
                  <textarea
                    className="textarea"
                    rows={3}
                    placeholder="Write a response... (Ctrl+Enter to send)"
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        (e.ctrlKey || e.metaKey) &&
                        e.key === 'Enter'
                      ) {
                        e.preventDefault();
                        handlePostComment(e);
                      }
                    }}
                    required
                  />

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      marginTop: 10,
                    }}
                  >
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={postingReply || !replyBody.trim()}
                    >
                      <Send size={13} />
                      {postingReply ? 'Sending...' : 'Post Comment'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Ticket properties and activity */}
        <aside
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Ticket Properties</h3>
            </div>

            <div
              className="card-body"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              {/* Status */}
              <div>
                <div
                  className="form-label"
                  style={{ marginBottom: 5 }}
                >
                  Status
                </div>

                {isAdmin ? (
                  <select
                    className="select"
                    value={ticket.status}
                    onChange={(e) =>
                      handleAdminPatch({
                        status: e.target.value as TicketStatus,
                      })
                    }
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                ) : (
                  <StatusBadge status={ticket.status} />
                )}
              </div>

              {/* Resolve and notify customer */}
              {canResolve && (
                <div
                  style={{
                    borderTop: '1px solid var(--border)',
                    paddingTop: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div>
                    <h4
                      style={{
                        margin: '0 0 5px',
                        fontSize: 14,
                      }}
                    >
                      Resolve & Notify Customer
                    </h4>

                    <p
                      style={{
                        margin: 0,
                        color: 'var(--text-muted)',
                        fontSize: 12,
                      }}
                    >
                      Enter a message explaining how the issue was
                      resolved. The customer can see it in the ticket
                      discussion.
                    </p>
                  </div>

                  <textarea
                    className="textarea"
                    rows={4}
                    placeholder="Hello, your issue has been investigated and successfully resolved..."
                    value={resolutionMessage}
                    onChange={(e) =>
                      setResolutionMessage(e.target.value)
                    }
                    disabled={resolving}
                  />

                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={
                      resolving || !resolutionMessage.trim()
                    }
                    onClick={handleResolveTicket}
                  >
                    <CheckCircle2 size={15} />
                    {resolving
                      ? 'Resolving...'
                      : 'Resolve & Notify Customer'}
                  </button>
                </div>
              )}

              {/* Resolved confirmation */}
              {ticket.status === 'resolved' && (
                <div
                  style={{
                    borderRadius: 8,
                    padding: 12,
                    background: 'var(--bg-subtle)',
                    color: '#047857',
                    fontSize: 13,
                  }}
                >
                  <CheckCircle2
                    size={16}
                    style={{
                      verticalAlign: 'middle',
                      marginRight: 6,
                    }}
                  />
                  This ticket has been resolved.
                </div>
              )}

              {/* Priority */}
              <div>
                <div
                  className="form-label"
                  style={{ marginBottom: 5 }}
                >
                  Priority
                </div>

                {isAdmin ? (
                  <select
                    className="select"
                    value={ticket.priority}
                    onChange={(e) =>
                      handleAdminPatch({
                        priority: e.target.value as TicketPriority,
                      })
                    }
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                ) : (
                  <PriorityBadge priority={ticket.priority} />
                )}
              </div>

              {/* Assignee */}
              {isAdmin && (
                <div>
                  <div
                    className="form-label"
                    style={{ marginBottom: 5 }}
                  >
                    Assignee
                  </div>

                  <select
                    className="select"
                    value={ticket.assigned_to ?? ''}
                    onChange={(e) =>
                      handleAdminPatch({
                        assignedTo: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  >
                    <option value="">Unassigned</option>

                    {admins.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {admin.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Other ticket information */}
              <div
                style={{
                  borderTop: '1px solid var(--border)',
                  paddingTop: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  fontSize: 12.5,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>
                    Category
                  </span>
                  <span style={{ fontWeight: 600 }}>
                    {formatCategoryLabel(ticket.category)}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>
                    Requester
                  </span>
                  <span style={{ fontWeight: 600 }}>
                    {ticket.submitter_name}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>
                    Created
                  </span>
                  <span>
                    {formatRelativeTime(ticket.created_at)}
                  </span>
                </div>

                {ticket.resolved_at && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)' }}>
                      Resolved
                    </span>

                    <span
                      style={{
                        color: '#047857',
                        fontWeight: 600,
                      }}
                    >
                      {formatRelativeTime(ticket.resolved_at)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Event timeline */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Event Timeline</h3>
            </div>

            <div className="card-body">
              {activity.length === 0 ? (
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-muted)',
                  }}
                >
                  No events logged.
                </div>
              ) : (
                <div className="timeline">
                  {activity.map((ev) => (
                    <div key={ev.id} className="timeline-item">
                      <span className="timeline-dot" />

                      <div className="timeline-event-tag">
                        {ev.event_type}
                      </div>

                      <div className="timeline-summary">
                        {ev.summary}
                      </div>

                      <div className="timeline-time">
                        {formatDateTime(ev.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Edit ticket modal */}
      <TicketModal
        open={editOpen}
        ticket={ticket}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => {
          setTicket(updated);
          onMutated();
          refreshActivity(updated.id);
        }}
      />
    </div>
  );
}
