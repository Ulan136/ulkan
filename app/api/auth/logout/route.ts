import { NextResponse } from 'next/server'

export async function POST() {
  const res = NextResponse.json({ ok: true })
<<<<<<< HEAD
  res.cookies.set('ukan_session', '', { httpOnly: true, maxAge: 0, path: '/' })
=======
  res.headers.set('Set-Cookie', 'ukan_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
  return res
}