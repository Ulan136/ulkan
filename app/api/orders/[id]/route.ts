import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'
import { pushSignal } from '@/lib/pusherServer'
import { CENTER_SKLAD } from '@/services/stockOps'
import { releaseStock } from '@/lib/stock'
import { POS_STATUS } from '@/lib/orderStatus'

// DELETE — полное удаление карточки. Только супер-админ. Снимает резервы склада,
// чистит сообщения чата; позиции и история удаляются каскадом.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(req, ['super_admin'])
  if (!auth.ok) return auth.response
  const { id } = await params

  const order = await prisma.order.findUnique({ where: { id }, include: { positions: true } })
  if (!order) return NextResponse.json({ error: 'Карточка не найдена' }, { status: 404 })

  // Снять резервы Центр-Склада у недоставленных позиций (иначе повиснет резерв).
  for (const p of order.positions) {
    if (p.supplier === CENTER_SKLAD && p.status !== POS_STATUS.delivered) {
      try { await releaseStock(p.id, p.name1c || p.oral, p.qty) } catch { /* склад не критичен */ }
    }
  }
  await prisma.cardMessage.deleteMany({ where: { cardId: id } }) // FK-каскада у чата нет
  await prisma.order.delete({ where: { id } })                    // позиции + история каскадом

  await pushSignal('orders')
  return NextResponse.json({ ok: true })
}
