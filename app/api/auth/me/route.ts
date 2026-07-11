import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response
  return NextResponse.json({ user: auth.session })
}
