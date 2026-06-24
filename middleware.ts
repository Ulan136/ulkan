import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionFromRequest } from './lib/auth'

<<<<<<< HEAD
const PUBLIC = ['/login', '/register', '/track', '/api/auth', '/api/track', '/api/client']
=======
const PUBLIC_PATHS = ['/login', '/register', '/track', '/_next', '/favicon', '/api/auth', '/api/track', '/api/client']
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

<<<<<<< HEAD
  if (pathname === '/client' || pathname.startsWith('/client/')) return NextResponse.next()
  if (pathname.startsWith('/rsp/')) return NextResponse.next()
  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) return NextResponse.next()
  if (pathname === '/') return NextResponse.next()

  const session = await getSessionFromRequest(req)
=======
  // Публичные пути
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (pathname === '/') return NextResponse.next()

  const session = await getSessionFromRequest(req)

  // Не авторизован — редирект на логин
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
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