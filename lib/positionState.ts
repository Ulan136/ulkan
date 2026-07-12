// Клиент-безопасные предикаты состояния позиции (без React/Prisma).
// СТАТУСНЫЕ, а не по leg: leg у старых данных бывает битым (чинили SQL-ом),
// поэтому код филиала не должен зависеть от значения leg. leg остаётся только
// как признак для фильтра логиста (сервер его продолжает проставлять).
import { POS_STATUS } from './orderStatus'

// Позиция передана логисту (второе плечо): филиал её больше не редактирует
// и не возвращает после начала доставки.
export const HANDED_OFF_STATUSES: string[] = [POS_STATUS.readyToShip, POS_STATUS.inTransit, POS_STATUS.delivered]
// Доставка уже идёт или завершена — вернуть нельзя.
export const IN_DELIVERY_STATUSES: string[] = [POS_STATUS.inTransit, POS_STATUS.delivered]

export function isHandedOff(p: { status: string }): boolean {
  return HANDED_OFF_STATUSES.includes(p.status)
}

export function isInDelivery(p: { status: string }): boolean {
  return IN_DELIVERY_STATUSES.includes(p.status)
}

// Сравнение имён без учёта регистра и лишних пробелов.
export function eqName(a?: string | null, b?: string | null): boolean {
  return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase()
}

type Pos = { status: string; supplier?: string | null }

// Мои активные позиции (я — поставщик, ещё НЕ передана логисту).
export function myActivePos<T extends Pos>(positions: T[], me: string): T[] {
  return positions.filter(p => eqName(p.supplier, me) && !isHandedOff(p))
}

// Мои позиции, уже переданные логисту.
export function myHandedPos<T extends Pos>(positions: T[], me: string): T[] {
  return positions.filter(p => eqName(p.supplier, me) && isHandedOff(p))
}
