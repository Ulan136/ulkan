// middleware.ts — ДИАГНОСТИКА: минимальная версия без импортов auth/jose.
// Задача: проверить, падает ли Edge-middleware сам по себе (платформа/кэш)
// или из-за импорта auth-edge. После диагностики логика будет восстановлена.
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(_req: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
