import { TicketStatus } from '../types';

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={`badge status-${status}`}>
      <span className="badge-dot" />
      {STATUS_LABELS[status] || status}
    </span>
  );
}
