<<<<<<< HEAD
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
=======
// lib/api.ts — API клиент для фронтенда

async function fetcher<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options })
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Ошибка запроса')
  return data as T
}

// ─── Карточки ─────────────────────────────────────────────────
export const fetchAllOrders = () => fetcher<unknown[]>('/api/orders/all')
export const createOrder = (data: Record<string, unknown>) => fetcher<unknown>('/api/orders', { method: 'POST', body: JSON.stringify(data) })
export const orderAction = (id: string, action: string, payload?: Record<string, unknown>) =>
  fetcher<{ success: boolean; order: unknown }>(`/api/orders/${id}/action`, { method: 'POST', body: JSON.stringify({ action, ...payload }) })
export const postAll = () => fetcher<{ success: boolean; count: number }>('/api/orders/postAll', { method: 'POST' })
export const fetchHistory = (cardId: string) => fetcher<unknown[]>(`/api/orders/${cardId}/history`)

<<<<<<< HEAD
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
=======
// ─── Дашборд ──────────────────────────────────────────────────
export const fetchDashboard = () => fetcher<unknown>('/api/dashboard')
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b

// ─── Справочники ──────────────────────────────────────────────
export const fetchSettings = () => fetcher<unknown>('/api/settings')

// ─── Пользователи ─────────────────────────────────────────────
export const createUser = (data: Record<string, unknown>) => fetcher<unknown>('/api/users', { method: 'POST', body: JSON.stringify(data) })
export const updateUser = (id: string, data: Record<string, unknown>) => fetcher<unknown>(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(data) })

// ─── Проекты ──────────────────────────────────────────────────
export const fetchProjects = () => fetcher<unknown[]>('/api/projects')
export const createProject = (data: Record<string, unknown>) => fetcher<unknown>('/api/projects', { method: 'POST', body: JSON.stringify(data) })

// ─── СпецПроекты ──────────────────────────────────────────────
export const fetchSpecProjects = () => fetcher<unknown[]>('/api/spec-projects')
export const createSpecProject = (data: Record<string, unknown>) => fetcher<unknown>('/api/spec-projects', { method: 'POST', body: JSON.stringify(data) })
export const fetchSpecProjectAnalysis = (id: string) => fetcher<unknown>(`/api/spec-projects/${id}`)
export const updateSpecProject = (id: string, data: Record<string, unknown>) => fetcher<unknown>(`/api/spec-projects/${id}`, { method: 'PUT', body: JSON.stringify(data) })

// ─── Склад ────────────────────────────────────────────────────
export const fetchStock = () => fetcher<unknown[]>('/api/stock')
export const fetchStockMovements = (type?: string) => fetcher<unknown[]>(`/api/stock/movements${type ? `?type=${type}` : ''}`)

// ─── Отчёты ───────────────────────────────────────────────────
export const fetchDailyReports = () => fetcher<unknown[]>('/api/reports/daily')
export const createDailyReport = (data: Record<string, unknown>) => fetcher<unknown>('/api/reports/daily', { method: 'POST', body: JSON.stringify(data) })
export const updateDailyReport = (id: string, status: string) => fetcher<unknown>(`/api/reports/daily/${id}`, { method: 'PUT', body: JSON.stringify({ status }) })

// ─── Кабинет заказчика ────────────────────────────────────────
export const fetchClientOrders = () => fetcher<unknown[]>('/api/client/orders')
export const createClientOrder = (data: Record<string, unknown>) => fetcher<unknown>('/api/client/orders', { method: 'POST', body: JSON.stringify(data) })

// ─── Трекинг (публичный) ──────────────────────────────────────
export const fetchTrack = (id: string) => fetcher<unknown>(`/api/track?id=${encodeURIComponent(id)}`)
export const submitExternalOrder = (data: Record<string, unknown>) => fetcher<unknown>('/api/track/submit', { method: 'POST', body: JSON.stringify(data) })
export const submitTrackChange = (cardId: string, changeText: string, changePhone: string) =>
  fetcher<{ ok: boolean }>('/api/track/change', { method: 'POST', body: JSON.stringify({ cardId, changeText, changePhone }) })

// ─── Auth ─────────────────────────────────────────────────────
export const loginEmail = (email: string, password: string) => fetcher<unknown>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
export const loginPhone = (phone: string) => fetcher<unknown>('/api/auth/phone', { method: 'POST', body: JSON.stringify({ phone }) })
export const registerClient = (data: Record<string, unknown>) => fetcher<unknown>('/api/auth/register', { method: 'POST', body: JSON.stringify(data) })
export const logout = async () => {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/login'
}

<<<<<<< HEAD
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
=======
// ─── Уведомления ──────────────────────────────────────────────
export const fetchNotifications = () => fetcher<unknown[]>('/api/notifications')
export const markNotificationRead = (id: string) => fetcher<unknown>(`/api/notifications/${id}`, { method: 'PUT' })
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
