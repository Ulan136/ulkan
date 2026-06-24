import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Начинаю заполнение базы данных...')

  // Пользователи-администраторы
  const adminPass = await bcrypt.hash('admin123', 10)
  const buhPass = await bcrypt.hash('buh123', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@u-kan.kz' },
    update: {},
    create: {
      name: 'Супер Админ',
      email: 'admin@u-kan.kz',
      password: adminPass,
      role: 'super_admin',
      slug: 'admin',
      active: true,
    },
  })

  const buh = await prisma.user.upsert({
    where: { email: 'buh@u-kan.kz' },
    update: {},
    create: {
      name: 'Бухгалтер',
      email: 'buh@u-kan.kz',
      password: buhPass,
      role: 'bookkeeper',
      slug: 'buh',
      active: true,
    },
  })

  // Логисты
  const logist1 = await prisma.user.upsert({
    where: { email: 'listogib@u-kan.kz' },
    update: {},
    create: {
      name: 'Нипа Листогиб',
      email: 'listogib@u-kan.kz',
      password: await bcrypt.hash('log123', 10),
      role: 'logist',
      slug: 'listogib',
      active: true,
    },
  })

  const logist2 = await prisma.user.upsert({
    where: { email: 'serikov@u-kan.kz' },
    update: {},
    create: {
      name: 'А. Серіков',
      email: 'serikov@u-kan.kz',
      password: await bcrypt.hash('log123', 10),
      role: 'logist',
      slug: 'serikov',
      active: true,
    },
  })

  const logist3 = await prisma.user.upsert({
    where: { email: 'csklad@u-kan.kz' },
    update: {},
    create: {
      name: 'Центр Склад',
      email: 'csklad@u-kan.kz',
      password: await bcrypt.hash('log123', 10),
      role: 'logist',
      slug: 'csklad',
      active: true,
    },
  })

  // Клиенты (поставщики-заказчики)
  const client1 = await prisma.user.upsert({
    where: { phone: '+77011111111' },
    update: {},
    create: {
      name: 'Нипа Алматы',
      phone: '+77011111111',
      password: await bcrypt.hash('+77011111111', 10),
      role: 'supplier_client',
      slug: 'nipa-almaty',
      active: true,
    },
  })

  const client2 = await prisma.user.upsert({
    where: { phone: '+77022222222' },
    update: {},
    create: {
      name: 'Кристалл Профиль',
      phone: '+77022222222',
      password: await bcrypt.hash('+77022222222', 10),
      role: 'supplier_client',
      slug: 'kristall-profil',
      active: true,
    },
  })

  const client3 = await prisma.user.upsert({
    where: { phone: '+77033333333' },
    update: {},
    create: {
      name: 'Металл Трейд',
      phone: '+77033333333',
      password: await bcrypt.hash('+77033333333', 10),
      role: 'supplier_client',
      slug: 'metall-treyd',
      active: true,
    },
  })

  const client4 = await prisma.user.upsert({
    where: { phone: '+77044444444' },
    update: {},
    create: {
      name: 'СтройБаза КЗ',
      phone: '+77044444444',
      password: await bcrypt.hash('+77044444444', 10),
      role: 'supplier_client',
      slug: 'stroybaza-kz',
      active: false,
    },
  })

  // Поставщики
  const sup1 = await prisma.supplier.upsert({
    where: { name: 'Нипа Базар' },
    update: {},
    create: { name: 'Нипа Базар', type: 'Внешний', active: true },
  })

  const sup2 = await prisma.supplier.upsert({
    where: { name: 'Центр Склад' },
    update: {},
    create: { name: 'Центр Склад', type: 'Внутренний склад', active: true },
  })

  const sup3 = await prisma.supplier.upsert({
    where: { name: 'Кристалл Профиль' },
    update: {},
    create: { name: 'Кристалл Профиль', type: 'Внешний', active: true },
  })

  // Номенклатура
  const nom1 = await prisma.nomenclature.create({
    data: { name: 'Профнастил МП-20 RAL8017', unit: 'лист', cat: 'Кровля' },
  }).catch(() => prisma.nomenclature.findFirst({ where: { name: 'Профнастил МП-20 RAL8017' } }))

  const nom2 = await prisma.nomenclature.create({
    data: { name: 'Оцинковка 0.5мм рулон', unit: 'кг', cat: 'Прокат' },
  }).catch(() => prisma.nomenclature.findFirst({ where: { name: 'Оцинковка 0.5мм рулон' } }))

  const nom3 = await prisma.nomenclature.create({
    data: { name: 'Профлист С8 2.0м', unit: 'шт', cat: 'Кровля' },
  }).catch(() => prisma.nomenclature.findFirst({ where: { name: 'Профлист С8 2.0м' } }))

  const nom4 = await prisma.nomenclature.create({
    data: { name: 'Уголок 50×50×4', unit: 'шт', cat: 'Прокат' },
  }).catch(() => prisma.nomenclature.findFirst({ where: { name: 'Уголок 50×50×4' } }))

  const nom5 = await prisma.nomenclature.create({
    data: { name: 'Труба профильная 40×20', unit: 'шт', cat: 'Прокат' },
  }).catch(() => prisma.nomenclature.findFirst({ where: { name: 'Труба профильная 40×20' } }))

  const nom6 = await prisma.nomenclature.create({
    data: { name: 'Саморезы кровельные 4.8×35', unit: 'уп', cat: 'Крепёж' },
  }).catch(() => prisma.nomenclature.findFirst({ where: { name: 'Саморезы кровельные 4.8×35' } }))

  // Статусы оплаты
  await prisma.paymentStatus.upsert({ where: { name: 'Оплачено' }, update: {}, create: { name: 'Оплачено' } })
  await prisma.paymentStatus.upsert({ where: { name: 'Не оплачено' }, update: {}, create: { name: 'Не оплачено' } })
  await prisma.paymentStatus.upsert({ where: { name: 'Частично' }, update: {}, create: { name: 'Частично' } })

  // Склад (остатки Центр Склад)
  if (nom1) {
    await prisma.stock.create({
      data: { supplierId: sup2.id, nomenclatureId: nom1.id, name: 'Профнастил МП-20 RAL8017', unit: 'лист', qty: 150, reserved: 0 },
    }).catch(() => {})
  }
  if (nom3) {
    await prisma.stock.create({
      data: { supplierId: sup2.id, nomenclatureId: nom3.id, name: 'Профлист С8 2.0м', unit: 'шт', qty: 200, reserved: 0 },
    }).catch(() => {})
  }

  // Демо проект
  const project1 = await prisma.project.create({
    data: { id: 'PRJ-001-210626', name: 'Кровля Алматы 2026', clientId: client1.id, description: 'Поставка кровельных материалов', status: 'active' },
  }).catch(() => prisma.project.findFirst({ where: { id: 'PRJ-001-210626' } }))

  // Демо СпецПроект
  const spec1 = await prisma.specProject.create({
    data: {
      id: 'СП-001-210626',
      name: 'Металл для стройки ЖК Восток',
      clientId: client2.id,
      description: 'Полная поставка металла для ЖК',
      status: 'active',
      items: {
        create: [
          { name: 'Профнастил МП-20 RAL8017', qty: 500, unit: 'лист' },
          { name: 'Уголок 50×50×4', qty: 200, unit: 'шт' },
          { name: 'Труба профильная 40×20', qty: 100, unit: 'шт' },
        ],
      },
    },
  }).catch(() => prisma.specProject.findFirst({ where: { id: 'СП-001-210626' } }))

  // Демо карточки по всем экранам
  const base = process.env.NEXTAUTH_URL || 'https://ulkan.vercel.app'

  const cards = [
    // incoming — новые заявки
    {
      id: 'C-001-240626', from: 'Нипа Алматы', fromId: client1.id, to: 'Нипа Базар', screen: 'incoming', status: 'В ожидании', source: 'cabinet',
      comment: 'Профнастил МП-20 RAL8017 — 50 листов\nСаморезы кровельные — 10 упаковок',
      trackingLink: `${base}/track?id=C-001-240626`, contactId: client1.id,
    },
    {
      id: 'C-002-240626', from: 'Металл Трейд', fromId: client3.id, to: 'Кристалл Профиль', screen: 'incoming', status: 'Новая заявка', source: 'external',
      comment: 'Оцинковка 0.5мм — 500кг срочно!',
      trackingLink: `${base}/track?id=C-002-240626`, phone: '+77033333333',
    },
    // reception — в приёмке
    {
      id: 'C-003-230626', from: 'Кристалл Профиль', fromId: client2.id, to: 'Центр Склад', screen: 'reception', status: 'Принят', source: 'cabinet',
      comment: '', block: 'waiting',
      trackingLink: `${base}/track?id=C-003-230626`, contactId: client2.id,
      projectId: project1?.id,
    },
    {
      id: 'C-004-230626', from: 'Нипа Алматы', fromId: client1.id, to: 'Нипа Базар', screen: 'reception', status: 'В обработке', source: 'cabinet',
      comment: '', block: 'processing',
      trackingLink: `${base}/track?id=C-004-230626`,
    },
    // outgoing — в работе
    {
      id: 'C-005-220626', from: 'Металл Трейд', fromId: client3.id, to: 'Нипа Базар', screen: 'outgoing', status: 'В работе', source: 'cabinet',
      trackingLink: `${base}/track?id=C-005-220626`, contactId: client3.id,
    },
    {
      id: 'C-006-220626', from: 'Кристалл Профиль', fromId: client2.id, to: 'Кристалл Профиль', screen: 'outgoing', status: 'В работе', source: 'responsible_portal',
      trackingLink: `${base}/track?id=C-006-220626`, specProjectId: spec1?.id,
    },
    // accounting — к учёту
    {
      id: 'C-007-210626', from: 'Нипа Алматы', fromId: client1.id, to: 'Нипа Базар', screen: 'accounting', status: 'К учёту', source: 'cabinet',
      toacc: true, trackingLink: `${base}/track?id=C-007-210626`,
    },
    {
      id: 'C-008-210626', from: 'Металл Трейд', fromId: client3.id, to: 'Кристалл Профиль', screen: 'accounting', status: 'К учёту', source: 'cabinet',
      toacc: true, postponed: true, trackingLink: `${base}/track?id=C-008-210626`,
    },
    // bookkeeping — бухгалтерия
    {
      id: 'C-009-200626', from: 'Кристалл Профиль', fromId: client2.id, to: 'Центр Склад', screen: 'bookkeeping', status: 'Бухгалтерия', source: 'cabinet',
      invoice: true, fact: true, posted1C: true, trackingLink: `${base}/track?id=C-009-200626`,
    },
    // archive
    {
      id: 'C-010-150626', from: 'Нипа Алматы', fromId: client1.id, to: 'Нипа Базар', screen: 'archive', status: 'Архив', source: 'cabinet',
      posted1C: true, delivered: new Date('2026-06-15'), trackingLink: `${base}/track?id=C-010-150626`,
    },
    // Изменённая
    {
      id: 'C-011-240626', from: 'Металл Трейд', fromId: client3.id, to: 'Нипа Базар', screen: 'incoming', status: 'В ожидании', source: 'cabinet',
      isChanged: true, changeText: 'Прошу добавить ещё 20 листов профнастила', changePhone: '+77033333333',
      trackingLink: `${base}/track?id=C-011-240626`,
    },
    // Черновик
    {
      id: 'C-012-240626', from: 'Кристалл Профиль', fromId: client2.id, to: '', screen: 'incoming', status: 'Черновик', source: 'cabinet',
      isDraft: true, comment: 'Черновик — ещё не готово', trackingLink: `${base}/track?id=C-012-240626`,
    },
    // Отменённая
    {
      id: 'C-013-230626', from: 'Нипа Алматы', fromId: client1.id, to: 'Нипа Базар', screen: 'incoming', status: 'Отменён', source: 'cabinet',
      isCancelled: true, cancelReason: 'Клиент отказался', trackingLink: `${base}/track?id=C-013-230626`,
    },
    // ещё outgoing с позициями
    {
      id: 'C-014-220626', from: 'Металл Трейд', fromId: client3.id, to: 'Нипа Базар', screen: 'outgoing', status: 'В работе', source: 'cabinet',
      trackingLink: `${base}/track?id=C-014-220626`, projectId: project1?.id,
    },
    // incoming обычная
    {
      id: 'C-015-240626', from: 'Кристалл Профиль', fromId: client2.id, to: 'Кристалл Профиль', screen: 'incoming', status: 'В ожидании', source: 'webhook',
      comment: 'Уголок 50×50×4 — 30шт\nТруба профильная 40×20 — 15шт',
      trackingLink: `${base}/track?id=C-015-240626`,
    },
  ]

  for (const card of cards) {
    await prisma.order.create({ data: card as any }).catch(() => {})
  }

  // Добавляем позиции к нескольким карточкам
  await prisma.position.createMany({
    data: [
      { id: 'C-005-220626-P1', cardId: 'C-005-220626', name1c: 'Профнастил МП-20 RAL8017', oral: 'Профнастил', qty: 50, unit: 'лист', price: 4500, supplier: 'Нипа Базар', supplierId: sup1.id, status: 'В пути', resp: 'А. Серіков' },
      { id: 'C-005-220626-P2', cardId: 'C-005-220626', name1c: 'Саморезы кровельные 4.8×35', oral: 'Саморезы', qty: 10, unit: 'уп', price: 800, supplier: 'Нипа Базар', supplierId: sup1.id, status: 'Доставлено', resp: 'А. Серіков' },
      { id: 'C-006-220626-P1', cardId: 'C-006-220626', name1c: 'Оцинковка 0.5мм рулон', oral: 'Оцинковка', qty: 200, unit: 'кг', price: 650, supplier: 'Кристалл Профиль', supplierId: sup3.id, status: 'Готово к отгрузке', resp: 'Нипа Листогиб' },
      { id: 'C-007-210626-P1', cardId: 'C-007-210626', name1c: 'Профлист С8 2.0м', oral: 'Профлист', qty: 100, unit: 'шт', price: 3200, supplier: 'Центр Склад', supplierId: sup2.id, status: 'Доставлено', resp: 'Центр Склад' },
      { id: 'C-009-200626-P1', cardId: 'C-009-200626', name1c: 'Уголок 50×50×4', oral: 'Уголок', qty: 30, unit: 'шт', price: 2100, supplier: 'Нипа Базар', supplierId: sup1.id, status: 'Доставлено', resp: 'А. Серіков', payment: 'Оплачено' },
      { id: 'C-014-220626-P1', cardId: 'C-014-220626', name1c: 'Труба профильная 40×20', oral: 'Труба', qty: 20, unit: 'шт', price: 1800, supplier: 'Нипа Базар', supplierId: sup1.id, status: 'В работе', resp: 'Нипа Листогиб' },
      { id: 'C-014-220626-P2', cardId: 'C-014-220626', name1c: 'Профнастил МП-20 RAL8017', oral: 'Профнастил', qty: 25, unit: 'лист', price: 4500, supplier: 'Центр Склад', supplierId: sup2.id, status: 'В работе', resp: 'Центр Склад' },
    ],
    skipDuplicates: true,
  }).catch(() => {})

  // История
  await prisma.history.createMany({
    data: [
      { cardId: 'C-003-230626', action: 'Карточка создана', userName: 'Нипа Алматы', createdAt: new Date('2026-06-23T09:00:00') },
      { cardId: 'C-003-230626', action: 'Принят в приёмку', userName: 'Супер Админ', createdAt: new Date('2026-06-23T10:30:00') },
      { cardId: 'C-005-220626', action: 'Карточка создана', userName: 'Металл Трейд', createdAt: new Date('2026-06-22T08:00:00') },
      { cardId: 'C-005-220626', action: 'Принят в приёмку', userName: 'Супер Админ', createdAt: new Date('2026-06-22T09:00:00') },
      { cardId: 'C-005-220626', action: 'Взят в обработку', userName: 'А. Серіков', createdAt: new Date('2026-06-22T10:00:00') },
      { cardId: 'C-005-220626', action: 'Отправлен в Исходящие', userName: 'Супер Админ', createdAt: new Date('2026-06-22T11:00:00') },
      { cardId: 'C-007-210626', action: 'Все позиции доставлены', userName: 'Система', createdAt: new Date('2026-06-21T15:00:00') },
      { cardId: 'C-007-210626', action: 'Отправлен к учёту', userName: 'Супер Админ', createdAt: new Date('2026-06-21T16:00:00') },
      { cardId: 'C-010-150626', action: 'Отправлен в архив', userName: 'Супер Админ', createdAt: new Date('2026-06-15T17:00:00') },
    ],
    skipDuplicates: true,
  }).catch(() => {})

  console.log('✅ База данных заполнена успешно!')
  console.log('👤 admin@u-kan.kz / admin123')
  console.log('👤 buh@u-kan.kz / buh123')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
