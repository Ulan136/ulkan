// ─── RAL-система цветов ────────────────────────────────────────────────────
// Единый источник правды по цветам: палитра (9 цветов владельца), словарь
// сокращений (двусторонний), извлечение кода из имени и поисковые термины.
// Чистые функции — можно импортировать и на сервере (route берёт extractRal),
// RalDot тришейкится из серверного бандла.

export interface RalColor { code: string; name: string; hex: string }

// Палитра владельца (порядок = порядок чипов в NomPicker).
export const RAL_COLORS: RalColor[] = [
  { code: '1015', name: 'Бежевый', hex: '#E6D690' },
  { code: '9003', name: 'Белый', hex: '#F4F8F4' },
  { code: '7004', name: 'Светло-серый', hex: '#9EA0A1' },
  { code: '7024', name: 'Серый графит', hex: '#45494E' },
  { code: '8017', name: 'Шоколадный', hex: '#442F29' },
  { code: '2004', name: 'Оранжевый', hex: '#E75B12' },
  { code: '6005', name: 'Зелёный', hex: '#0F4336' },
  { code: '5005', name: 'Сигнально-синий', hex: '#154889' },
  { code: '3020', name: 'Красный', hex: '#C1121C' },
]

export const RAL_BY_CODE: Record<string, RalColor> = Object.fromEntries(RAL_COLORS.map(c => [c.code, c]))

// Словарь: стем-слова → RAL-код. Двусторонний — extractRal ищет слова в имени,
// ralSearchTerms по коду отдаёт слова обратно. Порядок ВАЖЕН: более специфичный
// код проверяется раньше (графит 7024 → до серый 7004, иначе «Серый графит»
// попадёт в 7004). Все стемы ≥3 символов — матчим по началу слова (\m-граница).
const RAL_DICT: { code: string; words: string[] }[] = [
  { code: '8017', words: ['шок', 'шоколад'] },
  { code: '9003', words: ['бел', 'белый', 'белая'] },
  { code: '1015', words: ['беж', 'бежев'] },
  { code: '7024', words: ['графит', 'граф'] },              // до серого
  { code: '7004', words: ['светло-сер', 'св.-сер', 'серый'] },
  { code: '2004', words: ['оранж'] },
  { code: '6005', words: ['зел', 'зелён', 'зелен'] },
  { code: '5005', words: ['син', 'синий'] },
  { code: '3020', words: ['красн', 'красный'] },
]

// Токенизация имени в слова (русские/латинские буквы + цифры), нижний регистр.
function tokens(name: string): string[] {
  return (name || '').toLowerCase().split(/[^а-яёa-z0-9]+/i).filter(Boolean)
}

// extractRal(name): сначала /RAL\s?(\d{4})/i, затем словарь слов по границе слова.
// Возвращает код ('8017') или '' если цвет не определён.
export function extractRal(name: string): string {
  const m = /RAL\s?(\d{4})/i.exec(name || '')
  if (m && RAL_BY_CODE[m[1]]) return m[1]
  const toks = tokens(name)
  for (const { code, words } of RAL_DICT) {
    for (const w of words) {
      const stem = w.toLowerCase()
      // слово-токен начинается со стема (стем ≥3 → не цепляет посторонние слова
      // короче, но «син»→«синтетика» владелец доразметит в сиротах)
      if (toks.some(t => t.startsWith(stem))) return code
    }
  }
  return ''
}

// ralSearchTerms(code): слова для КАСКАДНОГО поиска по Nomenclature.
// Цвет — это ПОИСКОВОЕ СЛОВО: ['RAL8017','8017','шок','шоколад'] найдёт и
// «Наружный угол RAL8017», и «... шок.».
export function ralSearchTerms(code: string): string[] {
  if (!code) return []
  const entry = RAL_DICT.find(e => e.code === code)
  const words = entry ? entry.words.filter(w => !w.includes('.') && !w.includes('-')) : []
  return [`RAL${code}`, code, ...words]
}

// ─── RalDot — круглый чип цвета 16px ───────────────────────────────────────
// code пустой/неизвестный → серый пустой кружок-обводка (цвет не определён).
export function RalDot({ code, size = 16, title }: { code?: string; size?: number; title?: string }) {
  const c = code ? RAL_BY_CODE[code] : undefined
  const ring = size >= 20 ? 2 : 1.5
  if (!c) {
    return (
      <span title={title || 'Цвет не определён'} style={{
        display: 'inline-block', width: size, height: size, borderRadius: '50%',
        border: `${ring}px dashed #cfc9c0`, background: '#f4f2ee', flexShrink: 0, verticalAlign: 'middle',
      }} />
    )
  }
  // Белый почти сливается с фоном — отдельная тонкая обводка.
  const border = c.code === '9003' ? '#d8d3cc' : 'rgba(0,0,0,.15)'
  return (
    <span title={title || `RAL${c.code} · ${c.name}`} style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      background: c.hex, boxShadow: `inset 0 0 0 ${ring}px ${border}`, flexShrink: 0, verticalAlign: 'middle',
    }} />
  )
}
