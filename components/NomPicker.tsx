'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { catalogGroups, catalogCats } from '@/lib/nomCatalog'
import { overlayFor } from '@/lib/nomTree'
import { RAL_COLORS, RAL_BY_CODE, RalDot, extractRal } from '@/lib/ral'

const PRIMARY = '#d4613a'
const GLOW = '0 0 0 4px rgba(212,97,58,.25)'

export interface PickedPos { name1c: string; oral: string; qty: number; unit: string }
interface NomHit { id: string; name: string; unit: string }
interface Counts { g: Record<string, number>; c: Record<string, number> }

export default function NomPicker({ onPick, onClose }: {
  onPick: (items: PickedPos[]) => void
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [counts, setCounts] = useState<Counts>({ g: {}, c: {} })
  const [color, setColor] = useState('')
  const [groupName, setGroupName] = useState('')     // поле group (корень пути)
  const [catName, setCatName] = useState('')         // поле cat (подпапка пути)
  const [sel, setSel] = useState<Record<string, string>>({}) // надстройки-СЛОВА
  const [cm, setCm] = useState('')
  const [text, setText] = useState('')
  const [results, setResults] = useState<NomHit[]>([])
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<PickedPos[]>([])

  const [pad, setPad] = useState<null | { name1c: string; oral: string; unit: string; digits: string }>(null)
  const padRef = useRef(pad); padRef.current = pad

  // Жёсткий путь по полям базы — ТОЛЬКО до уровня папки: group → cat. subgroup
  // в фильтре Каталога НЕ участвует (цвет/вид/толщина — слова, см. ниже).
  const groups = catalogGroups()
  const cats = groupName ? catalogCats(groupName) : []
  const overlays = overlayFor(catName || groupName)

  useEffect(() => {
    setMounted(true)
    fetch('/api/nomenclature/tree').then(r => r.ok ? r.json() : []).then((tree: any[]) => {
      const g: Record<string, number> = {}, c: Record<string, number> = {}
      ;(Array.isArray(tree) ? tree : []).forEach(gr => {
        g[gr.name] = gr.count
        ;(gr.cats || []).forEach((ct: any) => { c[`${gr.name}|${ct.name}`] = ct.count })
      })
      setCounts({ g, c })
    }).catch(() => {})
  }, [])

  // ── СЛОВА уточнения внутри выбранной папки: цвет + виды/толщина + текст ──
  const cEntry = color ? RAL_BY_CODE[color] : undefined
  const colorLabel = cEntry ? (cEntry.code === 'decor' ? 'дерево' : cEntry.code) : '' // в ИМЯ — код
  const selItems = overlays.map(lv => lv.items.find(i => i.key === sel[lv.key])).filter(Boolean) as { key: string; label: string; terms?: string[]; measure?: boolean; exclude?: string[] }[]
  const measureItem = selItems.find(i => i.measure)

  const words: string[] = []
  if (cEntry) words.push(cEntry.query || cEntry.code)           // цвет — русским словом
  const excludes: string[] = []
  selItems.forEach(it => {
    ;(it.terms ?? [it.label]).forEach(t => words.push(t))
    if (it.measure && cm) words.push(`№ ${cm}`)
    if (it.exclude) excludes.push(...it.exclude)
  })
  if (text.trim()) words.push(text.trim())
  const q = words.join(' ').trim()

  // Имя для «добавить как есть»: БЕЗ слова категории; изделие → «· N см»; цвет — кодом.
  function asIsName(): string {
    const parts: string[] = []
    selItems.filter(i => !i.measure).forEach(i => parts.push(i.label))
    if (measureItem) parts.push(measureItem.terms?.[0] || 'Изделие')
    if (colorLabel) parts.push(colorLabel)
    if (text.trim()) parts.push(text.trim())
    let n = parts.join(' ').trim()
    if (measureItem && cm) n += ` · ${cm} см`
    return n || q
  }

  // ── Поиск: фильтр по полям (group/cat) + слова. Каскад не трогаем ──
  useEffect(() => {
    if (!groupName && !catName && !q) { setResults([]); setLoading(false); return }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams()
        if (groupName) params.set('group', groupName)
        if (catName) params.set('cat', catName)
        if (q) params.set('q', q)
        params.set('limit', '30')
        const res = await fetch(`/api/nomenclature?${params}`)
        const data = await res.json()
        setResults(Array.isArray(data) ? data.map((d: any) => ({ id: d.id, name: d.name, unit: d.unit || 'шт' })) : [])
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, groupName, catName])

  const qWords = q.toLowerCase().split(/[^а-яёa-z0-9]+/i).filter(w => w.length >= 2)
  const shown = results
    .filter(r => !excludes.some(w => r.name.toLowerCase().includes(w.toLowerCase())))
    .map(r => ({ r, score: qWords.filter(w => r.name.toLowerCase().includes(w)).length }))
    .sort((a, b) => b.score - a.score || a.r.name.length - b.r.name.length)
    .map(x => x.r)

  // ── Чипы ──
  function pickColor(c: string) { setColor(prev => prev === c ? '' : c) }
  function pickGroup(name: string) { setGroupName(prev => prev === name ? '' : name); setCatName(''); setSel({}); setCm('') }
  function pickCat(name: string) { setCatName(prev => prev === name ? '' : name); setSel({}); setCm('') }
  function pickItem(levelKey: string, itemKey: string, isMeasure: boolean) {
    setSel(prev => { const next = { ...prev }; if (next[levelKey] === itemKey) delete next[levelKey]; else next[levelKey] = itemKey; return next })
    if (!isMeasure) setCm('')
  }

  // ── Количество ──
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

  // Строка «Фильтр»: путь папки (group ▸ cat) + слова (цвет кодом, виды, текст).
  const crumbs: React.ReactNode[] = []
  const path = [groupName, catName].filter(Boolean).join(' ▸ ')
  if (path) crumbs.push(<span key="p" style={{ fontWeight: 700 }}>{path}</span>)
  if (cEntry) crumbs.push(<span key="c"><b style={{ color: PRIMARY }}>{colorLabel}</b> ({cEntry.name.toLowerCase()})</span>)
  selItems.forEach(it => crumbs.push(<span key={it.key}>«{it.measure ? (cm ? `Изделие · ${cm} см` : 'Изделие') : it.label}»</span>))
  if (text.trim()) crumbs.push(<span key="t">«{text.trim()}»</span>)

  if (!mounted) return null

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,16,.55)', zIndex: 100000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', width: '100%', maxWidth: 432, maxHeight: '94vh', borderRadius: '18px 18px 0 0', display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 40px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #f1efec', flexShrink: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>📖 Каталог</div>
          <button onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: '#f1efec', width: 32, height: 32, borderRadius: '50%', fontSize: 16, cursor: 'pointer', color: '#8a847c' }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 15 }}>
          {/* ЦВЕТ — 14 кругов (это слово поиска, не путь) */}
          <div>
            <div style={LBL}>ЦВЕТ</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' }}>
              {RAL_COLORS.map(c => {
                const on = color === c.code
                return (
                  <button key={c.code} onClick={() => pickColor(c.code)} title={`${c.code} · ${c.name}`}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', width: 40 }}>
                    <span style={{ width: on ? 38 : 28, height: on ? 38 : 28, borderRadius: '50%', background: c.bg || c.hex, boxShadow: on ? `${GLOW}, inset 0 0 0 2px rgba(0,0,0,.12)` : 'inset 0 0 0 1.5px rgba(0,0,0,.14)', transition: 'all .12s' }} />
                    <span style={{ fontSize: 9.5, fontWeight: on ? 800 : 500, color: on ? PRIMARY : '#a39c92', textAlign: 'center', lineHeight: 1.1 }}>{c.code === 'decor' ? 'дерево' : c.code}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ТОВАР — корневые группы модели */}
          <div>
            <div style={LBL}>ТОВАР</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {groups.map(g => <button key={g} onClick={() => pickGroup(g)} style={pill(groupName === g)}>{g}{counts.g[g] != null && <span style={cnt(groupName === g)}>{counts.g[g]}</span>}</button>)}
            </div>
          </div>

          {/* ПАПКА (cat) — глубже путь не идёт */}
          {cats.length > 0 && (
            <div>
              <div style={LBL}>ПАПКА</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {cats.map(c => <button key={c} onClick={() => pickCat(c)} style={pill(catName === c)}>{c}{counts.c[`${groupName}|${c}`] != null && <span style={cnt(catName === c)}>{counts.c[`${groupName}|${c}`]}</span>}</button>)}
              </div>
            </div>
          )}

          {/* НАШИ УРОВНИ-СЛОВА внутри папки (вид/толщина) */}
          {overlays.map(lv => (
            <div key={lv.key}>
              <div style={LBL}>{lv.label.toUpperCase()}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {lv.items.map(it => <button key={it.key} onClick={() => pickItem(lv.key, it.key, !!it.measure)} style={pill(sel[lv.key] === it.key)}>{it.label}</button>)}
              </div>
            </div>
          ))}

          {measureItem && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: '#8a847c', fontWeight: 600 }}>Длина:</span>
              <input value={cm} onChange={e => setCm(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="см"
                style={{ width: 90, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e6e2dc', fontSize: 14, fontFamily: 'inherit', outline: 'none', textAlign: 'center' }} />
              <span style={{ fontSize: 13, color: '#8a847c' }}>см</span>
            </div>
          )}

          {/* Ручное уточнение словами */}
          <div>
            <div style={LBL}>УТОЧНИТЬ СЛОВАМИ</div>
            <input value={text} onChange={e => setText(e.target.value)} placeholder="доп. слова поиска…"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${text ? PRIMARY : '#e6e2dc'}`, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            {crumbs.length > 0 && (
              <div style={{ fontSize: 12, color: '#8a847c', marginTop: 7, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                <span style={{ fontWeight: 700 }}>Фильтр:</span>
                {crumbs.map((c, i) => <span key={i} style={{ display: 'inline-flex', gap: 4 }}>{i > 0 && <span style={{ color: '#cfc9c0' }}>+</span>}{c}</span>)}
              </div>
            )}
          </div>

          {/* РЕЗУЛЬТАТЫ */}
          {(groupName || catName || q) && (
            <div>
              <div style={LBL}>НАЙДЕНО В БАЗЕ</div>
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
                  : <div style={{ fontSize: 13, color: '#8a847c', padding: '8px 0' }}>Не найдено в папке — можно добавить как есть ↓</div>
              }
              {(q || selItems.length > 0) && (
                <button onClick={() => { const n = asIsName(); if (n) setPad({ name1c: '', oral: n, unit: 'шт', digits: '' }) }}
                  style={{ marginTop: 8, width: '100%', border: '1.5px dashed #d8d3cc', background: 'none', borderRadius: 9, padding: '9px', cursor: 'pointer', fontSize: 13, color: '#4a4640', fontFamily: 'inherit', fontWeight: 600 }}>
                  ＋ Добавить как есть: «{asIsName()}»
                </button>
              )}
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
  return { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 22, border: 'none', fontSize: 13, fontWeight: on ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', background: on ? PRIMARY : '#f1efec', color: on ? '#fff' : '#4a4640', boxShadow: on ? GLOW : 'none', transition: 'all .12s' }
}
function cnt(on: boolean): React.CSSProperties {
  return { fontSize: 10, fontWeight: 700, color: on ? 'rgba(255,255,255,.8)' : '#a39c92' }
}
