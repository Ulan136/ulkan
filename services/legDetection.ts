import prisma from '@/lib/prisma'

// Определение «первого плеча» доставки.
//
// Бизнес-правило: карточка идёт через филиал ТОЛЬКО если ПОСТАВЩИК
// какой-либо позиции — пользователь роли branch (филиал-изготовитель).
// Получатель (order.to) НЕ учитывается: филиал-получатель при обычном
// поставщике — это простая доставка, логист видит её сразу.
//
// isFirstLeg = true, если supplier хотя бы одной позиции совпадает
// (без учёта регистра/пробелов) с именем пользователя роли branch.
export async function isFirstLeg(positions: { supplier?: string | null }[]): Promise<boolean> {
  const suppliers = positions
    .map(p => (p.supplier || '').trim().toLowerCase())
    .filter(Boolean)
  if (suppliers.length === 0) return false

  const branchUsers = await prisma.user.findMany({
    where: { role: 'branch' },
    select: { name: true },
  })
  const branchNames = new Set(branchUsers.map(u => u.name.trim().toLowerCase()))

  return suppliers.some(s => branchNames.has(s))
}

// Карточка уже передана логисту на второе плечо (был branchForward).
// Признак из существующих полей: branchForward ставит from = имя филиала и leg=2,
// тогда как на первом плече from — это исходный источник (не филиал), а скрытая
// первым плечом карточка имеет leg=1. Компаунд (leg=2 И from == имя branch-пользователя)
// надёжно отделяет переданную карточку.
export async function isForwardedToLogist(order: { leg?: number | null; from?: string | null }): Promise<boolean> {
  if (order.leg !== 2) return false
  const from = (order.from || '').trim().toLowerCase()
  if (!from) return false

  const branchUsers = await prisma.user.findMany({
    where: { role: 'branch' },
    select: { name: true },
  })
  return branchUsers.some(u => u.name.trim().toLowerCase() === from)
}
