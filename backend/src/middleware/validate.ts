import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { BadRequestError } from '../utils/errors';

interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      next();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'issues' in err) {
        const issues = (err as { issues: Array<{ path: (string | number)[]; message: string }> }).issues;
        const formatted = issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        return next(new BadRequestError('Validation failed', formatted));
      }
      next(err);
    }
  };
}
