const BASE = '/api'

async function req<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Ошибка сети' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

// Карточки
export const fetchAllOrders = () => req('/orders/all')
export const createOrder = (data: Record<string, unknown>) => req('/orders', { method: 'POST', body: JSON.stringify(data) })
export const orderAction = (id: string, action: string, payload?: Record<string, unknown>) =>
  req(`/orders/${id}/action`, { method: 'POST', body: JSON.stringify({ action, ...payload }) })
export const postAll = () => req('/orders/all', { method: 'POST' })
export const fetchHistory = (cardId: string) => req(`/orders/${cardId}/history`)

// Дашборд
export const fetchDashboard = () => req('/dashboard')

// Справочники
export const fetchSettings = () => req('/settings')

// Пользователи
export const createUser = (data: Record<string, unknown>) => req('/users', { method: 'POST', body: JSON.stringify(data) })
export const updateUser = (id: string, data: Record<string, unknown>) => req(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) })

// Проекты
export const createProject = (data: Record<string, unknown>) => req('/projects', { method: 'POST', body: JSON.stringify(data) })

// СпецПроекты
export const createSpecProject = (data: Record<string, unknown>) => req('/spec-projects', { method: 'POST', body: JSON.stringify(data) })
export const fetchSpecProjectAnalysis = (id: string) => req(`/spec-projects/${id}/analysis`)

// Склад
export const fetchStock = () => req('/stock')
export const fetchStockMovements = (type?: string) => req('/stock/movements' + (type ? `?type=${type}` : ''))

// Отчёты
export const fetchDailyReports = () => req('/reports/daily')
export const createDailyReport = (data: Record<string, unknown>) => req('/reports/daily', { method: 'POST', body: JSON.stringify(data) })
export const updateDailyReport = (id: string, status: string) => req(`/reports/daily/${id}`, { method: 'PUT', body: JSON.stringify({ status }) })

// Клиентский кабинет
export const fetchClientOrders = () => req('/client/orders')
export const createClientOrder = (data: Record<string, unknown>) => req('/client/orders', { method: 'POST', body: JSON.stringify(data) })

// Трекинг
export const fetchTrack = (id: string) => req(`/track?id=${encodeURIComponent(id)}`)
export const submitExternalOrder = (data: Record<string, unknown>) => req('/track/submit', { method: 'POST', body: JSON.stringify(data) })
export const submitTrackChange = (cardId: string, changeText: string, changePhone: string) =>
  req('/track/change', { method: 'POST', body: JSON.stringify({ cardId, changeText, changePhone }) })

// Auth
export const loginPhone = (phone: string) => req('/auth/phone', { method: 'POST', body: JSON.stringify({ phone }) })
export const logout = async () => {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/login'
}

// Уведомления
export const fetchNotifications = () => req('/notifications')
export const markNotificationRead = (id: string) => req(`/notifications/${id}/read`, { method: 'PUT' })

// Логист — свои позиции
export const fetchLogistOrders = () => req('/logist/orders')

// Поиск номенклатуры
export const searchNomenclature = (q: string) => req(`/nomenclature?q=${encodeURIComponent(q)}&limit=10`)
