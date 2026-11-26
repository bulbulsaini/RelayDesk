
import 'dotenv/config';

export const env = {
  port: Number(process.env.PORT) || 3000,

  databaseUrl: process.env.DATABASE_URL || '',

  nodeEnv: process.env.NODE_ENV || 'development',

  clientOrigin:
    process.env.CLIENT_ORIGIN || 'http://localhost:5173',

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || ''
  }
};
