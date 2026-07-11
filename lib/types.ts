export interface Position {
  id: string
  cardId: string
  name1c: string
  oral: string
  qty: number
  unit: string
  price: number
  resp: string
  supplier: string
  supplierId?: string
  status: string
  late: boolean
  payment: string
  deadline?: string
  createdAt: string
  updatedAt: string
}

export interface Order {
  id: string
  from: string
  fromId?: string
  to: string
  screen: string
  block: string
  status: string
  source: string
  projectId?: string
  specProjectId?: string
  contactId?: string
  comment: string
  phone?: string
  deadline?: string
  delivered?: string
  isDraft: boolean
  isChanged: boolean
  changeText: string
  changePhone: string
  isCancelled: boolean
  cancelReason: string
  toacc: boolean
  postponed: boolean
  invoice: boolean
  fact: boolean
  posted1C: boolean
  cold: boolean
  trackingLink: string
  sortOrder: number
  leg?: number
  createdAt: string
  updatedAt: string
  positions: Position[]
}

export interface User {
  id: string
  name: string
  phone?: string
  email?: string
  role: string
  companyId?: string
  slug?: string
  active: boolean
  createdAt: string
}

export interface Project {
  id: string
  name: string
  clientId?: string
  description: string
  status: string
  createdAt: string
  _count?: { orders: number }
}

export interface SpecProject {
  id: string
  name: string
  clientId?: string
  description: string
  status: string
  createdAt: string
  items: SpecProjectItem[]
  _count?: { orders: number }
}

export interface SpecProjectItem {
  id: string
  specProjectId: string
  name: string
  qty: number
  unit: string
  nomenclatureId?: string
}

export interface Supplier {
  id: string
  name: string
  type: string
  active: boolean
}

export interface Nomenclature {
  id: string
  name: string
  unit: string
  cat: string
}

export interface Stock {
  id: string
  supplierId: string
  nomenclatureId: string
  name: string
  unit: string
  qty: number
  reserved: number
  supplier?: Supplier
  nomenclature?: Nomenclature
}

export interface StockMovement {
  id: string
  type: string
  name: string
  qty: number
  unit: string
  positionId?: string
  cardId?: string
  createdAt: string
}

export interface DailyReport {
  id: string
  logistId: string
  date: string
  comment: string
  status: string
  createdAt: string
  logist?: User
  rows: DailyReportRow[]
}

export interface DailyReportRow {
  id: string
  reportId: string
  fromWho: string
  name: string
  qtyIn: number
  commentIn: string
  toWho: string
  qtyOut: number
  commentOut: string
  invoiceNum: string
}

export interface Notification {
  id: string
  userId: string
  text: string
  cardId?: string
  read: boolean
  createdAt: string
}

export interface SessionUser {
  id: string
  name: string
  email?: string
  phone?: string
  role: string
  slug?: string
}

export interface HistoryItem {
  id: string
  cardId: string
  action: string
  detail: string
  userName: string
  createdAt: string
}

export interface AnalysisRow {
  name: string
  unit: string
  needed: number
  collected: number
  remaining: number
  pct: number
}

export interface DashboardData {
  kpi: {
    active: number
    deliveredToday: number
    overdue: number
    inwork: number
    turnoverToday: number
  }
  flow: {
    incoming: number
    reception: number
    outgoing: number
    accounting: number
    bookkeeping: number
    archive: number
  }
  progress: {
    overallPct: number
    inwork: number
    delivered: number
    overdue: number
  }
  attention: Array<{ label: string; sub: string; tag: string; hue: string; screen: string }>
  activity: HistoryItem[]
  topClients: Array<{ name: string; count: number; pct: number }>
  specProjects: Array<{ id: string; name: string; pct: number; cardCount: number }>
}

export interface SettingsData {
  users: User[]
  projects: Project[]
  specProjects: SpecProject[]
  suppliers: Supplier[]
  nomenclature: Nomenclature[]
  paymentStatuses: Array<{ id: string; name: string; active: boolean }>
}

export interface TrackData {
  id: string
  from: string
  to: string
  status: string
  stage: number
  progress: number
  createdAt: string
  delivered?: string
  positions: Array<{ name: string; qty: number; unit: string; status: string }>
  history: Array<{ action: string; time: string }>
  details: Array<{ k: string; v: string }>
}

export type AdminScreen =
  | 'dashboard' | 'reception' | 'incoming' | 'outgoing'
  | 'filter' | 'accounting' | 'warehouse' | 'bookkeeping'
  | 'archive' | 'nomenclature' | 'settings'

export type IncTab = 'new' | 'changed' | 'toacc' | 'drafts' | 'cancelled'
export type FilterGroup = 'clients' | 'suppliers' | 'projects' | 'specprojects'
export type FilterStatus = 'inwork' | 'delivered' | 'all'
export type ArchiveTab = 'cards' | 'projects' | 'specprojects'
export type SettingsTab = 'users' | 'projects' | 'specprojects' | 'nomenclature' | 'payment'
export type BookkeepingTab = 'cards' | 'reports' | 'shifts'
