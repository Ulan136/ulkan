import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'
import { generateCardId, generateTrackingLink, generatePosId } from '@/lib/ids'
import { CENTER_SKLAD } from '@/lib/procurement'
import { matchCategoryKey } from '@/lib/nomCatalog'
import { resolvePriceIn } from '@/services/pricing'
import { pushSignal } from '@/lib/pusherServer'

// Складываем выбранные товары в ЧЕРНОВИК-НАКОПИТЕЛЬ закупа (isDraft, получатель
// Центр-Склад). Повторные вызовы дополняют тот же черновик. Связи с заявками
// (ProcurementLink) пишем сразу → товары уходят из «Автозакупа». Карточка
// становится «настоящей» только при «Оформить» (finalizePurchase).
export async function POST(req: NextRequest) {
  const auth = await requireSession(req, ['super_admin', 'bookkeeper'])
  if (!auth.ok) return auth.response
  const { session } = auth
  const { items } = await req.json()
  // items: [{ name, unit, total, rows: [{ cardId, qty }] }]
  if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: 'Нет товаров' }, { status: 400 })

  // Открытый черновик-накопитель закупа (последний), или создаём новый.
  let draft = await prisma.order.findFirst({
    where: { isDraft: true, to: CENTER_SKLAD, isCancelled: false },
    orderBy: { createdAt: 'desc' },
    include: { positions: true },
  })

  if (!draft) {
    const count = await prisma.order.count({ where: { to: CENTER_SKLAD } })
    const id = generateCardId(count, 'purchase')
    draft = await prisma.order.create({
      data: {
        id, from: session.name, to: CENTER_SKLAD, screen: 'incoming', block: '',
        status: 'В ожидании', source: 'admin_manual', isDraft: true,
        trackingLink: generateTrackingLink(id),
        history: { create: { action: 'Черновик закупа создан', userName: session.name } },
      },
      include: { positions: true },
    })
  }

  // Добавляем позиции (индекс продолжаем от текущего числа позиций).
  let idx = draft.positions.length
  const newPos = items.map((it: any) => {
    idx++
    return {
      id: generatePosId(draft!.id, idx),
      cardId: draft!.id,
      name1c: it.name || '', oral: it.name || '',
      qty: Number(it.total) || 0, unit: it.unit || 'шт',
      status: 'В работе',
    }
  })
  if (newPos.length) await prisma.position.createMany({ data: newPos })

  // Приходная цена (priceIn) тянется автоматически, редактируется в черновике.
  for (const np of newPos) {
    const pin = await resolvePriceIn(np.name1c)
    if (pin != null) await prisma.position.update({ where: { id: np.id }, data: { price: pin } })
  }

  // Автоназначение поставщика/логиста по группе (правила CategoryRule).
  try {
    const rules = await (prisma as any).categoryRule.findMany()
    if (rules.length) {
      const ruleByKey: Record<string, any> = {}
      for (const r of rules) ruleByKey[r.category] = r
      for (const np of newPos) {
        const nom = await prisma.nomenclature.findFirst({ where: { name: np.name1c }, select: { group: true, cat: true } })
        const key = nom ? matchCategoryKey(nom.group, nom.cat) : null
        const rule = key ? ruleByKey[key] : null
        if (!rule) continue
        const data: any = {}
        if (rule.logistName) data.resp = rule.logistName
        if (rule.supplierName) {
          data.supplier = rule.supplierName
          const sup = await prisma.supplier.findFirst({ where: { name: rule.supplierName }, select: { id: true } })
          data.supplierId = sup?.id || null
        }
        if (Object.keys(data).length) await prisma.position.update({ where: { id: np.id }, data })
      }
    }
  } catch { /* правил нет — заполнят вручную */ }

  // Связи закуп→заявки (для отчёта и скрытия из «Автозакупа»).
  const links = items.flatMap((it: any) =>
    (Array.isArray(it.rows) ? it.rows : [])
      .filter((r: any) => r && r.cardId)
      .map((r: any) => ({ purchaseCardId: draft!.id, saleCardId: r.cardId, product: it.name || '', qty: Number(r.qty) || 0 })))
  if (links.length) {
    try { await (prisma as any).procurementLink.createMany({ data: links }) } catch { /* таблицы нет — не критично */ }
  }

  await pushSignal('orders')
  return NextResponse.json({ ok: true, draftId: draft.id, added: newPos.length })
}
