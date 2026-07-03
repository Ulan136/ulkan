'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface NomItem { id: string; name: string; unit: string; cat: string; group: string; subgroup: string }
interface Props {
  value: string
  onChange: (name: string, unit: string) => void
  placeholder?: string
  style?: React.CSSProperties
  disabled?: boolean
}

const GROUPS = ['Водосток', 'Готовая продукция', 'Материалы', 'Товары', 'Услуги']

export default function NomSearch({ value, onChange, placeholder = 'Поиск...', style, disabled }: Props) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<NomItem[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(false)
  const [selGroup, setSelGroup] = useState('')
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 })
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { if (value !== query) { setQuery(value); setSelected(!!value) } }, [value])

  useEffect(() => {
    function handler(e: MouseEvent) {
      const drop = document.getElementById('nom-drop')
      if (inputRef.current && !inputRef.current.contains(e.target as Node) && drop && !drop.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function calcPos() {
    if (!inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow > 300 ? rect.bottom + window.scrollY + 4 : rect.top + window.scrollY - 304
    setDropPos({ top, left: rect.left + window.scrollX, width: Math.max(rect.width, 320) })
  }

  const doSearch = useCallback(async (q: string, group: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (group) params.set('group', group)
      params.set('limit', '20')
      const res = await fetch(`/api/nomenclature?${params}`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
    } catch { setResults([]) }
    finally { setLoading(false) }
  }, [])

  function handleInput(val: string) {
    setQuery(val); setSelected(false); onChange(val, ''); calcPos(); setOpen(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => doSearch(val, selGroup), 250)
  }

  function handleFocus() {
    calcPos(); setOpen(true)
    if (query || selGroup) doSearch(query, selGroup)
  }

  function handleGroupClick(g: string) {
    const next = selGroup === g ? '' : g
    setSelGroup(next)
    doSearch(query, next)
  }

  function handleSelect(item: NomItem) {
    setQuery(item.name); setSelected(true); setOpen(false); setResults([])
    onChange(item.name, item.unit)
  }

  function handleClear() {
    setQuery(''); setSelected(false); setSelGroup(''); onChange('', ''); setResults([])
  }

  const inpStyle: React.CSSProperties = {
    width: '100%', padding: '7px 28px 7px 10px', borderRadius: 7, fontSize: 13,
    border: `1.5px solid ${selected ? '#d4613a' : open ? '#d4613a' : '#e6e2dc'}`,
    background: selected ? '#fff8f5' : '#fff',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', ...style,
  }

  const dropdown = open && mounted ? createPortal(
    <div id="nom-drop" style={{ position: 'absolute', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 99999, background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,.2)', border: '1.5px solid #e6e2dc', overflow: 'hidden', maxHeight: 380 }}>

      {/* Группы сверху — горизонтальная лента */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1efec', display: 'flex', gap: 6, flexWrap: 'wrap', background: '#f8f6f3' }}>
        <button
          onMouseDown={() => handleGroupClick('')}
          style={{ padding: '4px 10px', borderRadius: 20, border: 'none', fontSize: 11, fontWeight: selGroup === '' ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit', background: selGroup === '' ? '#d4613a' : '#fff', color: selGroup === '' ? '#fff' : '#8a847c', boxShadow: '0 0 0 1px #e6e2dc' }}
        >Все</button>
        {GROUPS.map(g => (
          <button key={g}
            onMouseDown={() => handleGroupClick(g)}
            style={{ padding: '4px 10px', borderRadius: 20, border: 'none', fontSize: 11, fontWeight: selGroup === g ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit', background: selGroup === g ? '#d4613a' : '#fff', color: selGroup === g ? '#fff' : '#8a847c', boxShadow: '0 0 0 1px #e6e2dc' }}
          >{g}</button>
        ))}
      </div>

      {/* Результаты */}
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {loading && <div style={{ padding: '14px', fontSize: 13, color: '#8a847c', textAlign: 'center' }}>Поиск...</div>}
        {!loading && !query && !selGroup && (
          <div style={{ padding: '14px', fontSize: 13, color: '#8a847c', textAlign: 'center' }}>Выберите группу или начните вводить</div>
        )}
        {!loading && results.length === 0 && (query || selGroup) && (
          <div style={{ padding: '14px', fontSize: 13, color: '#8a847c', textAlign: 'center' }}>Не найдено — введите своё название</div>
        )}
        {results.map((item, i) => (
          <div key={item.id}
            onMouseDown={e => { e.preventDefault(); handleSelect(item) }}
            style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: i < results.length - 1 ? '1px solid #f1efec' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
            onMouseEnter={e => (e.currentTarget.style.background = '#fff8f5')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {highlightMatch(item.name, query)}
              </div>
              {(item.group || item.cat) && (
                <div style={{ fontSize: 10, color: '#8a847c', marginTop: 2 }}>
                  {[item.group, item.cat, item.subgroup].filter(Boolean).join(' › ')}
                </div>
              )}
            </div>
            <span style={{ fontSize: 11, color: '#8a847c', background: '#f1efec', padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>{item.unit}</span>
          </div>
        ))}
      </div>
    </div>,
    document.body
  ) : null

  return (
    <>
      <div style={{ position: 'relative', width: '100%' }}>
        <input ref={inputRef} style={inpStyle} value={query}
          onChange={e => handleInput(e.target.value)}
          onFocus={handleFocus}
          placeholder={selGroup ? `Поиск в "${selGroup}"...` : placeholder}
          disabled={disabled} autoComplete="off" />
        <span onClick={selected ? handleClear : () => { calcPos(); setOpen(true) }}
          style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: selected ? '#d4613a' : '#b8b1a6', cursor: 'pointer' }}>
          {loading ? '⟳' : selected ? '✓' : '🔍'}
        </span>
      </div>
      {dropdown}
    </>
  )
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  const words = query.trim().split(/\s+/).filter(w => w.length >= 1)
  const parts: Array<{ text: string; hl: boolean }> = [{ text, hl: false }]
  words.forEach(word => {
    const next: typeof parts = []
    parts.forEach(p => {
      if (p.hl) { next.push(p); return }
      const idx = p.text.toLowerCase().indexOf(word.toLowerCase())
      if (idx === -1) { next.push(p); return }
      if (idx > 0) next.push({ text: p.text.slice(0, idx), hl: false })
      next.push({ text: p.text.slice(idx, idx + word.length), hl: true })
      if (idx + word.length < p.text.length) next.push({ text: p.text.slice(idx + word.length), hl: false })
    })
    parts.splice(0, parts.length, ...next)
  })
  return <>{parts.map((p, i) => p.hl ? <span key={i} style={{ background: '#fff0ea', color: '#d4613a', borderRadius: 2 }}>{p.text}</span> : <span key={i}>{p.text}</span>)}</>
}
