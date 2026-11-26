export type DomainEventName =
  | 'TICKET_CREATED'
  | 'TICKET_UPDATED'
  | 'STATUS_CHANGED'
  | 'COMMENT_ADDED'
  | 'TICKET_RESOLVED';

export interface TicketCreatedPayload {
  ticketId: number;
  ticketTitle: string;
  priority: string;
  category: string;
  actorId: number;
  actorName: string;
}

export interface TicketUpdatedPayload {
  ticketId: number;
  ticketTitle: string;
  ticketOwnerId: number;
  actorId: number;
  actorName: string;
  actorRole: 'user' | 'admin';
  changes: Record<string, { from: unknown; to: unknown }>;
}

export interface StatusChangedPayload {
  ticketId: number;
  ticketTitle: string;
  ticketOwnerId: number;
  actorId: number;
  actorName: string;
  fromStatus: string;
  toStatus: string;
}

export interface CommentAddedPayload {
  ticketId: number;
  ticketTitle: string;
  ticketOwnerId: number;
  commentId: number;
  actorId: number;
  actorName: string;
  actorRole: 'user' | 'admin';
  preview: string;
}

export interface TicketResolvedPayload {
  ticketId: number;
  ticketTitle: string;
  ticketOwnerId: number;
  actorId: number;
  actorName: string;
}

export interface DomainEventMap {
  TICKET_CREATED: TicketCreatedPayload;
  TICKET_UPDATED: TicketUpdatedPayload;
  STATUS_CHANGED: StatusChangedPayload;
  COMMENT_ADDED: CommentAddedPayload;
  TICKET_RESOLVED: TicketResolvedPayload;
}
