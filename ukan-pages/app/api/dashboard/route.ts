// app/api/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  try {
    const orders = await prisma.order.findMany({
      include: { positions: true },
      orderBy: { createdAt: 'desc' },
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const active = orders.filter((o: { isDraft: boolean; isCancelled: boolean; screen: string }) => !o.isDraft && !o.isCancelled && o.screen !== 'archive')
    const deliveredToday = orders.filter((o: { delivered: Date | null }) => o.delivered && new Date(o.delivered) >= today)
    const inwork = orders.filter((o: { screen: string; status: string }) => o.screen === 'outgoing' && o.status === 'В работе')
    const overdue = orders.filter((o: { positions: { late: boolean; status: string }[] }) => o.positions.some((p: { late: boolean; status: string }) => p.late && p.status !== 'Доставлено'))
    const turnoverToday = deliveredToday.reduce((s: number, o: { positions: { qty: number; price: number }[] }) => s + o.positions.reduce((ps: number, p: { qty: number; price: number }) => ps + p.qty * p.price, 0), 0)

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
