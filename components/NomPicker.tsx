'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { NOM_TREE, type NomProduct } from '@/lib/nomTree'
import { RAL_COLORS, RAL_BY_CODE, RalDot, extractRal } from '@/lib/ral'

const PRIMARY = '#d4613a'
const GLOW = '0 0 0 4px rgba(212,97,58,.25)'

export interface PickedPos { name1c: string; oral: string; qty: number; unit: string }
interface NomHit { id: string; name: string; unit: string }

// Собрать строку запроса из выбранных чипов: цвет + слова категории + слова
// выбранных уровней (+ «№ {cm}» для изделия). Это ПОИСКОВЫЕ СЛОВА, а не имя.
function assemble(color: string, product: NomProduct | undefined, sel: Record<string, string>, cm: string): string {
  const parts: string[] = []
  const cEntry = color ? RAL_BY_CODE[color] : undefined
  if (cEntry) parts.push(cEntry.query || cEntry.code)
  if (product) {
    ;(product.terms || []).forEach(t => parts.push(t))
    product.levels.forEach(lv => {
      const it = lv.items.find(i => i.key === sel[lv.key])
      if (it) {
        ;(it.terms ?? [it.label]).forEach(t => parts.push(t))
        if (it.measure && cm) parts.push(`№ ${cm}`)
      }
    })
  }
  return parts.join(' ').trim()
}

