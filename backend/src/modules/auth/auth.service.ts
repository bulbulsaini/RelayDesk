import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { DbPool } from '../../config/db';
import { env } from '../../config/env';
import { AuthUser } from '../../middleware/auth';
import { ConflictError, UnauthorizedError } from '../../utils/errors';
import { LoginInput, RegisterInput } from './auth.schema';

interface UserRow extends AuthUser {
  password_hash: string;
  created_at: Date;
}

function signToken(user: AuthUser): string {
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, options);
}

export class AuthService {
  constructor(private readonly pool: DbPool) {}

  async register(input: RegisterInput) {
    const existing = await this.pool.query<{ id: number }>(
      'SELECT id FROM users WHERE email = $1',
      [input.email]
    );
    if (existing.rows.length > 0) {
      throw new ConflictError('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    // Public signup always creates a standard user; admins are provisioned explicitly.
    const result = await this.pool.query<AuthUser>(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'user')
       RETURNING id, name, email, role`,
      [input.name, input.email, passwordHash]
    );

    const user = result.rows[0];
    return {
      user,
      token: signToken(user),
    };
  }

  async login(input: LoginInput) {
    const result = await this.pool.query<UserRow>(
      'SELECT id, name, email, role, password_hash FROM users WHERE email = $1',
      [input.email]
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const row = result.rows[0];
    const matches = await bcrypt.compare(input.password, row.password_hash);
    if (!matches) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const user: AuthUser = {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
    };

    return {
      user,
      token: signToken(user),
    };
  }
}
