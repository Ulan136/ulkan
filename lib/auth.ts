import { SignJWT, jwtVerify } from 'jose'
import { NextRequest } from 'next/server'

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'fallback-secret-min-32-chars-here!!'
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

// ТОЛЬКО для API routes
export async function getSessionFromRequest(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get('ukan_session')?.value
  if (!token) return null
  return verifyToken(token)
}

// Для Server Components
export async function getSession(): Promise<SessionUser | null> {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const token = cookieStore.get('ukan_session')?.value
  if (!token) return null
  return verifyToken(token)
}
