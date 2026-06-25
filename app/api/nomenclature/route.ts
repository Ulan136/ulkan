import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const limit = parseInt(searchParams.get('limit') || '12')

  if (!q || q.length < 1) return NextResponse.json([])

  // Разбиваем запрос на слова и ищем каждое
  const words = q.trim().split(/\s+/).filter(w => w.length >= 1)

  if (words.length === 0) return NextResponse.json([])

  // Сначала ищем точное вхождение всей строки
  const exact = await prisma.nomenclature.findMany({
    where: { name: { contains: q, mode: 'insensitive' } },
    orderBy: { name: 'asc' },
    take: limit,
    select: { id: true, name: true, unit: true, cat: true }
  })

  // Если нашли достаточно — возвращаем
  if (exact.length >= 3) return NextResponse.json(exact)

  // Иначе ищем по каждому слову отдельно (AND логика)
  const byWords = await prisma.nomenclature.findMany({
    where: {
      AND: words.map(word => ({
        name: { contains: word, mode: 'insensitive' as const }
      }))
    },
    orderBy: { name: 'asc' },
    take: limit,
    select: { id: true, name: true, unit: true, cat: true }
  })

  if (byWords.length > 0) {
    // Объединяем exact + byWords без дублей
    const all = [...exact]
    byWords.forEach(item => {
      if (!all.find(e => e.id === item.id)) all.push(item)
    })
    return NextResponse.json(all.slice(0, limit))
  }

  // Если AND не нашёл — пробуем OR (хотя бы одно слово)
  const byAny = await prisma.nomenclature.findMany({
    where: {
      OR: words.map(word => ({
        name: { contains: word, mode: 'insensitive' as const }
      }))
    },
    orderBy: { name: 'asc' },
    take: limit,
    select: { id: true, name: true, unit: true, cat: true }
  })

  // Сортируем — больше совпадений слов = выше
  const scored = byAny.map(item => {
    const score = words.filter(w =>
      item.name.toLowerCase().includes(w.toLowerCase())
    ).length
    return { ...item, score }
  }).sort((a, b) => b.score - a.score)

  return NextResponse.json(scored.slice(0, limit).map(({ score, ...item }) => item))
}
