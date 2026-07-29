// Закуп vs Продажа — единый признак, без колонки в БД.
// Получатель закупа ВСЕГДА центральный склад «Центр Склад», поэтому тип
// карточки выводится из поля `to` (никакой опасной миграции Order не нужно).
// Клиент-безопасно (без prisma) — можно импортировать в компоненты.

export const CENTER_SKLAD = 'Центр Склад'

// Закуп — карточка, получатель которой центральный склад.
export function isPurchase(o: { to?: string | null }): boolean {
  return ((o?.to || '') as string).trim() === CENTER_SKLAD
}

// Ярлык типа для бейджей.
export function kindLabel(o: { to?: string | null }): 'Закуп' | 'Продажа' {
  return isPurchase(o) ? 'Закуп' : 'Продажа'
}
