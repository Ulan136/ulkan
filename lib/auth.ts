import { SignJWT, jwtVerify } from 'jose'
import { NextRequest } from 'next/server'

const SECRET = new TextEncoder().encode(
<<<<<<< HEAD
  process.env.AUTH_SECRET || 'fallback-secret-min-32-chars-here'
=======
  process.env.AUTH_SECRET || 'ukan-fallback-secret-min-32-chars-here'
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
)

export interface SessionUser {
  id: string
  name: string
  email?: string
  phone?: string
  role: string
  slug?: string
}

export async function createToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET)
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessionUser
  } catch {
    return null
  }
}

<<<<<<< HEAD
export async function getSessionFromRequest(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get('ukan_session')?.value
  if (!token) return null
  return verifyToken(token)
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('ukan_session')?.value
=======
// ✓ Для API routes — всегда использовать этот метод
export async function getSessionFromRequest(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get('ukan_session')?.value
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
  if (!token) return null
  return verifyToken(token)
}

// ✓ Для Server Components
export async function getSession(): Promise<SessionUser | null> {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const token = cookieStore.get('ukan_session')?.value
  if (!token) return null
  return verifyToken(token)
}

export function setSessionCookie(res: Response, token: string): void {
  const maxAge = 7 * 24 * 3600
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.headers.set(
    'Set-Cookie',
    `ukan_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
  )
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('7')) return `+${digits}`
  if (digits.length === 10) return `+7${digits}`
  if (digits.length === 11 && digits.startsWith('8')) return `+7${digits.slice(1)}`
  return raw.trim()
}