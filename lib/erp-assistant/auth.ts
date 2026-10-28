import { NextRequest } from 'next/server';

export interface SessionUser {
  id: number;
  username: string;
  full_name?: string;
  role_name?: string;
  email?: string;
}

export function getSessionUser(request: NextRequest): SessionUser | null {
  const sessionId = request.headers.get('x-session-id')?.trim();
  const cookieName = sessionId ? `auth-${sessionId}` : 'auth';
  const cookie = request.cookies.get(cookieName);
  const genericCookie = request.cookies.get('auth');
  const authCookie = cookie?.value || (!sessionId ? genericCookie?.value : undefined);

  if (!authCookie) return null;

  try {
    const user = JSON.parse(authCookie) as SessionUser;
    if (!user?.id) return null;
    return user;
  } catch {
    return null;
  }
}

export function normalizeRole(role?: string): string {
  if (!role) return 'Employee';
  const r = role.trim();
  if (r.toLowerCase() === 'admin') return 'Admin';
  if (r.toLowerCase() === 'manager') return 'Manager';
  if (r.toLowerCase() === 'employee' || r.toLowerCase() === 'user') return 'Employee';
  return r;
}

export function roleAllowed(userRole: string, allowedRoles: string[]): boolean {
  const role = normalizeRole(userRole);
  if (role === 'Admin') return true;
  return allowedRoles.some((a) => normalizeRole(a) === role);
}
