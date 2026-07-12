import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'
import { orderInclude } from '@/lib/orderMetrics'
import { isParticipant } from '@/services/cardParticipants'
import { messageSchema } from '@/lib/dto/message.dto'
import { notify } from '@/lib/notifications'
import { pushSignal } from '@/lib/pusherServer'

// GET — лента чата карточки (по возрастанию времени). Только участнику.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response
  const { id } = await params

  const order = await prisma.order.findUnique({ where: { id }, include: orderInclude })
  if (!order) return NextResponse.json({ error: 'Карточка не найдена' }, { status: 404 })
  if (!isParticipant(order, order.positions, auth.session!)) return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })

  const messages = await prisma.cardMessage.findMany({ where: { cardId: id }, orderBy: { createdAt: 'asc' } })
  return NextResponse.json(messages)
}

// POST — новое сообщение. Только участнику. Уведомляет остальных участников.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response
  const { session } = auth
  const { id } = await params

  const parsed = messageSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Введите сообщение' }, { status: 400 })

  const order = await prisma.order.findUnique({ where: { id }, include: orderInclude })
  if (!order) return NextResponse.json({ error: 'Карточка не найдена' }, { status: 404 })
  if (!isParticipant(order, order.positions, session!)) return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })

  const message = await prisma.cardMessage.create({
    data: { cardId: id, userId: session!.id, userName: session!.name, role: session!.role, text: parsed.data.text },
  })

  // Собираем id всех участников (кроме автора) для уведомлений в колокольчик.
  const recipients = new Set<string>()
  const admins = await prisma.user.findMany({ where: { role: { in: ['super_admin', 'bookkeeper'] }, active: true }, select: { id: true } })
  admins.forEach(a => recipients.add(a.id))

  const respNames = [...new Set(order.positions.map(p => p.resp).filter(Boolean))]
  if (respNames.length) {
    const logists = await prisma.user.findMany({ where: { name: { in: respNames }, role: 'logist' }, select: { id: true } })
    logists.forEach(u => recipients.add(u.id))
  }
  const supNames = [...new Set(order.positions.map(p => p.supplier).filter(Boolean))]
  if (supNames.length) {
    const branches = await prisma.user.findMany({ where: { name: { in: supNames }, role: 'branch' }, select: { id: true } })
    branches.forEach(u => recipients.add(u.id))
  }
  if (order.fromId) recipients.add(order.fromId)
  if (order.contactId) recipients.add(order.contactId)
  recipients.delete(session!.id) // не уведомляем автора

  const preview = parsed.data.text.length > 60 ? parsed.data.text.slice(0, 60) + '…' : parsed.data.text
  for (const uid of recipients) {
    await notify(uid, `💬 ${session!.name} по заказу ${id}: ${preview}`, id)
  }

  await pushSignal('orders') // после ВСЕХ записей БД (как в 8bb33f6)
  return NextResponse.json(message, { status: 201 })
}
