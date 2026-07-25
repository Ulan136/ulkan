'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CATALOG_CATEGORIES } from '@/lib/nomCatalog'
import { overlayFor, producersFor } from '@/lib/nomTree'
import { RAL_COLORS, RAL_BY_CODE, RalDot, extractRal } from '@/lib/ral'

const PRIMARY = '#d4613a'
const GLOW = '0 0 0 4px rgba(212,97,58,.25)'

export interface PickedPos { name1c: string; oral: string; qty: number; unit: string }
interface NomHit { id: string; name: string; unit: string }
interface NomFull { id: string; name: string; unit: string; group: string; cat: string; subgroup: string }

const NOCOLOR = '__none__' // спец-чип «нет цвета»: только позиции без цвета в имени

// Нормализация как на экране «Номенклатура»: trim + нижний регистр + ё→е.
const norm = (s: string) => (s || '').trim().toLowerCase().replace(/ё/g, 'е')

export default function NomPicker({ onPick, onClose }: {
  onPick: (items: PickedPos[]) => void
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [allItems, setAllItems] = useState<NomFull[]>([]) // вся номенклатура (как экран)
  const [loaded, setLoaded] = useState(false)
  const [color, setColor] = useState('')
  const [catKey, setCatKey] = useState('')           // выбранная категория (плоский список из 4)
  const [producerKey, setProducerKey] = useState('') // Евробрус: фильтр по subgroup
  const [sel, setSel] = useState<Record<string, string>>({}) // надстройки-СЛОВА
  const [cm, setCm] = useState('')
  const [text, setText] = useState('')
  const [rows, setRows] = useState<PickedPos[]>([])

  const [pad, setPad] = useState<null | { name1c: string; oral: string; unit: string; digits: string }>(null)
  const padRef = useRef(pad); padRef.current = pad

  // Категория — плоский выбор из 4 (Водосток/Материалы/Евробрус/Комплектующие).
  // Просто быстрый фильтр по полям; ручной поиск не ограничен (находит всё).
  const activeCat = CATALOG_CATEGORIES.find(c => c.key === catKey)
  const groupName = activeCat?.group || ''
  const catName = activeCat?.cat || ''
  const overlays = overlayFor(catName || groupName)
  const producers = producersFor(catName)              // непусто только в «Евро брус»
  const selectedProducer = producers.find(p => p.key === producerKey)

  useEffect(() => {
    setMounted(true)
    // Грузим ВСЮ номенклатуру и фильтруем на клиенте нормализованно — та же
    // логика, что на экране «Номенклатура» (работает во всех папках: терпит
    // ё/е, регистр, пробелы и перепутанные поля group/cat).
    fetch('/api/nomenclature?all=1').then(r => r.ok ? r.json() : []).then((d: any[]) => {
      setAllItems(Array.isArray(d) ? d.map(x => ({ id: x.id, name: x.name || '', unit: x.unit || 'шт', group: x.group || '', cat: x.cat || '', subgroup: x.subgroup || '' })) : [])
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  // ── СЛОВА уточнения внутри выбранной папки: цвет + виды/толщина + текст ──
  const cEntry = color && color !== NOCOLOR ? RAL_BY_CODE[color] : undefined
  const colorLabel = cEntry ? (cEntry.code === 'decor' ? 'дерево' : cEntry.code) : '' // в ИМЯ — код
  const selItems = overlays.map(lv => lv.items.find(i => i.key === sel[lv.key])).filter(Boolean) as { key: string; label: string; terms?: string[]; measure?: boolean; exclude?: string[] }[]
  const measureItem = selItems.find(i => i.measure)

  // q — МЯГКИЙ каскад: только виды (вид/изделие) + ручной текст. Цвет и толщина
  // сюда НЕ идут — они жёсткие фильтры (ниже), иначе на OR-этапе становятся
  // необязательными и в выдаче всплывают все цвета/толщины.
  const words: string[] = []
  const excludes: string[] = []
  overlays.forEach(lv => {
    const it = lv.items.find(i => i.key === sel[lv.key])
    if (!it || lv.key === 'thick') return                       // толщину в q не кладём
    ;(it.terms ?? [it.label]).forEach(t => words.push(t))
    if (it.measure && cm) words.push(`№ ${cm}`)
    if (it.exclude) excludes.push(...it.exclude)
  })
  if (text.trim()) words.push(text.trim())
  const q = words.join(' ').trim()

  // ── ЖЁСТКИЕ фильтры (AND, целым токеном) ──
  // Цвет: код как максимальная группа цифр (7024, но не часть 7004/70245),
  // допускается суффикс-буква (7024М). Дерево — по словам дуб|дерево|3D.
  // «Нет цвета» — только позиции без определяемого цвета (extractRal === '').
  const decorRe = /(^|[^0-9a-zа-яё])(дуб|дерево|3d)/i
  const colorPass = (name: string): boolean => {
    if (!color) return true
    if (color === NOCOLOR) return extractRal(name) === ''
    if (color === 'decor') return decorRe.test(name)
    return new RegExp('(^|[^0-9])' + color + '(?![0-9])').test(name)
  }
  // Толщина: число целым токеном (0,4 — не 0,45); запятая/точка взаимозаменяемы.
  const thickItem = overlays.find(lv => lv.key === 'thick')?.items.find(i => i.key === sel['thick'])
  const thickRe: RegExp | null = thickItem
    ? new RegExp('(^|[^0-9])' + thickItem.label.replace(/[.,]/g, '[.,]') + '(?![0-9])')
    : null

  // Имя для «добавить как есть»: БЕЗ слова категории; изделие → «· N см»; цвет — кодом.
  function asIsName(): string {
    const parts: string[] = []
    if (selectedProducer) parts.push(selectedProducer.label)
    selItems.filter(i => !i.measure).forEach(i => parts.push(i.label))
    if (measureItem) parts.push(measureItem.terms?.[0] || 'Изделие')
    if (colorLabel) parts.push(colorLabel)
    if (text.trim()) parts.push(text.trim())
    let n = parts.join(' ').trim()
    if (measureItem && cm) n += ` · ${cm} см`
    return n
  }

  // ── Папка → выборка по ПОЛЯМ (нормализованно; ориентация group/cat терпима) ──
  const inGroup = (i: NomFull, g: string) => norm(i.group) === norm(g) || norm(i.cat) === norm(g)
  const inCat = (i: NomFull, g: string, c: string) =>
    (norm(i.group) === norm(g) && norm(i.cat) === norm(c)) ||
    (norm(i.group) === norm(c) && norm(i.cat) === norm(g))
  const countGroup = (g: string) => allItems.filter(i => inGroup(i, g)).length
  const countCat = (g: string, c: string) => allItems.filter(i => inCat(i, g, c)).length

  // База — записи выбранной папки/производителя (поля). Цвет/толщина/слова — поверх.
  let base = allItems
  if (catName) base = base.filter(i => inCat(i, groupName, catName))
  else if (groupName) base = base.filter(i => inGroup(i, groupName))
  if (selectedProducer) base = base.filter(i => norm(i.subgroup) === norm(selectedProducer.subgroup))

  const mustWords = words.flatMap(t => t.toLowerCase().split(/[^а-яёa-z0-9]+/i)).filter(w => w.length >= 1)
  const anySelection = !!(groupName || catName || producerKey || q || color || thickItem)
  const loading = !loaded
  const shown: NomHit[] = !anySelection ? [] : base
    .filter(i => !excludes.some(w => i.name.toLowerCase().includes(w.toLowerCase())))
    .filter(i => colorPass(i.name))                             // цвет / нет цвета — жёстко
    .filter(i => !thickRe || thickRe.test(i.name))              // толщина — жёстко
    .filter(i => mustWords.every(w => i.name.toLowerCase().includes(w))) // виды/текст
    .map(i => ({ i, score: mustWords.filter(w => i.name.toLowerCase().includes(w)).length }))
    .sort((a, b) => b.score - a.score || a.i.name.length - b.i.name.length)
    .map(x => ({ id: x.i.id, name: x.i.name, unit: x.i.unit }))

  // ── Чипы ──
  function pickColor(c: string) { setColor(prev => prev === c ? '' : c) }
  function pickCategory(key: string) { setCatKey(prev => prev === key ? '' : key); setProducerKey(''); setSel({}); setCm('') }
  const catCount = (c: { group: string; cat: string }) => c.cat ? countCat(c.group, c.cat) : countGroup(c.group)
  function pickProducer(k: string) { setProducerKey(prev => prev === k ? '' : k) }
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
  if (activeCat) crumbs.push(<span key="p" style={{ fontWeight: 700 }}>{activeCat.label}</span>)
  if (selectedProducer) crumbs.push(<span key="prod">{selectedProducer.label}</span>) // label, БЕЗ расшифровки
  selItems.forEach(it => crumbs.push(<span key={it.key}>«{it.measure ? (cm ? `Изделие · ${cm} см` : 'Изделие') : it.label}»</span>))
  if (cEntry) crumbs.push(<span key="c"><b style={{ color: PRIMARY }}>{colorLabel}</b> ({cEntry.name.toLowerCase()})</span>)
  else if (color === NOCOLOR) crumbs.push(<span key="c">без цвета</span>)
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
              {/* Нет цвета — только позиции без цвета (перечёркнутый круг) */}
              {(() => {
                const on = color === NOCOLOR
                return (
                  <button key="nocolor" onClick={() => pickColor(NOCOLOR)} title="Без цвета"
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', width: 40 }}>
                    <span style={{ width: on ? 38 : 28, height: on ? 38 : 28, borderRadius: '50%', background: 'linear-gradient(45deg, transparent 45%, #c1121c 45%, #c1121c 55%, transparent 55%), #fff', boxShadow: on ? `${GLOW}, inset 0 0 0 2px rgba(0,0,0,.12)` : 'inset 0 0 0 1.5px rgba(0,0,0,.2)', transition: 'all .12s' }} />
                    <span style={{ fontSize: 9.5, fontWeight: on ? 800 : 500, color: on ? PRIMARY : '#a39c92', textAlign: 'center', lineHeight: 1.1 }}>нет</span>
                  </button>
                )
              })()}
            </div>
          </div>

          {/* КАТЕГОРИЯ — плоский выбор из 4 (быстрый фильтр; поиск снизу находит всё) */}
          <div>
            <div style={LBL}>КАТЕГОРИЯ</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CATALOG_CATEGORIES.map(c => (
                <button key={c.key} onClick={() => pickCategory(c.key)} style={pill(catKey === c.key)}>
                  {c.label}{loaded && <span style={cnt(catKey === c.key)}>{catCount(c)}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* ПРОИЗВОДИТЕЛЬ (только «Евро брус») — фильтр по полю subgroup, ВЫШЕ толщины.
              Расшифровка под кнопкой — чисто декоративная, в поиск/имя не идёт. */}
          {producers.length > 0 && (
            <div>
              <div style={LBL}>ПРОИЗВОДИТЕЛЬ</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {producers.map(p => {
                  const on = producerKey === p.key
                  return (
                    <button key={p.key} onClick={() => pickProducer(p.key)}
                      style={{ ...pill(on), flexDirection: 'column', alignItems: 'center', gap: 1, padding: '6px 14px' }}>
                      <span style={{ fontWeight: on ? 800 : 700 }}>{p.label}</span>
                      <span style={{ fontSize: 9, fontWeight: 500, color: on ? 'rgba(255,255,255,.75)' : '#a39c92' }}>{p.hint}</span>
                    </button>
                  )
                })}
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
          {anySelection && (
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
              {asIsName() && (
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
