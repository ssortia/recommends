'use client';

import type { Role } from '@repo/types';

import { useRole } from './role-provider';

interface AccessProps {
  role: Role | Role[];
  children: React.ReactNode;
}

export function Access({ role, children }: AccessProps) {
  const userRole = useRole();
  const allowed = Array.isArray(role) ? role : [role];
  if (!userRole || !allowed.includes(userRole)) return null;
  return <>{children}</>;
}
