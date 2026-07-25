// ─── Дерево каталога NomPicker (макет v8) ──────────────────────────────────
// Выбор чипов = ПОИСКОВЫЕ СЛОВА, сужающие выборку через существующий каскадный
// поиск номенклатуры. Никаких фабричных имён — только слова в запрос.
//   terms      — слова в запрос (по умолчанию [label]); для комплектующих это
//                ТОЧНЫЕ имена из 1С (с дефисами/точками — они и есть поиск).
//   measure    — «Изделие · см»: длина уходит словом «№ {cm}».
//   exclude    — исключающий фильтр (МП): отсеять имена с этими словами
//                (в именах МП не пишется → «брус без АП/МБ/КМК»).
//   product.terms — слова категории, реально встречающиеся в именах 1С
//                (для level-less товаров = слово-категория само по себе).

export interface NomItem {
  key: string
  label: string
  terms?: string[]
  measure?: boolean
  exclude?: string[]
}
export interface NomLevel {
  key: string
  label: string
  items: NomItem[]
}
export interface NomProduct {
  key: string
  label: string
  terms?: string[]
  levels: NomLevel[]
}

export const NOM_TREE: NomProduct[] = [
  {
    key: 'eurobrus', label: 'Евробрус', terms: ['брус'],
    levels: [
      { key: 'thick', label: 'Толщина', items: [               // толщина ПЕРВОЙ
        { key: 't035', label: '0,35', terms: ['0,35мм'] },
        { key: 't04', label: '0,4', terms: ['0,4мм'] },
        { key: 't045', label: '0,45', terms: ['0,45мм'] },
      ] },
      { key: 'maker', label: 'Производитель', items: [
        { key: 'mp', label: 'МП', terms: [], exclude: ['АП', 'МБ', 'КМК'] }, // исключающий
        { key: 'ap', label: 'АП', terms: ['АП'] },
        { key: 'mb', label: 'МБ', terms: ['МБ'] },
        { key: 'kmk', label: 'КМК', terms: ['КМК'] },
      ] },
    ],
  },
  {
    key: 'vodostok', label: 'Водосток',
    levels: [
      { key: 'brand', label: 'Бренд', items: [                 // по цветам не дробить
        { key: 'deke_lux', label: 'Дёке люкс', terms: ['Дёке', 'люкс'] },
        { key: 'deke_prem', label: 'Дёке премиум', terms: ['Дёке', 'премиум'] },
        { key: 'deke_gray_lux', label: 'Дёке серый люкс', terms: ['Дёке', 'серый', 'люкс'] },
        { key: 'deke_std', label: 'Дёке стандарт', terms: ['Дёке', 'стандарт'] },
        { key: 'mb', label: 'МБ', terms: ['МБ'] },
      ] },
    ],
  },
  {
    key: 'accessories', label: 'Комплектующие',
    levels: [
      { key: 'kind', label: 'Вид', items: [                    // ТОЧНЫЕ имена из 1С
        { key: 'h', label: 'H - профиль', terms: ['H - профиль'] },
        { key: 'j', label: 'J - профиль', terms: ['J - профиль'] },
        { key: 'outer_r', label: 'Нар. угол (пр)', terms: ['Нар. угол (пр)'] },
        { key: 'outer_l', label: 'Нар. угол (сл)', terms: ['Нар. угол (сл)'] },
        { key: 'inner_r', label: 'Внут. угол (пр)', terms: ['Внут. угол (пр)'] },
        { key: 'inner_l', label: 'Внут. угол (сл)', terms: ['Внут. угол (сл)'] },
        { key: 'item', label: 'Изделие · см', measure: true, terms: ['Изделие'] },
      ] },
    ],
  },
  {
    key: 'metal', label: 'Металлочерепица',
    levels: [
      { key: 'profile', label: 'Профиль', items: [             // остальное — цветом
        { key: 'andaluzia', label: 'Андалузия', terms: ['Андалузия'] },
      ] },
    ],
  },
  {
    key: 'flat', label: 'Плоский лист', terms: ['плоский', 'лист'],
    levels: [
      { key: 'thick', label: 'Толщина', items: [
        { key: 't02', label: '0,2', terms: ['0,2мм'] },
        { key: 't025', label: '0,25', terms: ['0,25мм'] },
        { key: 't04', label: '0,4', terms: ['0,4мм'] },
        { key: 't045', label: '0,45', terms: ['0,45мм'] },
      ] },
      { key: 'coat', label: 'Покрытие', items: [
        { key: 'mat', label: 'Мат', terms: ['мат'] },
        { key: 'glyan', label: 'Глян', terms: ['глян'] },
      ] },
    ],
  },
  { key: 'proflist', label: 'Проф лист С8', terms: ['проф', 'с8'], levels: [] },
  { key: 'armstrong', label: 'Армстронг', terms: ['армстронг'], levels: [] },
  { key: 'korabelny', label: 'Корабельный брус', terms: ['корабельн', 'брус'], levels: [] },
  { key: 'lenar', label: 'Ленарная панель', terms: ['ленарн', 'панель'], levels: [] },
  {
    key: 'krepezh', label: 'Крепёж',
    levels: [
      { key: 'kind', label: 'Вид', items: [                    // ед. число = имена «Саморез 4,8х35»
        { key: 'samorez', label: 'Саморез', terms: ['Саморез'] },
        { key: 'dyubel', label: 'Дюбель', terms: ['Дюбель'] },
        { key: 'zaklepka', label: 'Заклёпка', terms: ['Заклёпка'] },
      ] },
    ],
  },
]
