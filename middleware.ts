import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionFromRequest } from './lib/auth'

const PUBLIC = ['/login', '/register', '/track', '/api/auth', '/api/track', '/api/client']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname === '/client' || pathname.startsWith('/client/')) return NextResponse.next()
  if (pathname.startsWith('/rsp/')) return NextResponse.next()
  if (pathname.startsWith('/warehouse/')) return NextResponse.next()
  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) return NextResponse.next()
  if (pathname === '/') return NextResponse.next()

  const session = await getSessionFromRequest(req)
  if (!session) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
