import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'

// ── Финансовый учёт клиента/филиала (ШАБЛОН) ────────────────────────────────
// Клиент/филиал ВИДИТ свой баланс: долг, оплату, остаток + историю операций.
// Данные заводит админ (позже подключим в админке и свяжем по session.id).
// Пока источника нет → отдаём нули/пусто + configured:false, чтобы вывести
// заглушку «настраивается». Структура ответа стабильна — админ наполнит её.
export interface FinTxn { id: string; date: string; type: 'debt' | 'payment'; amount: number; comment?: string }
export interface FinData { debt: number; paid: number; balance: number; currency: string; transactions: FinTxn[]; configured: boolean }

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response

  // TODO: подтянуть фин-данные пользователя из админского учёта по auth.session.id.
  const data: FinData = { debt: 0, paid: 0, balance: 0, currency: '₸', transactions: [], configured: false }
  return NextResponse.json(data)
}
