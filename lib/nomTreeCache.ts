import prisma from '@/lib/prisma'

// Фактическое дерево 1С-групп из базы: group (корень) → cat (подгруппа) →
// subgroup (лист), со счётчиками. Источник — поля Nomenclature, НЕ слова имени.
export interface TreeSub { name: string; count: number }
export interface TreeCat { name: string; count: number; subgroups: TreeSub[] }
export interface TreeGroup { name: string; count: number; cats: TreeCat[] }

// Кэш в памяти инстанса + TTL-бэкстоп; явный сброс на мутацию номенклатуры
// (pushSignal('settings')). На разных инстансах Vercel — свой кэш + TTL.
let cache: TreeGroup[] | null = null
let cacheAt = 0
const TTL = 5 * 60 * 1000

export function invalidateNomTree() { cache = null }

// Порядок корневых групп: канон владельца — вперёд, остальные — по алфавиту.
const ROOT_ORDER = ['Водосток', 'Готовая продукция', 'Материалы', 'Товары', 'Услуги']
const rank = (n: string) => { const i = ROOT_ORDER.indexOf(n); return i < 0 ? 99 : i }

async function build(): Promise<TreeGroup[]> {
  const items = await prisma.nomenclature.findMany({ select: { group: true, cat: true, subgroup: true } })
  const gmap = new Map<string, { count: number; cats: Map<string, { count: number; subs: Map<string, number> }> }>()
  for (const it of items) {
    const g = (it.group || '').trim()
    if (!g) continue                        // без группы — в дерево не кладём (ищется словами)
    if (!gmap.has(g)) gmap.set(g, { count: 0, cats: new Map() })
    const gE = gmap.get(g)!; gE.count++
    const c = (it.cat || '').trim()
    if (!c) continue
    if (!gE.cats.has(c)) gE.cats.set(c, { count: 0, subs: new Map() })
    const cE = gE.cats.get(c)!; cE.count++
    const s = (it.subgroup || '').trim()
    if (s) cE.subs.set(s, (cE.subs.get(s) || 0) + 1)
  }
  // «Материалы» — родная 1С-группа (плоские листы, м²), владелец требует её
  // присутствия даже если сейчас пусто.
  if (!gmap.has('Материалы')) gmap.set('Материалы', { count: 0, cats: new Map() })

  return [...gmap.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0], 'ru'))
    .map(([name, g]) => ({
      name, count: g.count,
      cats: [...g.cats.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ru')).map(([cn, c]) => ({
        name: cn, count: c.count,
        subgroups: [...c.subs.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ru')).map(([sn, sc]) => ({ name: sn, count: sc })),
      })),
    }))
}

export async function getNomTree(): Promise<TreeGroup[]> {
  const now = Date.now()
  if (!cache || now - cacheAt > TTL) { cache = await build(); cacheAt = now }
  return cache
}
