import type { SessionUser } from '@/lib/auth'
import { eqName } from '@/lib/positionState'

type OrderLike = { fromId?: string | null; contactId?: string | null }
type PosLike = { resp?: string | null; supplier?: string | null }

// Участник карточки (может читать/писать в чат):
// - super_admin / bookkeeper — всегда;
// - logist — если есть позиция с resp == его имя;
// - branch — если есть позиция с supplier == его имя;
// - client / supplier_client — если он заказчик (fromId) или контакт (contactId).
export function isParticipant(order: OrderLike, positions: PosLike[], session: SessionUser): boolean {
  const role = session.role
  if (role === 'super_admin' || role === 'bookkeeper') return true
  if (role === 'logist') return positions.some(p => eqName(p.resp, session.name))
  if (role === 'branch') return positions.some(p => eqName(p.supplier, session.name))
  if (role === 'client' || role === 'supplier_client') {
    return order.fromId === session.id || order.contactId === session.id
  }
  return false
}
