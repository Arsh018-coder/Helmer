import { NextResponse } from 'next/server';
import { authenticateWithCredentials } from '../../../../server/userStore';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: 'Email and password are required.' }, { status: 400 });
    }

    const { user, token } = authenticateWithCredentials(email, password);

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
      { ok: false, error: error?.message || 'Invalid email or password.' },
      { status: 401 }
    );
  }
}
