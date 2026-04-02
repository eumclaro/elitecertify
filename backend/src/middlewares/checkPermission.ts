import { Request, Response, NextFunction } from 'express';
import { PERMISSIONS, PermissionKey } from '../config/permissions';

export const checkPermission = (permission: PermissionKey) => {
  return (req: any, res: any, next: any) => {
    // A rota deve ser protegida antes por authenticateToken (que injeta req.user)
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const { role } = req.user;
    
    // Obter as permissões da rule ou defaults para false se der algo errado
    const rolePermissions = PERMISSIONS[role as keyof typeof PERMISSIONS];

    if (!rolePermissions || typeof rolePermissions[permission] === 'undefined' || !rolePermissions[permission]) {
      return res.status(403).json({ error: 'Acesso negado: você não tem permissão para esta ação' });
    }

    next();
  };
};
