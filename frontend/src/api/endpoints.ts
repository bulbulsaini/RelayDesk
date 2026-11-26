import {
  ActivityEntry,
  NotificationItem,
  PaginationMeta,
  Ticket,
  TicketCategory,
  TicketComment,
  TicketPriority,
  TicketStats,
  TicketStatus,
  User,
} from '../types';
import { apiRequest } from './client';

export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (name: string, email: string, password: string) =>
    apiRequest<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),
  me: () => apiRequest<{ user: User }>('/auth/me'),
};

export interface TicketFilters {
  q?: string;
  status?: TicketStatus | '';
  priority?: TicketPriority | '';
  category?: TicketCategory | '';
  userId?: number | '';
  sortBy?: 'created_at' | 'updated_at' | 'priority' | 'status';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export const ticketsApi = {
  list: (filters: TicketFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== '') {
        params.set(key, String(val));
      }
    });
    const qs = params.toString();
    return apiRequest<{ items: Ticket[]; pagination: PaginationMeta }>(
      `/tickets${qs ? `?${qs}` : ''}`
    );
  },
  stats: () => apiRequest<{ stats: TicketStats }>('/tickets/stats'),
  get: (id: number) => apiRequest<{ ticket: Ticket }>(`/tickets/${id}`),
  create: (payload: {
    title: string;
    description: string;
    category: TicketCategory;
    priority: TicketPriority;
  }) =>
    apiRequest<{ ticket: Ticket }>('/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (
    id: number,
    payload: {
      title?: string;
      description?: string;
      category?: TicketCategory;
      priority?: TicketPriority;
      status?: TicketStatus;
      assignedTo?: number | null;
    }
  ) =>
    apiRequest<{ ticket: Ticket }>(`/tickets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  remove: (id: number) =>
    apiRequest<void>(`/tickets/${id}`, {
      method: 'DELETE',
    }),
  listComments: (ticketId: number) =>
    apiRequest<{ comments: TicketComment[] }>(`/tickets/${ticketId}/comments`),
  addComment: (ticketId: number, body: string) =>
    apiRequest<{ comment: TicketComment }>(`/tickets/${ticketId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
  listTicketActivity: (ticketId: number) =>
    apiRequest<{ activity: ActivityEntry[] }>(`/tickets/${ticketId}/activity`),
};

export const notificationsApi = {
  list: () =>
    apiRequest<{ notifications: NotificationItem[]; unreadCount: number }>('/notifications'),
  markRead: (id: number) =>
    apiRequest<{ notification: { id: number; is_read: boolean } }>(`/notifications/${id}/read`, {
      method: 'PATCH',
    }),
  markAllRead: () =>
    apiRequest<{ ok: boolean }>('/notifications/read-all', {
      method: 'PATCH',
    }),
};

export const adminApi = {
  listUsers: () => apiRequest<{ users: User[] }>('/users'),
  listActivity: (params: { eventType?: string; page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.eventType) qs.set('eventType', params.eventType);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const str = qs.toString();
    return apiRequest<{ items: ActivityEntry[]; pagination: PaginationMeta }>(
      `/activity${str ? `?${str}` : ''}`
    );
  },
};
