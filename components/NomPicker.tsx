'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { NOM_TREE, type NomLeaf } from '@/lib/nomTree'
import { RAL_COLORS, RalDot, extractRal } from '@/lib/ral'

const PRIMARY = '#d4613a'
const GLOW = '0 0 0 4px rgba(212,97,58,.25)'

export interface PickedPos { name1c: string; oral: string; qty: number; unit: string }
interface NomHit { id: string; name: string; unit: string; ral: string }
interface Row {
  id: string
  base: string            // основа имени ("Наружный угол")
  ral: string             // код цвета ('' если не выбран)
  qty: number
  cm: number              // для measure
  measure: boolean
  unit: string
  name1c: string          // совпадение из номенклатуры или ''
  candidates: NomHit[]    // >1 совпадение → выбор под строкой
}

let rowSeq = 0
const uid = () => `r${++rowSeq}`

// Итоговое имя позиции: основа + « RAL»+код (+ « · N см» для изделия).
// RAL дописывается в имя — решение владельца (самодостаточно в отчётах/1С).
function buildName(r: { base: string; ral: string; measure: boolean; cm: number }): string {
  let n = r.base
  if (r.ral) n += ` RAL${r.ral}`
  if (r.measure && r.cm > 0) n += ` · ${r.cm} см`
  return n
}

function matchesColor(hit: NomHit, ral: string): boolean {
  if (!ral) return true
  return hit.ral === ral || extractRal(hit.name) === ral
}

