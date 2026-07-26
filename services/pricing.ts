import prisma from '@/lib/prisma'

// ── Автоподтягивание цены ────────────────────────────────────────────────────
// Тип цены получателя (клиента) карточки → берём соответствующую цену из
// номенклатуры по имени позиции. Всё обёрнуто в try/catch: если колонки
// priceRetail/priceOpt/priceType ещё не добавлены в БД (не выполнен ALTER) —
// возвращаем безопасные значения и НЕ ломаем создание заказа.

export type PriceType = 'retail' | 'opt'

// Тип цены клиента: по fromId (заявка ОТ клиента) или по имени получателя (to).
export async function clientPriceType(to?: string, fromId?: string): Promise<PriceType> {
  try {
    let u: { priceType: string } | null = null
    if (fromId) u = await prisma.user.findUnique({ where: { id: fromId }, select: { priceType: true } })
    if (!u && to && to.trim()) u = await prisma.user.findFirst({ where: { name: to.trim() }, select: { priceType: true } })
    return u?.priceType === 'opt' ? 'opt' : 'retail'
  } catch { return 'retail' }
}

// Цена позиции из номенклатуры по имени (name1c) и типу цены.
// null → не нашли / колонок ещё нет — цену не подставляем.
export async function resolvePrice(name1c: string, priceType: PriceType): Promise<number | null> {
  const nm = (name1c || '').trim()
  if (!nm) return null
  try {
    // Совпадение имени БЕЗ учёта регистра (и по точному, и по «первое вхождение»
    // на случай мелких расхождений пробелов/хвостов).
    let nom = await prisma.nomenclature.findFirst({
      where: { name: { equals: nm, mode: 'insensitive' } },
      select: { priceRetail: true, priceOpt: true },
    })
    if (!nom) nom = await prisma.nomenclature.findFirst({
      where: { name: { contains: nm, mode: 'insensitive' } },
      select: { priceRetail: true, priceOpt: true },
    })
    if (!nom) return null
    const p = priceType === 'opt' ? nom.priceOpt : nom.priceRetail
    return p > 0 ? p : null
  } catch { return null }
}

// Проставить цены набору позиций по имени и типу цены клиента (in-place по map).
// Не трогаем позиции, где цена уже задана вручную (>0).
export async function applyAutoPrices<T extends { name1c?: string; price?: number }>(
  positions: T[], to?: string, fromId?: string,
): Promise<T[]> {
  if (!positions?.length) return positions
  const type = await clientPriceType(to, fromId)
  for (const p of positions) {
    if ((p.price || 0) > 0) continue
    const price = await resolvePrice(p.name1c || '', type)
    if (price != null) p.price = price
  }
  return positions
}
