import type { SessionUser } from '@/lib/auth'
import { eqName } from '@/lib/positionState'

type OrderLike = { from?: string | null; to?: string | null; fromId?: string | null; contactId?: string | null }
type PosLike = { resp?: string | null; supplier?: string | null }

// Участник карточки (может читать/писать в чат). Гард ВЫРОВНЕН с тем, что
// каждая роль реально видит в своём кабинете/портале — иначе видимая карточка
// давала бы 403 (наша грабля «тихая пустота»):
// - super_admin / bookkeeper — всегда;
// - logist — есть позиция с resp == его имя;
// - branch — есть позиция supplier == его имя, ЛИБО он получатель (to) или
//   отправитель (from) карточки (BranchPortal показывает и такие — заявки без
//   позиций-поставщика и адресованные филиалу);
// - client / supplier_client — он заказчик (fromId) или контакт (contactId),
//   либо (legacy-подстраховка) from == его имя.
export function isParticipant(order: OrderLike, positions: PosLike[], session: SessionUser): boolean {
  const role = session.role
  if (role === 'super_admin' || role === 'bookkeeper') return true
  if (role === 'logist') return positions.some(p => eqName(p.resp, session.name))
  if (role === 'branch') {
    return positions.some(p => eqName(p.supplier, session.name))
      || eqName(order.to, session.name)
      || eqName(order.from, session.name)
  }
  if (role === 'client' || role === 'supplier_client') {
    return order.fromId === session.id
      || order.contactId === session.id
      || eqName(order.from, session.name)
  }
  return false
}
