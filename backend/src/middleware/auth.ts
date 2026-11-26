import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { DbPool } from '../config/db';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

export type UserRole = 'user' | 'admin';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface JwtPayload {
  sub: number;
  role: UserRole;
}

export function createAuthMiddleware(pool: DbPool) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const header = req.headers.authorization;
      if (!header || !header.startsWith('Bearer ')) {
        throw new UnauthorizedError('Missing or invalid authorization header');
      }

      const token = header.slice(7).trim();
      const decoded = jwt.verify(token, env.jwtSecret) as unknown as JwtPayload;

      const result = await pool.query<AuthUser>(
        'SELECT id, name, email, role FROM users WHERE id = $1',
        [decoded.sub]
      );

      if (result.rows.length === 0) {
        throw new UnauthorizedError('User account no longer exists');
      }

      req.user = result.rows[0];
      next();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        next(err);
      } else {
        next(new UnauthorizedError('Invalid or expired authentication token'));
      }
    }
  };
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('Admin privileges required for this action'));
    }
    next();
  };
}
