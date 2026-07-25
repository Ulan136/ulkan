import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { getNomTree } from '@/lib/nomTreeCache'

// GET — фактическое дерево 1С-групп из базы (group → cat → subgroup + счётчики).
// Кэш в памяти со сбросом на мутацию номенклатуры (см. lib/nomTreeCache).
export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response
  const tree = await getNomTree()
  return NextResponse.json(tree)
}
