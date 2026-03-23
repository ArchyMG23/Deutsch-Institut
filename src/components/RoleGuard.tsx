import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { profile, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-dia-red"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (profile?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
