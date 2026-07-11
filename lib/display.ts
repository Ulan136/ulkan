import type React from 'react'
import { Order } from './types'
import { COLORS } from './colors'

// Метрики заказа вынесены в серверо-нейтральный модуль; реэкспортируем,
// чтобы существующие импорты из '@/lib/display' продолжали работать.
export { PCT, posPct, cardProgress, cardSum } from './orderMetrics'

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

export function barColor(pct: number): string {
  return pct >= 100 ? COLORS.progress.high
    : pct >= 60 ? COLORS.progress.mid
    : COLORS.progress.low
}

export function statusStyle(status: string): React.CSSProperties {
  const map: Record<string, { bg: string; color: string }> = {
    'В ожидании':       COLORS.status.waiting,
    'Новая заявка':     COLORS.status.waiting,
    'Принят':           COLORS.status.accepted,
    'В обработке':      COLORS.status.accepted,
    'В работе':         COLORS.status.accepted,
    'Готово к отгрузке':COLORS.status.ready,
    'В пути':           COLORS.status.ready,
    'Доставлено':       COLORS.status.delivered,
    'К учёту':          COLORS.status.delivered,
    'Бухгалтерия':      COLORS.status.delivered,
    'Отменён':          COLORS.status.cancelled,
    'Черновик':         COLORS.status.draft,
    'Архив':            COLORS.status.archive,
  }
  const s = map[status] || COLORS.status.draft
  return {
    fontSize: '10.5px', padding: '1px 9px', borderRadius: 20,
    fontWeight: 600, whiteSpace: 'nowrap', background: s.bg, color: s.color,
  }
}

export function sourceStyle(source: string): React.CSSProperties {
  const s = COLORS.source[source as keyof typeof COLORS.source] || COLORS.source.cabinet
  return {
    fontSize: '10px', padding: '1px 8px', borderRadius: 20,
    fontWeight: 600, background: s.bg, color: s.color,
  }
}

export function sourceLabel(s: string): string {
  return ({
    cabinet:            'Кабинет',
    external:           'Внешняя',
    webhook:            'Вебхук',
    admin_manual:       'Админ',
    responsible_portal: 'Портал',
  })[s] || s
}

export function fmtMoney(n: number): string {
  return n.toLocaleString('ru-RU').replace(/\u00A0/g, ' ') + ' тг'
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
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
