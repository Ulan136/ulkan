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
}

export interface SpecProject {
  id: string
  name: string
  clientId?: string
  description: string
  status: string
  createdAt: string
  items: SpecProjectItem[]
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
  name: string
  unit: string
  qty: number
  reserved: number
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

<<<<<<< HEAD
=======
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
}

export interface SpecProject {
  id: string
  name: string
  clientId?: string
  description: string
  status: string
  createdAt: string
  items: SpecProjectItem[]
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

export interface PaymentStatus {
  id: string
  name: string
  active: boolean
}

>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
export type AdminScreen =
  | 'dashboard' | 'reception' | 'incoming' | 'outgoing'
  | 'filter' | 'accounting' | 'warehouse' | 'bookkeeping'
  | 'archive' | 'settings'

export type IncTab = 'new' | 'changed' | 'toacc' | 'drafts' | 'cancelled'
export type FilterGroup = 'clients' | 'suppliers' | 'projects' | 'specprojects'
export type FilterStatus = 'inwork' | 'delivered' | 'all'
<<<<<<< HEAD

export interface AdminFilterSelections {
  suppliers: string[]
  customers: string[]
  privateClients: string[]
  projects: string[]
  specProjects: string[]
}

export const EMPTY_FILTER_SELECTIONS: AdminFilterSelections = {
  suppliers: [],
  customers: [],
  privateClients: [],
  projects: [],
  specProjects: [],
}
export type ArchiveTab = 'cards' | 'projects' | 'specprojects'
export type SettingsTab = 'users' | 'projects' | 'specprojects' | 'nomenclature' | 'payment'
export type BookkeepingTab = 'cards' | 'reports'
=======
export type ArchiveTab = 'cards' | 'projects' | 'specprojects'
export type SettingsTab = 'users' | 'projects' | 'specprojects' | 'nomenclature' | 'payment'
export type BookkeepingTab = 'cards' | 'reports'
export type OutgoingTab = 'inwork' | 'ready' | 'all'
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
