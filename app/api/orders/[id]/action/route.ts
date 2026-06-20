// app/api/orders/[id]/action/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { generatePosId } from '@/lib/ids'

type Params = { params: Promise<{ id: string }> }

async function log(cardId: string, action: string, detail: string, userName: string) {
  await prisma.history.create({ data: { cardId, action, detail, userName } })
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = await params
  const { action, ...payload } = await req.json()

  const order = await prisma.order.findUnique({ where: { id }, include: { positions: true } })
  if (!order) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })

  const who = session.name

  switch (action) {
    // ─── Принять из Входящих → Приёмка / Ожидание ────────────────────────
    case 'accept': {
      await prisma.order.update({
        where: { id },
        data: { screen: 'reception', status: 'Принят', block: 'waiting', postponed: false },
      })
      await log(id, 'Принят в приёмку', '→ Приёмка / Ожидание', who)
      break
    }

    // ─── Взять в обработку → Приёмка / Стол ──────────────────────────────
    case 'take': {
      let posOps = {}
      if (order.positions.length === 0 && order.comment) {
        const lines = order.comment.split('\n').map(l => l.trim()).filter(Boolean)
        const newPositions = lines.map((line, i) => ({
          id: generatePosId(id, i + 1),
          cardId: id,
          oral: line,
          status: 'В работе',
        }))
        posOps = { positions: { create: newPositions } }
      }
      await prisma.order.update({
        where: { id },
        data: { status: 'В обработке', block: 'processing', ...posOps },
      })
      await log(id, 'Взят в обработку', 'Позиции распарсены из комментария', who)
      break
    }

    // ─── Отправить в Исходящие ────────────────────────────────────────────
    case 'process': {
      await prisma.order.update({
        where: { id },
        data: { screen: 'outgoing', status: 'В работе', block: '' },
      })
      if (order.positions.length > 0) {
        await prisma.position.updateMany({
          where: { cardId: id, status: '' },
          data: { status: 'В работе' },
        })
      }
      await log(id, 'Отправлен в Исходящие', '', who)
      break
    }

    // ─── Обновить статус позиции ──────────────────────────────────────────
    case 'updatePos': {
      const { posId, status: newStatus } = payload
      await prisma.position.update({
        where: { id: posId },
        data: { status: newStatus, late: newStatus === 'Доставлено' ? false : undefined },
      })
      // Check if all delivered
      const updatedPositions = await prisma.position.findMany({ where: { cardId: id } })
      if (updatedPositions.every(p => p.status === 'Доставлено')) {
        await prisma.order.update({
          where: { id },
          data: { screen: 'incoming', status: 'Доставлено', toacc: true, delivered: new Date() },
        })
        await log(id, 'Все позиции доставлены', 'Автопереход к учёту', who)
      } else {
        await log(id, 'Позиция обновлена', `${posId} → ${newStatus}`, who)
      }
      break
    }

    // ─── Отметить все доставленными ───────────────────────────────────────
    case 'markAll': {
      await prisma.position.updateMany({
        where: { cardId: id },
        data: { status: 'Доставлено', late: false },
      })
      await prisma.order.update({
        where: { id },
        data: { screen: 'incoming', status: 'Доставлено', toacc: true, delivered: new Date() },
      })
      await log(id, 'Все позиции отмечены доставленными', 'Автозавершение', who)
      break
    }

    // ─── Отправить к учёту ────────────────────────────────────────────────
    case 'sendAcc': {
      await prisma.order.update({
        where: { id },
        data: { screen: 'accounting', status: 'К учёту' },
      })
      await log(id, 'Отправлен к учёту', '', who)
      break
    }

    // ─── Провести в Бухгалтерию ───────────────────────────────────────────
    case 'postAcc': {
      await prisma.order.update({
        where: { id },
        data: { screen: 'bookkeeping', status: 'Бухгалтерия', toacc: false },
      })
      await log(id, 'Проведён в Бухгалтерию', '', who)
      break
    }

    // ─── Вернуть в Входящие из Приёмки ───────────────────────────────────
    case 'returnOut': {
      await prisma.order.update({
        where: { id },
        data: { screen: 'incoming', status: 'В ожидании', block: '', toacc: false },
      })
      await log(id, 'Возврат в Входящие', '', who)
      break
    }

    // ─── Вернуть в К Учёту ────────────────────────────────────────────────
    case 'returnToAcc': {
      await prisma.order.update({
        where: { id },
        data: { screen: 'accounting', status: 'К учёту', toacc: true },
      })
      await log(id, 'Возврат в К учёту', '', who)
      break
    }

    // ─── Отменить ─────────────────────────────────────────────────────────
    case 'cancel': {
      await prisma.order.update({
        where: { id },
        data: { isCancelled: true, status: 'Отменён', screen: 'incoming', isChanged: false },
      })
      await log(id, 'Отменён', payload.reason || '', who)
      break
    }

    // ─── Восстановить ─────────────────────────────────────────────────────
    case 'restore': {
      await prisma.order.update({
        where: { id },
        data: { isCancelled: false, status: 'В ожидании', screen: 'incoming' },
      })
      await log(id, 'Восстановлен', '', who)
      break
    }

    // ─── Подтвердить изменение ────────────────────────────────────────────
    case 'confirmChg': {
      await prisma.order.update({
        where: { id },
        data: { isChanged: false },
      })
      await log(id, 'Изменение подтверждено', '', who)
      break
    }

    // ─── Отложить/снять откладывание ─────────────────────────────────────
    case 'postpone': {
      await prisma.order.update({
        where: { id },
        data: { postponed: !order.postponed },
      })
      await log(id, order.postponed ? 'Снят с паузы' : 'Отложен', '', who)
      break
    }

    // ─── Создать документ (счёт / счёт-фактура) ──────────────────────────
    case 'createDoc': {
      const field = payload.type === 'invoice' ? { invoice: true } : { fact: true }
      await prisma.order.update({ where: { id }, data: field })
      await log(id, `Создан ${payload.type === 'invoice' ? 'счёт на оплату' : 'счёт-фактура'}`, '', who)
      break
    }

    // ─── Провести в 1С ────────────────────────────────────────────────────
    case 'post1C': {
      await prisma.order.update({ where: { id }, data: { posted1C: true } })
      await log(id, 'Проведено в 1С', '', who)
      break
    }

    // ─── Архив ────────────────────────────────────────────────────────────
    case 'sendArchive': {
      await prisma.order.update({ where: { id }, data: { screen: 'archive', status: 'Архив' } })
      await log(id, 'Отправлен в архив', '', who)
      break
    }

    default:
      return NextResponse.json({ error: `Неизвестное действие: ${action}` }, { status: 400 })
  }

  // Return updated order
  const updated = await prisma.order.findUnique({ where: { id }, include: { positions: true } })
  return NextResponse.json({ success: true, order: updated })
}
