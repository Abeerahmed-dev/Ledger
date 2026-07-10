import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  verifyCredentials,
} from '../../../../lib/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const username = String(body.username || '').trim();
    const password = String(body.password || '');

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
    }

    const isValid = await verifyCredentials(username, password);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    const token = await createSessionToken();
    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 500 });
  }
}
