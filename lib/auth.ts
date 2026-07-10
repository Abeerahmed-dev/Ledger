export const SESSION_COOKIE = 'erp_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export function getAdminCredentials() {
  return {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  };
}

export async function createSessionToken(): Promise<string> {
  const { username, password } = getAdminCredentials();
  const encoder = new TextEncoder();
  const data = encoder.encode(`${username}:${password}:ledger-session`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  const admin = getAdminCredentials();
  return username === admin.username && password === admin.password;
}
