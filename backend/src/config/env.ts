import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret',
  PORT: parseInt(process.env.PORT || '3333', 10),
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5179',
  PRODUCTION_URL: process.env.PRODUCTION_URL || 'https://certify.elitetraining.com.br',
  NODE_ENV: process.env.NODE_ENV || 'development',
  MANDRILL_API_KEY: process.env.MANDRILL_API_KEY || '',
};
