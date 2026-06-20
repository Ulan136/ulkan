// app/api/orders/[id]/action/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { generatePosId } from '@/lib/ids'

type Params = { params: Promise<{ id: string }> }

async function log(cardId: string, action: string, detail: string, userName: string) {
  try {
    await prisma.history.create({ data: { cardId, action, detail, userName } })
  } catch {}
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { action, ...payload } = body

    const order = await prisma.order.findUnique({ where: { id }, include: { positions: true } })
    if (!order) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })

    const who = session.name

    switch (action) {
      case 'accept': {
        await prisma.order.update({
          where: { id },
          data: { screen: 'reception', status: 'Принят', block: 'waiting', postponed: false },
        })
        await log(id, 'Принят в приёмку', '→ Приёмка / Ожидание', who)
        break
      }
      case 'take': {
        let createData = {}
        if (order.positions.length === 0 && order.comment) {
          const lines = order.comment.split('\n').map((l: string) => l.trim()).filter(Boolean)
          const newPositions = lines.map((line: string, i: number) => ({
            id: generatePosId(id, i + 1),
            oral: line,
            status: 'В работе',
          }))
          createData = { positions: { create: newPositions } }
        }
        await prisma.order.update({
          where: { id },
          data: { status: 'В обработке', block: 'processing', ...createData },
        })
        await log(id, 'Взят в обработку', '', who)
        break
      }
      case 'process': {
        await prisma.order.update({
          where: { id },
          data: { screen: 'outgoing', status: 'В работе', block: '' },
        })
        await log(id, 'Отправлен в Исходящие', '', who)
        break
      }
      case 'updatePos': {
        const { posId, status: newStatus } = payload
        await prisma.position.update({
          where: { id: posId },
          data: { status: newStatus, late: newStatus === 'Доставлено' ? false : undefined },
        })
        const updatedPositions = await prisma.position.findMany({ where: { cardId: id } })
        if (updatedPositions.every((p: { status: string }) => p.status === 'Доставлено')) {
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
      case 'markAll': {
        await prisma.position.updateMany({
          where: { cardId: id },
          data: { status: 'Доставлено', late: false },
        })
        await prisma.order.update({
          where: { id },
          data: { screen: 'incoming', status: 'Доставлено', toacc: true, delivered: new Date() },
        })
        await log(id, 'Все позиции отмечены доставленными', '', who)
        break
      }
      case 'sendAcc': {
        await prisma.order.update({
          where: { id },
          data: { screen: 'accounting', status: 'К учёту' },
        })
        await log(id, 'Отправлен к учёту', '', who)
        break
      }
      case 'postAcc': {
        await prisma.order.update({
          where: { id },
          data: { screen: 'bookkeeping', status: 'Бухгалтерия', toacc: false },
        })
        await log(id, 'Проведён в Бухгалтерию', '', who)
        break
      }
      case 'returnOut': {
        await prisma.order.update({
          where: { id },
          data: { screen: 'incoming', status: 'В ожидании', block: '', toacc: false },
        })
        await log(id, 'Возврат в Входящие', '', who)
        break
      }
      case 'returnToAcc': {
        await prisma.order.update({
          where: { id },
          data: { screen: 'accounting', status: 'К учёту', toacc: true },
        })
        await log(id, 'Возврат в К учёту', '', who)
        break
      }
      case 'cancel': {
        await prisma.order.update({
          where: { id },
          data: { isCancelled: true, status: 'Отменён', screen: 'incoming', isChanged: false },
        })
        await log(id, 'Отменён', payload.reason || '', who)
        break
      }
      case 'restore': {
        await prisma.order.update({
          where: { id },
          data: { isCancelled: false, status: 'В ожидании', screen: 'incoming' },
        })
        await log(id, 'Восстановлен', '', who)
        break
      }
      case 'confirmChg': {
        await prisma.order.update({ where: { id }, data: { isChanged: false } })
        await log(id, 'Изменение подтверждено', '', who)
        break
      }
      case 'postpone': {
        await prisma.order.update({
          where: { id },
          data: { postponed: !order.postponed },
        })
        await log(id, order.postponed ? 'Снят с паузы' : 'Отложен', '', who)
        break
      }
      case 'createDoc': {
        const field = payload.type === 'invoice' ? { invoice: true } : { fact: true }
        await prisma.order.update({ where: { id }, data: field })
        await log(id, `Создан документ`, payload.type || '', who)
        break
      }
      case 'post1C': {
        await prisma.order.update({ where: { id }, data: { posted1C: true } })
        await log(id, 'Проведено в 1С', '', who)
        break
      }
      case 'sendArchive': {
        await prisma.order.update({ where: { id }, data: { screen: 'archive', status: 'Архив' } })
        await log(id, 'Отправлен в архив', '', who)
        break
      }
      default:
        return NextResponse.json({ error: `Неизвестное действие: ${action}` }, { status: 400 })
    }

    const updated = await prisma.order.findUnique({ where: { id }, include: { positions: true } })
    return NextResponse.json({ success: true, order: updated })

  } catch (error) {
    console.error('Action error:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка' }, { status: 500 })
  }
}
