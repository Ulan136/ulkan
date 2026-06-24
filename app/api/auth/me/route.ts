<<<<<<< HEAD
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  return NextResponse.json(session)
}
=======
// app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  return NextResponse.json({ user: session })
}
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
