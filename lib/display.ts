// lib/display.ts
import { Order, Position } from './types'

export const PCT: Record<string, number> = {
  'В работе': 10,
  'Готово к отгрузке': 60,
  'В пути': 80,
  'Доставлено': 100,
  '': 0,
}

export function posPct(p: Position): number {
  return PCT[p.status] ?? 0
}

export function cardProgress(o: Order): number {
  if (!o.positions.length) return o.status === 'Доставлено' ? 100 : 0
  return Math.round(o.positions.reduce((s, p) => s + posPct(p), 0) / o.positions.length)
}

export function cardSum(o: Order): number {
  return o.positions.reduce((s, p) => s + (p.qty * p.price || 0), 0)
}

export function isOverdue(o: Order): boolean {
  return o.positions.some(p => p.late && p.status !== 'Доставлено')
}

export function primaryResp(o: Order): string {
  const c: Record<string, number> = {}
  let best = '—', n = 0
  o.positions.forEach(p => {
    if (!p.resp) return
    c[p.resp] = (c[p.resp] || 0) + 1
    if (c[p.resp] > n) { n = c[p.resp]; best = p.resp }
  })
  return best
}

export function srcLabel(s: string): string {
  const m: Record<string, string> = {
    cabinet: 'Кабинет', external: 'Внешняя',
    webhook: 'Вебхук', admin_manual: 'Админ', responsible_portal: 'Портал',
  }
  return m[s] || s
}

export function srcStyle(s: string): string {
  const m: Record<string, string> = {
    cabinet: '250', external: '30', webhook: '290',
    admin_manual: '260', responsible_portal: '160',
  }
  const h = m[s] || '260'
  return `font-size:10.5px;padding:1px 8px;border-radius:20px;font-weight:600;color:oklch(0.5 0.1 ${h});background:oklch(0.95 0.03 ${h})`
}

export function statusTag(status: string): { label: string; style: string } {
  const map: Record<string, [string, string]> = {
    'В ожидании': ['250', 'В ожидании'],
    'Новая заявка': ['250', 'Новая заявка'],
    'Принят': ['30', 'Принят'],
    'В обработке': ['30', 'В обработке'],
    'В работе': ['30', 'В работе'],
    'Готово к отгрузке': ['70', 'Готово'],
    'В пути': ['70', 'В пути'],
    'Доставлено': ['155', 'Доставлено'],
    'К учёту': ['155', 'К учёту'],
    'Бухгалтерия': ['155', 'Бухгалтерия'],
    'Архив': ['260', 'Архив'],
    'Отменён': ['25', 'Отменён'],
    'Черновик': ['n', 'Черновик'],
  }
  const e = map[status] || ['n', status]
  if (e[0] === 'n') return { label: e[1], style: 'font-size:10.5px;padding:1px 9px;border-radius:20px;font-weight:600;color:#6b655b;background:#efece8' }
  return { label: e[1], style: `font-size:10.5px;padding:1px 9px;border-radius:20px;font-weight:600;color:oklch(0.5 0.12 ${e[0]});background:oklch(0.95 0.05 ${e[0]})` }
}

export function barColor(pct: number): string {
  return pct >= 100 ? 'oklch(0.6 0.13 155)' : pct >= 60 ? 'oklch(0.7 0.14 70)' : 'oklch(0.62 0.17 30)'
}

export function fmtMoney(n: number): string {
  return n.toLocaleString('ru-RU').replace(/\u00A0/g, ' ') + ' тг'
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  const date = new Date(d)
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—'
  const date = new Date(d)
  const now = Date.now()
  const diff = Math.floor((now - date.getTime()) / 60000)
  if (diff < 1) return 'только что'
  if (diff < 60) return `${diff} мин`
  if (diff < 1440) return `${Math.floor(diff / 60)} ч`
  return fmtDate(d)
}
