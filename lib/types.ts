// lib/types.ts

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
  status: string
  late: boolean
  payment: string
  createdAt: string
  updatedAt: string
}

export interface Order {
  id: string
  from: string
  fromId: string | null
  to: string
  screen: string
  block: string
  status: string
  source: string
  projectId: string | null
  comment: string
  phone: string | null
  deadline: string | null
  delivered: string | null
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
  trackingLink: string
  createdAt: string
  updatedAt: string
  positions: Position[]
}

export interface SessionUser {
  id: string
  name: string
  email: string
  role: string
}

export type Screen =
  | 'dashboard'
  | 'reception'
  | 'incoming'
  | 'outgoing'
  | 'filter'
  | 'accounting'
  | 'bookkeeping'
  | 'settings'
  | 'warehouse'
  | 'archive'

export type IncTab = 'new' | 'changed' | 'toacc' | 'drafts' | 'cancelled'
