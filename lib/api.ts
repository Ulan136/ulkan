// lib/api.ts
import { Order } from './types'

const BASE = '/api'

export async function fetchAllOrders(): Promise<Order[]> {
  const res = await fetch(`${BASE}/orders/all`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to fetch orders')
  return res.json()
}

export async function fetchDashboard() {
  const res = await fetch(`${BASE}/dashboard`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to fetch dashboard')
  return res.json()
}

export async function fetchSettings() {
  const res = await fetch(`${BASE}/settings`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

export async function fetchHistory(cardId: string) {
  const res = await fetch(`${BASE}/orders/${cardId}/history`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to fetch history')
  return res.json()
}

export async function orderAction(id: string, action: string, payload?: Record<string, unknown>): Promise<Order> {
  const res = await fetch(`${BASE}/orders/${id}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Ошибка')
  }
  const data = await res.json()
  return data.order
}

export async function postAll(): Promise<{ count: number }> {
  const res = await fetch(`${BASE}/orders/all`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to post all')
  return res.json()
}

export async function createOrder(data: Record<string, unknown>): Promise<Order> {
  const res = await fetch(`${BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Ошибка создания')
  }
  return res.json()
}

export async function logout() {
  await fetch(`${BASE}/auth/logout`, { method: 'POST' })
  window.location.href = '/login'
}
