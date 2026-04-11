import dotenv from 'dotenv';
import path from 'path';

// In production (Docker), env vars come from docker-compose/Coolify environment.
// dotenv is only needed for local development where we use a .env file.
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

// Validate critical env vars — crash early with a clear message instead of
// failing silently at runtime with cryptic Prisma errors
if (!process.env.DATABASE_URL) {
  console.error('❌ FATAL: DATABASE_URL is not defined. Check your environment variables.');
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET is not defined. Check your environment variables.');
  process.exit(1);
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET!,
  PORT: parseInt(process.env.PORT || '3333', 10),
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5179',
  PRODUCTION_URL: process.env.PRODUCTION_URL || 'https://certify.elitetraining.com.br',
  NODE_ENV: process.env.NODE_ENV || 'development',
  MANDRILL_API_KEY: process.env.MANDRILL_API_KEY || '',
};
