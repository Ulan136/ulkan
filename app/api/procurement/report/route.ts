import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'
import { CENTER_SKLAD } from '@/lib/procurement'

// Отчёт-цепочка закуп→продажи: закуп на Центр-Склад и раскладка по заказчикам.
// Связь берётся из ProcurementLink (если таблицы ещё нет — раскладка пустая).
export async function GET(req: NextRequest) {
  const auth = await requireSession(req, ['super_admin', 'bookkeeper'])
  if (!auth.ok) return auth.response

  // Карточки закупа = получатель Центр-Склад.
  const purchases = await prisma.order.findMany({
    where: { to: CENTER_SKLAD, isCancelled: false },
    include: { positions: { select: { name1c: true, oral: true, qty: true, unit: true, supplier: true, status: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  // Связи по всем этим закупам.
  const ids = purchases.map(p => p.id)
  let links: any[] = []
  if (ids.length) {
    try { links = await (prisma as any).procurementLink.findMany({ where: { purchaseCardId: { in: ids } } }) } catch { links = [] }
  }

  // Имена заказчиков (to) исходных заявок-продаж.
  const saleIds = Array.from(new Set(links.map(l => l.saleCardId)))
  const saleMap: Record<string, { client: string; comment: string }> = {}
  if (saleIds.length) {
    const sales = await prisma.order.findMany({ where: { id: { in: saleIds } }, select: { id: true, to: true, from: true, comment: true } })
    for (const s of sales) saleMap[s.id] = { client: s.to || s.from || '—', comment: s.comment || '' }
  }

  const report = purchases.map(p => {
    const cardLinks = links.filter(l => l.purchaseCardId === p.id)
    return {
      id: p.id,
      status: p.status,
      createdAt: p.createdAt,
      delivered: p.delivered,
      positions: p.positions.map(pos => {
        const name = pos.name1c || pos.oral
        const posLinks = cardLinks.filter(l => (l.product || '').toLowerCase() === (name || '').toLowerCase())
        return {
          name,
          qty: pos.qty,
          unit: pos.unit,
          supplier: pos.supplier || '—',
          status: pos.status,
          breakdown: posLinks.map(l => ({ client: saleMap[l.saleCardId]?.client || l.saleCardId, comment: saleMap[l.saleCardId]?.comment || '', saleCardId: l.saleCardId, qty: l.qty })),
        }
      }),
    }
  })

  return NextResponse.json(report)
}
