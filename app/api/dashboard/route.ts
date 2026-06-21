import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { cardProgress, cardSum, isOverdue } from '@/lib/display'
import { Order } from '@/lib/types'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const orders = await prisma.order.findMany({
    include: { positions: true },
    orderBy: { createdAt: 'desc' },
  }) as unknown as Order[]

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const active = orders.filter(o => !o.isDraft && !o.isCancelled && o.screen !== 'archive')
  const incoming = orders.filter(o => o.screen === 'incoming')
  const reception = orders.filter(o => o.screen === 'reception')
  const outgoing = orders.filter(o => o.screen === 'outgoing' && o.status === 'В работе')
  const accounting = orders.filter(o => o.screen === 'accounting')
  const bookkeeping = orders.filter(o => o.screen === 'bookkeeping')
  const archive = orders.filter(o => o.screen === 'archive')

  const newCards = incoming.filter(o => !o.isDraft && !o.isCancelled && !o.toacc)
  const toaccIncoming = incoming.filter(o => o.toacc && o.status === 'Доставлено')
  const changed = orders.filter(o => o.isChanged && !o.isCancelled && !o.isDraft)
  const overdueCards = orders.filter(o => o.screen === 'outgoing' && isOverdue(o))

  const deliveredToday = orders.filter(o => o.delivered && new Date(o.delivered) >= today)
  const turnoverToday = deliveredToday.reduce((s, o) => s + cardSum(o), 0)

  const progSrc = [...orders.filter(o => o.screen === 'outgoing'), ...accounting, ...toaccIncoming]
  const overallPct = progSrc.length
    ? Math.round(progSrc.reduce((s, o) => s + cardProgress(o), 0) / progSrc.length)
    : 0

  const attention: Array<{ label: string; sub: string; tag: string; hue: string; screen: string; tab?: string }> = []
  overdueCards.forEach(o => attention.push({ label: `${o.id} просрочен`, sub: `${o.from} → ${o.to}`, tag: 'просрочено', hue: '25', screen: 'outgoing' }))
  changed.forEach(o => attention.push({ label: `${o.id} изменён`, sub: o.changeText || `${o.from} → ${o.to}`, tag: 'изменено', hue: '70', screen: 'incoming', tab: 'changed' }))
  toaccIncoming.forEach(o => attention.push({ label: `${o.id} к учёту`, sub: `${o.from} → ${o.to}`, tag: 'к учёту', hue: '155', screen: 'incoming', tab: 'toacc' }))

  const recentHistory = await prisma.history.findMany({ orderBy: { createdAt: 'desc' }, take: 8 })

  const clientCounts: Record<string, number> = {}
  active.forEach(o => { clientCounts[o.from] = (clientCounts[o.from] || 0) + 1 })
  const maxCount = Math.max(1, ...Object.values(clientCounts))
  const topClients = Object.entries(clientCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count, pct: Math.round((count / maxCount) * 100) }))

  const specProjects = await prisma.specProject.findMany({
    where: { status: 'active' },
    include: { items: true, orders: { include: { positions: true } } },
  })

  const specProjectsData = specProjects.map(sp => {
    const cardCount = sp.orders.length
    let totalNeeded = 0
    let totalCollected = 0
    for (const item of sp.items) {
      totalNeeded += item.qty
      const collected = sp.orders.flatMap(o => o.positions)
        .filter(p => (p.name1c || p.oral) === item.name && p.status === 'Доставлено')
        .reduce((s, p) => s + p.qty, 0)
      totalCollected += Math.min(collected, item.qty)
    }
    const pct = totalNeeded ? Math.round((totalCollected / totalNeeded) * 100) : 0
    return { id: sp.id, name: sp.name, pct, cardCount }
  })

  return NextResponse.json({
    kpi: {
      active: active.length,
      deliveredToday: deliveredToday.length,
      overdue: overdueCards.length,
      inwork: outgoing.length,
      turnoverToday,
    },
    flow: {
      incoming: newCards.length + changed.length,
      reception: reception.length,
      outgoing: outgoing.length,
      accounting: toaccIncoming.length + accounting.length,
      bookkeeping: bookkeeping.length,
      archive: archive.length,
    },
    progress: { overallPct, inwork: outgoing.length, delivered: toaccIncoming.length, overdue: overdueCards.length },
    attention: attention.slice(0, 6),
    activity: recentHistory.map(h => ({ text: h.action, sub: h.detail || h.cardId, time: h.createdAt, userName: h.userName })),
    topClients,
    specProjects: specProjectsData,
  })
}