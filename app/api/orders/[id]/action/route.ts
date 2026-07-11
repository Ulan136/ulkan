import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'
import { generatePosId } from '@/lib/ids'
import { notifyAdmins, notify } from '@/lib/notifications'
import { releaseStock, reserveStock } from '@/lib/stock'
import { orderInclude } from '@/lib/orderMetrics'
import { isFirstLeg, isForwardedToLogist } from '@/services/legDetection'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response
  const { session } = auth

  const { id } = await params
  const body = await req.json()
  const { action, ...payload } = body

  const order = await prisma.order.findUnique({ where: { id }, include: orderInclude })
  if (!order) return NextResponse.json({ error: 'Карточка не найдена' }, { status: 404 })

  let updateData: any = {}
  let historyText = ''

  try {
    switch (action) {

      // ── Приёмка: принять → ожидание ──
      case 'accept':
        updateData = { screen: 'reception', block: 'waiting', status: 'Принят' }
        historyText = 'Принят в приёмку'
        break

      // ── Приёмка: взять в обработку (парсинг comment) ──
      case 'take':
        updateData = { status: 'В обработке', block: 'processing' }
        historyText = 'Взят в обработку'
        if (order.positions.length === 0 && order.comment) {
          const lines = order.comment.split('\n').filter(l => l.trim())
          if (lines.length > 0) {
            await prisma.position.createMany({
              data: lines.map((line, i) => {
                const trimmed = line.trim()
                const qtyMatch = trimmed.match(/(\d+(?:[.,]\d+)?)\s*(шт|м2|м\u00b2|кв\.?м|кг|рулон|усл)\b/i)
                const qty = qtyMatch ? parseFloat(qtyMatch[1].replace(',', '.')) : 0
                const unit = qtyMatch ? qtyMatch[2].toLowerCase().replace('кв.м', 'м2').replace('м\u00b2', 'м2') : 'шт'
                return {
                  id: generatePosId(id, i + 1),
                  cardId: id,
                  oral: trimmed,
                  qty,
                  unit,
                  status: 'В работе',
                }
              })
            })
          }
        }
        break

      // ── Приёмка Блок 2: отправить в исходящие ──
      case 'process': {
        updateData = { screen: 'outgoing', status: 'В работе', block: '' }
        historyText = 'Отправлен в Исходящие'
        // Первое плечо: если поставщик хотя бы одной позиции — филиал (branch),
        // карточка сначала идёт к филиалу-изготовителю, логисту пока не видна.
        updateData.leg = (await isFirstLeg(order.positions)) ? 1 : 2
        // Резервируем позиции с Центр Склад
        const posToReserve = order.positions.filter(p => p.supplier === 'Центр Склад' && p.qty > 0 && p.name1c)
        for (const pos of posToReserve) {
          await reserveStock(pos.id, pos.name1c, pos.qty)
        }
        if (posToReserve.length > 0) {
          historyText = `Отправлен в Исходящие (зарезервировано ${posToReserve.length} позиций на складе)`
        }
        break
      }

      // ── Обновить статус позиции ──
      case 'updatePos': {
        const { posId, status: posStatus } = payload
        await prisma.position.update({ where: { id: posId }, data: { status: posStatus } })

        // Если позиция с Центр Склад → Доставлено — списываем
        const pos = order.positions.find(p => p.id === posId)
        if (pos && pos.supplier === 'Центр Склад' && posStatus === 'Доставлено') {
          await releaseStock(posId, pos.name1c || pos.oral, pos.qty)
        }

        // Сохраняем историю логиста — строка смены
        if (session.role === 'logist' && pos) {
          historyText = `Логист ${session.name}: ${pos.name1c || pos.oral} → ${posStatus}`
        }

        // Уведомляем клиента о каждом изменении статуса позиции
        if (order.contactId && pos) {
          const statusMsg: Record<string, string> = {
            'Готово к отгрузке': `Позиция "${pos.name1c || pos.oral}" готова к отгрузке`,
            'В пути': `Позиция "${pos.name1c || pos.oral}" в пути`,
            'Доставлено': `Позиция "${pos.name1c || pos.oral}" доставлена`,
          }
          if (statusMsg[posStatus]) {
            await notify(order.contactId, statusMsg[posStatus], id)
          }
        }

        // Проверяем все ли позиции доставлены
        const updatedPositions = await prisma.position.findMany({ where: { cardId: id } })
        const allDone = updatedPositions.every(p => p.status === 'Доставлено')
        if (allDone && updatedPositions.length > 0) {
          updateData = { screen: 'incoming', status: 'Доставлено', toacc: true, delivered: new Date() }
          historyText = 'Все позиции доставлены'
          if (order.contactId) await notify(order.contactId, `✅ Заказ ${id} полностью доставлен!`, id)
          await notifyAdmins(`Заказ ${id} полностью доставлен`, id)

          // Если получатель = Центр Склад → автоматический приход на склад
          if (order.to === 'Центр Склад') {
            const { incomeStock } = await import('@/lib/stock')
            const centerSklad = await prisma.supplier.findFirst({ where: { name: 'Центр Склад' } })
            if (centerSklad) {
              for (const pos of updatedPositions) {
                if (pos.name1c && pos.qty > 0) {
                  await incomeStock(pos.name1c, pos.qty, centerSklad.id)
                }
              }
              historyText = `Все позиции доставлены → приход на склад (${updatedPositions.length} позиций)`
            }
          }
        }
        break
      }

      // ── Все позиции доставлены ──
      case 'markAll': {
        const allPositions = await prisma.position.findMany({ where: { cardId: id } })
        await prisma.position.updateMany({ where: { cardId: id }, data: { status: 'Доставлено' } })
        updateData = { screen: 'incoming', status: 'Доставлено', toacc: true, delivered: new Date() }
        historyText = 'Все позиции доставлены'
        if (order.contactId) await notify(order.contactId, `Заказ ${id} доставлен!`, id)

        // Если получатель = Центр Склад → автоматический приход на склад
        if (order.to === 'Центр Склад') {
          const { incomeStock } = await import('@/lib/stock')
          const centerSklad = await prisma.supplier.findFirst({ where: { name: 'Центр Склад' } })
          if (centerSklad) {
            for (const pos of allPositions) {
              if (pos.name1c && pos.qty > 0) {
                await incomeStock(pos.name1c, pos.qty, centerSklad.id)
              }
            }
            historyText = `Все позиции доставлены → приход на склад (${allPositions.length} позиций)`
          }
        }
        break
      }

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

      case 'updateOrder':
        if (payload.to !== undefined) updateData.to = payload.to
        if (payload.deadline !== undefined) updateData.deadline = payload.deadline ? new Date(payload.deadline) : null
        historyText = ''
        break

      // ── Филиал: передать дальше через логиста (плечо 2) ──
      case 'branchForward': {
        // Сбрасываем статусы позиций на "В работе" для второго плеча
        await prisma.position.updateMany({
          where: { cardId: id },
          data: { status: 'В работе' }
        })
        // Меняем from на филиал, карточка снова идёт в исходящие.
        // leg=2 → теперь карточка видна логисту (второе плечо доставки).
        updateData = {
          from: payload.branchName || order.to,
          screen: 'outgoing',
          status: 'В работе',
          toacc: false,
          delivered: null,
          leg: 2,
        }
        historyText = `Передано филиалом ${payload.branchName || order.to} → второе плечо доставки`
        // Уведомляем логистов, назначенных в позициях, что заказ готов к доставке
        const respNames = [...new Set(order.positions.map(p => p.resp).filter(Boolean))]
        for (const respName of respNames) {
          const logist = await prisma.user.findFirst({ where: { name: respName, role: 'logist' } })
          if (logist) await notify(logist.id, `Заказ ${id} готов к доставке`, id)
        }
        break
      }

      // ── Филиал: принял товар ──
      case 'branchAccept':
        updateData = { status: 'Принято филиалом' }
        historyText = `Товар принят филиалом ${payload.branchName || order.to}`
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

      // ── Добавить позицию ──
      case 'addPos': {
        const existing = await prisma.position.findMany({ where: { cardId: id } })
        const newId = generatePosId(id, existing.length + 1)
        const newPos = await prisma.position.create({
          data: {
            id: newId, cardId: id,
            name1c: payload.name1c || '', oral: payload.oral || '',
            qty: payload.qty || 0, unit: payload.unit || 'шт',
            price: payload.price || 0, resp: payload.resp || '',
            supplier: payload.supplier || '', supplierId: payload.supplierId || null,
            status: payload.status || 'В работе',
            deadline: payload.deadline ? new Date(payload.deadline) : null,
          },
        })
        // Если поставщик = Центр Склад → резервируем
        if (payload.supplier === 'Центр Склад' && payload.qty > 0) {
          await reserveStock(newPos.id, payload.name1c || payload.oral, payload.qty)
        }
        historyText = `Добавлена позиция: ${payload.name1c || payload.oral}`
        // Пересчёт плеча: поставщика-филиала могли добавить этой позицией.
        // Гард: если карточка уже передана логисту (branchForward) — leg не понижаем.
        const legAfterAdd = (await isForwardedToLogist(order))
          ? 2
          : ((await isFirstLeg([...existing, newPos])) ? 1 : 2)
        updateData = { leg: legAfterAdd }
        // Уведомляем логиста только если карточка второго плеча (leg=2) —
        // при первом плече логист её ещё не видит.
        if (legAfterAdd === 2 && payload.resp) {
          const logist = await prisma.user.findFirst({ where: { name: payload.resp, role: 'logist' } })
          if (logist) await notify(logist.id, `Вам назначена позиция: ${payload.name1c || payload.oral} по заказу ${id}`, id)
        }
        break
      }

      // ── Обновить детали позиции ──
      case 'updatePosDetail': {
        const { posId, ...posData } = payload
        const oldPos = order.positions.find(p => p.id === posId)
        await prisma.position.update({
          where: { id: posId },
          data: {
            name1c: posData.name1c, oral: posData.oral,
            qty: Number(posData.qty) || 0, unit: posData.unit,
            price: Number(posData.price) || 0, resp: posData.resp,
            supplier: posData.supplier, supplierId: posData.supplierId || null,
            status: posData.status, payment: posData.payment,
            late: posData.late, deadline: posData.deadline ? new Date(posData.deadline) : null,
          },
        })
        // Обновляем резерв если поставщик Центр Склад
        if (oldPos && oldPos.supplier === 'Центр Склад' && posData.supplier === 'Центр Склад') {
          const diff = (Number(posData.qty) || 0) - oldPos.qty
          if (diff !== 0) {
            const { updateReserve } = await import('@/lib/stock')
            await updateReserve(posId, oldPos.qty, Number(posData.qty) || 0)
          }
        }
        // Пересчёт плеча: поставщика-филиала могли назначить/сменить этой правкой.
        // Гард: если карточка уже передана логисту (branchForward) — leg не понижаем.
        const legAfterEdit = (await isForwardedToLogist(order))
          ? 2
          : ((await isFirstLeg(await prisma.position.findMany({ where: { cardId: id } }))) ? 1 : 2)
        updateData = { leg: legAfterEdit }
        // Не пишем в историю — слишком частые мелкие изменения засоряют ленту
        break
      }

      // ── Удалить позицию ──
      case 'deletePos':
        await prisma.position.delete({ where: { id: payload.posId } })
        historyText = 'Позиция удалена'
        break

      // ── Обновить карточку ──
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

    const updated = await prisma.order.findUnique({ where: { id }, include: orderInclude })
    return NextResponse.json({ success: true, order: updated })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка выполнения действия' }, { status: 500 })
  }
}
