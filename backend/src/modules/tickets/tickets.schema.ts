import { z } from 'zod';

export const TICKET_CATEGORIES = ['technical', 'billing', 'account', 'feature_request', 'other'] as const;
export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;

export const ticketIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Ticket ID must be a positive integer'),
});

export const createTicketSchema = z.object({
  title: z.string().trim().min(4, 'Title must be at least 4 characters').max(180),
  description: z.string().trim().min(10, 'Please provide at least 10 characters of detail').max(5000),
  category: z.enum(TICKET_CATEGORIES).default('technical'),
  priority: z.enum(TICKET_PRIORITIES).default('medium'),
});

export const updateTicketSchema = z
  .object({
    title: z.string().trim().min(4).max(180).optional(),
    description: z.string().trim().min(10).max(5000).optional(),
    category: z.enum(TICKET_CATEGORIES).optional(),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    status: z.enum(TICKET_STATUSES).optional(),
    assignedTo: z.number().int().positive().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  });

export const listTicketsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
  userId: z.coerce.number().int().positive().optional(),
  sortBy: z.enum(['created_at', 'updated_at', 'priority', 'status']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
