import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';

export async function auditMiddleware(action: string, entity: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await prisma.auditEvent.create({
        data: {
          userId: (req as any).user?.userId || null,
          action,
          entity,
          entityId: (req.params.id as any) || null,
          ip: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || null,
          device: (req.headers['user-agent'] as string) || null,
          metadata: JSON.stringify({ method: req.method, path: req.path }),
        },
      });
    } catch (e) {
      console.error('Audit log error:', e);
    }
    next();
  };
}

export function getClientInfo(req: Request) {
  return {
    ip: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown',
    device: req.headers['user-agent'] || 'unknown',
  };
}
