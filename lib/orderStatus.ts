// Единый источник истины для строковых статусов и экранов заказа.
// Чистый модуль (без React/Prisma) — безопасно импортировать где угодно.

// Статусы позиции (Position.status)
export const POS_STATUS = {
  working: 'В работе',
  readyToShip: 'Готово к отгрузке',
  inTransit: 'В пути',
  delivered: 'Доставлено',
  acceptedByBranch: 'Принято филиалом', // плечо 1: филиал принял товар
  empty: '',
} as const

// Статусы карточки (Order.status)
export const CARD_STATUS = {
  accepted: 'Принят',
  processing: 'В обработке',
  working: 'В работе',
  delivered: 'Доставлено',
  toAccount: 'К учёту',
  bookkeeping: 'Бухгалтерия',
  waiting: 'В ожидании',
  cancelled: 'Отменён',
  archive: 'Архив',
} as const

// Экраны (Order.screen)
export const SCREENS = {
  reception: 'reception',
  outgoing: 'outgoing',
  incoming: 'incoming',
  accounting: 'accounting',
  bookkeeping: 'bookkeeping',
  archive: 'archive',
} as const
