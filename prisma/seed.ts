import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding U-Kan v1.0...')

  const hash = await bcrypt.hash('admin123', 10)
  const buhHash = await bcrypt.hash('buh123', 10)

  await prisma.user.upsert({
    where: { email: 'admin@u-kan.kz' },
    update: {},
    create: { name: 'Супер-Админ', email: 'admin@u-kan.kz', password: hash, role: 'super_admin', active: true },
  })

  await prisma.user.upsert({
    where: { email: 'buh@u-kan.kz' },
    update: {},
    create: { name: 'Бухгалтер', email: 'buh@u-kan.kz', password: buhHash, role: 'bookkeeper', active: true },
  })

  const clients = [
    { name: 'Нипа Алматы', slug: 'nipa-almaty', phone: '+77011111101', role: 'supplier_client' },
    { name: 'Кристалл Профиль', slug: 'kristall-profil', phone: '+77011111102', role: 'supplier_client' },
    { name: 'Металл Трейд', slug: 'metall-treyd', phone: '+77011111103', role: 'supplier_client' },
    { name: 'СтройБаза КЗ', slug: 'stroybaza-kz', phone: '+77011111104', role: 'supplier_client', active: false },
  ]

  const clientIds: Record<string, string> = {}
  for (const c of clients) {
    const u = await prisma.user.upsert({
      where: { phone: c.phone },
      update: {},
      create: { name: c.name, slug: c.slug, phone: c.phone, role: c.role, active: c.active !== false },
    })
    clientIds[c.name] = u.id
  }

  const logists = [
    { name: 'Нипа Листогиб', slug: 'nipa-listogib', email: 'logist1@u-kan.kz', password: hash },
    { name: 'А. Серіков', slug: 'a-serikov', email: 'logist2@u-kan.kz', password: hash },
    { name: 'Центр Склад', slug: 'centr-sklad', email: 'logist3@u-kan.kz', password: hash },
  ]
  for (const l of logists) {
    await prisma.user.upsert({
      where: { email: l.email },
      update: {},
      create: { name: l.name, slug: l.slug, email: l.email, password: l.password, role: 'logist', active: true },
    })
  }

  const suppliers = [
    { name: 'Нипа Базар', type: 'Внешний' },
    { name: 'Центр Склад', type: 'Внутренний склад' },
    { name: 'Кристалл Профиль', type: 'Внешний' },
  ]
  for (const s of suppliers) {
    await prisma.supplier.upsert({ where: { name: s.name }, update: {}, create: s })
  }

  const noms = [
    { name: 'Профнастил МП-20 RAL8017', unit: 'лист', cat: 'Кровля' },
    { name: 'Оцинковка 0.5мм рулон', unit: 'кг', cat: 'Прокат' },
    { name: 'Профлист С8 2.0м', unit: 'шт', cat: 'Кровля' },
    { name: 'Уголок 50×50×4', unit: 'шт', cat: 'Прокат' },
    { name: 'Труба профильная 40×20', unit: 'шт', cat: 'Прокат' },
    { name: 'Саморезы кровельные 4.8×35', unit: 'уп', cat: 'Крепёж' },
  ]
  const nomIds: Record<string, string> = {}
  for (const n of noms) {
    const existing = await prisma.nomenclature.findFirst({ where: { name: n.name } })
    if (existing) nomIds[n.name] = existing.id
    else {
      const created = await prisma.nomenclature.create({ data: n })
      nomIds[n.name] = created.id
    }
  }

  for (const ps of ['Оплачено', 'Не оплачено', 'Частично']) {
    await prisma.paymentStatus.upsert({ where: { name: ps }, update: {}, create: { name: ps } })
  }

  const warehouse = await prisma.supplier.findUnique({ where: { name: 'Центр Склад' } })
  if (warehouse) {
    const stockItems = [
      { name: 'Саморезы кровельные 4.8×35', qty: 120, reserved: 8 },
      { name: 'Профлист С8 2.0м', qty: 45, reserved: 12 },
    ]
    for (const s of stockItems) {
      const nomId = nomIds[s.name]
      if (!nomId) continue
      const existing = await prisma.stock.findFirst({ where: { name: s.name, supplierId: warehouse.id } })
      if (!existing) {
        await prisma.stock.create({
          data: { supplierId: warehouse.id, nomenclatureId: nomId, name: s.name, unit: 'уп', qty: s.qty, reserved: s.reserved },
        })
      }
    }
  }

  const orders = [
    { id: 'C-062-210626', from: 'Нипа Алматы', fromId: clientIds['Нипа Алматы'], to: 'Нипа Листогиб', screen: 'incoming', status: 'В ожидании', source: 'cabinet', comment: 'Профнастил МП-20 — 30 листов\nСаморезы — 2 уп' },
    { id: 'C-063-210626', from: 'Металл Трейд', fromId: clientIds['Металл Трейд'], to: '—', screen: 'incoming', status: 'Новая заявка', source: 'external', phone: '+77012201488', comment: 'Лист г/к 3мм, ~1.2 тонны' },
    { id: 'C-057-210626', from: 'Нипа Алматы', fromId: clientIds['Нипа Алматы'], to: 'Нипа Листогиб', screen: 'reception', block: 'waiting', status: 'Принят', source: 'cabinet', comment: 'Профлист С8 — 50 шт' },
    { id: 'C-054-210626', from: 'Нипа Алматы', fromId: clientIds['Нипа Алматы'], to: 'Нипа Листогиб', screen: 'outgoing', status: 'В работе', source: 'cabinet', deadline: new Date('2026-06-25') },
    { id: 'C-052-210626', from: 'Кристалл Профиль', fromId: clientIds['Кристалл Профиль'], to: 'Нипа Листогиб', screen: 'incoming', status: 'Доставлено', source: 'cabinet', toacc: true, delivered: new Date('2026-06-17') },
    { id: 'C-049-210626', from: 'Кристалл Профиль', fromId: clientIds['Кристалл Профиль'], to: 'Нипа Листогиб', screen: 'accounting', status: 'К учёту', source: 'cabinet', toacc: true, delivered: new Date('2026-06-17') },
    { id: 'C-047-210626', from: 'Металл Трейд', fromId: clientIds['Металл Трейд'], to: 'Склад Алматы', screen: 'bookkeeping', status: 'Бухгалтерия', source: 'cabinet', delivered: new Date('2026-06-15'), invoice: true },
    { id: 'C-045-210626', from: 'Нипа Алматы', fromId: clientIds['Нипа Алматы'], to: 'Нипа Листогиб', screen: 'archive', status: 'Архив', source: 'cabinet', delivered: new Date('2026-05-01'), posted1C: true },
  ]

  for (const o of orders) {
    await prisma.order.upsert({
      where: { id: o.id },
      update: {},
      create: { ...o, trackingLink: `https://u-kan.kz/track?id=${o.id}` },
    })
  }

  const positions = [
    { id: 'C-054-210626-P1', cardId: 'C-054-210626', name1c: 'Профнастил МП-20 RAL8017', qty: 40, unit: 'лист', price: 5200, resp: 'Нипа Листогиб', supplier: 'Нипа Базар', status: 'В пути' },
    { id: 'C-052-210626-P1', cardId: 'C-052-210626', name1c: 'Профнастил МП-20 RAL8017', qty: 30, unit: 'лист', price: 5000, resp: 'Нипа Листогиб', supplier: 'Нипа Базар', status: 'Доставлено' },
    { id: 'C-049-210626-P1', cardId: 'C-049-210626', name1c: 'Профнастил МП-20 RAL8017', qty: 60, unit: 'лист', price: 5200, resp: 'Нипа Листогиб', supplier: 'Нипа Базар', status: 'Доставлено' },
    { id: 'C-047-210626-P1', cardId: 'C-047-210626', name1c: 'Уголок 50×50', qty: 100, unit: 'шт', price: 1900, resp: 'А. Серіков', supplier: 'Кристалл Профиль', status: 'Доставлено' },
  ]
  for (const p of positions) {
    await prisma.position.upsert({ where: { id: p.id }, update: {}, create: p })
  }

  console.log('✅ Seed complete!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })