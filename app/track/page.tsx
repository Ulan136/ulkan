// app/track/page.tsx
'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

interface TrackData {
  id: string
  from: string
  to: string
  status: string
  progress: number
  createdAt: string
  delivered: string | null
  positions: Array<{ name: string; qty: number; unit: string; status: string }>
  history: Array<{ action: string; time: string }>
}

const STATUS_HUE: Record<string, string> = {
  'В ожидании': '250', 'Новая заявка': '250',
  'Принят': '30', 'В обработке': '30', 'В работе': '30',
  'Готово к отгрузке': '70', 'В пути': '70',
  'Доставлено': '155', 'К учёту': '155', 'Бухгалтерия': '155', 'Архив': '260',
  'Отменён': '25',
}

function fmt(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function TrackContent() {
  const params = useSearchParams()
  const id = params.get('id')
  const [data, setData] = useState<TrackData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) { setError('ID заказа не указан'); return }
    fetch(`/api/track?id=${id}`)
      .then(r => r.ok ? r.json() : Promise.reject('Заказ не найден'))
      .then(setData)
      .catch(() => setError('Заказ не найден'))
  }, [id])

  const hue = data ? (STATUS_HUE[data.status] || '260') : '260'

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1efec', fontFamily: "'Golos Text', system-ui, sans-serif" }}>
      <div style={{ textAlign: 'center', color: '#8a847c' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: '#26231f' }}>Заказ не найден</div>
        <div>{error}</div>
      </div>
    </div>
  )

  if (!data) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1efec', fontFamily: "'Golos Text', system-ui, sans-serif" }}>
      <div style={{ color: '#8a847c' }}>Загрузка…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f1efec', fontFamily: "'Golos Text', system-ui, sans-serif", padding: '32px 16px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'oklch(0.62 0.17 30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 16 }}>U</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>U-Kan · Трекинг</div>
        </div>

        {/* Main card */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e6e2dc', padding: 24, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 20, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-.3px' }}>{data.id}</div>
              <div style={{ fontSize: 13, color: '#8a847c', marginTop: 4 }}>{data.from} → {data.to || '—'}</div>
            </div>
            <span style={{ fontSize: 12, padding: '3px 12px', borderRadius: 20, fontWeight: 600, color: `oklch(0.5 0.12 ${hue})`, background: `oklch(0.95 0.05 ${hue})` }}>
              {data.status}
            </span>
          </div>

          {/* Progress */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 8 }}>
              <span style={{ fontWeight: 600 }}>Прогресс</span>
              <span style={{ color: '#8a847c', fontFamily: 'JetBrains Mono, monospace' }}>{data.progress}%</span>
            </div>
            <div style={{ height: 8, background: '#ece8e2', borderRadius: 8 }}>
              <div style={{ width: `${data.progress}%`, height: '100%', borderRadius: 8, background: data.progress >= 100 ? 'oklch(0.6 0.13 155)' : data.progress >= 60 ? 'oklch(0.7 0.14 70)' : 'oklch(0.62 0.17 30)', transition: 'width .6s' }} />
            </div>
          </div>

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12.5 }}>
            <div>
              <div style={{ color: '#a39c92', marginBottom: 2 }}>Создан</div>
              <div style={{ fontWeight: 500 }}>{fmt(data.createdAt)}</div>
            </div>
            <div>
              <div style={{ color: '#a39c92', marginBottom: 2 }}>Доставлен</div>
              <div style={{ fontWeight: 500, color: data.delivered ? 'oklch(0.5 0.12 155)' : '#a39c92' }}>{data.delivered ? fmt(data.delivered) : 'Ожидается'}</div>
            </div>
          </div>
        </div>

        {/* Positions */}
        {data.positions.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e6e2dc', padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Позиции</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.positions.map((p, i) => {
                const ph = STATUS_HUE[p.status] || '260'
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#faf8f6', borderRadius: 9, border: '1px solid #ece8e2' }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{p.name || '—'}</div>
                      <div style={{ fontSize: 12, color: '#8a847c', marginTop: 2 }}>{p.qty} {p.unit}</div>
                    </div>
                    <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, fontWeight: 600, color: `oklch(0.5 0.12 ${ph})`, background: `oklch(0.95 0.05 ${ph})`, whiteSpace: 'nowrap' }}>
                      {p.status}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* History */}
        {data.history.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e6e2dc', padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>История</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {data.history.map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid #f1ede7' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'oklch(0.62 0.17 30)', marginTop: 5, flex: 'none' }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{h.action}</span>
                  <span style={{ fontSize: 11.5, color: '#b8b1a6', whiteSpace: 'nowrap' }}>{fmt(h.time)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TrackPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1efec' }}>Загрузка…</div>}>
      <TrackContent />
    </Suspense>
  )
}
