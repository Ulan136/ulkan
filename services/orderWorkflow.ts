import prisma from '@/lib/prisma'
import type { Order, Position } from '@prisma/client'
import type { SessionUser } from '@/lib/auth'
import { notify, notifyAdmins } from '@/lib/notifications'
import { generatePosId } from '@/lib/ids'
import { legForSupplier } from '@/services/legDetection'
import { updateReserve } from '@/lib/stock'
import { reserveCenterSkladPositions, incomeOnDeliveryToCenter, releaseDeliveredPosition, CENTER_SKLAD } from '@/services/stockOps'
import { POS_STATUS, CARD_STATUS, SCREENS } from '@/lib/orderStatus'

// ── Декларативная карта переходов заказа ──
// Роут /api/orders/:id/action — тонкий диспетчер: находит TransitionDef по
// action, проверяет roles/guard, выполняет effects, применяет patch и пишет
// History. Общий хвост (order.update, history.create, re-fetch, pushSignal)
// живёт в роуте. Guard'ы исходных состояний (кроме sendArchive) — этап 4c-2.

export type OrderWithPositions = Order & { positions: Position[] }

export interface WorkflowCtx {
  order: OrderWithPositions
  positions: Position[]
  session: SessionUser
  payload: any
  prisma: typeof prisma
  // scratch — эффекты кладут сюда вычисленные значения для patch/history
  // (напр. число зарезервированных позиций, флаг allDone, найденные позиции).
  scratch: Record<string, any>
}

// Guard возвращает: null (ок), строку (→ 400), либо {error,status} для
// не-400 ответов (сохраняет исходные 403 у role-проверок).
export type GuardResult = string | { error: string; status?: number } | null

export interface TransitionDef {
  roles?: string[]                                     // пусто → любой авторизованный (→ 403 при несовпадении)
  guard?: (ctx: WorkflowCtx) => GuardResult            // текст/объект ошибки или null
  patch?: (ctx: WorkflowCtx) => Partial<Order> | null  // патч карточки
  effects?: (ctx: WorkflowCtx) => Promise<void>        // позиции/склад/уведомления
  history?: (ctx: WorkflowCtx) => string | null        // текст History (null → не писать)
}

