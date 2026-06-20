// lib/ids.ts

/** CardID: C-xxx-DDHHMMYY */
export function generateCardId(): string {
  const d = new Date()
  const seq = String(Math.floor(Math.random() * 900) + 100).padStart(3, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `C-${seq}-${dd}${hh}${mm}${yy}`
}

/** ProjectID: PRJ-xxx-DDHHMMYY */
export function generateProjectId(): string {
  const d = new Date()
  const seq = String(Math.floor(Math.random() * 900) + 100).padStart(3, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `PRJ-${seq}-${dd}${hh}${mm}${yy}`
}

/** PosID: CardID-Pn */
export function generatePosId(cardId: string, n: number): string {
  return `${cardId}-P${n}`
}

/** TrackingLink */
export function generateTrackingLink(cardId: string): string {
  const base = process.env.NEXTAUTH_URL || 'https://u-kan.kz'
  return `${base}/track?id=${cardId}`
}

// ─── Форматирование ────────────────────────────────────────────────────────

export function formatNum(n: number): string {
  return n.toLocaleString('ru-RU').replace(/\u00A0/g, ' ')
}

export function formatMoney(n: number): string {
  return formatNum(n) + ' тг'
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) return `${diffMin} мин назад`
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)} ч назад`
  return formatDate(date)
}

// ─── Статусы ───────────────────────────────────────────────────────────────

const STATUS_PROGRESS: Record<string, number> = {
  'В работе': 10,
  'Готово к отгрузке': 60,
  'В пути': 80,
  'Доставлено': 100,
  '': 0,
}

export function posProgress(status: string): number {
  return STATUS_PROGRESS[status] ?? 0
}

export function cardProgress(positions: { status: string }[]): number {
  if (!positions.length) return 0
  const sum = positions.reduce((s, p) => s + posProgress(p.status), 0)
  return Math.round(sum / positions.length)
}

export function cardSum(positions: { qty: number; price: number }[]): number {
  return positions.reduce((s, p) => s + (p.qty * p.price || 0), 0)
}

export function isOverdue(positions: { late: boolean; status: string }[]): boolean {
  return positions.some((p) => p.late && p.status !== 'Доставлено')
}

export function srcLabel(s: string): string {
  const map: Record<string, string> = {
    cabinet: 'Кабинет',
    external: 'Внешняя',
    webhook: 'Вебхук',
    admin_manual: 'Админ',
    responsible_portal: 'Портал',
  }
  return map[s] || s
}
