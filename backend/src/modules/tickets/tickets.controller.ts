import { Request, Response } from 'express';
import { TicketsService } from './tickets.service';
import { ListTicketsQuery } from './tickets.schema';

export class TicketsController {
  constructor(private readonly service: TicketsService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.listTickets(req.query as unknown as ListTicketsQuery, req.user!);
    res.json(result);
  };

  stats = async (req: Request, res: Response): Promise<void> => {
    const stats = await this.service.getStats(req.user!);
    res.json({ stats });
  };

  getOne = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    const ticket = await this.service.getTicketById(id, req.user!);
    res.json({ ticket });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const ticket = await this.service.createTicket(req.body, req.user!);
    res.status(201).json({ ticket });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    const ticket = await this.service.updateTicket(id, req.body, req.user!);
    res.json({ ticket });
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    await this.service.deleteTicket(id, req.user!);
    res.status(204).send();
  };
}
