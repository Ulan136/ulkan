import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'
import { pushSignal } from '@/lib/pusherServer'
import { invalidateNomTree } from '@/lib/nomTreeCache'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const all = searchParams.get('all') === '1'
  const group = searchParams.get('group') || ''
  const cat = searchParams.get('cat') || ''
  const subgroup = searchParams.get('subgroup') || ''
  const limit = parseInt(searchParams.get('limit') || '12')

  // Фильтр ПО ПОЛЯМ базы (не по словам имени). Путь group/cat УСТОЙЧИВ к
  // перепутанным полям 1С (часть импортов легла с group↔cat, напр. «Евро брус»:
  // group='Евро брус', cat='Товары') — сверяем пару в любой ориентации. subgroup
  // (производитель) — точный. Собираем условия списком для AND.
  const baseConds: any[] = []
  if (group && cat) baseConds.push({ OR: [{ group, cat }, { group: cat, cat: group }] })
  else if (group) baseConds.push({ OR: [{ group }, { cat: group }] })
  else if (cat) baseConds.push({ OR: [{ cat }, { group: cat }] })
  if (subgroup) baseConds.push({ subgroup })
  const hasField = baseConds.length > 0
  const baseWhere = hasField ? { AND: baseConds } : undefined

  if (all) {
    const auth = await requireSession(req)
    if (!auth.ok) return auth.response
    const items = await prisma.nomenclature.findMany({
      where: baseWhere,
      orderBy: [{ group: 'asc' }, { cat: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json(items)
  }

  // Пустой запрос, но выбрана папка/производитель → отдать записи этой выборки
  // (тап по папке показывает её позиции без ввода слов).
  if (!q || q.length < 1) {
    if (hasField) {
      const items = await prisma.nomenclature.findMany({ where: baseWhere, orderBy: { name: 'asc' }, take: limit })
      return NextResponse.json(items)
    }
    return NextResponse.json([])
  }

  // Нормализация: заменяем , на . и наоборот для поиска
  // Ищем оба варианта чтобы "0,45" нашёл "0.45" и наоборот
  const qNorm = q.trim()
  const qAlt = qNorm.includes(',') ? qNorm.replace(/,/g, '.') : qNorm.replace(/\./g, ',')
  const words = qNorm.split(/\s+/).filter(w => w.length >= 1)
  const wordsAlt = qAlt.split(/\s+/).filter(w => w.length >= 1)

  // Поиск с нормализацией запятая/точка (поля-условия baseConds + слова в AND)
  async function search(searchWords: string[], take: number) {
    return prisma.nomenclature.findMany({
      where: { AND: [...baseConds, ...searchWords.map(w => ({ name: { contains: w, mode: 'insensitive' as const } }))] },
      orderBy: { name: 'asc' }, take,
    })
  }

  // Точное вхождение (оригинал и альтернатива)
  const [exact1, exact2] = await Promise.all([
    prisma.nomenclature.findMany({ where: { AND: [...baseConds, { name: { contains: qNorm, mode: 'insensitive' as const } }] }, orderBy: { name: 'asc' }, take: limit }),
    qAlt !== qNorm ? prisma.nomenclature.findMany({ where: { AND: [...baseConds, { name: { contains: qAlt, mode: 'insensitive' as const } }] }, orderBy: { name: 'asc' }, take: limit }) : Promise.resolve([]),
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
    where: { AND: [...baseConds, { OR: allWords.map(w => ({ name: { contains: w, mode: 'insensitive' as const } })) }] },
    orderBy: { name: 'asc' }, take: limit,
  })
  const scored = byAny
    .map(item => ({ ...item, score: allWords.filter(w => item.name.toLowerCase().includes(w.toLowerCase())).length }))
    .sort((a, b) => b.score - a.score)
  return NextResponse.json(scored.map(({ score, ...item }) => item))
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, ['super_admin', 'bookkeeper'])
  if (!auth.ok) return auth.response
  const { name, unit, cat, group, subgroup } = await req.json()
  if (!name) return NextResponse.json({ error: 'Название обязательно' }, { status: 400 })
  const item = await prisma.nomenclature.create({
    data: { name, unit: unit || 'шт', cat: cat || '', group: group || '', subgroup: subgroup || '' }
  })
  invalidateNomTree()
  await pushSignal('settings')
  return NextResponse.json(item, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(req, ['super_admin', 'bookkeeper'])
  if (!auth.ok) return auth.response
  const { id, name, unit, cat, group, subgroup } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })
  const item = await prisma.nomenclature.update({
    where: { id }, data: { name, unit, cat, group, subgroup: subgroup || '' }
  })
  invalidateNomTree()
  await pushSignal('settings')
  return NextResponse.json(item)
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(req, ['super_admin', 'bookkeeper'])
  if (!auth.ok) return auth.response
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })
  await prisma.nomenclature.delete({ where: { id } })
  invalidateNomTree()
  await pushSignal('settings')
  return NextResponse.json({ ok: true })
}
