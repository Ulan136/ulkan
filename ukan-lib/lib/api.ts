// lib/api.ts — API клиент для фронтенда

async function fetcher<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options })
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

// ─── Дашборд ──────────────────────────────────────────────────
export const fetchDashboard = () => fetcher<unknown>('/api/dashboard')

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

// ─── Уведомления ──────────────────────────────────────────────
export const fetchNotifications = () => fetcher<unknown[]>('/api/notifications')
export const markNotificationRead = (id: string) => fetcher<unknown>(`/api/notifications/${id}`, { method: 'PUT' })
