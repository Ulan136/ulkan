// lib/auth.ts
// Реэкспорт edge-безопасного ядра + серверные функции (next/headers).
// НЕ импортировать этот файл из middleware — используйте lib/auth-edge.
export type { SessionUser } from './auth-edge'
export { createToken, verifyToken, getSessionFromRequest } from './auth-edge'

import { verifyToken } from './auth-edge'
import type { SessionUser } from './auth-edge'

// ✓ Для Server Components (использует next/headers — только в Node-рантайме)
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
