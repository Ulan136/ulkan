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
const thicknessEuro: NomLevel = {
  key: 'thick', label: 'Толщина', items: [
    { key: 't035', label: '0,35', terms: ['0,35мм'] },
    { key: 't04', label: '0,4', terms: ['0,4мм'] },
    { key: 't045', label: '0,45', terms: ['0,45мм'] },
  ],
}
const producer: NomLevel = {
  key: 'maker', label: 'Производитель', items: [
    { key: 'mp', label: 'МП', terms: [], exclude: ['АП', 'МБ', 'КМК'] }, // «без АП/МБ/КМК»
    { key: 'ap', label: 'АП', terms: ['АП'] },
    { key: 'mb', label: 'МБ', terms: ['МБ'] },
    { key: 'kmk', label: 'КМК', terms: ['КМК'] },
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
    { key: 't02', label: '0,2', terms: ['0,2мм'] },
    { key: 't025', label: '0,25', terms: ['0,25мм'] },
    { key: 't04', label: '0,4', terms: ['0,4мм'] },
    { key: 't045', label: '0,45', terms: ['0,45мм'] },
  ],
}
const coating: NomLevel = {
  key: 'coat', label: 'Покрытие', items: [
    { key: 'mat', label: 'Мат', terms: ['мат'] },
    { key: 'glyan', label: 'Глян', terms: ['глян'] },
  ],
}
const metalProfile: NomLevel = {
  key: 'profile', label: 'Профиль', items: [
    { key: 'andaluzia', label: 'Андалузия', terms: ['Андалузия'] },
  ],
}

// Ключи — нормализованные имена 1С-групп/подгрупп (варианты написания).
const OVERLAYS: Record<string, NomLevel[]> = {
  'евро брус': [thicknessEuro, producer],
  'евробрус': [thicknessEuro, producer],
  'комплектующие': [accessoryKinds],
  'плоский лист': [thicknessFlat, coating],
  'материалы': [thicknessFlat, coating],
  'металлочерепица': [metalProfile],
}

// overlayFor(name): уровни-надстройки для группы/подгруппы (или []).
export function overlayFor(name: string): NomLevel[] {
  return OVERLAYS[(name || '').trim().toLowerCase()] || []
}
