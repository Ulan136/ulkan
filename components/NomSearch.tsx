'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

interface NomItem { id: string; name: string; unit: string; cat: string }

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
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (value !== query) { setQuery(value); setSelected(!!value) }
  }, [value])

  // Закрыть при клике вне
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        const drop = document.getElementById('nom-dropdown')
        if (drop && drop.contains(e.target as Node)) return
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Вычисляем позицию дропдауна
  function calcPos() {
    if (!inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    setDropPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width })
  }

  function handleInput(val: string) {
    setQuery(val)
    setSelected(false)
    onChange(val, '')
    calcPos()
    setOpen(true)
    if (timer.current) clearTimeout(timer.current)
    if (!val.trim()) { setResults([]); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/nomenclature?q=${encodeURIComponent(val)}&limit=12`)
        const data = await res.json()
        setResults(Array.isArray(data) ? data : [])
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 250)
  }

  function handleFocus() {
    calcPos()
    if (query && !selected) setOpen(true)
  }

  function handleSelect(item: NomItem) {
    setQuery(item.name)
    setSelected(true)
    setOpen(false)
    setResults([])
    onChange(item.name, item.unit)
  }

  const inpStyle: React.CSSProperties = {
    width: '100%', padding: '7px 28px 7px 10px', borderRadius: 7, fontSize: 13,
    border: `1.5px solid ${selected ? '#d4613a' : '#e6e2dc'}`,
    background: selected ? '#fff8f5' : '#fff',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
    ...style,
  }

  const showDrop = open && (results.length > 0 || (loading) || (query.length >= 2 && !loading && results.length === 0))

  return (
    <>
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          ref={inputRef}
          style={inpStyle}
          value={query}
          onChange={e => handleInput(e.target.value)}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
        />
        <span style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: selected ? '#d4613a' : '#b8b1a6', pointerEvents: selected ? 'auto' : 'none', cursor: selected ? 'pointer' : 'default' }}
          onClick={() => { if (selected) { setQuery(''); setSelected(false); onChange('', '') } }}>
          {loading ? '⟳' : selected ? '✓' : '🔍'}
        </span>
      </div>

      {/* Дропдаун через portal — position fixed, поверх всего */}
      {showDrop && typeof window !== 'undefined' && (() => {
        const el = (
          <div
            id="nom-dropdown"
            style={{
              position: 'fixed',
              top: dropPos.top,
              left: dropPos.left,
              width: Math.max(dropPos.width, 240),
              zIndex: 99999,
              background: '#fff',
              borderRadius: 10,
              boxShadow: '0 8px 32px rgba(0,0,0,.18)',
              border: '1.5px solid #e6e2dc',
              maxHeight: 280,
              overflowY: 'auto',
            }}
          >
            {loading && <div style={{ padding: '12px 14px', fontSize: 13, color: '#8a847c' }}>Поиск...</div>}
            {!loading && results.length === 0 && query.length >= 2 && (
              <div style={{ padding: '12px 14px', fontSize: 13, color: '#8a847c' }}>Не найдено — можно ввести своё</div>
            )}
            {results.map((item, i) => (
              <div
                key={item.id}
                onMouseDown={e => { e.preventDefault(); handleSelect(item) }}
                style={{ padding: '9px 14px', cursor: 'pointer', borderBottom: i < results.length - 1 ? '1px solid #f1efec' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: '#fff' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fff8f5')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {highlightMatch(item.name, query)}
                  </div>
                  {item.cat && <div style={{ fontSize: 10, color: '#8a847c' }}>{item.cat}</div>}
                </div>
                <span style={{ fontSize: 11, color: '#8a847c', background: '#f1efec', padding: '1px 7px', borderRadius: 20, flexShrink: 0 }}>{item.unit}</span>
              </div>
            ))}
          </div>
        )
        // Рендерим через createPortal если доступен document.body
        const { createPortal } = require('react-dom')
        return createPortal(el, document.body)
      })()}
    </>
  )
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  const words = query.trim().split(/\s+/).filter(w => w.length >= 1)
  if (words.length === 0) return text

  // Подсвечиваем каждое слово
  let result = text
  const parts: Array<{ text: string; highlight: boolean }> = [{ text, highlight: false }]

  words.forEach(word => {
    const newParts: Array<{ text: string; highlight: boolean }> = []
    parts.forEach(part => {
      if (part.highlight) { newParts.push(part); return }
      const idx = part.text.toLowerCase().indexOf(word.toLowerCase())
      if (idx === -1) { newParts.push(part); return }
      if (idx > 0) newParts.push({ text: part.text.slice(0, idx), highlight: false })
      newParts.push({ text: part.text.slice(idx, idx + word.length), highlight: true })
      if (idx + word.length < part.text.length) newParts.push({ text: part.text.slice(idx + word.length), highlight: false })
    })
    parts.length = 0
    parts.push(...newParts)
  })

  return (
    <>
      {parts.map((p, i) => p.highlight
        ? <span key={i} style={{ background: '#fff0ea', color: '#d4613a', borderRadius: 2, padding: '0 1px' }}>{p.text}</span>
        : <span key={i}>{p.text}</span>
      )}
    </>
  )
}
