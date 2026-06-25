import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'

// GET — поиск (публичный) или все записи (для настроек)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const all = searchParams.get('all') === '1'
  const group = searchParams.get('group') || ''
  const limit = parseInt(searchParams.get('limit') || '12')

  // Все записи для настроек — требует авторизации
  if (all) {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const items = await prisma.nomenclature.findMany({
      where: group ? { group } : undefined,
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json(items)
  }

  // Поиск — публичный
  if (!q || q.length < 1) return NextResponse.json([])

  const words = q.trim().split(/\s+/).filter(w => w.length >= 1)

  // Фильтр по группе если указана
  const groupFilter = group ? { group } : {}

  // Точное вхождение
  const exact = await prisma.nomenclature.findMany({
    where: { ...groupFilter, name: { contains: q, mode: 'insensitive' } },
    orderBy: { name: 'asc' },
    take: limit,
  })
  if (exact.length >= 3) return NextResponse.json(exact)

  // По всем словам (AND)
  const byWords = await prisma.nomenclature.findMany({
    where: {
      ...groupFilter,
      AND: words.map(w => ({ name: { contains: w, mode: 'insensitive' as const } }))
    },
    orderBy: { name: 'asc' },
    take: limit,
  })

  if (byWords.length > 0) {
    const all = [...exact]
    byWords.forEach(i => { if (!all.find(e => e.id === i.id)) all.push(i) })
    return NextResponse.json(all.slice(0, limit))
  }

  // По любому слову (OR) + сортировка по количеству совпадений
  const byAny = await prisma.nomenclature.findMany({
    where: {
      ...groupFilter,
      OR: words.map(w => ({ name: { contains: w, mode: 'insensitive' as const } }))
    },
    orderBy: { name: 'asc' },
    take: limit,
  })

  const scored = byAny
    .map(item => ({ ...item, score: words.filter(w => item.name.toLowerCase().includes(w.toLowerCase())).length }))
    .sort((a, b) => b.score - a.score)

  return NextResponse.json(scored.map(({ score, ...item }) => item))
}

// POST — создать
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'super_admin') return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })

  const { name, unit, cat, group } = await req.json()
  if (!name) return NextResponse.json({ error: 'Название обязательно' }, { status: 400 })

  const item = await prisma.nomenclature.create({
    data: { name, unit: unit || 'шт', cat: cat || '', group: group || '' }
  })
  return NextResponse.json(item, { status: 201 })
}

// PUT — обновить
export async function PUT(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'super_admin') return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })

  const { id, name, unit, cat, group } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })

  const item = await prisma.nomenclature.update({
    where: { id },
    data: { name, unit, cat, group }
  })
  return NextResponse.json(item)
}

// DELETE — удалить
export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'super_admin') return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })

  await prisma.nomenclature.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
