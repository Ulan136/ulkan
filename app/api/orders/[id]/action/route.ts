import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generatePosId } from '@/lib/ids'
<<<<<<< HEAD
import { notify, notifyAdmins } from '@/lib/notifications'
import { releaseStock } from '@/lib/stock'

type Params = { params: Promise<{ id: string }> }
=======
import { notifyAdmins, notifyUser } from '@/lib/notifications'
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b

async function log(cardId: string, action: string, detail: string, userName: string) {
  await prisma.history.create({ data: { cardId, action, detail, userName } })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = await params
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
<<<<<<< HEAD
        const { posId, status: newStatus } = payload
        const pos = await prisma.position.findUnique({ where: { id: posId } })
        await prisma.position.update({
          where: { id: posId },
          data: { status: newStatus, late: newStatus === 'Доставлено' ? false : undefined },
        })
        if (pos && newStatus === 'Доставлено' && pos.supplier === 'Центр Склад') {
          await releaseStock(posId, pos.name1c || pos.oral, pos.qty, id)
        }
        const updatedPositions = await prisma.position.findMany({ where: { cardId: id } })
        if (updatedPositions.every((p) => p.status === 'Доставлено')) {
          await prisma.order.update({
            where: { id },
            data: { screen: 'incoming', status: 'Доставлено', toacc: true, delivered: new Date() },
          })
          await log(id, 'Все позиции доставлены', 'Автопереход к учёту', who)
        } else {
          await log(id, 'Позиция обновлена', `${posId} → ${newStatus}`, who)
=======
        const { posId, status: posStatus } = payload as { posId: string; status: string }
        await prisma.position.update({ where: { id: posId }, data: { status: posStatus } })

        // Пересчёт: все ли доставлено?
        const allPos = await prisma.position.findMany({ where: { cardId: id } })
        const allDone = allPos.every((p: { status: string }) => p.status === 'Доставлено')
        if (allDone && allPos.length > 0) {
          updateData = { screen: 'incoming', status: 'Доставлено', toacc: true, delivered: new Date() }
          await log(id, 'Все позиции доставлены', '', session.name)
          await notifyUser(order.fromId, `Заказ ${id} доставлен!`, id)
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
        }
        break
      }

      case 'markAll': {
<<<<<<< HEAD
        for (const p of order.positions) {
          if (p.supplier === 'Центр Склад') {
            await releaseStock(p.id, p.name1c || p.oral, p.qty, id)
          }
        }
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
        await prisma.order.update({ where: { id }, data: { screen: 'accounting', status: 'К учёту' } })
        await log(id, 'Отправлен к учёту', '', who)
=======
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
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
        break
      }

      case 'postpone':
        updateData = { postponed: !order.postponed }
        await log(id, order.postponed ? 'Снято с отложенных' : 'Отложено', '', session.name)
        break
<<<<<<< HEAD
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
        if (order.fromId) {
          await notify(order.fromId, `Изменение по заявке ${id} принято`, id)
        }
        break
      }
      case 'postpone': {
        await prisma.order.update({ where: { id }, data: { postponed: !order.postponed } })
        await log(id, order.postponed ? 'Снят с паузы' : 'Отложен', '', who)
        break
      }
      case 'createDoc': {
        const field = payload.type === 'invoice' ? { invoice: true } : { fact: true }
        await prisma.order.update({ where: { id }, data: field })
        await log(id, 'Создан документ', payload.type || '', who)
=======

      case 'createDoc': {
        const { type } = payload as { type: string }
        if (type === 'invoice') updateData = { invoice: true }
        if (type === 'fact') updateData = { fact: true }
        await log(id, `Создан документ: ${type}`, '', session.name)
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
        break
      }

      case 'post1C':
        updateData = { posted1C: true }
        await log(id, 'Проведено в 1С', '', session.name)
        break
<<<<<<< HEAD
      }
      case 'sendArchive': {
        if (!order.posted1C) {
          return NextResponse.json({ error: 'Сначала проведите в 1С' }, { status: 400 })
        }
        await prisma.order.update({ where: { id }, data: { screen: 'archive', status: 'Архив' } })
        await log(id, 'Отправлен в архив', '', who)
        break
      }
      case 'changeOrder': {
        await prisma.order.update({
          where: { id },
          data: {
            isChanged: true,
            changeText: payload.changeText || '',
            changePhone: payload.changePhone || '',
            to: payload.to || order.to,
            comment: payload.text || order.comment,
            deadline: payload.deadline ? new Date(payload.deadline) : order.deadline,
          },
        })
        await notifyAdmins(`Клиент изменил заявку ${id}`, id)
        await log(id, 'Изменение от клиента', payload.changeText || '', who)
        break
      }
=======

      case 'sendArchive':
        if (!order.posted1C) return NextResponse.json({ error: 'Сначала проведите в 1С' }, { status: 400 })
        updateData = { screen: 'archive', status: 'Архив' }
        await log(id, 'Отправлен в Архив', '', session.name)
        break

>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
      default:
        return NextResponse.json({ error: `Неизвестное действие: ${action}` }, { status: 400 })
    }

<<<<<<< HEAD
    const updated = await prisma.order.findUnique({ where: { id }, include: { positions: true } })
    return NextResponse.json({ success: true, order: updated })
  } catch (error) {
    console.error('Action error:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка' }, { status: 500 })
=======
    const updated = await prisma.order.update({
      where: { id },
      data: updateData as Record<string, unknown>,
      include: { positions: { orderBy: { createdAt: 'asc' } } },
    })

    return NextResponse.json({ success: true, order: updated })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
  }
}