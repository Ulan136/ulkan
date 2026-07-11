import prisma from '@/lib/prisma'

// Per-position модель плеча: leg живёт на позиции, а не на карточке.
// Плечо позиции определяется её ПОСТАВЩИКОМ: поставщик-филиал → 1 (первое
// плечо, изготовление), иначе → 2 (обычная позиция / второе плечо доставки).

// Набор имён пользователей роли branch (нижний регистр, без пробелов).
export async function branchNameSet(): Promise<Set<string>> {
  const users = await prisma.user.findMany({ where: { role: 'branch' }, select: { name: true } })
  return new Set(users.map(u => u.name.trim().toLowerCase()))
}

// supplier — это пользователь роли branch (филиал-изготовитель)?
export async function isBranchSupplier(supplierName?: string | null): Promise<boolean> {
  const name = (supplierName || '').trim().toLowerCase()
  if (!name) return false
  return (await branchNameSet()).has(name)
}

// leg для позиции по её поставщику: филиал → 1, иначе → 2.
export async function legForSupplier(supplierName?: string | null): Promise<number> {
  return (await isBranchSupplier(supplierName)) ? 1 : 2
}
