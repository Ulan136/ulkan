'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

interface NomItem {
  id: string
  name: string
  unit: string
  cat: string
}

interface Props {
  value: string
  onChange: (name: string, unit: string) => void
  placeholder?: string
  style?: React.CSSProperties
  disabled?: boolean
}

export default function NomSearch({ value, onChange, placeholder = 'Поиск номенклатуры...', style, disabled }: Props) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<NomItem[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Синхронизируем если value изменился снаружи
  useEffect(() => {
    if (value !== query) { setQuery(value); setSelected(!!value) }
  }, [value])

  // Клик вне — закрыть
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Debounce поиск
  function handleInput(val: string) {
    setQuery(val)
    setSelected(false)
    onChange(val, '')
    setOpen(true)
    if (timer.current) clearTimeout(timer.current)
    if (!val.trim()) { setResults([]); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/nomenclature?q=${encodeURIComponent(val)}&limit=12`, { credentials: 'include' })
        const data = await res.json()
        setResults(Array.isArray(data) ? data : [])
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 220)
  }

  function handleSelect(item: NomItem) {
    setQuery(item.name)
    setSelected(true)
    setOpen(false)
    setResults([])
    onChange(item.name, item.unit)
  }

  function handleClear() {
    setQuery('')
    setSelected(false)
    onChange('', '')
    setResults([])
  }

  const inpStyle: React.CSSProperties = {
    width: '100%', padding: '8px 32px 8px 10px', borderRadius: 7, fontSize: 13,
    border: `1.5px solid ${selected ? '#d4613a' : '#e6e2dc'}`,
    background: selected ? '#fff8f5' : '#fff',
    outline: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box',
    ...style,
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <input
          style={inpStyle}
          value={query}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => { if (query && !selected) setOpen(true) }}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
        />
        {/* Иконка */}
        <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: selected ? '#d4613a' : '#b8b1a6', cursor: selected ? 'pointer' : 'default' }}
          onClick={selected ? handleClear : undefined}>
          {loading ? '⟳' : selected ? '✓' : '🔍'}
        </span>
      </div>

      {/* Дропдаун */}
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 500, background: '#fff', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,.14)', border: '1.5px solid #e6e2dc', maxHeight: 280, overflowY: 'auto' }}>
          {results.map((item, i) => (
            <div
              key={item.id}
              onMouseDown={() => handleSelect(item)}
              style={{ padding: '9px 14px', cursor: 'pointer', borderBottom: i < results.length - 1 ? '1px solid #f1efec' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#fff8f5')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {/* Подсветка совпадения */}
                  {highlightMatch(item.name, query)}
                </div>
                {item.cat && <div style={{ fontSize: 11, color: '#8a847c', marginTop: 1 }}>{item.cat}</div>}
              </div>
              <span style={{ fontSize: 11, color: '#8a847c', flexShrink: 0, background: '#f1efec', padding: '1px 7px', borderRadius: 20 }}>{item.unit}</span>
            </div>
          ))}
        </div>
      )}

      {/* Нет результатов */}
      {open && !loading && query.length >= 2 && results.length === 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 500, background: '#fff', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,.14)', border: '1.5px solid #e6e2dc', padding: '12px 14px', fontSize: 13, color: '#8a847c' }}>
          Не найдено — введите своё название
        </div>
      )}
    </div>
  )
}

// Подсветка совпадающей части
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ background: '#fff0ea', color: '#d4613a', borderRadius: 3, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  )
}
