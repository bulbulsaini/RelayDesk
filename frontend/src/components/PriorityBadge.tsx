import { AlertCircle, ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { TicketPriority } from '../types';

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const icon =
    priority === 'urgent' ? (
      <AlertCircle size={14} />
    ) : priority === 'high' ? (
      <ArrowUp size={14} />
    ) : priority === 'low' ? (
      <ArrowDown size={14} />
    ) : (
      <Minus size={14} />
    );

  return (
    <span className={`priority-pill priority-${priority}`}>
      {icon}
      {priority}
    </span>
  );
}
