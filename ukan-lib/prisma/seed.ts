// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seed начался...')

  // Пользователи
  const adminPass = await bcrypt.hash('admin123', 10)
  const buhPass = await bcrypt.hash('buh123', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@u-kan.kz' },
    update: {},
    create: { name: 'Администратор', email: 'admin@u-kan.kz', password: adminPass, role: 'super_admin', slug: 'admin', active: true },
  })

  await prisma.user.upsert({
    where: { email: 'buh@u-kan.kz' },
    update: {},
    create: { name: 'Бухгалтер', email: 'buh@u-kan.kz', password: buhPass, role: 'bookkeeper', slug: 'bookkeeper', active: true },
  })

  // Логисты
  const logist1 = await prisma.user.upsert({
    where: { email: 'nipa-listogib@u-kan.kz' },
    update: {},
    create: { name: 'Нипа Листогиб', email: 'nipa-listogib@u-kan.kz', password: await bcrypt.hash('logist123', 10), role: 'logist', slug: 'nipa-listogib', active: true },
  })

  await prisma.user.upsert({
    where: { email: 'a-serikov@u-kan.kz' },
    update: {},
    create: { name: 'А. Серіков', email: 'a-serikov@u-kan.kz', password: await bcrypt.hash('logist123', 10), role: 'logist', slug: 'a-serikov', active: true },
  })

  await prisma.user.upsert({
    where: { email: 'centr-sklad@u-kan.kz' },
    update: {},
    create: { name: 'Центр Склад', email: 'centr-sklad@u-kan.kz', password: await bcrypt.hash('logist123', 10), role: 'logist', slug: 'centr-sklad', active: true },
  })

  // Клиенты
  const nipaAlmaty = await prisma.user.upsert({
    where: { phone: '+77011234567' },
    update: {},
    create: { name: 'Нипа Алматы', phone: '+77011234567', role: 'supplier_client', slug: 'nipa-almaty', active: true },
  })

  await prisma.user.upsert({
    where: { phone: '+77012345678' },
    update: {},
    create: { name: 'Кристалл Профиль', phone: '+77012345678', role: 'supplier_client', slug: 'kristall-profil', active: true },
  })

  await prisma.user.upsert({
    where: { phone: '+77013456789' },
    update: {},
    create: { name: 'Металл Трейд', phone: '+77013456789', role: 'supplier_client', slug: 'metall-treyd', active: true },
  })

  await prisma.user.upsert({
    where: { phone: '+77014567890' },
    update: {},
    create: { name: 'СтройБаза КЗ', phone: '+77014567890', role: 'client', slug: 'stroybaza-kz', active: false },
  })

  console.log('✓ Пользователи созданы')

  // Поставщики
  const nipaBazar = await prisma.supplier.upsert({
    where: { name: 'Нипа Базар' },
    update: {},
    create: { name: 'Нипа Базар', type: 'Внешний', active: true },
  })

  const centrSklad = await prisma.supplier.upsert({
    where: { name: 'Центр Склад' },
    update: {},
    create: { name: 'Центр Склад', type: 'Внутренний склад', active: true },
  })

  await prisma.supplier.upsert({
    where: { name: 'Кристалл Профиль' },
    update: {},
    create: { name: 'Кристалл Профиль', type: 'Внешний', active: true },
  })

  console.log('✓ Поставщики созданы')

  // Номенклатура
  const nom1 = await prisma.nomenclature.upsert({ where: { id: 'nom-1' }, update: {}, create: { id: 'nom-1', name: 'Профнастил МП-20 RAL8017', unit: 'лист', cat: 'Кровля' } })
  const nom2 = await prisma.nomenclature.upsert({ where: { id: 'nom-2' }, update: {}, create: { id: 'nom-2', name: 'Оцинковка 0.5мм рулон', unit: 'кг', cat: 'Прокат' } })
  const nom3 = await prisma.nomenclature.upsert({ where: { id: 'nom-3' }, update: {}, create: { id: 'nom-3', name: 'Профлист С8 2.0м', unit: 'шт', cat: 'Кровля' } })
  const nom4 = await prisma.nomenclature.upsert({ where: { id: 'nom-4' }, update: {}, create: { id: 'nom-4', name: 'Уголок 50×50×4', unit: 'шт', cat: 'Прокат' } })
  await prisma.nomenclature.upsert({ where: { id: 'nom-5' }, update: {}, create: { id: 'nom-5', name: 'Труба профильная 40×20', unit: 'шт', cat: 'Прокат' } })
  const nom6 = await prisma.nomenclature.upsert({ where: { id: 'nom-6' }, update: {}, create: { id: 'nom-6', name: 'Саморезы кровельные 4.8×35', unit: 'уп', cat: 'Крепёж' } })

  console.log('✓ Номенклатура создана')

  // Статусы оплаты
  await prisma.paymentStatus.upsert({ where: { name: 'Оплачено' }, update: {}, create: { name: 'Оплачено', active: true } })
  await prisma.paymentStatus.upsert({ where: { name: 'Не оплачено' }, update: {}, create: { name: 'Не оплачено', active: true } })
  await prisma.paymentStatus.upsert({ where: { name: 'Частично' }, update: {}, create: { name: 'Частично', active: true } })

  // Склад (Центр Склад)
  await prisma.stock.upsert({
    where: { id: 'stock-1' },
    update: {},
    create: { id: 'stock-1', supplierId: centrSklad.id, nomenclatureId: nom1.id, name: 'Профнастил МП-20 RAL8017', unit: 'лист', qty: 160, reserved: 65 },
  })
  await prisma.stock.upsert({
    where: { id: 'stock-2' },
    update: {},
    create: { id: 'stock-2', supplierId: centrSklad.id, nomenclatureId: nom2.id, name: 'Оцинковка 0.5мм рулон', unit: 'кг', qty: 1240, reserved: 850 },
  })
  await prisma.stock.upsert({
    where: { id: 'stock-3' },
    update: {},
    create: { id: 'stock-3', supplierId: centrSklad.id, nomenclatureId: nom6.id, name: 'Саморезы кровельные 4.8×35', unit: 'уп', qty: 90, reserved: 12 },
  })

  console.log('✓ Склад создан')

  // СпецПроект
  await prisma.specProject.upsert({
    where: { id: 'СП-001-010626' },
    update: {},
    create: {
      id: 'СП-001-010626', name: 'Кровля Сайран 2026',
      clientId: nipaAlmaty.id, description: 'Кровельные работы на объекте Сайран',
      status: 'active',
      items: { create: [
        { name: 'Профнастил МП-20 RAL8017', qty: 500, unit: 'лист', nomenclatureId: nom1.id },
        { name: 'Саморезы кровельные 4.8×35', qty: 50, unit: 'уп', nomenclatureId: nom6.id },
        { name: 'Уголок 50×50×4', qty: 100, unit: 'шт', nomenclatureId: nom4.id },
      ] },
    },
  })

  console.log('✓ СпецПроект создан')

  // Демо карточки
  const cards = [
    {
      id: 'C-062-100626', from: 'Нипа Алматы', fromId: nipaAlmaty.id, to: 'Нипа Листогиб',
      screen: 'incoming', block: '', status: 'В ожидании', source: 'cabinet',
      comment: 'Профнастил МП-20 коричневый — 30 листов\nСаморезы кровельные — 2 уп\nДоставка на объект Сайран',
    },
    {
      id: 'C-057-070626', from: 'Нипа Алматы', fromId: nipaAlmaty.id, to: 'Нипа Листогиб',
      screen: 'reception', block: 'waiting', status: 'Принят', source: 'cabinet',
      comment: 'Профлист С8 2.0м — 50 шт\nОцинковка 0.5мм — 1 рулон',
    },
    {
      id: 'C-054-060626', from: 'Нипа Алматы', fromId: nipaAlmaty.id, to: 'Нипа Листогиб',
      screen: 'outgoing', block: '', status: 'В работе', source: 'cabinet',
      comment: '',
    },
    {
      id: 'C-049-030626', from: 'Кристалл Профиль', to: 'Нипа Листогиб',
      screen: 'accounting', block: '', status: 'К учёту', source: 'cabinet',
      comment: '', toacc: true, delivered: new Date('2026-06-17'),
    },
    {
      id: 'C-047-010626', from: 'Металл Трейд', to: 'Склад Алматы',
      screen: 'bookkeeping', block: '', status: 'Бухгалтерия', source: 'cabinet',
      comment: '', delivered: new Date('2026-06-15'),
    },
  ]

  for (const card of cards) {
    try {
      await prisma.order.upsert({
        where: { id: card.id },
        update: {},
        create: {
          ...card,
          trackingLink: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/track?id=${card.id}`,
        },
      })
    } catch {}
  }

  // Позиции для C-054
  try {
    await prisma.position.upsert({
      where: { id: 'C-054-060626-P1' },
      update: {},
      create: {
        id: 'C-054-060626-P1', cardId: 'C-054-060626',
        name1c: 'Профнастил МП-20 RAL8017', qty: 40, unit: 'лист', price: 5200,
        resp: 'Нипа Листогиб', supplier: 'Нипа Базар', status: 'В пути',
      },
    })
    await prisma.position.upsert({
      where: { id: 'C-054-060626-P2' },
      update: {},
      create: {
        id: 'C-054-060626-P2', cardId: 'C-054-060626',
        name1c: 'Конёк кровельный 2м', qty: 12, unit: 'шт', price: 2800,
        resp: 'Нипа Листогиб', supplier: 'Нипа Базар', status: 'В работе',
      },
    })
  } catch {}

  console.log('✓ Демо карточки созданы')
  console.log('\n✅ Seed завершён!')
  console.log('Логин: admin@u-kan.kz / admin123')
  console.log('Бухгалтер: buh@u-kan.kz / buh123')
  console.log('Клиент телефон: +77011234567 (Нипа Алматы)')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
