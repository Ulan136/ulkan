// Генерация порядкового номера на основе текущего счётчика из базы
// count передаётся снаружи (из prisma.order.count() и т.д.)
function dateStr(): string {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `${dd}${mm}${yy}`
}

export function generateCardId(count: number = 0): string {
  const seq = String(count + 1).padStart(3, '0')
  return `C-${seq}-${dateStr()}`
}

export function generateProjectId(count: number = 0): string {
  const seq = String(count + 1).padStart(3, '0')
  return `PRJ-${seq}-${dateStr()}`
}

export function generateSpecProjectId(count: number = 0): string {
  const seq = String(count + 1).padStart(3, '0')
  return `СП-${seq}-${dateStr()}`
}

export function generatePosId(cardId: string, n: number): string {
  return `${cardId}-P${n}`
}

export function generateTrackingLink(cardId: string): string {
  const base = process.env.NEXTAUTH_URL || 'https://ulkan.vercel.app'
  return `${base}/track?id=${cardId}`
}

export function generateSlug(name: string): string {
  const map: Record<string, string> = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z',
    'и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r',
    'с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh',
    'щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
  }
  return name
    .toLowerCase()
    .replace(/[а-яё]/g, (c) => map[c] || c)
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 50)
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('8') && digits.length === 11) return '+7' + digits.slice(1)
  if (digits.startsWith('7') && digits.length === 11) return '+' + digits
  if (digits.length === 10) return '+7' + digits
  return '+' + digits
}
