// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionFromRequest } from './lib/auth-edge'

const PUBLIC_PATHS = ['/login', '/register', '/track', '/_next', '/favicon', '/api/auth', '/api/track', '/api/client']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Публичные пути
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (pathname === '/') return NextResponse.next()

  const session = await getSessionFromRequest(req)

  // Не авторизован — редирект на логин
  if (!session) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }

  // Клиент пытается зайти в Admin
  if (pathname.startsWith('/admin') && !['super_admin', 'bookkeeper'].includes(session.role)) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  // Логист пытается зайти в Admin
  if (pathname.startsWith('/admin') && session.role === 'logist') {
    return NextResponse.redirect(new URL(`/rsp/${session.slug}`, req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
