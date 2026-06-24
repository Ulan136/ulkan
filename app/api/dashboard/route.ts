<<<<<<< HEAD
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { cardProgress, cardSum, isOverdue } from '@/lib/display'
import { Order } from '@/lib/types'
=======
// app/api/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

<<<<<<< HEAD
  const orders = await prisma.order.findMany({
    include: { positions: true },
    orderBy: { createdAt: 'desc' },
  }) as unknown as Order[]
=======
  try {
    const orders = await prisma.order.findMany({
      include: { positions: true },
      orderBy: { createdAt: 'desc' },
    })
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const active = orders.filter((o: { isDraft: boolean; isCancelled: boolean; screen: string }) => !o.isDraft && !o.isCancelled && o.screen !== 'archive')
    const deliveredToday = orders.filter((o: { delivered: Date | null }) => o.delivered && new Date(o.delivered) >= today)
    const inwork = orders.filter((o: { screen: string; status: string }) => o.screen === 'outgoing' && o.status === 'В работе')
    const overdue = orders.filter((o: { positions: { late: boolean; status: string }[] }) => o.positions.some((p: { late: boolean; status: string }) => p.late && p.status !== 'Доставлено'))
    const turnoverToday = deliveredToday.reduce((s: number, o: { positions: { qty: number; price: number }[] }) => s + o.positions.reduce((ps: number, p: { qty: number; price: number }) => ps + p.qty * p.price, 0), 0)

<<<<<<< HEAD
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
=======
    // Поток
    const flow = {
      incoming: orders.filter((o: { screen: string; isDraft: boolean; isCancelled: boolean }) => o.screen === 'incoming' && !o.isDraft && !o.isCancelled).length,
      reception: orders.filter((o: { screen: string }) => o.screen === 'reception').length,
      outgoing: inwork.length,
      accounting: orders.filter((o: { screen: string }) => o.screen === 'accounting').length,
      bookkeeping: orders.filter((o: { screen: string }) => o.screen === 'bookkeeping').length,
      archive: orders.filter((o: { screen: string }) => o.screen === 'archive').length,
    }

    // Прогресс
    const PCT: Record<string, number> = { 'В работе': 10, 'Готово к отгрузке': 60, 'В пути': 80, 'Доставлено': 100 }
    const withPos = inwork.filter((o: { positions: { status: string }[] }) => o.positions.length > 0)
    const overallPct = withPos.length === 0 ? 0 : Math.round(
      withPos.reduce((s: number, o: { positions: { status: string }[] }) => {
        const pct = o.positions.reduce((ps: number, p: { status: string }) => ps + (PCT[p.status] || 0), 0) / o.positions.length
        return s + pct
      }, 0) / withPos.length
    )

    // Последние действия
    const activity = await prisma.history.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
    })

    // Топ заказчики (этот месяц)
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const monthOrders = orders.filter((o: { createdAt: Date | string }) => new Date(o.createdAt) >= monthStart)
    const clientMap: Record<string, number> = {}
    monthOrders.forEach((o: { from: string }) => { clientMap[o.from] = (clientMap[o.from] || 0) + 1 })
    const maxCount = Math.max(...Object.values(clientMap), 1)
    const topClients = Object.entries(clientMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count, pct: Math.round((count / maxCount) * 100) }))

    // СпецПроекты
    const specProjects = await prisma.specProject.findMany({
      where: { status: 'active' },
      include: { orders: { include: { positions: true } }, items: true },
    })

    const spData = specProjects.map((sp: {
      id: string;
      name: string;
      orders: { positions: { status: string }[] }[];
      items: { qty: number; name: string }[];
    }) => {
      const cards = sp.orders.length
      const allPos = sp.orders.flatMap((o: { positions: { status: string }[] }) => o.positions)
      const pct = allPos.length === 0 ? 0 : Math.round(allPos.filter((p: { status: string }) => p.status === 'Доставлено').length / allPos.length * 100)
      return { id: sp.id, name: sp.name, pct, cardCount: cards }
    })

    // Требуют внимания
    const attention = []
    if (overdue.length > 0) attention.push({ label: `Просрочено: ${overdue.length}`, sub: 'Позиции с истёкшим сроком', tag: 'просрочено', hue: '25', screen: 'outgoing' })
    const changed = orders.filter((o: { isChanged: boolean; isCancelled: boolean; isDraft: boolean }) => o.isChanged && !o.isCancelled && !o.isDraft)
    if (changed.length > 0) attention.push({ label: `Изменено: ${changed.length}`, sub: 'Ждут подтверждения', tag: 'изменено', hue: '70', screen: 'incoming' })
    if (flow.accounting > 0) attention.push({ label: `К учёту: ${flow.accounting}`, sub: 'Ждут проводки', tag: 'к учёту', hue: '155', screen: 'accounting' })

    return NextResponse.json({
      kpi: { active: active.length, deliveredToday: deliveredToday.length, overdue: overdue.length, inwork: inwork.length, turnoverToday },
      flow,
      progress: { overallPct, inwork: inwork.length, delivered: deliveredToday.length, overdue: overdue.length },
      attention,
      activity,
      topClients,
      specProjects: spData,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
