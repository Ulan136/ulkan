// ─── Дерево каталога NomPicker (макет v6) ──────────────────────────────────
// ТОВАР → ПОДКАТЕГОРИЯ. Водосток имеет слой брендов (Дёке ▾ раскрывается в
// сорта; МБ — сразу к вводу). «Изделие · см» — measure: два ввода (шт → см).
// Имя позиции строится из nameBase + « RAL»+код (решение владельца: имя
// самодостаточно в отчётах/1С).

export interface NomLeaf {
  key: string
  label: string
  measure?: boolean   // 'Изделие · см' → шт, затем см
  nameBase: string    // основа имени позиции (без цвета)
}

export interface NomBrand {
  key: string
  label: string
  leaves: NomLeaf[]   // сорта; пустой массив → бренд ведёт сразу к вводу
  nameBase?: string   // если leaves пуст — основа имени бренда
}

export interface NomProduct {
  key: string
  label: string
  subs?: NomLeaf[]    // простые подкатегории-пилюли
  brands?: NomBrand[] // брендовый слой (Водосток)
}

export const NOM_TREE: NomProduct[] = [
  {
    key: 'eurobrus', label: 'Евробрус',
    subs: [
      { key: 'mp', label: 'МП', nameBase: 'Евробрус МП' },
      { key: 'ap', label: 'АП', nameBase: 'Евробрус АП' },
      { key: 'mb', label: 'МБ', nameBase: 'Евробрус МБ' },
    ],
  },
  {
    key: 'vodostok', label: 'Водосток',
    brands: [
      {
        key: 'deke', label: 'Дёке', leaves: [
          { key: 'lux', label: 'Люкс', nameBase: 'Водосток Дёке Люкс' },
          { key: 'premium', label: 'Премиум', nameBase: 'Водосток Дёке Премиум' },
          { key: 'standard', label: 'Стандарт', nameBase: 'Водосток Дёке Стандарт' },
        ],
      },
      { key: 'mb', label: 'МБ', leaves: [], nameBase: 'Водосток МБ' },
    ],
  },
  {
    key: 'accessories', label: 'Комплектующие',
    subs: [
      { key: 'j', label: 'J профиль', nameBase: 'J профиль' },
      { key: 'h', label: 'H профиль', nameBase: 'H профиль' },
      { key: 'jf', label: 'J фазка', nameBase: 'J фазка' },
      { key: 'outer', label: 'Наружный угол', nameBase: 'Наружный угол' },
      { key: 'inner', label: 'Внутренний угол', nameBase: 'Внутренний угол' },
      { key: 'item', label: 'Изделие · см', measure: true, nameBase: 'Изделие' },
    ],
  },
  {
    key: 'fasteners', label: 'Крепёж',
    subs: [
      { key: 'screws', label: 'Саморезы', nameBase: 'Саморезы' },
      { key: 'dowels', label: 'Дюбели', nameBase: 'Дюбели' },
      { key: 'rivets', label: 'Заклёпки', nameBase: 'Заклёпки' },
    ],
  },
]
