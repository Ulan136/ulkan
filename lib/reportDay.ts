// Границы суток по Asia/Almaty (UTC+5, без DST), как UTC-инстанты.
// dayKey = Алматы 00:00 (канонический ключ дня для черновика смены).
// dateStr (опц.) = 'YYYY-MM-DD' по дню Алматы; без него — сегодня.
export function almatyDay(dateStr?: string | null) {
  const OFFSET = 5 * 60 * 60 * 1000
  let y: number, m: number, d: number
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const p = dateStr.split('-').map(Number)
    y = p[0]; m = p[1] - 1; d = p[2]
  } else {
    const shifted = new Date(Date.now() + OFFSET) // UTC-поля = локальное время Алматы
    y = shifted.getUTCFullYear(); m = shifted.getUTCMonth(); d = shifted.getUTCDate()
  }
  const dayKey = new Date(Date.UTC(y, m, d) - OFFSET)
  const nextKey = new Date(dayKey.getTime() + 24 * 60 * 60 * 1000)
  return { dayKey, nextKey }
}
