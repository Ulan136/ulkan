'use client'
import { SessionUser } from '@/lib/types'
import WarehouseScreen from '@/components/WarehouseScreen'
import { logout } from '@/lib/api'

interface Props { user: SessionUser }

export default function WarehousePortal({ user }: Props) {
  return (
    <div style={{ minHeight: '100vh', background: '#f1efec', fontFamily: "'Golos Text', system-ui, sans-serif" }}>
      {/* Шапка */}
      <div style={{ background: '#211f1c', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: '#d4613a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 15 }}>U</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>U-Kan · Склад</div>
            <div style={{ color: '#8c857a', fontSize: 11 }}>{user.name}</div>
          </div>
        </div>
        <button onClick={logout} style={{ background: '#322f2b', border: 'none', borderRadius: 7, padding: '6px 12px', color: '#cfc9c0', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Выйти</button>
      </div>
      <div style={{ padding: 24 }}>
        <WarehouseScreen />
      </div>
    </div>
  )
}
