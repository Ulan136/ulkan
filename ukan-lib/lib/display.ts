// lib/display.ts
import { Order, Position } from './types'
import type React from 'react'

// ─── Прогресс ─────────────────────────────────────────────────
const PCT: Record<string, number> = {
  'В работе': 10, 'Готово к отгрузке': 60,
  'В пути': 80, 'Доставлено': 100, '': 0,
}

export function posPct(p: Position): number { return PCT[p.status] ?? 0 }

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

// ─── Цвета (только hex!) ──────────────────────────────────────
export function barColor(pct: number): string {
  return pct >= 100 ? '#3a9d6e' : pct >= 60 ? '#c4a832' : '#d4613a'
}

// ─── Стили статусов (только hex!) ─────────────────────────────
interface StyleResult { background: string; color: string }

const STATUS_STYLES: Record<string, StyleResult> = {
  'В ожидании':        { background: '#eef2ff', color: '#4a5aaa' },
  'Новая заявка':      { background: '#eef2ff', color: '#4a5aaa' },
  'Принят':            { background: '#fff0ea', color: '#c0532a' },
  'В обработке':       { background: '#fff0ea', color: '#c0532a' },
  'В работе':          { background: '#fff0ea', color: '#c0532a' },
  'Готово к отгрузке': { background: '#fdf8e1', color: '#8a6f00' },
  'В пути':            { background: '#fdf8e1', color: '#8a6f00' },
  'Доставлено':        { background: '#e8f5ee', color: '#2e8a5e' },
  'К учёту':           { background: '#e8f5ee', color: '#2e8a5e' },
  'Бухгалтерия':       { background: '#e8f5ee', color: '#2e8a5e' },
  'Отменён':           { background: '#faeaea', color: '#b03020' },
  'Черновик':          { background: '#efece8', color: '#6b655b' },
  'Архив':             { background: '#eef2ff', color: '#4a5aaa' },
  'На рассмотрении':   { background: '#fff0ea', color: '#c0532a' },
}

export function statusStyle(status: string): React.CSSProperties {
  const s = STATUS_STYLES[status] || { background: '#efece8', color: '#6b655b' }
  return {
    fontSize: '10.5px', padding: '1px 9px', borderRadius: 20,
    fontWeight: 600, whiteSpace: 'nowrap',
    background: s.background, color: s.color,
  }
}

const SOURCE_STYLES: Record<string, StyleResult> = {
  cabinet:            { background: '#eef2ff', color: '#4a5aaa' },
  external:           { background: '#fff0ea', color: '#c0532a' },
  webhook:            { background: '#f3eeff', color: '#7a3aaa' },
  admin_manual:       { background: '#eef2ff', color: '#4a5aaa' },
  responsible_portal: { background: '#e8f5ee', color: '#2e8a5e' },
}

export function sourceStyle(source: string): React.CSSProperties {
  const s = SOURCE_STYLES[source] || SOURCE_STYLES.cabinet
  return {
    fontSize: '10px', padding: '1px 8px', borderRadius: 20,
    fontWeight: 600, background: s.background, color: s.color,
  }
}

export function sourceLabel(s: string): string {
  return ({
    cabinet: 'Кабинет', external: 'Внешняя',
    webhook: 'Вебхук', admin_manual: 'Админ', responsible_portal: 'Портал',
  })[s] || s
}

// ─── Форматирование ───────────────────────────────────────────
export function fmtMoney(n: number): string {
  return n.toLocaleString('ru-RU').replace(/\u00A0/g, ' ') + ' тг'
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit'
  })
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—'
  const date = new Date(d)
  const diff = Math.floor((Date.now() - date.getTime()) / 60000)
  if (diff < 1) return 'только что'
  if (diff < 60) return `${diff} мин`
  if (diff < 1440) return `${Math.floor(diff / 60)} ч`
  return fmtDate(d)
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('8') && digits.length === 11) return '+7' + digits.slice(1)
  if (digits.startsWith('7') && digits.length === 11) return '+' + digits
  if (digits.length === 10) return '+7' + digits
  return '+' + digits
}
