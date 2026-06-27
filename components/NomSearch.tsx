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

export default function NomSearch({ value, onChange, placeholder = 'Поиск...', style, disabled }: Props) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<NomItem[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(false)
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
    setDropPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width })
  }

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/nomenclature?q=${encodeURIComponent(q)}&limit=15`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
    } catch { setResults([]) }
    finally { setLoading(false) }
  }, [])

  function handleInput(val: string) {
    setQuery(val); setSelected(false); onChange(val, ''); calcPos(); setOpen(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => doSearch(val), 250)
  }

  function handleFocus() { calcPos(); if (!open) { setOpen(true); if (query) doSearch(query) } }

  function handleSelect(item: NomItem) {
    setQuery(item.name); setSelected(true); setOpen(false)
    onChange(item.name, item.unit)
  }

  const inpStyle: React.CSSProperties = {
    width: '100%', padding: '7px 28px 7px 10px', borderRadius: 7, fontSize: 13,
    border: `1.5px solid ${selected ? '#d4613a' : open ? '#d4613a' : '#e6e2dc'}`,
    background: selected ? '#fff8f5' : '#fff',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', ...style,
  }

  const showDrop = open && mounted

  const dropdown = showDrop ? createPortal(
    <div id="nom-drop" style={{ position: 'absolute', top: dropPos.top, left: dropPos.left, width: Math.max(dropPos.width, 320), zIndex: 99999, background: '#fff', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.18)', border: '1.5px solid #e6e2dc', maxHeight: 320, overflowY: 'auto' }}>
      {loading && <div style={{ padding: '12px 14px', fontSize: 13, color: '#8a847c' }}>Поиск...</div>}
      {!loading && !query && <div style={{ padding: '12px 14px', fontSize: 13, color: '#8a847c' }}>Начните вводить название...</div>}
      {!loading && query && results.length === 0 && <div style={{ padding: '12px 14px', fontSize: 13, color: '#8a847c' }}>Не найдено — можно ввести своё</div>}
      {results.map((item, i) => (
        <div key={item.id}
          onMouseDown={e => { e.preventDefault(); handleSelect(item) }}
          style={{ padding: '9px 14px', cursor: 'pointer', borderBottom: i < results.length - 1 ? '1px solid #f1efec' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
          onMouseEnter={e => (e.currentTarget.style.background = '#fff8f5')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {highlightMatch(item.name, query)}
            </div>
            {(item.group || item.cat) && (
              <div style={{ fontSize: 10, color: '#8a847c', marginTop: 1 }}>
                {[item.group, item.cat, item.subgroup].filter(Boolean).join(' › ')}
              </div>
            )}
          </div>
          <span style={{ fontSize: 11, color: '#8a847c', background: '#f1efec', padding: '1px 7px', borderRadius: 20, flexShrink: 0 }}>{item.unit}</span>
        </div>
      ))}
    </div>,
    document.body
  ) : null

  return (
    <>
      <div style={{ position: 'relative', width: '100%' }}>
        <input ref={inputRef} style={inpStyle} value={query} onChange={e => handleInput(e.target.value)}
          onFocus={handleFocus} placeholder={placeholder} disabled={disabled} autoComplete="off" />
        <span onClick={() => { if (selected) { setQuery(''); setSelected(false); onChange('', '') } else { calcPos(); setOpen(true); if (query) doSearch(query) } }}
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
