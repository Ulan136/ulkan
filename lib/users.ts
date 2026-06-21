import type { User } from './types'

export function isClientRole(role: string) {
  return role === 'client' || role === 'supplier_client'
}

export function isPrivateClientRole(role: string) {
  return role === 'client'
}

export function isCustomerRole(role: string) {
  return role === 'supplier_client'
}

export function isLogistRole(role: string) {
  return role === 'logist'
}

export function activeUsers(users: User[]) {
  return users.filter(u => u.active)
}

export function supplierUsers(users: User[]) {
  return activeUsers(users).filter(u => u.role === 'supplier_client')
}

export function customerUsers(users: User[]) {
  return activeUsers(users).filter(u => u.role === 'supplier_client')
}

export function privateClientUsers(users: User[]) {
  return activeUsers(users).filter(u => u.role === 'client')
}

export function logistUsers(users: User[]) {
  return activeUsers(users).filter(u => u.role === 'logist')
}

export function fromUsers(users: User[]) {
  return activeUsers(users).filter(u => isClientRole(u.role))
}