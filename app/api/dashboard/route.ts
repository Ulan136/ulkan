import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'
import { posPct } from '@/lib/orderMetrics'

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [allOrders, activity, specProjectsList] = await Promise.all([
    prisma.order.findMany({ include: { positions: true } }),
    prisma.history.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
    prisma.specProject.findMany({ where: { status: 'active' }, include: { orders: { include: { positions: true } }, items: true } }),
  ])

  const active = allOrders.filter(o => !o.isDraft && !o.isCancelled && o.screen !== 'archive').length
  const deliveredToday = allOrders.filter(o => o.delivered && o.delivered >= today && o.delivered < tomorrow).length
  const overdue = allOrders.filter(o => o.positions.some(p => p.late && p.status !== 'Доставлено')).length
  const inwork = allOrders.filter(o => o.screen === 'outgoing').length
  const turnoverToday = allOrders
    .filter(o => o.delivered && o.delivered >= today && o.delivered < tomorrow)
    .reduce((s, o) => s + o.positions.reduce((ps, p) => ps + p.qty * p.price, 0), 0)

  const flow = {
    incoming: allOrders.filter(o => o.screen === 'incoming' && !o.isDraft && !o.isCancelled).length,
    reception: allOrders.filter(o => o.screen === 'reception').length,
    outgoing: allOrders.filter(o => o.screen === 'outgoing').length,
    accounting: allOrders.filter(o => o.screen === 'accounting').length,
    bookkeeping: allOrders.filter(o => o.screen === 'bookkeeping').length,
    archive: allOrders.filter(o => o.screen === 'archive').length,
  }

  const workOrders = allOrders.filter(o => !o.isDraft && !o.isCancelled && o.screen !== 'archive')
  const totalPct = workOrders.length > 0
    ? Math.round(workOrders.reduce((s, o) => {
        const pct = o.positions.length > 0
          ? o.positions.reduce((ps, p) => ps + posPct(p), 0) / o.positions.length
          : (o.status === 'Доставлено' ? 100 : 0)
        return s + pct
      }, 0) / workOrders.length)
    : 0

  // Топ клиенты
  const clientMap: Record<string, number> = {}
  allOrders.forEach(o => { clientMap[o.from] = (clientMap[o.from] || 0) + 1 })
  const totalOrders = allOrders.length
  const topClients = Object.entries(clientMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count, pct: Math.round(count / (totalOrders || 1) * 100) }))

  // Блоки внимания
  const attention: Array<{ label: string; sub: string; tag: string; hue: string; screen: string }> = []
  const changed = allOrders.filter(o => o.isChanged && !o.isCancelled)
  if (changed.length > 0) attention.push({ label: `${changed.length} изменений от клиентов`, sub: 'Требуют подтверждения', tag: 'isChanged', hue: '#c0532a', screen: 'incoming' })
  const overdueList = allOrders.filter(o => o.positions.some(p => p.late && p.status !== 'Доставлено'))
  if (overdueList.length > 0) attention.push({ label: `${overdueList.length} просроченных`, sub: 'Позиции с нарушением срока', tag: 'late', hue: '#b03020', screen: 'outgoing' })
  const toaccList = allOrders.filter(o => o.toacc && o.screen === 'incoming')
  if (toaccList.length > 0) attention.push({ label: `${toaccList.length} к учёту`, sub: 'Готовы к проводке', tag: 'toacc', hue: '#2e8a5e', screen: 'incoming' })

  // СпецПроекты с прогрессом
  const specProjects = specProjectsList.map(sp => {
    const needed = sp.items.reduce((s, i) => s + i.qty, 0)
    const collected = sp.orders.reduce((s, o) => s + o.positions.reduce((ps, p) => ps + p.qty, 0), 0)
    const pct = needed > 0 ? Math.round(Math.min(collected / needed * 100, 100)) : 0
    return { id: sp.id, name: sp.name, pct, cardCount: sp.orders.length }
  })

  return NextResponse.json({
    kpi: { active, deliveredToday, overdue, inwork, turnoverToday },
    flow,
    progress: { overallPct: totalPct, inwork, delivered: deliveredToday, overdue },
    attention,
    activity,
    topClients,
    specProjects,
  })
}
