// app/api/orders/[id]/action/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generatePosId } from '@/lib/ids'
import { notifyAdmins, notifyUser } from '@/lib/notifications'

async function log(cardId: string, action: string, detail: string, userName: string) {
  try {
    await prisma.history.create({ data: { cardId, action, detail, userName } })
  } catch {}
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = params
  const body = await req.json()
  const { action, ...payload } = body

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { positions: true },
    })
    if (!order) return NextResponse.json({ error: 'Карточка не найдена' }, { status: 404 })

    let updateData: Record<string, unknown> = {}

    switch (action) {

      case 'accept':
        updateData = { screen: 'reception', block: 'waiting', status: 'Принят' }
        await log(id, 'Принят в приёмку', '', session.name)
        await notifyUser(order.fromId, `Заявка ${id} принята`, id)
        break

      case 'take': {
        updateData = { status: 'В обработке', block: 'processing' }
        // Парсим comment → positions (ТОЛЬКО если нет позиций)
        if (order.positions.length === 0 && order.comment) {
          const lines = order.comment.split('\n').map((l: string) => l.trim()).filter(Boolean)
          const posCreate = lines.map((line: string, i: number) => ({
            id: generatePosId(id, i + 1),
            // НЕ передаём cardId — Prisma подставит сам!
            oral: line,
            status: 'В работе',
          }))
          if (posCreate.length > 0) {
            await prisma.position.createMany({
              data: posCreate.map((p: { id: string; oral: string; status: string }) => ({ ...p, cardId: id })),
            })
          }
        }
        await log(id, 'Взят в обработку', '', session.name)
        break
      }

      case 'process':
        updateData = { screen: 'outgoing', status: 'В работе', block: '' }
        await log(id, 'Отправлен в Исходящие', '', session.name)
        await notifyUser(order.fromId, `Заказ ${id} в работе`, id)
        break

      case 'updatePos': {
        const { posId, status: posStatus } = payload as { posId: string; status: string }
        await prisma.position.update({ where: { id: posId }, data: { status: posStatus } })

        // Пересчёт: все ли доставлено?
        const allPos = await prisma.position.findMany({ where: { cardId: id } })
        const allDone = allPos.every((p: { status: string }) => p.status === 'Доставлено')
        if (allDone && allPos.length > 0) {
          updateData = { screen: 'incoming', status: 'Доставлено', toacc: true, delivered: new Date() }
          await log(id, 'Все позиции доставлены', '', session.name)
          await notifyUser(order.fromId, `Заказ ${id} доставлен!`, id)
        }
        break
      }

      case 'markAll': {
        await prisma.position.updateMany({ where: { cardId: id }, data: { status: 'Доставлено' } })
        updateData = { screen: 'incoming', status: 'Доставлено', toacc: true, delivered: new Date() }
        await log(id, 'Все позиции доставлены', '', session.name)
        await notifyUser(order.fromId, `Заказ ${id} доставлен!`, id)
        break
      }

      case 'sendAcc':
        updateData = { screen: 'accounting', status: 'К учёту', toacc: false }
        await log(id, 'Отправлен в К Учёту', '', session.name)
        break

      case 'postAcc':
        updateData = { screen: 'bookkeeping', status: 'Бухгалтерия', toacc: false }
        await log(id, 'Проведён в Бухгалтерию', '', session.name)
        break

      case 'returnOut':
        updateData = { screen: 'incoming', status: 'В ожидании', block: '', toacc: false }
        await log(id, 'Возвращён во Входящие', '', session.name)
        break

      case 'returnToAcc':
        updateData = { screen: 'accounting', status: 'К учёту', toacc: true }
        await log(id, 'Возвращён в К Учёту', '', session.name)
        break

      case 'cancel':
        updateData = { isCancelled: true, status: 'Отменён', screen: 'incoming', cancelReason: (payload as { reason?: string }).reason || '' }
        await log(id, 'Отменён', (payload as { reason?: string }).reason || '', session.name)
        break

      case 'restore':
        updateData = { isCancelled: false, status: 'В ожидании', screen: 'incoming', cancelReason: '' }
        await log(id, 'Восстановлен', '', session.name)
        break

      case 'confirmChg':
        updateData = { isChanged: false, changeText: '', changePhone: '' }
        await log(id, 'Изменение подтверждено', '', session.name)
        await notifyUser(order.fromId, `Изменение по заказу ${id} принято`, id)
        break

      case 'changeOrder': {
        const { changeText = '', changePhone = '' } = payload as { changeText?: string; changePhone?: string }
        updateData = { isChanged: true, changeText, changePhone }
        await log(id, 'Изменение от клиента', changeText, order.from)
        await notifyAdmins(`Заказ ${id} изменён клиентом: ${changeText}`, id)
        break
      }

      case 'postpone':
        updateData = { postponed: !order.postponed }
        await log(id, order.postponed ? 'Снято с отложенных' : 'Отложено', '', session.name)
        break

      case 'createDoc': {
        const { type } = payload as { type: string }
        if (type === 'invoice') updateData = { invoice: true }
        if (type === 'fact') updateData = { fact: true }
        await log(id, `Создан документ: ${type}`, '', session.name)
        break
      }

      case 'post1C':
        updateData = { posted1C: true }
        await log(id, 'Проведено в 1С', '', session.name)
        break

      case 'sendArchive':
        if (!order.posted1C) return NextResponse.json({ error: 'Сначала проведите в 1С' }, { status: 400 })
        updateData = { screen: 'archive', status: 'Архив' }
        await log(id, 'Отправлен в Архив', '', session.name)
        break

      default:
        return NextResponse.json({ error: `Неизвестное действие: ${action}` }, { status: 400 })
    }

    const updated = await prisma.order.update({
      where: { id },
      data: updateData as Record<string, unknown>,
      include: { positions: { orderBy: { createdAt: 'asc' } } },
    })

    return NextResponse.json({ success: true, order: updated })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
