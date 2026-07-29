import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'
import { matchCategoryKey } from '@/lib/nomCatalog'

// Превью автоназначения для формы закупа: по именам товаров возвращает
// поставщика и логиста из правил CategoryRule (та же логика, что на столе
// приёмки). Карточка ещё не создана — поэтому отдельный preview-эндпоинт.
export async function POST(req: NextRequest) {
  const auth = await requireSession(req, ['super_admin', 'bookkeeper'])
  if (!auth.ok) return auth.response
  const { products } = await req.json()
  if (!Array.isArray(products) || products.length === 0) return NextResponse.json([])

  let rules: any[] = []
  try { rules = await (prisma as any).categoryRule.findMany() } catch { rules = [] }
  const ruleByKey: Record<string, any> = {}
  for (const r of rules) ruleByKey[r.category] = r

  const out = await Promise.all(products.map(async (p: any) => {
    const name = (p?.name || '').trim()
    if (!name || !rules.length) return { name, supplier: '', supplierId: '', resp: '' }
    const nom = await prisma.nomenclature.findFirst({ where: { name }, select: { group: true, cat: true } })
    const key = nom ? matchCategoryKey(nom.group, nom.cat) : null
    const rule = key ? ruleByKey[key] : null
    if (!rule) return { name, supplier: '', supplierId: '', resp: '' }
    let supplierId = ''
    if (rule.supplierName) {
      const sup = await prisma.supplier.findFirst({ where: { name: rule.supplierName }, select: { id: true } })
      supplierId = sup?.id || ''
    }
    return { name, supplier: rule.supplierName || '', supplierId, resp: rule.logistName || '' }
  }))
  return NextResponse.json(out)
}
