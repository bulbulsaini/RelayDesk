import { EventEmitter } from 'node:events';
import { DomainEventMap, DomainEventName } from './types';

type EventHandler<K extends DomainEventName> = (payload: DomainEventMap[K]) => Promise<void> | void;

export class TicketEventBus {
  private emitter = new EventEmitter();
  private inflight = new Set<Promise<void>>();

  on<K extends DomainEventName>(event: K, handler: EventHandler<K>): void {
    this.emitter.on(event, (payload: DomainEventMap[K]) => {
      const task = Promise.resolve(handler(payload)).catch((err) => {
        console.error(`[EventBus:${event}] listener failed:`, err);
      });
      this.inflight.add(task);
      task.finally(() => this.inflight.delete(task));
    });
  }

  emit<K extends DomainEventName>(event: K, payload: DomainEventMap[K]): void {
    this.emitter.emit(event, payload);
  }

  async waitForIdle(): Promise<void> {
    while (this.inflight.size > 0) {
      await Promise.all(Array.from(this.inflight));
    }
  }
}
