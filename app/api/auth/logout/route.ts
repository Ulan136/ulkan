// app/api/auth/logout/route.ts
import { NextResponse } from 'next/server'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.headers.set('Set-Cookie', 'ukan_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')
  return res
}
