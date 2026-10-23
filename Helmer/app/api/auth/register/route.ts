import { NextResponse } from 'next/server';
import { registerUser } from '../../../../server/userStore';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name, role } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ ok: false, error: 'A valid email address is required.' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ ok: false, error: 'Password must be at least 6 characters long.' }, { status: 400 });
    }

    const { user, token } = registerUser(email, password, name, role);

    const response = NextResponse.json({ ok: true, user, token });

    // Set secure HTTP-only session cookie
    response.cookies.set('helmer_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Registration failed.' },
      { status: 400 }
    );
  }
}
