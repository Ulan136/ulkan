import prisma from '@/lib/prisma'
import { reserveStock, releaseStock, incomeStock } from '@/lib/stock'

// Складские операции, привязанные к центральному складу «Центр Склад».
// Позиции с этим поставщиком/получателем автоматически резервируются,
// списываются и приходуются на складе.

// Имя центрального склада в справочнике поставщиков.
export const CENTER_SKLAD = 'Центр Склад'

type ReservePos = { id: string; supplier: string; qty: number; name1c: string; oral: string }

// Резервирует на складе позиции с поставщиком «Центр Склад» (qty > 0 и name1c).
// Возвращает число зарезервированных позиций (нужно для текста History у process).
// Резервируем только при наличии name1c: позиция без имени 1С не может быть
// осмысленно зарезервирована/оприходована (единое поведение с 4c — раньше
// orders POST / addPos резервировали и без name1c, теперь выровнено).
export async function reserveCenterSkladPositions(positions: ReservePos[]): Promise<number> {
  let n = 0
  for (const pos of positions) {
    if (pos.supplier !== CENTER_SKLAD || !(pos.qty > 0) || !pos.name1c) continue
    await reserveStock(pos.id, pos.name1c, pos.qty)
    n++
  }
  return n
}

// Авто-приход на «Центр Склад», когда получатель заказа = Центр Склад.
// Возвращает число позиций (для текста History) либо null, если приход не
// выполнялся (получатель не Центр Склад или склад не найден в справочнике) —
// в этом случае вызывающий НЕ перезаписывает historyText.
export async function incomeOnDeliveryToCenter(
  order: { to: string },
  positions: { name1c: string; qty: number }[],
): Promise<number | null> {
  if (order.to !== CENTER_SKLAD) return null
  const centerSklad = await prisma.supplier.findFirst({ where: { name: CENTER_SKLAD } })
  if (!centerSklad) return null
  for (const pos of positions) {
    if (pos.name1c && pos.qty > 0) {
      await incomeStock(pos.name1c, pos.qty, centerSklad.id)
    }
  }
  return positions.length
}

// Списывает со склада доставленную позицию поставщика «Центр Склад».
// Возвращает true, если списание выполнено (поставщик = Центр Склад).
export async function releaseDeliveredPosition(
  pos: { id: string; supplier: string; name1c: string; oral: string; qty: number },
): Promise<boolean> {
  if (pos.supplier !== CENTER_SKLAD) return false
  await releaseStock(pos.id, pos.name1c || pos.oral, pos.qty)
  return true
}