export default function NomPicker({ onPick, onClose }: {
  onPick: (items: PickedPos[]) => void
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [color, setColor] = useState('')
  const [productKey, setProductKey] = useState('')
  const [sel, setSel] = useState<Record<string, string>>({})   // levelKey → itemKey
  const [cm, setCm] = useState('')
  const [query, setQuery] = useState('')
  const [manual, setManual] = useState(false)                  // ручная правка строки
  const [results, setResults] = useState<NomHit[]>([])
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<PickedPos[]>([])

  const [pad, setPad] = useState<null | { name1c: string; oral: string; unit: string; digits: string }>(null)
  const padRef = useRef(pad); padRef.current = pad

  useEffect(() => { setMounted(true) }, [])

  const product = NOM_TREE.find(p => p.key === productKey)

  // Пока не редактировали руками — строка запроса собирается из чипов.
  useEffect(() => {
    if (!manual) setQuery(assemble(color, product, sel, cm))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, productKey, sel, cm, manual])

  // Исключающий фильтр (МП): слова, имена с которыми выкидываем из выдачи.
  const excludes: string[] = []
  product?.levels.forEach(lv => {
    const it = lv.items.find(i => i.key === sel[lv.key])
    if (it?.exclude) excludes.push(...it.exclude)
  })

  // ── Поиск по реальной номенклатуре (debounce), каскад не трогаем ──
  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults([]); setLoading(false); return }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/nomenclature?q=${encodeURIComponent(q)}&limit=25`)
        const data = await res.json()
        setResults(Array.isArray(data) ? data.map((d: any) => ({ id: d.id, name: d.name, unit: d.unit || 'шт' })) : [])
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  // Выдача: исключить МП-слова, сорт «точность (больше слов совпало) → короче имя».
  const qWords = query.toLowerCase().split(/[^а-яёa-z0-9]+/i).filter(w => w.length >= 2)
  const shown = results
    .filter(r => !excludes.some(w => r.name.toLowerCase().includes(w.toLowerCase())))
    .map(r => ({ r, score: qWords.filter(w => r.name.toLowerCase().includes(w)).length }))
    .sort((a, b) => b.score - a.score || a.r.name.length - b.r.name.length)
    .map(x => x.r)

  // ── Чипы ──
  function pickColor(c: string) { setManual(false); setColor(prev => prev === c ? '' : c) }
  function pickProduct(k: string) { setManual(false); setProductKey(prev => prev === k ? '' : k); setSel({}); setCm('') }
  function pickItem(levelKey: string, itemKey: string, isMeasure: boolean) {
    setManual(false)
    setSel(prev => { const next = { ...prev }; if (next[levelKey] === itemKey) delete next[levelKey]; else next[levelKey] = itemKey; return next })
    if (!isMeasure) setCm('')
  }

  // ── Количество: панель + клавиатура ──
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

  function submit() { if (rows.length) { onPick(rows); onClose() } }
  const totalUnits = rows.reduce((s, r) => s + r.qty, 0)
  const measureSelected = product?.levels.some(lv => lv.items.find(i => i.key === sel[lv.key])?.measure)

  // Разбор «Поисковые слова: 7024 (серый) + Комплектующие + «Нар. угол (сл)»»
  const cEntry = color ? RAL_BY_CODE[color] : undefined
  const crumbs: React.ReactNode[] = []
  if (cEntry) crumbs.push(<span key="c"><b style={{ color: PRIMARY }}>{cEntry.query || cEntry.code}</b> ({cEntry.name.toLowerCase()})</span>)
  if (product) {
    crumbs.push(<span key="p">{product.label}</span>)
    product.levels.forEach(lv => {
      const it = lv.items.find(i => i.key === sel[lv.key])
      if (it) crumbs.push(<span key={lv.key}>«{it.label}{it.measure && cm ? ` ${cm} см` : ''}»</span>)
    })
  }

  if (!mounted) return null

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,16,.55)', zIndex: 100000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', width: '100%', maxWidth: 432, maxHeight: '94vh', borderRadius: '18px 18px 0 0', display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 40px rgba(0,0,0,.3)' }}>
        {/* Шапка */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #f1efec', flexShrink: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>📖 Каталог</div>
          <button onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: '#f1efec', width: 32, height: 32, borderRadius: '50%', fontSize: 16, cursor: 'pointer', color: '#8a847c' }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 15 }}>
          {/* ЦВЕТ — 14 кругов */}
          <div>
            <div style={LBL}>ЦВЕТ</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' }}>
              {RAL_COLORS.map(c => {
                const on = color === c.code
                return (
                  <button key={c.code} onClick={() => pickColor(c.code)} title={`${c.query || c.code} · ${c.name}`}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', width: 40 }}>
                    <span style={{ width: on ? 38 : 28, height: on ? 38 : 28, borderRadius: '50%', background: c.bg || c.hex, boxShadow: on ? `${GLOW}, inset 0 0 0 2px rgba(0,0,0,.12)` : 'inset 0 0 0 1.5px rgba(0,0,0,.14)', transition: 'all .12s' }} />
                    <span style={{ fontSize: 9.5, fontWeight: on ? 800 : 500, color: on ? PRIMARY : '#a39c92', textAlign: 'center', lineHeight: 1.1 }}>{c.code === 'decor' ? 'дерево' : c.code}</span>
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

          {/* УРОВНИ выбранного товара */}
          {product?.levels.map(lv => (
            <div key={lv.key}>
              <div style={LBL}>{lv.label.toUpperCase()}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {lv.items.map(it => <button key={it.key} onClick={() => pickItem(lv.key, it.key, !!it.measure)} style={pill(sel[lv.key] === it.key)}>{it.label}</button>)}
              </div>
            </div>
          ))}

          {/* Изделие · см — ввод длины (уходит словом «№ {cm}») */}
          {measureSelected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: '#8a847c', fontWeight: 600 }}>Длина:</span>
              <input value={cm} onChange={e => { setManual(false); setCm(e.target.value.replace(/\D/g, '').slice(0, 4)) }} inputMode="numeric" placeholder="см"
                style={{ width: 90, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e6e2dc', fontSize: 14, fontFamily: 'inherit', outline: 'none', textAlign: 'center' }} />
              <span style={{ fontSize: 13, color: '#8a847c' }}>см</span>
            </div>
          )}

          {/* Строка поиска (собрана чипами, редактируемая) */}
          <div>
            <div style={LBL}>ПОИСК</div>
            <input value={query} onChange={e => { setManual(true); setQuery(e.target.value) }} placeholder="Слова поиска (можно править вручную)"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${query ? PRIMARY : '#e6e2dc'}`, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            {crumbs.length > 0 && (
              <div style={{ fontSize: 12, color: '#8a847c', marginTop: 7, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                <span style={{ fontWeight: 700 }}>Поисковые слова:</span>
                {crumbs.map((c, i) => <span key={i} style={{ display: 'inline-flex', gap: 4 }}>{i > 0 && <span style={{ color: '#cfc9c0' }}>+</span>}{c}</span>)}
              </div>
            )}
          </div>

          {/* РЕЗУЛЬТАТЫ */}
          {query.trim() && (
            <div>
              <div style={LBL}>НАЙДЕНО В БАЗЕ{excludes.length ? ` · без ${excludes.join('/')}` : ''}</div>
              {loading
                ? <div style={{ fontSize: 13, color: '#8a847c', padding: '8px 0' }}>Поиск…</div>
                : shown.length > 0
                  ? <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {shown.map(h => (
                        <button key={h.id} onClick={() => setPad({ name1c: h.name, oral: h.name, unit: h.unit, digits: '' })}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', border: '1.5px solid #e6e2dc', background: '#fff', borderRadius: 9, padding: '9px 11px', cursor: 'pointer', fontFamily: 'inherit' }}>
                          <RalDot code={extractRal(h.name)} size={14} />
                          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
                          <span style={{ fontSize: 11, color: '#8a847c', background: '#f1efec', padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>{h.unit}</span>
                          <span style={{ color: PRIMARY, fontWeight: 800, flexShrink: 0 }}>+</span>
                        </button>
                      ))}
                    </div>
                  : <div style={{ fontSize: 13, color: '#8a847c', padding: '8px 0' }}>Не найдено в базе — можно добавить как есть ↓</div>
              }
              <button onClick={() => { const q = query.trim(); if (q) setPad({ name1c: '', oral: q, unit: 'шт', digits: '' }) }}
                style={{ marginTop: 8, width: '100%', border: '1.5px dashed #d8d3cc', background: 'none', borderRadius: 9, padding: '9px', cursor: 'pointer', fontSize: 13, color: '#4a4640', fontFamily: 'inherit', fontWeight: 600 }}>
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
