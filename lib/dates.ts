// Сегодня в ЛОКАЛЬНОМ часовом поясе пользователя, формат 'YYYY-MM-DD'.
// НЕ через new Date().toISOString().slice(0,10) — это UTC, и после 19:00 по
// Алматы (UTC+5) даёт ЗАВТРА. Собираем из локальных getFullYear/Month/Date.
export function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
