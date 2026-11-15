import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { DashboardSkeleton } from './Skeletons.tsx';
import { useAuth } from '../context/AuthContext.tsx';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B1115] p-6 lg:p-10">
        <DashboardSkeleton />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
