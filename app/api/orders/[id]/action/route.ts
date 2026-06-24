import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { generatePosId } from '@/lib/ids'
import { notifyAdmins, notify } from '@/lib/notifications'
import { releaseStock } from '@/lib/stock'

const WITH_POS = { positions: { orderBy: { createdAt: 'asc' as const } } }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { action, ...payload } = body

  const order = await prisma.order.findUnique({ where: { id }, include: WITH_POS })
  if (!order) return NextResponse.json({ error: 'Карточка не найдена' }, { status: 404 })

  let updateData: any = {}
  let historyText = ''

  try {
    switch (action) {
      case 'accept':
        updateData = { screen: 'reception', block: 'waiting', status: 'Принят' }
        historyText = 'Принят в приёмку'
        break

      case 'take':
        updateData = { status: 'В обработке', block: 'processing' }
        historyText = 'Взят в обработку'
        // Парсим comment в позиции если позиций нет
        if (order.positions.length === 0 && order.comment) {
          const lines = order.comment.split('\n').filter(l => l.trim())
          const posCreate = lines.map((line, i) => ({
            id: generatePosId(id, i + 1),
            oral: line.trim(),
            status: 'В работе',
          }))
          if (posCreate.length > 0) {
            await prisma.position.createMany({ data: posCreate.map(p => ({ ...p, cardId: id })) })
          }
        }
        break

      case 'process':
        updateData = { screen: 'outgoing', status: 'В работе', block: '' }
        historyText = 'Отправлен в Исходящие'
        break

      case 'updatePos': {
        const { posId, status: posStatus } = payload
        await prisma.position.update({ where: { id: posId }, data: { status: posStatus } })
        // Если позиция с Центр Склад и статус Доставлено — списываем со склада
        const pos = order.positions.find(p => p.id === posId)
        if (pos && pos.supplier === 'Центр Склад' && posStatus === 'Доставлено') {
          await releaseStock(posId, pos.name1c || pos.oral, pos.qty)
        }
        // Проверяем все ли доставлено
        const updatedPositions = await prisma.position.findMany({ where: { cardId: id } })
        const allDone = updatedPositions.every(p => p.status === 'Доставлено')
        if (allDone && updatedPositions.length > 0) {
          updateData = { screen: 'incoming', status: 'Доставлено', toacc: true, delivered: new Date() }
          historyText = 'Все позиции доставлены'
          if (order.contactId) await notify(order.contactId, `Заказ ${id} доставлен!`, id)
        }
        break
      }

      case 'markAll':
        await prisma.position.updateMany({ where: { cardId: id }, data: { status: 'Доставлено' } })
        updateData = { screen: 'incoming', status: 'Доставлено', toacc: true, delivered: new Date() }
        historyText = 'Все позиции доставлены'
        if (order.contactId) await notify(order.contactId, `Заказ ${id} доставлен!`, id)
        break

      case 'sendAcc':
        updateData = { screen: 'accounting', status: 'К учёту' }
        historyText = 'Отправлен к учёту'
        break

      case 'postAcc':
        updateData = { screen: 'bookkeeping', status: 'Бухгалтерия', toacc: false }
        historyText = 'Проведён в бухгалтерию'
        break

      case 'returnOut':
        updateData = { screen: 'incoming', status: 'В ожидании', block: '', toacc: false }
        historyText = 'Возвращён из исходящих'
        break

      case 'returnToAcc':
        updateData = { screen: 'accounting', status: 'К учёту', toacc: true }
        historyText = 'Возвращён к учёту'
        break

      case 'cancel':
        updateData = { isCancelled: true, status: 'Отменён', screen: 'incoming', cancelReason: payload.reason || '' }
        historyText = 'Отменён' + (payload.reason ? `: ${payload.reason}` : '')
        break

      case 'restore':
        updateData = { isCancelled: false, status: 'В ожидании', screen: 'incoming', cancelReason: '' }
        historyText = 'Восстановлен из отменённых'
        break

      case 'confirmChg':
        updateData = { isChanged: false }
        historyText = 'Изменение подтверждено'
        if (order.contactId) await notify(order.contactId, `Изменение по заказу ${id} принято`, id)
        break

      case 'postpone':
        updateData = { postponed: !order.postponed }
        historyText = order.postponed ? 'Снят с отложенных' : 'Отложен'
        break

      case 'createDoc':
        if (payload.type === 'invoice') updateData = { invoice: true }
        if (payload.type === 'fact') updateData = { fact: true }
        historyText = payload.type === 'invoice' ? 'Счёт сформирован' : 'Счёт-фактура сформирована'
        break

      case 'post1C':
        updateData = { posted1C: true }
        historyText = 'Проведён в 1С'
        break

      case 'sendArchive':
        if (!order.posted1C) return NextResponse.json({ error: 'Сначала проведите в 1С' }, { status: 400 })
        updateData = { screen: 'archive', status: 'Архив' }
        historyText = 'Отправлен в архив'
        break

      case 'changeOrder':
        updateData = { isChanged: true, changeText: payload.changeText || '', changePhone: payload.changePhone || '' }
        historyText = 'Клиент внёс изменение'
        await notifyAdmins(`Клиент изменил заказ ${id}`, id)
        break

      case 'addPos': {
        const existing = await prisma.position.findMany({ where: { cardId: id } })
        const newId = generatePosId(id, existing.length + 1)
        await prisma.position.create({
          data: {
            id: newId, cardId: id,
            name1c: payload.name1c || '', oral: payload.oral || '',
            qty: payload.qty || 0, unit: payload.unit || 'шт',
            price: payload.price || 0, resp: payload.resp || '',
            supplier: payload.supplier || '', supplierId: payload.supplierId || null,
            status: payload.status || 'В работе',
          },
        })
        historyText = `Добавлена позиция: ${payload.name1c || payload.oral}`
        break
      }

      case 'updatePosDetail': {
        const { posId, ...posData } = payload
        await prisma.position.update({
          where: { id: posId },
          data: {
            name1c: posData.name1c, oral: posData.oral, qty: posData.qty,
            unit: posData.unit, price: posData.price, resp: posData.resp,
            supplier: posData.supplier, supplierId: posData.supplierId || null,
            status: posData.status, payment: posData.payment,
            late: posData.late, deadline: posData.deadline ? new Date(posData.deadline) : null,
          },
        })
        historyText = `Позиция обновлена`
        break
      }

      case 'deletePos': {
        await prisma.position.delete({ where: { id: payload.posId } })
        historyText = 'Позиция удалена'
        break
      }

      case 'updateCard':
        updateData = {
          from: payload.from, to: payload.to,
          comment: payload.comment, phone: payload.phone,
          deadline: payload.deadline ? new Date(payload.deadline) : null,
          projectId: payload.projectId || null,
          specProjectId: payload.specProjectId || null,
          contactId: payload.contactId || null,
        }
        historyText = 'Карточка обновлена'
        break

      default:
        return NextResponse.json({ error: `Неизвестный action: ${action}` }, { status: 400 })
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.order.update({ where: { id }, data: updateData })
    }

    if (historyText) {
      await prisma.history.create({ data: { cardId: id, action: historyText, userName: session.name } })
    }

    const updated = await prisma.order.findUnique({ where: { id }, include: WITH_POS })
    return NextResponse.json({ success: true, order: updated })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка выполнения действия' }, { status: 500 })
  }
}
