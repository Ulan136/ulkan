import { SignJWT, jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

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

// Единый гвард для API routes.
// - нет сессии          → { ok: false, response: 401 "Не авторизован" }
// - roles задан и не совпал → { ok: false, response: 403 "Нет доступа" }
// - иначе               → { ok: true, session }
// Тип задан интерфейсом с опциональными полями (а не discriminated union),
// потому что в этом проекте strictNullChecks выключен и сужение union по
// дискриминанту ok не работает. При ok=true присутствует session, при
// ok=false — response.
export interface SessionResult {
  ok: boolean
  session?: SessionUser
  response?: NextResponse
}

export async function requireSession(req: NextRequest, roles?: string[]): Promise<SessionResult> {
  const session = await getSessionFromRequest(req)
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: 'Не авторизован' }, { status: 401 }) }
  }
  // Fallback для старых JWT без role: подтягиваем роль из БД по id.
  // Prisma импортируем динамически — эта функция вызывается только в API-роутах (Node),
  // а middleware (Edge) использует getSessionFromRequest напрямую и prisma не тянет.
  if (!session.role && session.id) {
    try {
      const { default: prisma } = await import('./prisma')
      const user = await prisma.user.findUnique({ where: { id: session.id }, select: { role: true } })
      if (user) session.role = user.role
    } catch { /* если БД недоступна — оставляем как есть */ }
  }
  if (roles && !roles.includes(session.role)) {
    return { ok: false, response: NextResponse.json({ error: 'Нет доступа' }, { status: 403 }) }
  }
  return { ok: true, session }
}
