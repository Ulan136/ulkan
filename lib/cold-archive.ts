import prisma from './prisma'

export async function markColdArchive() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 45)
  await prisma.order.updateMany({
    where: { screen: 'archive', cold: false, delivered: { lt: cutoff } },
    data: { cold: true },
  })
}
