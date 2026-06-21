import { Order, Project, SpecProject, Notification, DailyReport } from './types'

const BASE = '/api'

export async function fetchAllOrders(): Promise<Order[]> {
  const res = await fetch(`${BASE}/orders/all`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to fetch orders')
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

export async function fetchHistory(cardId: string) {
  const res = await fetch(`${BASE}/orders/${cardId}/history`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to fetch history')
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

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch(`${BASE}/projects`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export async function createProject(data: Record<string, unknown>): Promise<Project> {
  const res = await fetch(`${BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export async function fetchSpecProjects(): Promise<SpecProject[]> {
  const res = await fetch(`${BASE}/spec-projects`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export async function createSpecProject(data: Record<string, unknown>): Promise<SpecProject> {
  const res = await fetch(`${BASE}/spec-projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export async function fetchStock() {
  const res = await fetch(`${BASE}/stock`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export async function fetchStockMovements() {
  const res = await fetch(`${BASE}/stock/movements`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export async function fetchDailyReports(): Promise<DailyReport[]> {
  const res = await fetch(`${BASE}/reports/daily`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export async function createDailyReport(data: Record<string, unknown>): Promise<DailyReport> {
  const res = await fetch(`${BASE}/reports/daily`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export async function updateDailyReport(id: string, status: string): Promise<DailyReport> {
  const res = await fetch(`${BASE}/reports/daily/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export async function fetchClientOrders(): Promise<Order[]> {
  const res = await fetch(`${BASE}/client/orders`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export async function fetchLogistOrders(): Promise<Order[]> {
  const res = await fetch(`${BASE}/logist/orders`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export async function fetchDirectory() {
  const res = await fetch(`${BASE}/client/directory`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export async function createClientOrder(data: Record<string, unknown>) {
  const res = await fetch(`${BASE}/client/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export async function fetchTrack(id: string) {
  const res = await fetch(`${BASE}/track?id=${id}`)
  if (!res.ok) throw new Error('Not found')
  return res.json()
}

export async function submitExternalOrder(data: Record<string, unknown>) {
  const res = await fetch(`${BASE}/track/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export async function submitTrackChange(cardId: string, changeText: string, changePhone: string) {
  const res = await fetch(`${BASE}/track/change`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardId, changeText, changePhone }),
  })
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export async function loginPhone(phone: string) {
  const res = await fetch(`${BASE}/auth/phone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  })
  if (!res.ok) throw new Error('Not found')
  return res.json()
}

export async function logout() {
  await fetch(`${BASE}/auth/logout`, { method: 'POST' })
  window.location.href = '/login'
}

export async function fetchNotifications(): Promise<Notification[]> {
  const res = await fetch(`${BASE}/notifications`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export async function markNotificationRead(id: string) {
  await fetch(`${BASE}/notifications/${id}/read`, { method: 'PUT' })
}

export async function createUser(data: Record<string, unknown>) {
  const res = await fetch(`${BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Ошибка')
  }
  return res.json()
}

export async function updateUser(id: string, data: Record<string, unknown>) {
  const res = await fetch(`${BASE}/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export async function createNomenclature(data: { name: string; unit?: string; cat?: string }) {
  const res = await fetch(`${BASE}/nomenclature`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Ошибка')
  }
  return res.json()
}

export async function createPaymentStatus(data: { name: string }) {
  const res = await fetch(`${BASE}/payment-statuses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Ошибка')
  }
  return res.json()
}