export default function NomPicker({ onPick, onClose }: {
  onPick: (items: PickedPos[]) => void
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [color, setColor] = useState('')          // код RAL или ''
  const [productKey, setProductKey] = useState('')
  const [brandKey, setBrandKey] = useState('')     // только для Водостока
  const [rows, setRows] = useState<Row[]>([])

  // Цифровая панель (клавиатура): открыта под добавление/правку строки.
  const [pad, setPad] = useState<null | {
    base: string; measure: boolean; ral: string
    step: 'qty' | 'cm'; qty: string; cm: string; editId: string | null
  }>(null)
  const padRef = useRef(pad); padRef.current = pad   // всегда свежий pad для клавиатуры/коммита

  useEffect(() => { setMounted(true) }, [])

  const product = NOM_TREE.find(p => p.key === productKey)
  const brand = product?.brands?.find(b => b.key === brandKey)

  // ── Открыть цифровую панель под подкатегорию/бренд-лист ──
  function openPad(leaf: NomLeaf) {
    setPad({ base: leaf.nameBase, measure: !!leaf.measure, ral: color, step: 'qty', qty: '', cm: '', editId: null })
  }
  function editRow(r: Row) {
    setPad({ base: r.base, measure: r.measure, ral: r.ral, step: 'qty', qty: String(r.qty || ''), cm: String(r.cm || ''), editId: r.id })
  }

  // ── Матчинг с реальной номенклатурой ──
  const runMatch = useCallback(async (base: string, ral: string): Promise<{ name1c: string; unit: string; candidates: NomHit[] }> => {
    try {
      const q = base.trim()
      const res = await fetch(`/api/nomenclature?q=${encodeURIComponent(q)}&limit=25`)
      const data = await res.json()
      const all: NomHit[] = Array.isArray(data) ? data.map((d: any) => ({ id: d.id, name: d.name, unit: d.unit || 'шт', ral: d.ral || '' })) : []
      const hits = ral ? all.filter(h => matchesColor(h, ral)) : all
      if (hits.length === 1) return { name1c: hits[0].name, unit: hits[0].unit, candidates: [] }
      if (hits.length > 1) return { name1c: '', unit: 'шт', candidates: hits.slice(0, 8) }
      return { name1c: '', unit: 'шт', candidates: [] } // ноль → черновик (oral)
    } catch {
      return { name1c: '', unit: 'шт', candidates: [] }
    }
  }, [])

  // ── Финализация цифровой панели: добавить/обновить строку + матчинг ──
  async function commitPad() {
    const p = padRef.current
    if (!p) return
    const qty = parseInt(p.qty || '0', 10) || 0
    if (qty <= 0) return
    const cm = p.measure ? (parseInt(p.cm || '0', 10) || 0) : 0
    if (p.measure && cm <= 0) return
    const editId = p.editId
    const base = p.base, ral = p.ral, measure = p.measure
    setPad(null)

    const m = await runMatch(base, ral)
    setRows(prev => {
      if (editId) {
        return prev.map(r => r.id === editId
          ? { ...r, qty, cm, ral, name1c: m.name1c, unit: m.unit || r.unit, candidates: m.candidates }
          : r)
      }
      return [...prev, { id: uid(), base, ral, qty, cm, measure, unit: m.unit || 'шт', name1c: m.name1c, candidates: m.candidates }]
    })
  }

  // Клавиатура компьютера: 0-9/NumPad вводят, Backspace стирает, Enter=далее/добавить, Esc=отмена.
  useEffect(() => {
    if (!pad) return
    function onKey(e: KeyboardEvent) {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault(); press(e.key)
      } else if (e.key === 'Backspace') {
        e.preventDefault(); back()
      } else if (e.key === 'Enter') {
        e.preventDefault(); next()
      } else if (e.key === 'Escape') {
        e.preventDefault(); setPad(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pad])

  function press(d: string) {
    setPad(p => {
      if (!p) return p
      const field = p.step === 'qty' ? 'qty' : 'cm'
      const cur = p[field]
      if (cur.length >= 6) return p            // лимит 6 цифр
      const nextVal = (cur === '0' ? '' : cur) + d
      return { ...p, [field]: nextVal }
    })
  }
  function back() {
    setPad(p => {
      if (!p) return p
      const field = p.step === 'qty' ? 'qty' : 'cm'
      return { ...p, [field]: p[field].slice(0, -1) }
    })
  }
  // Enter/«Добавить»: для measure первый шаг (шт) ведёт ко второму (см), иначе коммит.
  function next() {
    const p = padRef.current
    if (!p) return
    if (p.measure && p.step === 'qty') {
      if ((parseInt(p.qty || '0', 10) || 0) <= 0) return
      setPad({ ...p, step: 'cm' })
      return
    }
    commitPad()
  }

  function removeRow(id: string) { setRows(prev => prev.filter(r => r.id !== id)) }
  function chooseCandidate(id: string, hit: NomHit) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, name1c: hit.name, unit: hit.unit, candidates: [] } : r))
  }

  function submit() {
    const items: PickedPos[] = rows.map(r => {
      const oral = buildName(r)
      return { name1c: r.name1c || '', oral, qty: r.qty, unit: r.unit || 'шт' }
    })
    if (items.length === 0) return
    onPick(items)
    onClose()
  }

  const totalUnits = rows.reduce((s, r) => s + r.qty, 0)

  // ── Пилюли подкатегорий текущего товара ──
  const subLeaves: NomLeaf[] = product?.subs || (brand?.leaves || [])
  const showBrandRow = !!product?.brands
  const brandDirect = brand && brand.leaves.length === 0  // МБ → сразу к вводу

  if (!mounted) return null

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,16,.55)', zIndex: 100000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', width: '100%', maxWidth: 432, maxHeight: '94vh', borderRadius: '18px 18px 0 0',
        display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 40px rgba(0,0,0,.3)',
      }}>
        {/* Шапка */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #f1efec', flexShrink: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>📖 Каталог</div>
          <button onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: '#f1efec', width: 32, height: 32, borderRadius: '50%', fontSize: 16, cursor: 'pointer', color: '#8a847c' }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ── ЦВЕТ ── */}
          <div>
            <div style={LBL}>ЦВЕТ</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              {RAL_COLORS.map(c => {
                const on = color === c.code
                return (
                  <button key={c.code} onClick={() => setColor(on ? '' : c.code)} title={`RAL${c.code} · ${c.name}`}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, border: 'none', background: 'none',
                      cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                    }}>
                    <span style={{
                      width: on ? 40 : 30, height: on ? 40 : 30, borderRadius: '50%', background: c.hex,
                      boxShadow: on ? `${GLOW}, inset 0 0 0 2px rgba(0,0,0,.12)` : 'inset 0 0 0 1.5px rgba(0,0,0,.14)',
                      transition: 'all .12s', flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 10, fontWeight: on ? 800 : 500, color: on ? PRIMARY : '#a39c92' }}>{c.code}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── ТОВАР ── */}
          <div>
            <div style={LBL}>ТОВАР</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {NOM_TREE.map(p => {
                const on = productKey === p.key
                return (
                  <button key={p.key} onClick={() => { setProductKey(on ? '' : p.key); setBrandKey('') }}
                    style={pill(on)}>{p.label}</button>
                )
              })}
            </div>
          </div>

          {/* ── БРЕНД (Водосток) ── */}
          {showBrandRow && (
            <div>
              <div style={LBL}>БРЕНД</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {product!.brands!.map(b => {
                  const on = brandKey === b.key
                  const arrow = b.leaves.length > 0 ? ' ▾' : ''
                  return (
                    <button key={b.key} onClick={() => {
                      const nextOn = on ? '' : b.key
                      setBrandKey(nextOn)
                      // МБ без сортов — сразу цифровая панель
                      if (nextOn && b.leaves.length === 0 && b.nameBase) {
                        setPad({ base: b.nameBase, measure: false, ral: color, step: 'qty', qty: '', cm: '', editId: null })
                      }
                    }} style={pill(on)}>{b.label}{arrow}</button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── ПОДКАТЕГОРИЯ ── */}
          {subLeaves.length > 0 && !brandDirect && (
            <div>
              <div style={LBL}>ПОДКАТЕГОРИЯ</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {subLeaves.map(leaf => (
                  <button key={leaf.key} onClick={() => openPad(leaf)} style={pill(false)}>
                    {leaf.label} <span style={{ color: PRIMARY, fontWeight: 800 }}>+</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── СПИСОК ВЫБРАННОГО ── */}
          {rows.length > 0 && (
            <div>
              <div style={LBL}>ВЫБРАНО</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rows.map(r => (
                  <div key={r.id} style={{ background: '#f8f6f3', borderRadius: 10, padding: '8px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <RalDot code={r.ral} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{buildName(r)}</div>
                        {r.name1c && <div style={{ fontSize: 10, color: '#5a8f5a' }}>✓ 1С: {r.name1c}</div>}
                        {!r.name1c && r.candidates.length === 0 && <div style={{ fontSize: 10, color: '#a39c92' }}>со слов</div>}
                      </div>
                      <button onClick={() => editRow(r)} style={{ border: 'none', background: '#fff', boxShadow: '0 0 0 1.5px #e6e2dc', borderRadius: 7, padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#26231f', fontFamily: 'inherit', flexShrink: 0 }}>{r.qty} шт</button>
                      {r.measure && r.cm > 0 && <span style={{ fontSize: 12, color: '#8a847c', background: '#fff', boxShadow: '0 0 0 1.5px #e6e2dc', borderRadius: 7, padding: '5px 8px', flexShrink: 0 }}>{r.cm} см</span>}
                      <button onClick={() => removeRow(r.id)} style={{ border: 'none', background: 'none', color: '#c1121c', fontSize: 18, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>×</button>
                    </div>
                    {/* Несколько совпадений — компактный выбор */}
                    {r.candidates.length > 1 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
                        {r.candidates.map(h => (
                          <button key={h.id} onClick={() => chooseCandidate(r.id, h)}
                            style={{ border: 'none', background: '#fff', boxShadow: '0 0 0 1px #e6e2dc', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: '#4a4640', fontFamily: 'inherit' }}>
                            {h.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Футер */}
        <div style={{ flexShrink: 0, padding: '12px 16px', borderTop: '1px solid #f1efec', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#8a847c' }}>{rows.length} поз. · {totalUnits} шт</div>
          <button onClick={submit} disabled={rows.length === 0}
            style={{ marginLeft: 'auto', border: 'none', background: rows.length ? PRIMARY : '#e6e2dc', color: '#fff', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 800, cursor: rows.length ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
            Добавить в заказ →
          </button>
        </div>
      </div>

      {/* ── ЦИФРОВАЯ ПАНЕЛЬ ── */}
      {pad && (
        <div onClick={() => setPad(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,16,.5)', zIndex: 100001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, padding: 18, width: '100%', maxWidth: 320 }}>
            {/* Заголовок */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <RalDot code={pad.ral} size={20} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {buildName({ base: pad.base, ral: pad.ral, measure: pad.measure, cm: parseInt(pad.cm || '0', 10) || 0 })}
                </div>
                <div style={{ fontSize: 11, color: '#8a847c' }}>{pad.step === 'cm' ? 'длина, см' : 'количество, шт'}</div>
              </div>
            </div>
            {/* Поле */}
            <div style={{ background: '#f8f6f3', borderRadius: 12, padding: '16px 18px', textAlign: 'right', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 34, fontWeight: 700, minHeight: 30, color: (pad.step === 'cm' ? pad.cm : pad.qty) ? '#26231f' : '#cfc9c0', marginBottom: 12 }}>
              {(pad.step === 'cm' ? pad.cm : pad.qty) || '0'}
            </div>
            {/* Клавиши */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map(d => (
                <button key={d} onClick={() => press(d)} style={keyBtn}>{d}</button>
              ))}
              <button onClick={() => press('0')} style={{ ...keyBtn, gridColumn: 'span 2' }}>0</button>
              <button onClick={back} style={{ ...keyBtn, background: '#f1efec' }}>←</button>
            </div>
            {/* Действия */}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => setPad(null)} style={{ flex: 1, border: '1.5px solid #e6e2dc', background: '#fff', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#8a847c' }}>Отмена</button>
              <button onClick={next} style={{ flex: 2, border: 'none', background: PRIMARY, color: '#fff', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                {pad.measure && pad.step === 'qty' ? 'Далее →' : (pad.editId ? 'Сохранить' : 'Добавить')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}

const LBL: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: '#a39c92', letterSpacing: '.05em', marginBottom: 8 }
const keyBtn: React.CSSProperties = { padding: '14px 0', borderRadius: 10, border: 'none', background: '#f8f6f3', fontSize: 20, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: '#26231f' }
function pill(on: boolean): React.CSSProperties {
  return {
    padding: '8px 14px', borderRadius: 22, border: 'none', fontSize: 13, fontWeight: on ? 700 : 500,
    cursor: 'pointer', fontFamily: 'inherit',
    background: on ? PRIMARY : '#f1efec', color: on ? '#fff' : '#4a4640',
    boxShadow: on ? GLOW : 'none', transition: 'all .12s',
  }
}
