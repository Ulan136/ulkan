import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const all = searchParams.get('all') === '1'
  const group = searchParams.get('group') || ''
  const limit = parseInt(searchParams.get('limit') || '12')

  if (all) {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const items = await prisma.nomenclature.findMany({
      where: group ? { group } : undefined,
      orderBy: [{ group: 'asc' }, { cat: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json(items)
  }

  if (!q || q.length < 1) return NextResponse.json([])

  // Нормализация: заменяем , на . и наоборот для поиска
  // Ищем оба варианта чтобы "0,45" нашёл "0.45" и наоборот
  const qNorm = q.trim()
  const qAlt = qNorm.includes(',') ? qNorm.replace(/,/g, '.') : qNorm.replace(/\./g, ',')
  const words = qNorm.split(/\s+/).filter(w => w.length >= 1)
  const wordsAlt = qAlt.split(/\s+/).filter(w => w.length >= 1)
  const groupFilter = group ? { group } : {}

  // Поиск с нормализацией запятая/точка
  async function search(searchWords: string[], take: number) {
    return prisma.nomenclature.findMany({
      where: { ...groupFilter, AND: searchWords.map(w => ({ name: { contains: w, mode: 'insensitive' as const } })) },
      orderBy: { name: 'asc' }, take,
    })
  }

  // Точное вхождение (оригинал и альтернатива)
  const [exact1, exact2] = await Promise.all([
    prisma.nomenclature.findMany({ where: { ...groupFilter, name: { contains: qNorm, mode: 'insensitive' } }, orderBy: { name: 'asc' }, take: limit }),
    qAlt !== qNorm ? prisma.nomenclature.findMany({ where: { ...groupFilter, name: { contains: qAlt, mode: 'insensitive' } }, orderBy: { name: 'asc' }, take: limit }) : Promise.resolve([]),
  ])
  const exact = [...exact1, ...exact2.filter(i => !exact1.find(e => e.id === i.id))]
  if (exact.length >= 3) return NextResponse.json(exact.slice(0, limit))

  // По словам AND (оригинал + альтернатива)
  const [byWords1, byWords2] = await Promise.all([
    search(words, limit),
    wordsAlt.join('') !== words.join('') ? search(wordsAlt, limit) : Promise.resolve([]),
  ])
  const byWords = [...byWords1, ...byWords2.filter(i => !byWords1.find(e => e.id === i.id))]
  if (byWords.length > 0) {
    const all = [...exact]
    byWords.forEach(i => { if (!all.find(e => e.id === i.id)) all.push(i) })
    return NextResponse.json(all.slice(0, limit))
  }

  // OR поиск
  const allWords = [...new Set([...words, ...wordsAlt])]
  const byAny = await prisma.nomenclature.findMany({
    where: { ...groupFilter, OR: allWords.map(w => ({ name: { contains: w, mode: 'insensitive' as const } })) },
    orderBy: { name: 'asc' }, take: limit,
  })
  const scored = byAny
    .map(item => ({ ...item, score: allWords.filter(w => item.name.toLowerCase().includes(w.toLowerCase())).length }))
    .sort((a, b) => b.score - a.score)
  return NextResponse.json(scored.map(({ score, ...item }) => item))
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })
  const { name, unit, cat, group, subgroup } = await req.json()
  if (!name) return NextResponse.json({ error: 'Название обязательно' }, { status: 400 })
  const item = await prisma.nomenclature.create({
    data: { name, unit: unit || 'шт', cat: cat || '', group: group || '', subgroup: subgroup || '' }
  })
  return NextResponse.json(item, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })
  const { id, name, unit, cat, group, subgroup } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })
  const item = await prisma.nomenclature.update({
    where: { id }, data: { name, unit, cat, group, subgroup: subgroup || '' }
  })
  return NextResponse.json(item)
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })
  await prisma.nomenclature.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
