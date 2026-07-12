import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'
import { orderInclude } from '@/lib/orderMetrics'
import { pushSignal } from '@/lib/pusherServer'
import { TRANSITIONS, WorkflowCtx } from '@/services/orderWorkflow'

// Тонкий диспетчер: находит TransitionDef по action, проверяет roles/guard,
// выполняет effects, применяет patch и пишет History. Вся бизнес-логика
// переходов — в services/orderWorkflow.ts (декларативная карта TRANSITIONS).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response
  const { session } = auth

  const { id } = await params
  const body = await req.json()
  const { action, ...payload } = body

  const order = await prisma.order.findUnique({ where: { id }, include: orderInclude })
  if (!order) return NextResponse.json({ error: 'Карточка не найдена' }, { status: 404 })

  try {
    const def = TRANSITIONS[action]
    if (!def) return NextResponse.json({ error: `Неизвестный action: ${action}` }, { status: 400 })

    // roles → 403
    if (def.roles && !def.roles.includes(session.role)) {
      return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })
    }

    const ctx: WorkflowCtx = { order, positions: order.positions, session, payload, prisma, scratch: {} }

    // guard → 400 (или собственный статус, напр. 403 у role-проверок)
    if (def.guard) {
      const g = def.guard(ctx)
      if (g) {
        const msg = typeof g === 'string' ? g : g.error
        const status = typeof g === 'string' ? 400 : (g.status || 400)
        return NextResponse.json({ error: msg }, { status })
      }
    }

    if (def.effects) await def.effects(ctx)
    const patch = def.patch ? def.patch(ctx) : null
    const history = def.history ? def.history(ctx) : null

    if (patch && Object.keys(patch).length > 0) {
      await prisma.order.update({ where: { id }, data: patch })
    }
    if (history) {
      await prisma.history.create({ data: { cardId: id, action: history, userName: session.name } })
    }

    const updated = await prisma.order.findUnique({ where: { id }, include: orderInclude })
    await pushSignal('orders') // после ВСЕХ записей БД и перед ответом
    return NextResponse.json({ success: true, order: updated })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка выполнения действия' }, { status: 500 })
  }
}
