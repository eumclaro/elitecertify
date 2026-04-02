import { useAuth } from '../contexts/AuthContext';
import { PERMISSIONS } from '../config/permissions';
import type { PermissionKey } from '../config/permissions';

export function usePermission() {
  const { user } = useAuth();
  
  const hasPermission = (permission: PermissionKey): boolean => {
    if (!user) return false;
    const rolePermissions = PERMISSIONS[user.role as keyof typeof PERMISSIONS];
    if (!rolePermissions) return false;
    return rolePermissions[permission] === true;
  };

  return { hasPermission };
}
