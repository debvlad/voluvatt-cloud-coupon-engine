import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import type { Role } from '../types';

export function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: Role[] }) {
  const { loading, user, profile, hasRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="grid min-h-[50vh] place-items-center text-center text-navy/70">Loading Võluvatt Coupons…</div>;
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  if (!profile?.active) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !hasRole(roles)) {
    return (
      <div className="rounded-[2rem] bg-white p-8 text-center shadow-soft">
        <h1 className="text-2xl font-black text-navy">Access denied</h1>
        <p className="mt-2 text-navy/70">Your account is not authorized for this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}
