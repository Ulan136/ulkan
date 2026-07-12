'use client'
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { orderAction } from '@/lib/api'
import NomSearch from '@/components/NomSearch'

const PRIMARY = '#d4613a'
const editInp: CSSProperties = { padding: '6px 8px', borderRadius: 6, border: '1.5px solid #e6e2dc', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }
export const editBtn = (primary: boolean): CSSProperties => ({ padding: '6px 12px', borderRadius: 6, border: primary ? 'none' : '1.5px solid #e6e2dc', background: primary ? PRIMARY : '#fff', color: primary ? '#fff' : '#8a847c', cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'inherit', flexShrink: 0 })

// Редактор состава позиции: поиск по номенклатуре + количество + ед. (без цен).
// Модуль-компонент с локальным state — ввод не дёргает родителя.
// Сохранение через updatePosDetail (частичный payload; supplier/price/leg не затираются — слияние на сервере).
export function PositionEditor({ pos, orderId, onEditing, onSaved, onCancel }: {
  pos: { id: string; name1c: string; oral: string; qty: number; unit: string }
  orderId: string
  onEditing: (editing: boolean) => void
  onSaved: (msg: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(pos.name1c || pos.oral || '')
  const [unit, setUnit] = useState(pos.unit || 'шт')
  const [qty, setQty] = useState(String(pos.qty ?? ''))
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await orderAction(orderId, 'updatePosDetail', { posId: pos.id, name1c: name, oral: name, qty: Number(qty) || 0, unit })
      onSaved('✓ Позиция обновлена')
    } catch (e: any) { setSaving(false); onSaved(e.message || 'Ошибка сохранения') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      <NomSearch value={name} placeholder="Поиск по номенклатуре..." onChange={(n, u) => { setName(n); if (u) setUnit(u); onEditing(true) }} style={{ fontSize: 13 }} />
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="number" inputMode="decimal" value={qty} placeholder="Кол-во" onFocus={() => onEditing(true)} onChange={e => setQty(e.target.value)} style={{ ...editInp, width: 80, textAlign: 'right' }} />
        <input value={unit} placeholder="ед." onFocus={() => onEditing(true)} onChange={e => setUnit(e.target.value)} style={{ ...editInp, width: 56 }} />
        <button onClick={save} disabled={saving || !name.trim()} style={{ ...editBtn(true), opacity: saving || !name.trim() ? .5 : 1 }}>{saving ? '...' : 'Сохранить'}</button>
        <button onClick={onCancel} style={editBtn(false)}>Отмена</button>
      </div>
    </div>
  )
}

// Форма добавления позиции.
// supplierName  — фиксированный поставщик (филиал: своё имя).
// supplierOptions — если задан, показывается СЕЛЕКТ поставщика (логист: выбор из списка).
export function AddPositionForm({ orderId, resp, supplierName, supplierOptions, onEditing, onAdded, onCancel }: {
  orderId: string
  resp: string
  supplierName?: string
  supplierOptions?: string[]
  onEditing: (editing: boolean) => void
  onAdded: (msg: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('шт')
  const [qty, setQty] = useState('')
  const [supplier, setSupplier] = useState(supplierName || '')
  const [saving, setSaving] = useState(false)
  const useSelect = Array.isArray(supplierOptions)

  async function add() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const sup = useSelect ? supplier : (supplierName || '')
      await orderAction(orderId, 'addPos', { name1c: name, oral: name, qty: Number(qty) || 0, unit, supplier: sup, resp })
      onAdded('✓ Позиция добавлена')
    } catch (e: any) { setSaving(false); onAdded(e.message || 'Ошибка') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', background: '#f8f6f3', borderRadius: 8, padding: 10, marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#8a847c' }}>НОВАЯ ПОЗИЦИЯ</div>
      <NomSearch value={name} placeholder="Поиск по номенклатуре..." onChange={(n, u) => { setName(n); if (u) setUnit(u); onEditing(true) }} style={{ fontSize: 13 }} />
      {useSelect && (
        <select value={supplier} onFocus={() => onEditing(true)} onChange={e => { setSupplier(e.target.value); onEditing(true) }} style={{ ...editInp, width: '100%' }}>
          <option value="">— поставщик —</option>
          {supplierOptions!.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      )}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="number" inputMode="decimal" value={qty} placeholder="Кол-во" onFocus={() => onEditing(true)} onChange={e => setQty(e.target.value)} style={{ ...editInp, width: 80, textAlign: 'right' }} />
        <input value={unit} placeholder="ед." onFocus={() => onEditing(true)} onChange={e => setUnit(e.target.value)} style={{ ...editInp, width: 56 }} />
        <button onClick={add} disabled={saving || !name.trim()} style={{ ...editBtn(true), opacity: saving || !name.trim() ? .5 : 1 }}>{saving ? '...' : 'Добавить'}</button>
        <button onClick={onCancel} style={editBtn(false)}>Отмена</button>
      </div>
    </div>
  )
}
