// Серверо-нейтральные метрики заказа: без React и без Prisma.
// Функции принимают минимальный набор полей, поэтому работают и с
// клиентским типом Order/Position, и с объектами, которые возвращает Prisma.

// Маппинг статуса позиции в процент готовности
export const PCT: Record<string, number> = {
  'В работе': 10,
  'Готово к отгрузке': 60,
  'В пути': 80,
  'Доставлено': 100,
  'Принято филиалом': 40, // плечо 1: филиал принял товар (шкала первого плеча: 10→40)
  '': 0,
}

export function posPct(p: { status: string }): number {
  return PCT[p.status] ?? 0
}

export function cardProgress(o: { status: string; positions: { status: string }[] }): number {
  if (!o.positions.length) return o.status === 'Доставлено' ? 100 : 0
  return Math.round(o.positions.reduce((s, p) => s + posPct(p), 0) / o.positions.length)
}

export function cardSum(o: { positions: { qty: number; price: number }[] }): number {
  return o.positions.reduce((s, p) => s + (p.qty * p.price || 0), 0)
}

// Общий include для загрузки заказа вместе с позициями (позиции по дате создания)
export const orderInclude = { positions: { orderBy: { createdAt: 'asc' } } } as const
