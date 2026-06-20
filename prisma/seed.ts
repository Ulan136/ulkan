// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Admin user
  const hash = await bcrypt.hash('admin123', 10)
  await prisma.user.upsert({
    where: { email: 'admin@u-kan.kz' },
    update: {},
    create: {
      name: 'Администратор',
      email: 'admin@u-kan.kz',
      password: hash,
      role: 'super_admin',
      slug: '',
      active: true,
    },
  })

  // Clients
  const clients = [
    { name: 'Нипа Алматы', slug: 'nipa-almaty', active: true },
    { name: 'Кристалл Профиль', slug: 'kristall-profil', active: true },
    { name: 'Металл Трейд', slug: 'metall-treyd', active: true },
    { name: 'СтройБаза КЗ', slug: 'stroybaza-kz', active: false },
    { name: 'Нипа Базар', slug: 'nipa-bazar', active: true },
  ]
  for (const c of clients) {
    await prisma.client.upsert({ where: { slug: c.slug }, update: {}, create: c })
  }

  // Suppliers
  const suppliers = [
    { name: 'Нипа Базар', type: 'Внешний', active: true },
    { name: 'Центр Склад', type: 'Внутренний склад', active: true },
    { name: 'Кристалл Профиль', type: 'Внешний', active: true },
  ]
  for (const s of suppliers) {
    await prisma.supplier.upsert({ where: { name: s.name }, update: {}, create: s })
  }

  // Nomenclature
  const noms = [
    { name: 'Профнастил МП-20 RAL8017', unit: 'лист', cat: 'Кровля' },
    { name: 'Оцинковка 0.5мм рулон', unit: 'кг', cat: 'Прокат' },
    { name: 'Профлист С8 2.0м', unit: 'шт', cat: 'Кровля' },
    { name: 'Уголок 50×50×4', unit: 'шт', cat: 'Прокат' },
    { name: 'Труба профильная 40×20', unit: 'шт', cat: 'Прокат' },
    { name: 'Саморезы кровельные 4.8×35', unit: 'уп', cat: 'Крепёж' },
  ]
  for (const n of noms) {
    await prisma.nomenclature.create({ data: n })
  }

  // Demo orders
  const orders = [
    {
      id: 'C-062-100626', from: 'Нипа Алматы', to: 'Нипа Листогиб',
      screen: 'incoming', status: 'В ожидании', source: 'cabinet',
      comment: 'Профнастил МП-20 коричневый — 30 листов\nСаморезы кровельные — 2 уп\nДоставка на объект Сайран',
    },
    {
      id: 'C-063-100626', from: 'Металл Трейд', to: '—',
      screen: 'incoming', status: 'Новая заявка', source: 'external',
      phone: '+7 701 220 14 88',
      comment: 'Нужен лист г/к 3мм, примерно 1.2 тонны, самовывоз. Перезвоните по цене.',
    },
    {
      id: 'C-061-090626', from: 'СтройБаза КЗ', to: 'Объект Сайран',
      screen: 'incoming', status: 'Новая заявка', source: 'webhook', postponed: true,
      comment: 'Уголок 50×50 — 40 шт, труба профильная 40×20 — 25 шт',
    },
    {
      id: 'C-052-050626', from: 'Кристалл Профиль', to: 'Нипа Листогиб',
      screen: 'incoming', status: 'Доставлено', source: 'cabinet', toacc: true,
      delivered: new Date('2026-06-17'),
    },
    {
      id: 'C-064-100626', from: 'Нипа Алматы', to: 'Склад Алматы',
      screen: 'incoming', status: 'Черновик', source: 'cabinet', isDraft: true,
      comment: 'Черновик: утеплитель 100мм, уточнить объём',
    },
    {
      id: 'C-059-080626', from: 'СтройБаза КЗ', to: 'Склад Алматы',
      screen: 'incoming', status: 'Отменён', source: 'external', isCancelled: true,
      cancelReason: 'Клиент отказался',
      comment: 'Труба профильная 60×40 — 50 шт',
    },
    {
      id: 'C-057-070626', from: 'Нипа Алматы', to: 'Нипа Листогиб',
      screen: 'reception', block: 'waiting', status: 'Принят', source: 'cabinet',
      comment: 'Профлист С8 2.0м — 50 шт\nОцинковка 0.5мм — 1 рулон',
    },
    {
      id: 'C-056-070626', from: 'Металл Трейд', to: 'Склад Алматы',
      screen: 'reception', block: 'waiting', status: 'Принят', source: 'external',
      comment: 'Уголок 50×50 — 60 шт',
    },
    {
      id: 'C-055-060626', from: 'Кристалл Профиль', to: 'Объект Сайран',
      screen: 'reception', block: 'processing', status: 'В обработке', source: 'cabinet',
    },
    {
      id: 'C-054-060626', from: 'Нипа Алматы', to: 'Нипа Листогиб',
      screen: 'outgoing', status: 'В работе', source: 'cabinet',
      deadline: new Date('2026-06-20'),
    },
    {
      id: 'C-053-050626', from: 'Металл Трейд', to: 'Склад Алматы',
      screen: 'outgoing', status: 'В работе', source: 'admin_manual',
      deadline: new Date('2026-06-16'),
    },
    {
      id: 'C-058-070626', from: 'Кристалл Профиль', to: 'Нипа Листогиб',
      screen: 'outgoing', status: 'В работе', source: 'cabinet',
      isChanged: true, changeText: 'Поменяйте цвет на RAL 6005 (зелёный), количество то же',
      changePhone: '+7 705 118 22 04', deadline: new Date('2026-06-21'),
    },
    {
      id: 'C-049-030626', from: 'Кристалл Профиль', to: 'Нипа Листогиб',
      screen: 'accounting', status: 'К учёту', source: 'cabinet', toacc: true,
      delivered: new Date('2026-06-17'),
    },
    {
      id: 'C-047-010626', from: 'Металл Трейд', to: 'Склад Алматы',
      screen: 'bookkeeping', status: 'Бухгалтерия', source: 'cabinet',
      delivered: new Date('2026-06-15'),
    },
    {
      id: 'C-045-300526', from: 'Нипа Алматы', to: 'Нипа Листогиб',
      screen: 'bookkeeping', status: 'Бухгалтерия', source: 'cabinet',
      invoice: true, delivered: new Date('2026-06-14'),
    },
  ]

  for (const o of orders) {
    await prisma.order.upsert({
      where: { id: o.id },
      update: {},
      create: {
        ...o,
        trackingLink: `https://u-kan.kz/track?id=${o.id}`,
      },
    })
  }

  // Demo positions
  const positions = [
    { id: 'C-052-050626-P1', cardId: 'C-052-050626', name1c: 'Профнастил МП-20 RAL8017', oral: 'профнастил коричн', qty: 30, unit: 'лист', price: 5000, resp: 'Нипа Листогиб', supplier: 'Нипа Базар', status: 'Доставлено' },
    { id: 'C-052-050626-P2', cardId: 'C-052-050626', name1c: 'Саморезы кровельные 4.8×35', oral: 'саморезы', qty: 4, unit: 'уп', price: 3500, resp: 'Нипа Листогиб', supplier: 'Центр Склад', status: 'Доставлено' },
    { id: 'C-055-060626-P1', cardId: 'C-055-060626', oral: 'профнастил 20 коричн — 35 листов', qty: 35, unit: 'лист', price: 5000, resp: 'Нипа Листогиб', supplier: 'Нипа Базар', status: 'В работе' },
    { id: 'C-055-060626-P2', cardId: 'C-055-060626', oral: 'саморезы — 3 упаковки', qty: 3, unit: 'уп', price: 3500, resp: 'Нипа Листогиб', supplier: 'Центр Склад', status: 'В работе' },
    { id: 'C-054-060626-P1', cardId: 'C-054-060626', name1c: 'Профнастил МП-20 RAL8017', qty: 40, unit: 'лист', price: 5200, resp: 'Нипа Листогиб', supplier: 'Нипа Базар', status: 'В пути' },
    { id: 'C-054-060626-P2', cardId: 'C-054-060626', name1c: 'Конёк кровельный 2м', qty: 12, unit: 'шт', price: 2800, resp: 'Нипа Листогиб', supplier: 'Нипа Базар', status: 'В работе' },
    { id: 'C-053-050626-P1', cardId: 'C-053-050626', name1c: 'Лист г/к 3мм', qty: 1200, unit: 'кг', price: 380, resp: 'А. Серіков', supplier: 'Нипа Базар', status: 'В работе', late: true },
    { id: 'C-053-050626-P2', cardId: 'C-053-050626', name1c: 'Уголок 50×50×4', qty: 40, unit: 'шт', price: 1900, resp: 'А. Серіков', supplier: 'Кристалл Профиль', status: 'Готово к отгрузке', late: true },
    { id: 'C-058-070626-P1', cardId: 'C-058-070626', name1c: 'Профнастил МП-20 RAL8017', qty: 25, unit: 'лист', price: 5200, resp: 'Нипа Листогиб', supplier: 'Нипа Базар', status: 'В работе' },
    { id: 'C-049-030626-P1', cardId: 'C-049-030626', name1c: 'Профнастил МП-20 RAL8017', qty: 60, unit: 'лист', price: 5200, resp: 'Нипа Листогиб', supplier: 'Нипа Базар', status: 'Доставлено' },
    { id: 'C-049-030626-P2', cardId: 'C-049-030626', name1c: 'Саморезы кровельные', qty: 8, unit: 'уп', price: 3500, resp: 'Нипа Листогиб', supplier: 'Центр Склад', status: 'Доставлено' },
    { id: 'C-047-010626-P1', cardId: 'C-047-010626', name1c: 'Уголок 50×50', qty: 100, unit: 'шт', price: 1900, resp: 'А. Серіков', supplier: 'Кристалл Профиль', status: 'Доставлено' },
    { id: 'C-045-300526-P1', cardId: 'C-045-300526', name1c: 'Профнастил МП-20 RAL8017', qty: 80, unit: 'лист', price: 5200, resp: 'Нипа Листогиб', supplier: 'Нипа Базар', status: 'Доставлено' },
    { id: 'C-045-300526-P2', cardId: 'C-045-300526', name1c: 'Конёк кровельный 2м', qty: 20, unit: 'шт', price: 2800, resp: 'Нипа Листогиб', supplier: 'Нипа Базар', status: 'Доставлено' },
  ]

  for (const p of positions) {
    await prisma.position.upsert({ where: { id: p.id }, update: {}, create: p })
  }

  // Demo history
  await prisma.history.createMany({
    data: [
      { cardId: 'C-062-100626', action: 'Создан заказ', detail: 'Источник: cabinet', userName: 'Нипа Алматы' },
      { cardId: 'C-052-050626', action: 'Все позиции доставлены', detail: 'Автопереход в К учёту', userName: 'Система' },
      { cardId: 'C-049-030626', action: 'Принят в приёмку', detail: '', userName: 'Администратор' },
      { cardId: 'C-049-030626', action: 'Отправлен в Исходящие', detail: '', userName: 'Администратор' },
      { cardId: 'C-049-030626', action: 'Отправлен к учёту', detail: '', userName: 'Администратор' },
    ],
    skipDuplicates: true,
  })

  console.log('✅ Seed complete!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