export const TRANSITIONS: Record<string, TransitionDef> = {
  // ── Приёмка: принять → ожидание ──
  accept: {
    patch: () => ({ screen: SCREENS.reception, block: 'waiting', status: CARD_STATUS.accepted }),
    history: () => 'Принят в приёмку',
  },

  // ── Приёмка: взять в обработку (парсинг comment в позиции) ──
  take: {
    patch: () => ({ status: CARD_STATUS.processing, block: 'processing' }),
    effects: async ({ order, prisma }) => {
      if (order.positions.length === 0 && order.comment) {
        const lines = order.comment.split('\n').filter(l => l.trim())
        if (lines.length > 0) {
          await prisma.position.createMany({
            data: lines.map((line, i) => {
              const trimmed = line.trim()
              const qtyMatch = trimmed.match(/(\d+(?:[.,]\d+)?)\s*(шт|м2|м²|кв\.?м|кг|рулон|усл)\b/i)
              const qty = qtyMatch ? parseFloat(qtyMatch[1].replace(',', '.')) : 0
              const unit = qtyMatch ? qtyMatch[2].toLowerCase().replace('кв.м', 'м2').replace('м²', 'м2') : 'шт'
              return { id: generatePosId(order.id, i + 1), cardId: order.id, oral: trimmed, qty, unit, status: POS_STATUS.working }
            }),
          })
        }
      }
    },
    history: () => 'Взят в обработку',
  },

  // ── Приёмка: отправить в исходящие (+резерв склада) ──
  process: {
    // Комплектность перед отправкой: назначен получатель и логист у каждой позиции.
    guard: ({ order }) => {
      if (!(order.to || '').trim()) return 'Укажите получателя (Кому)'
      if (order.positions.some(p => !(p.resp || '').trim())) return 'Назначьте логиста всем позициям'
      return null
    },
    patch: () => ({ screen: SCREENS.outgoing, status: CARD_STATUS.working, block: '' }),
    effects: async (ctx) => {
      ctx.scratch.reserved = await reserveCenterSkladPositions(ctx.order.positions)
    },
    history: (ctx) => ctx.scratch.reserved > 0
      ? `Отправлен в Исходящие (зарезервировано ${ctx.scratch.reserved} позиций на складе)`
      : 'Отправлен в Исходящие',
  },

  // ── Обновить статус одной позиции (+авто-правило «все доставлены») ──
  updatePos: {
    effects: async (ctx) => {
      const { order, payload, prisma, scratch } = ctx
      const { posId, status: posStatus } = payload
      const pos = order.positions.find(p => p.id === posId)
      scratch.pos = pos
      scratch.oldStatus = pos?.status
      scratch.newStatus = posStatus
      await prisma.position.update({ where: { id: posId }, data: { status: posStatus } })

      // Позиция Центр Склад → Доставлено — списываем со склада
      if (pos && posStatus === POS_STATUS.delivered) {
        await releaseDeliveredPosition(pos)
      }

      // Уведомляем клиента о смене статуса позиции
      if (order.contactId && pos) {
        const statusMsg: Record<string, string> = {
          [POS_STATUS.readyToShip]: `Позиция "${pos.name1c || pos.oral}" готова к отгрузке`,
          [POS_STATUS.inTransit]: `Позиция "${pos.name1c || pos.oral}" в пути`,
          [POS_STATUS.delivered]: `Позиция "${pos.name1c || pos.oral}" доставлена`,
        }
        if (statusMsg[posStatus]) await notify(order.contactId, statusMsg[posStatus], order.id)
      }

      // Авто-правило «все позиции доставлены»
      const updatedPositions = await prisma.position.findMany({ where: { cardId: order.id } })
      const allDone = updatedPositions.length > 0 && updatedPositions.every(p => p.status === POS_STATUS.delivered)
      scratch.allDone = allDone
      if (allDone) {
        if (order.contactId) await notify(order.contactId, `✅ Заказ ${order.id} полностью доставлен!`, order.id)
        await notifyAdmins(`Заказ ${order.id} полностью доставлен`, order.id)
        scratch.incomed = await incomeOnDeliveryToCenter(order, updatedPositions)
      }
    },
    patch: (ctx) => ctx.scratch.allDone
      ? { screen: SCREENS.incoming, status: CARD_STATUS.delivered, toacc: true, delivered: new Date() }
      : null,
    history: (ctx) => {
      const { scratch, session } = ctx
      if (scratch.allDone) {
        return scratch.incomed != null
          ? `Все позиции доставлены → приход на склад (${scratch.incomed} позиций)`
          : 'Все позиции доставлены'
      }
      if (session.role === 'logist' && scratch.pos) {
        return `Логист ${session.name}: ${scratch.pos.name1c || scratch.pos.oral} → ${scratch.newStatus}`
      }
      // fix #6: частичное обновление статуса не-логистом теперь журналируется
      if (scratch.pos) return `Позиция ${scratch.pos.id}: ${scratch.oldStatus} → ${scratch.newStatus}`
      return null
    },
  },

  // ── Все позиции доставлены (массово) ──
  markAll: {
    effects: async (ctx) => {
      const { order, prisma, scratch } = ctx
      const before = await prisma.position.findMany({ where: { cardId: order.id } })
      await prisma.position.updateMany({ where: { cardId: order.id }, data: { status: POS_STATUS.delivered } })
      // fix #3: списываем резерв позиций Центр Склад, ВПЕРВЫЕ ставших доставленными
      // (уже доставленные ранее пропускаем — иначе двойное списание резерва).
      for (const pos of before) {
        if (pos.status !== POS_STATUS.delivered) await releaseDeliveredPosition(pos)
      }
      if (order.contactId) await notify(order.contactId, `Заказ ${order.id} доставлен!`, order.id)
      await notifyAdmins(`Заказ ${order.id} полностью доставлен`, order.id) // fix #3: как updatePos
      scratch.incomed = await incomeOnDeliveryToCenter(order, before)
    },
    patch: () => ({ screen: SCREENS.incoming, status: CARD_STATUS.delivered, toacc: true, delivered: new Date() }),
    history: (ctx) => ctx.scratch.incomed != null
      ? `Все позиции доставлены → приход на склад (${ctx.scratch.incomed} позиций)`
      : 'Все позиции доставлены',
  },

  sendAcc: {
    patch: () => ({ screen: SCREENS.accounting, status: CARD_STATUS.toAccount }),
    history: () => 'Отправлен к учёту',
  },

  postAcc: {
    patch: () => ({ screen: SCREENS.bookkeeping, status: CARD_STATUS.bookkeeping, toacc: false }),
    history: () => 'Проведён в бухгалтерию',
  },

  returnOut: {
    patch: () => ({ screen: SCREENS.incoming, status: CARD_STATUS.waiting, block: '', toacc: false }),
    history: () => 'Возвращён из исходящих',
  },

  returnToAcc: {
    patch: () => ({ screen: SCREENS.accounting, status: CARD_STATUS.toAccount, toacc: true }),
    history: () => 'Возвращён к учёту',
  },

  cancel: {
    patch: ({ payload }) => ({ isCancelled: true, status: CARD_STATUS.cancelled, screen: SCREENS.incoming, cancelReason: payload.reason || '' }),
    history: ({ payload }) => 'Отменён' + (payload.reason ? `: ${payload.reason}` : ''),
  },

  restore: {
    patch: () => ({ isCancelled: false, status: CARD_STATUS.waiting, screen: SCREENS.incoming, cancelReason: '' }),
    history: () => 'Восстановлен из отменённых',
  },

  // fix #6: журналируем изменение (какие поля), раньше History не писалась
  updateOrder: {
    patch: ({ payload }) => ({
      ...(payload.to !== undefined ? { to: payload.to } : {}),
      ...(payload.deadline !== undefined ? { deadline: payload.deadline ? new Date(payload.deadline) : null } : {}),
    }),
    history: ({ payload }) => {
      const changed: string[] = []
      if (payload.to !== undefined) changed.push('получатель')
      if (payload.deadline !== undefined) changed.push('срок')
      return changed.length ? `Карточка обновлена: ${changed.join(', ')}` : null
    },
  },

  // ── Филиал: передать логисту ТОЛЬКО свои позиции (плечо 1 → 2) ──
  branchForward: {
    guard: (ctx) => {
      const me = (ctx.payload.branchName || ctx.session.name || '').trim().toLowerCase()
      const mine = ctx.order.positions.filter(p => (p.supplier || '').trim().toLowerCase() === me && p.leg === 1)
      if (mine.length === 0) return 'Нет позиций для передачи'
      ctx.scratch.mine = mine
      return null
    },
    effects: async (ctx) => {
      const { order, prisma, scratch } = ctx
      const mine: Position[] = scratch.mine
      await prisma.position.updateMany({ where: { id: { in: mine.map(p => p.id) } }, data: { leg: 2, status: POS_STATUS.readyToShip } })
      scratch.count = mine.length
      const fwdResp = [...new Set(mine.map(p => p.resp).filter(Boolean))]
      for (const respName of fwdResp) {
        const logist = await prisma.user.findFirst({ where: { name: respName, role: 'logist' } })
        if (logist) await notify(logist.id, `Заказ ${order.id} готов к доставке`, order.id)
      }
    },
    history: (ctx) => `Филиал ${ctx.payload.branchName || ctx.session.name} передал логисту (${ctx.scratch.count} поз.)`,
  },

  // ── Филиал: принял ТОЛЬКО свои позиции (leg=1) ──
  branchAccept: {
    effects: async (ctx) => {
      const { order, payload, session, prisma, scratch } = ctx
      const me = (payload.branchName || session.name || '').trim().toLowerCase()
      const mine = order.positions.filter(p => (p.supplier || '').trim().toLowerCase() === me && p.leg === 1)
      if (mine.length > 0) {
        await prisma.position.updateMany({ where: { id: { in: mine.map(p => p.id) } }, data: { status: POS_STATUS.acceptedByBranch } })
      }
      scratch.count = mine.length
    },
    history: (ctx) => `Товар принят филиалом ${ctx.payload.branchName || ctx.session.name} (${ctx.scratch.count} поз.)`,
  },

  // ── Филиал: вернуть свои переданные позиции (до начала доставки) ──
  branchRecall: {
    guard: (ctx) => {
      if (ctx.session.role !== 'branch') return { error: 'Возврат доступен только филиалу', status: 403 }
      const me = ctx.session.name.trim().toLowerCase()
      const mine = ctx.order.positions.filter(p => (p.supplier || '').trim().toLowerCase() === me && p.leg === 2)
      if (mine.length === 0) return 'Нет переданных позиций для возврата'
      if (mine.some(p => p.status === POS_STATUS.inTransit || p.status === POS_STATUS.delivered)) return 'Логист уже начал доставку, возврат невозможен'
      ctx.scratch.mine = mine
      return null
    },
    effects: async (ctx) => {
      const { order, session, prisma, scratch } = ctx
      const mine: Position[] = scratch.mine
      await prisma.position.updateMany({ where: { id: { in: mine.map(p => p.id) } }, data: { leg: 1, status: POS_STATUS.acceptedByBranch } })
      scratch.count = mine.length
      const recallResp = [...new Set(mine.map(p => p.resp).filter(Boolean))]
      for (const respName of recallResp) {
        const logist = await prisma.user.findFirst({ where: { name: respName, role: 'logist' } })
        if (logist) await notify(logist.id, `Заказ ${order.id} возвращён филиалом`, order.id)
      }
    },
    history: (ctx) => `Возвращены филиалом ${ctx.session.name} для изменений (${ctx.scratch.count} поз.)`,
  },

  confirmChg: {
    patch: () => ({ isChanged: false }),
    effects: async ({ order }) => { if (order.contactId) await notify(order.contactId, `Изменение по заказу ${order.id} принято`, order.id) },
    history: () => 'Изменение подтверждено',
  },

  postpone: {
    patch: ({ order }) => ({ postponed: !order.postponed }),
    history: ({ order }) => order.postponed ? 'Снят с отложенных' : 'Отложен',
  },

  // fix #5: неизвестный тип документа → 400 (раньше писалась ложная History)
  createDoc: {
    guard: ({ payload }) => (payload.type === 'invoice' || payload.type === 'fact') ? null : 'Неизвестный тип документа',
    patch: ({ payload }) => payload.type === 'invoice' ? { invoice: true } : { fact: true },
    history: ({ payload }) => payload.type === 'invoice' ? 'Счёт сформирован' : 'Счёт-фактура сформирована',
  },

  post1C: {
    patch: () => ({ posted1C: true }),
    history: () => 'Проведён в 1С',
  },

  sendArchive: {
    guard: ({ order }) => order.posted1C ? null : 'Сначала проведите в 1С',
    patch: () => ({ screen: SCREENS.archive, status: CARD_STATUS.archive }),
    history: () => 'Отправлен в архив',
  },

  changeOrder: {
    patch: ({ payload }) => ({ isChanged: true, changeText: payload.changeText || '', changePhone: payload.changePhone || '' }),
    effects: async ({ order }) => { await notifyAdmins(`Клиент изменил заказ ${order.id}`, order.id) },
    history: () => 'Клиент внёс изменение',
  },

  // ── Добавить позицию ──
  addPos: {
    guard: (ctx) => {
      const { session, order, payload } = ctx
      // Филиал: только свою позицию (supplier = имя) и только в карточку, где он уже поставщик.
      if (session.role === 'branch') {
        const me = session.name.trim().toLowerCase()
        const already = order.positions.some(p => (p.supplier || '').trim().toLowerCase() === me)
        if (!already || (payload.supplier || '').trim().toLowerCase() !== me) return { error: 'Филиал может добавлять только свои позиции', status: 403 }
      }
      // Логист: только в карточку, где у него уже есть позиция, и только с resp = своё имя.
      if (session.role === 'logist') {
        const me = session.name.trim().toLowerCase()
        const already = order.positions.some(p => (p.resp || '').trim().toLowerCase() === me)
        if (!already || (payload.resp || '').trim().toLowerCase() !== me) return { error: 'Логист может добавлять только свои позиции', status: 403 }
      }
      return null
    },
    effects: async (ctx) => {
      const { order, payload, prisma } = ctx
      const existing = await prisma.position.findMany({ where: { cardId: order.id } })
      const newId = generatePosId(order.id, existing.length + 1)
      const posLeg = await legForSupplier(payload.supplier) // поставщик-филиал → 1
      const newPos = await prisma.position.create({
        data: {
          id: newId, cardId: order.id,
          name1c: payload.name1c || '', oral: payload.oral || '',
          qty: payload.qty || 0, unit: payload.unit || 'шт',
          price: payload.price || 0, resp: payload.resp || '',
          supplier: payload.supplier || '', supplierId: payload.supplierId || null,
          status: payload.status || POS_STATUS.working,
          leg: posLeg,
          deadline: payload.deadline ? new Date(payload.deadline) : null,
        },
      })
      await reserveCenterSkladPositions([newPos])
      // Уведомляем логиста только для позиции второго плеча (leg=2).
      if (posLeg === 2 && payload.resp) {
        const logist = await prisma.user.findFirst({ where: { name: payload.resp, role: 'logist' } })
        if (logist) await notify(logist.id, `Вам назначена позиция: ${payload.name1c || payload.oral} по заказу ${order.id}`, order.id)
      }
    },
    history: ({ payload }) => `Добавлена позиция: ${payload.name1c || payload.oral}`,
  },

  // ── Обновить детали позиции ──
  updatePosDetail: {
    guard: (ctx) => {
      const { session, order, payload } = ctx
      const oldPos = order.positions.find(p => p.id === payload.posId)
      if (session.role === 'branch' && (oldPos?.supplier || '').trim().toLowerCase() !== session.name.trim().toLowerCase()) return { error: 'Филиал может менять только свои позиции', status: 403 }
      if (session.role === 'logist' && (oldPos?.resp || '').trim().toLowerCase() !== session.name.trim().toLowerCase()) return { error: 'Логист может менять только свои позиции', status: 403 }
      ctx.scratch.oldPos = oldPos
      return null
    },
    effects: async (ctx) => {
      const { payload, prisma, scratch } = ctx
      const { posId, ...posData } = payload
      const oldPos: Position | undefined = scratch.oldPos
      // Плечо пересчитываем ТОЛЬКО при смене поставщика (qty-правка не меняет leg).
      const supplierChanged = posData.supplier !== undefined && posData.supplier !== oldPos?.supplier
      const newLeg = supplierChanged ? await legForSupplier(posData.supplier) : oldPos?.leg
      await prisma.position.update({
        where: { id: posId },
        data: {
          name1c: posData.name1c ?? oldPos?.name1c,
          oral: posData.oral ?? oldPos?.oral,
          qty: posData.qty !== undefined ? (Number(posData.qty) || 0) : oldPos?.qty,
          unit: posData.unit ?? oldPos?.unit,
          price: posData.price !== undefined ? (Number(posData.price) || 0) : oldPos?.price,
          resp: posData.resp ?? oldPos?.resp,
          supplier: posData.supplier ?? oldPos?.supplier,
          supplierId: posData.supplierId !== undefined ? (posData.supplierId || null) : oldPos?.supplierId,
          status: posData.status ?? oldPos?.status,
          leg: newLeg,
          payment: posData.payment ?? oldPos?.payment,
          late: posData.late ?? oldPos?.late,
          deadline: posData.deadline !== undefined ? (posData.deadline ? new Date(posData.deadline) : null) : oldPos?.deadline,
        },
      })
      // Резерв корректируем, только если поставщик был И остаётся Центр Склад
      if (oldPos && oldPos.supplier === CENTER_SKLAD && posData.supplier === CENTER_SKLAD) {
        const diff = (Number(posData.qty) || 0) - oldPos.qty
        if (diff !== 0) await updateReserve(posId, oldPos.qty, Number(posData.qty) || 0)
      }
    },
    history: ({ payload }) => `Позиция ${payload.posId} изменена`, // fix #6
  },

  // ── Удалить позицию (+снять резерв склада) ──
  deletePos: {
    effects: async (ctx) => {
      const { order, payload, prisma } = ctx
      const pos = order.positions.find(p => p.id === payload.posId)
      // fix #4: снять резерв перед удалением, если позиция Центр Склад и ещё не доставлена
      // (у доставленной резерв уже списан releaseStock — повторно не трогаем).
      if (pos && pos.supplier === CENTER_SKLAD && pos.status !== POS_STATUS.delivered) {
        await updateReserve(pos.id, pos.qty, 0)
      }
      await prisma.position.delete({ where: { id: payload.posId } })
    },
    history: () => 'Позиция удалена',
  },

  // ── Обновить карточку ──
  updateCard: {
    patch: ({ payload }) => ({
      from: payload.from, to: payload.to,
      comment: payload.comment, phone: payload.phone,
      deadline: payload.deadline ? new Date(payload.deadline) : null,
      projectId: payload.projectId || null,
      specProjectId: payload.specProjectId || null,
      contactId: payload.contactId || null,
    }),
    history: () => 'Карточка обновлена',
  },
}
