import { prisma } from './prisma'

const WAREHOUSE = 'Центр Склад'

export async function reserveStock(positionId: string, name: string, qty: number, cardId?: string) {
  const supplier = await prisma.supplier.findUnique({ where: { name: WAREHOUSE } })
  if (!supplier) return

  await prisma.stockMovement.create({
    data: { type: 'reserve', name, qty, positionId, cardId },
  })

  const stock = await prisma.stock.findFirst({ where: { name, supplierId: supplier.id } })
  if (stock) {
    await prisma.stock.update({
      where: { id: stock.id },
      data: { reserved: { increment: qty } },
    })
  }
}

export async function releaseStock(positionId: string, name: string, qty: number, cardId?: string) {
  const supplier = await prisma.supplier.findUnique({ where: { name: WAREHOUSE } })
  if (!supplier) return

  await prisma.stockMovement.create({
    data: { type: 'expense', name, qty, positionId, cardId },
  })

  const stock = await prisma.stock.findFirst({ where: { name, supplierId: supplier.id } })
  if (stock) {
    await prisma.stock.update({
      where: { id: stock.id },
      data: { qty: { decrement: qty }, reserved: { decrement: qty } },
    })
  }
}