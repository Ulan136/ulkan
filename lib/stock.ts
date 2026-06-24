import prisma from './prisma'

export async function reserveStock(positionId: string, name: string, qty: number) {
  await prisma.stockMovement.create({ data: { type: 'reserve', name, qty, positionId } })
  await prisma.stock.updateMany({ where: { name }, data: { reserved: { increment: qty } } })
}

export async function updateReserve(positionId: string, oldQty: number, newQty: number) {
  const diff = newQty - oldQty
  if (diff === 0) return
  const mv = await prisma.stockMovement.findFirst({ where: { positionId, type: 'reserve' } })
  if (!mv) return
  await prisma.stock.updateMany({ where: { name: mv.name }, data: { reserved: { increment: diff } } })
}

export async function releaseStock(positionId: string, name: string, qty: number) {
  await prisma.stockMovement.create({ data: { type: 'expense', name, qty, positionId } })
  await prisma.stock.updateMany({
    where: { name },
    data: { qty: { decrement: qty }, reserved: { decrement: qty } },
  })
}

export async function incomeStock(name: string, qty: number, supplierId: string) {
  await prisma.stockMovement.create({ data: { type: 'income', name, qty } })
  const existing = await prisma.stock.findFirst({ where: { supplierId, name } })
  if (existing) {
    await prisma.stock.update({ where: { id: existing.id }, data: { qty: { increment: qty } } })
  } else {
    const nom = await prisma.nomenclature.findFirst({ where: { name } })
    if (nom) {
      await prisma.stock.create({ data: { supplierId, nomenclatureId: nom.id, name, unit: nom.unit, qty } })
    }
  }
}
