'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { NOM_TREE, type NomLeaf } from '@/lib/nomTree'
import { RAL_COLORS, RalDot, extractRal } from '@/lib/ral'

const PRIMARY = '#d4613a'
const GLOW = '0 0 0 4px rgba(212,97,58,.25)'

export interface PickedPos { name1c: string; oral: string; qty: number; unit: string }
interface NomHit { id: string; name: string; unit: string }

// Чипы цвет/товар/подкатегория — ПОМОЩНИК ПОИСКА: собирают строку запроса,
// которая ищется в реальной номенклатуре. Отдельного поля RAL нет — код цвета
// это просто слово в запросе (напр. «9003 нар угол»), которое находит позицию
// в базе. Изделие — особый формат: «Изделие № 17 8017».
function assembleQuery(color: string, leaf: NomLeaf | null, cm: string): string {
  if (!leaf) return color
  if (leaf.measure) {
    return [leaf.nameBase, cm ? `№ ${cm}` : '', color].filter(Boolean).join(' ').trim()
  }
  return [color, leaf.nameBase].filter(Boolean).join(' ').trim()
}

export default function NomPicker({ onPick, onClose }: {
  onPick: (items: PickedPos[]) => void
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [color, setColor] = useState('')
  const [productKey, setProductKey] = useState('')
  const [brandKey, setBrandKey] = useState('')
  const [leafKey, setLeafKey] = useState('')
  const [leaf, setLeaf] = useState<NomLeaf | null>(null)
  const [cm, setCm] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NomHit[]>([])
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<PickedPos[]>([])

  // Панель ввода количества (шт) для выбранной позиции.
  const [pad, setPad] = useState<null | { name1c: string; oral: string; unit: string; digits: string }>(null)
  const padRef = useRef(pad); padRef.current = pad

  useEffect(() => { setMounted(true) }, [])

  const product = NOM_TREE.find(p => p.key === productKey)
  const brand = product?.brands?.find(b => b.key === brandKey)
  const subLeaves: NomLeaf[] = product?.subs || brand?.leaves || []

  // ── Выбор помощников поиска → пересобрать строку запроса ──
  function pickColor(c: string) {
    const next = color === c ? '' : c
    setColor(next); setQuery(assembleQuery(next, leaf, leaf?.measure ? cm : ''))
  }
  function pickProduct(key: string) {
    const next = productKey === key ? '' : key
    setProductKey(next); setBrandKey(''); setLeafKey(''); setLeaf(null); setCm('')
    setQuery(assembleQuery(color, null, ''))
  }
  function pickBrand(bKey: string) {
    const b = product?.brands?.find(x => x.key === bKey)
    const next = brandKey === bKey ? '' : bKey
    setBrandKey(next); setLeafKey(''); setLeaf(null); setCm('')
    // Бренд без сортов (МБ) — сам как подкатегория
    if (next && b && b.leaves.length === 0 && b.nameBase) {
      selectLeaf({ key: b.key, label: b.label, nameBase: b.nameBase })
    } else {
      setQuery(assembleQuery(color, null, ''))
    }
  }
  function selectLeaf(l: NomLeaf) {
    const next = leafKey === l.key ? '' : l.key
    if (!next) { setLeafKey(''); setLeaf(null); setCm(''); setQuery(assembleQuery(color, null, '')); return }
    setLeafKey(l.key); setLeaf(l); setCm('')
    setQuery(assembleQuery(color, l, ''))
  }
  function setCmVal(v: string) {
    const clean = v.replace(/\D/g, '').slice(0, 4)
    setCm(clean); setQuery(assembleQuery(color, leaf, clean))
  }

  // ── Поиск по реальной номенклатуре (debounce) ──
  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults([]); setLoading(false); return }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/nomenclature?q=${encodeURIComponent(q)}&limit=20`)
        const data = await res.json()
        setResults(Array.isArray(data) ? data.map((d: any) => ({ id: d.id, name: d.name, unit: d.unit || 'шт' })) : [])
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  // ── Количество: панель + клавиатура ──
  function openPadForHit(h: NomHit) { setPad({ name1c: h.name, oral: h.name, unit: h.unit, digits: '' }) }
  function openPadAsIs() { const q = query.trim(); if (q) setPad({ name1c: '', oral: q, unit: 'шт', digits: '' }) }
  function commitPad() {
    const p = padRef.current
    if (!p) return
    const qty = parseInt(p.digits || '0', 10) || 0
    if (qty <= 0) return
    setRows(prev => [...prev, { name1c: p.name1c, oral: p.oral, qty, unit: p.unit }])
    setPad(null)
  }
  useEffect(() => {
    if (!pad) return
    function onKey(e: KeyboardEvent) {
      if (e.key >= '0' && e.key <= '9') { e.preventDefault(); setPad(p => p && p.digits.length < 6 ? { ...p, digits: (p.digits === '0' ? '' : p.digits) + e.key } : p) }
      else if (e.key === 'Backspace') { e.preventDefault(); setPad(p => p ? { ...p, digits: p.digits.slice(0, -1) } : p) }
      else if (e.key === 'Enter') { e.preventDefault(); commitPad() }
      else if (e.key === 'Escape') { e.preventDefault(); setPad(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pad])

  function submit() {
    if (rows.length === 0) return
    onPick(rows); onClose()
  }
  const totalUnits = rows.reduce((s, r) => s + r.qty, 0)

  if (!mounted) return null

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,16,.55)', zIndex: 100000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', width: '100%', maxWidth: 432, maxHeight: '94vh', borderRadius: '18px 18px 0 0', display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 40px rgba(0,0,0,.3)' }}>
        {/* Шапка */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #f1efec', flexShrink: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>📖 Каталог — поиск</div>
          <button onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: '#f1efec', width: 32, height: 32, borderRadius: '50%', fontSize: 16, cursor: 'pointer', color: '#8a847c' }}>✕</button>
        </div>

        {/* Строка поиска (собирается чипами, но редактируемая) */}
        <div style={{ padding: '12px 16px 8px', flexShrink: 0 }}>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Запрос: цвет + товар (напр. 9003 нар угол)"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${query ? PRIMARY : '#e6e2dc'}`, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '4px 16px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* ЦВЕТ */}
          <div>
            <div style={LBL}>ЦВЕТ</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              {RAL_COLORS.map(c => {
                const on = color === c.code
                return (
                  <button key={c.code} onClick={() => pickColor(c.code)} title={`${c.code} · ${c.name}`}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                    <span style={{ width: on ? 38 : 28, height: on ? 38 : 28, borderRadius: '50%', background: c.hex, boxShadow: on ? `${GLOW}, inset 0 0 0 2px rgba(0,0,0,.12)` : 'inset 0 0 0 1.5px rgba(0,0,0,.14)', transition: 'all .12s' }} />
                    <span style={{ fontSize: 10, fontWeight: on ? 800 : 500, color: on ? PRIMARY : '#a39c92' }}>{c.code}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ТОВАР */}
          <div>
            <div style={LBL}>ТОВАР</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {NOM_TREE.map(p => <button key={p.key} onClick={() => pickProduct(p.key)} style={pill(productKey === p.key)}>{p.label}</button>)}
            </div>
          </div>

          {/* БРЕНД (Водосток) */}
          {product?.brands && (
            <div>
              <div style={LBL}>БРЕНД</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {product.brands.map(b => <button key={b.key} onClick={() => pickBrand(b.key)} style={pill(brandKey === b.key)}>{b.label}{b.leaves.length ? ' ▾' : ''}</button>)}
              </div>
            </div>
          )}

          {/* ПОДКАТЕГОРИЯ */}
          {subLeaves.length > 0 && (
            <div>
              <div style={LBL}>ПОДКАТЕГОРИЯ</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {subLeaves.map(l => <button key={l.key} onClick={() => selectLeaf(l)} style={pill(leafKey === l.key)}>{l.label}</button>)}
              </div>
              {/* Изделие — ввод длины в см (уходит в запрос: «Изделие № 17 8017») */}
              {leaf?.measure && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <span style={{ fontSize: 13, color: '#8a847c', fontWeight: 600 }}>Длина:</span>
                  <input value={cm} onChange={e => setCmVal(e.target.value)} inputMode="numeric" placeholder="см"
                    style={{ width: 90, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e6e2dc', fontSize: 14, fontFamily: 'inherit', outline: 'none', textAlign: 'center' }} />
                  <span style={{ fontSize: 13, color: '#8a847c' }}>см</span>
                </div>
              )}
            </div>
          )}

          {/* РЕЗУЛЬТАТЫ ПОИСКА (реальная база) */}
          {query.trim() && (
            <div>
              <div style={LBL}>НАЙДЕНО В БАЗЕ</div>
              {loading
                ? <div style={{ fontSize: 13, color: '#8a847c', padding: '8px 0' }}>Поиск…</div>
                : results.length > 0
                  ? <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {results.map(h => (
                        <button key={h.id} onClick={() => openPadForHit(h)} style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', border: '1.5px solid #e6e2dc', background: '#fff', borderRadius: 9, padding: '9px 11px', cursor: 'pointer', fontFamily: 'inherit' }}>
                          <RalDot code={extractRal(h.name)} size={14} />
                          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
                          <span style={{ fontSize: 11, color: '#8a847c', background: '#f1efec', padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>{h.unit}</span>
                          <span style={{ color: PRIMARY, fontWeight: 800, flexShrink: 0 }}>+</span>
                        </button>
                      ))}
                    </div>
                  : <div style={{ fontSize: 13, color: '#8a847c', padding: '8px 0' }}>Не найдено в базе — можно добавить как есть ↓</div>
              }
              {/* Добавить как есть — черновой путь «со слов» (работает и без базы) */}
              <button onClick={openPadAsIs} style={{ marginTop: 8, width: '100%', border: '1.5px dashed #d8d3cc', background: 'none', borderRadius: 9, padding: '9px', cursor: 'pointer', fontSize: 13, color: '#4a4640', fontFamily: 'inherit', fontWeight: 600 }}>
                ＋ Добавить как есть: «{query.trim()}»
              </button>
            </div>
          )}

          {/* ВЫБРАНО */}
          {rows.length > 0 && (
            <div>
              <div style={LBL}>ВЫБРАНО</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rows.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8f6f3', borderRadius: 9, padding: '8px 10px' }}>
                    <RalDot code={extractRal(r.name1c || r.oral)} size={14} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name1c || r.oral}</div>
                      {!r.name1c && <div style={{ fontSize: 10, color: '#a39c92' }}>со слов</div>}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{r.qty} {r.unit}</span>
                    <button onClick={() => setRows(prev => prev.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', color: '#c1121c', fontSize: 18, cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Футер */}
        <div style={{ flexShrink: 0, padding: '12px 16px', borderTop: '1px solid #f1efec', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#8a847c' }}>{rows.length} поз. · {totalUnits} шт</div>
          <button onClick={submit} disabled={rows.length === 0} style={{ marginLeft: 'auto', border: 'none', background: rows.length ? PRIMARY : '#e6e2dc', color: '#fff', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 800, cursor: rows.length ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
            Добавить в заказ →
          </button>
        </div>
      </div>

      {/* ── ПАНЕЛЬ КОЛИЧЕСТВА ── */}
      {pad && (
        <div onClick={() => setPad(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,16,.5)', zIndex: 100001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, padding: 18, width: '100%', maxWidth: 320 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <RalDot code={extractRal(pad.name1c || pad.oral)} size={20} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pad.name1c || pad.oral}</div>
                <div style={{ fontSize: 11, color: '#8a847c' }}>количество, {pad.unit}</div>
              </div>
            </div>
            <div style={{ background: '#f8f6f3', borderRadius: 12, padding: '16px 18px', textAlign: 'right', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 34, fontWeight: 700, minHeight: 30, color: pad.digits ? '#26231f' : '#cfc9c0', marginBottom: 12 }}>
              {pad.digits || '0'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map(d => (
                <button key={d} onClick={() => setPad(p => p && p.digits.length < 6 ? { ...p, digits: (p.digits === '0' ? '' : p.digits) + d } : p)} style={keyBtn}>{d}</button>
              ))}
              <button onClick={() => setPad(p => p && p.digits.length < 6 ? { ...p, digits: (p.digits === '0' ? '' : p.digits) + '0' } : p)} style={{ ...keyBtn, gridColumn: 'span 2' }}>0</button>
              <button onClick={() => setPad(p => p ? { ...p, digits: p.digits.slice(0, -1) } : p)} style={{ ...keyBtn, background: '#f1efec' }}>←</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => setPad(null)} style={{ flex: 1, border: '1.5px solid #e6e2dc', background: '#fff', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#8a847c' }}>Отмена</button>
              <button onClick={commitPad} style={{ flex: 2, border: 'none', background: PRIMARY, color: '#fff', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Добавить</button>
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
  return { padding: '8px 14px', borderRadius: 22, border: 'none', fontSize: 13, fontWeight: on ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', background: on ? PRIMARY : '#f1efec', color: on ? '#fff' : '#4a4640', boxShadow: on ? GLOW : 'none', transition: 'all .12s' }
}
