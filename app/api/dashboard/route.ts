// app/api/dashboard/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { cardProgress, cardSum, isOverdue } from '@/lib/ids'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const orders = await prisma.order.findMany({
    include: { positions: true, history: { orderBy: { createdAt: 'desc' }, take: 1 } },
    orderBy: { createdAt: 'desc' },
  })

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
  const overdueCards = outgoing.filter(o => isOverdue(o.positions))

  // KPI
  const deliveredToday = orders.filter(o => o.delivered && o.delivered >= today)
  const turnoverToday = deliveredToday.reduce((s, o) => s + cardSum(o.positions), 0)

  // Progress
  const progSrc = [...outgoing, ...accounting, ...toaccIncoming]
  const overallPct = progSrc.length
    ? Math.round(progSrc.reduce((s, o) => s + cardProgress(o.positions), 0) / progSrc.length)
    : 0

  // Attention items
  const attention: Array<{ label: string; sub: string; tag: string; hue: string; screen: string; tab?: string }> = []
  overdueCards.forEach(o => attention.push({ label: `${o.id} просрочен`, sub: `${o.from} → ${o.to}`, tag: 'просрочено', hue: '25', screen: 'outgoing' }))
  changed.forEach(o => attention.push({ label: `${o.id} изменён клиентом`, sub: o.changeText || `${o.from} → ${o.to}`, tag: 'изменено', hue: '70', screen: 'incoming', tab: 'changed' }))
  toaccIncoming.forEach(o => attention.push({ label: `${o.id} готов к учёту`, sub: `${o.from} → ${o.to}`, tag: 'к учёту', hue: '155', screen: 'incoming', tab: 'toacc' }))

  // Recent history
  const recentHistory = await prisma.history.findMany({
    orderBy: { createdAt: 'desc' },
    take: 8,
  })

  // Top clients
  const clientCounts: Record<string, number> = {}
  active.forEach(o => { clientCounts[o.from] = (clientCounts[o.from] || 0) + 1 })
  const maxCount = Math.max(1, ...Object.values(clientCounts))
  const topClients = Object.entries(clientCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count, pct: Math.round((count / maxCount) * 100) }))

  return NextResponse.json({
    kpi: {
      active: active.length,
      inwork: outgoing.length,
      overdue: overdueCards.length,
      toacc: toaccIncoming.length + accounting.length,
      changed: changed.length,
      deliveredToday: deliveredToday.length,
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
    progress: {
      overallPct,
      inwork: outgoing.length,
      delivered: toaccIncoming.length,
      overdue: overdueCards.length,
      waiting: reception.filter(o => o.block === 'waiting').length,
    },
    attention: attention.slice(0, 6),
    attentionTotal: attention.length,
    activity: recentHistory.map(h => ({
      text: h.action,
      sub: h.detail || h.cardId,
      time: h.createdAt,
      userName: h.userName,
    })),
    topClients,
  })
}
