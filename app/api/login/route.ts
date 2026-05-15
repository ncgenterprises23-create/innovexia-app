import { NextRequest, NextResponse } from 'next/server';
import { getAllUsers, getClientInterfaceData } from '@/lib/sheets';
import bcrypt from 'bcryptjs';

const createSessionId = (request: NextRequest) => {
  const headerId = request.headers.get('x-session-id')?.trim();
  if (headerId) return headerId;
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
};

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // 1. Try to find in ERP Users
    const users = await getAllUsers();
    let user = users.find((u: any) => u.username === username);
    let isClient = false;

    // 2. If not found in ERP, try Client Users
    if (!user) {
        try {
            console.log('[Login] Checking Client Users for:', username);
            const clientUsers = await getClientInterfaceData('Client User');
            
            // Find user with case-insensitive username match and trimmed values
            const clientUser = clientUsers.find((u: any) => 
                String(u.Username || '').trim().toLowerCase() === String(username).trim().toLowerCase()
            );

            if (clientUser) {
                console.log('[Login] Found Client User match:', clientUser.Username);
                user = {
                    id: `client-${clientUser.Username}`,
                    username: String(clientUser.Username).trim(),
                    password: String(clientUser.Password).trim(), // Ensure password is a string
                    role_name: 'Client',
                    full_name: clientUser.Username
                };
                isClient = true;
            }
        } catch (e) {
            console.error('Error fetching client users during login:', e);
        }
    }

    if (!user) {
      console.log('[Login] No user found for:', username);
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Check if password is valid
    let isPasswordValid = false;
    const incomingPassword = String(password).trim();

    if (!isClient) {
        // ERP Users might have hashed passwords
        const isHashed = user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$');
        if (isHashed) {
            isPasswordValid = await bcrypt.compare(incomingPassword, user.password);
        } else {
            isPasswordValid = incomingPassword === String(user.password).trim();
        }
    } else {
        // Client Users are plain text
        isPasswordValid = incomingPassword === user.password;
    }

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    const sessionId = createSessionId(request);

    const userData = {
      id: user.id,
      username: user.username,
      email: user.email || '',
      full_name: user.full_name || user.username,
      role_name: user.role_name || 'User',
      late_long: user.late_long || '',
    };

    // Create response with auth cookie keyed by sessionId so tabs are isolated
    const response = NextResponse.json({
      success: true,
      sessionId,
      user: userData,
    });

    // Set httpOnly cookie per session to avoid cross-tab logout
    console.log('[Login Debug] Setting auth cookie for session:', sessionId);
    console.log('[Login Debug] Cookie options:', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    response.cookies.set(`auth-${sessionId}`, JSON.stringify(userData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    response.headers.set('x-session-id', sessionId);

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
