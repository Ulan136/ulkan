// Серверо-нейтральные метрики заказа: без React и без Prisma.
// Функции принимают минимальный набор полей, поэтому работают и с
// клиентским типом Order/Position, и с объектами, которые возвращает Prisma.
import { POS_STATUS, CARD_STATUS } from './orderStatus'

// Маппинг статуса позиции в процент готовности
export const PCT: Record<string, number> = {
  [POS_STATUS.working]: 10,
  [POS_STATUS.readyToShip]: 60,
  [POS_STATUS.inTransit]: 80,
  [POS_STATUS.delivered]: 100,
  [POS_STATUS.acceptedByBranch]: 40, // плечо 1: филиал принял товар (шкала первого плеча: 10→40)
  [POS_STATUS.empty]: 0,
}

export function posPct(p: { status: string }): number {
  return PCT[p.status] ?? 0
}

export function cardProgress(o: { status: string; positions: { status: string }[] }): number {
  if (!o.positions.length) return o.status === CARD_STATUS.delivered ? 100 : 0
  return Math.round(o.positions.reduce((s, p) => s + posPct(p), 0) / o.positions.length)
}

export function cardSum(o: { positions: { qty: number; price: number }[] }): number {
  return o.positions.reduce((s, p) => s + (p.qty * p.price || 0), 0)
}

// Общий include для загрузки заказа вместе с позициями (позиции по дате создания)
export const orderInclude = { positions: { orderBy: { createdAt: 'asc' } } } as const
