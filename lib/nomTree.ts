// ─── Надстройки-уровни NomPicker поверх 1С-групп (макет v8, катализатор v9) ──
// Категории/подгруппы каталога теперь идут ИЗ БАЗЫ (group/cat, см.
// lib/nomTreeCache). Здесь — только НАШИ уровни-надстройки, которые применяются
// СЛОВАМИ внутри уже отфильтрованной по полям выборки. Ключ — имя группы/
// подгруппы 1С (нормализованное). Нет правила → просто кнопка без уровней.

export interface NomItem {
  key: string
  label: string
  terms?: string[]      // слова в запрос (по умолчанию [label])
  measure?: boolean     // «Изделие · см» → длина словом «№ {cm}»
  exclude?: string[]    // исключающий фильтр (МП): отсеять имена с этими словами
}
export interface NomLevel {
  key: string
  label: string
  items: NomItem[]
}

// Евробрус: Толщина ПЕРВОЙ → Производитель (МП исключающий).
// Толщина — ЖЁСТКИЙ фильтр (целым токеном на клиенте, см. NomPicker): label =
// число, по нему строится regex «0,4 не как часть 0,45». terms в q не нужны.
const thicknessEuro: NomLevel = {
  key: 'thick', label: 'Толщина', items: [
    { key: 't035', label: '0,35' },
    { key: 't04', label: '0,4' },
    { key: 't045', label: '0,45' },
  ],
}
// Комплектующие: точные имена видов из 1С (без фазки).
const accessoryKinds: NomLevel = {
  key: 'kind', label: 'Вид', items: [
    { key: 'h', label: 'H - профиль', terms: ['H - профиль'] },
    { key: 'j', label: 'J - профиль', terms: ['J - профиль'] },
    { key: 'outer_r', label: 'Нар. угол (пр)', terms: ['Нар. угол (пр)'] },
    { key: 'outer_l', label: 'Нар. угол (сл)', terms: ['Нар. угол (сл)'] },
    { key: 'inner_r', label: 'Внут. угол (пр)', terms: ['Внут. угол (пр)'] },
    { key: 'inner_l', label: 'Внут. угол (сл)', terms: ['Внут. угол (сл)'] },
    { key: 'item', label: 'Изделие · см', measure: true, terms: ['Изделие'] },
  ],
}
// Плоский лист / Материалы (листы м²): толщины + покрытие.
const thicknessFlat: NomLevel = {
  key: 'thick', label: 'Толщина', items: [
    { key: 't02', label: '0,2' },
    { key: 't025', label: '0,25' },
    { key: 't04', label: '0,4' },
    { key: 't045', label: '0,45' },
  ],
}
const coating: NomLevel = {
  key: 'coat', label: 'Покрытие', items: [
    { key: 'mat', label: 'Мат', terms: ['мат'] },
    { key: 'glyan', label: 'Глян', terms: ['глян'] },
  ],
}
// Надстройки-СЛОВА только там, где их НЕТ полем в дереве:
//   Евро брус  → Толщина (производитель = subgroup дерева: Металл профиль/…)
//   Комплектующие → Вид (цвет = subgroup дерева; вид — в имени, словами)
//   Плоский лист/Материалы → Толщина + Покрытие (листы м²)
// Металлочерепица/Водосток и т.п. полностью покрыты subgroup дерева → без надстроек.
const OVERLAYS: Record<string, NomLevel[]> = {
  'евро брус': [thicknessEuro],
  'евробрус': [thicknessEuro],
  'комплектующие': [accessoryKinds],
  'плоский лист': [thicknessFlat, coating],
  'материалы': [thicknessFlat, coating],
}

// overlayFor(name): уровни-надстройки для группы/подгруппы (или []).
export function overlayFor(name: string): NomLevel[] {
  return OVERLAYS[(name || '').trim().toLowerCase()] || []
}

// ─── Производители Евробруса — фильтр по ПОЛЮ subgroup ───────────────────────
// hint — ЧИСТО декоративная расшифровка (в поиск/имя/крумбы НЕ попадает).
// subgroup — фактическое значение поля в базе (первичный критерий фильтра).
export interface Producer { key: string; label: string; hint: string; subgroup: string }
export const EUROBRUS_PRODUCERS: Producer[] = [
  { key: 'mp', label: 'МП', hint: 'Металл Профиль', subgroup: 'Металл профиль' },
  { key: 'ap', label: 'АП', hint: 'Меллиус', subgroup: 'Меллиус' },
  { key: 'kmk', label: 'КМК', hint: 'КМК', subgroup: 'КМК' },
  { key: 'mb', label: 'МБ', hint: 'Китай', subgroup: 'Разные' },
]
export function producersFor(cat: string): Producer[] {
  return (cat || '').trim().toLowerCase().replace(/ё/g, 'е') === 'евро брус' ? EUROBRUS_PRODUCERS : []
}
