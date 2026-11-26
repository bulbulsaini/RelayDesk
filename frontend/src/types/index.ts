export type UserRole = 'user' | 'admin';

export type TicketCategory = 'technical' | 'billing' | 'account' | 'feature_request' | 'other';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  created_at?: string;
}

export interface Ticket {
  id: number;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  user_id: number;
  assigned_to: number | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  submitter_name: string;
  submitter_email: string;
  assignee_name: string | null;
  comment_count: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TicketStats {
  total: number;
  byStatus: Record<TicketStatus, number>;
  byPriority: Record<TicketPriority, number>;
  byCategory: Record<string, number>;
}

export interface TicketComment {
  id: number;
  ticket_id: number;
  user_id: number;
  body: string;
  created_at: string;
  author_name: string;
  author_role: UserRole;
}

export interface ActivityEntry {
  id: number;
  ticket_id: number | null;
  actor_id: number | null;
  event_type: string;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_name: string | null;
  actor_role: UserRole | null;
  ticket_title?: string | null;
}

export interface NotificationItem {
  id: number;
  ticket_id: number | null;
  event_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}
