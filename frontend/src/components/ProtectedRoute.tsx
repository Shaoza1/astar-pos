import { Navigate } from 'react-router-dom';
import type { StaffRole } from '@astar-pos/shared';

import { useAuth } from '@/store/auth.context';

interface Props {
  children: React.ReactNode;
  roles?: StaffRole[];
}

export function ProtectedRoute({ children, roles }: Props) {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && role && !roles.includes(role)) return <Navigate to="/unauthorized" replace />;

  return <>{children}</>;
}
