'use client'
import { useState, useEffect, useCallback } from 'react'
import { RalDot, extractRal } from '@/lib/ral'
import { useLiveData } from '@/lib/live'

interface Breakdown { client: string; saleCardId: string; qty: number }
interface Pos { name: string; qty: number; unit: string; supplier: string; status: string; breakdown: Breakdown[] }
interface Chain { id: string; status: string; createdAt: string; delivered: string | null; positions: Pos[] }

const PURPLE = '#7a3aaa'

export default function ProcurementReport() {
  const [rows, setRows] = useState<Chain[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/procurement/report')
      setRows(r.ok ? await r.json() : [])
    } catch { setRows([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useLiveData('orders', load, [])

  return (
    <div className="anim-fade">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 20 }}>🛒 Закуп-отчёт</div>
        <button onClick={load} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #e6e2dc', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>⟳ Обновить</button>
      </div>
      <div style={{ fontSize: 13, color: '#5f5952', marginBottom: 16 }}>
        Цепочка: поставщик → Центр-Склад → раскладка по заказчикам. Связь фиксируется при создании закупа из «Автозакупа».
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#5f5952' }}>Загрузка…</div>
        : rows.length === 0
        ? <div style={{ textAlign: 'center', padding: 40, color: '#5f5952', fontSize: 14 }}>Закупов пока нет</div>
        : rows.map(c => (
          <div key={c.id} style={{ background: '#fff', borderRadius: 14, marginBottom: 14, boxShadow: '0 0 0 1.5px #e3d4f0', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#faf7fd', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 13, color: PURPLE }}>{c.id}</span>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: c.status === 'Доставлено' ? '#e8f5ee' : '#f3eeff', color: c.status === 'Доставлено' ? '#2e8a5e' : PURPLE }}>{c.status}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#837c72' }}>{new Date(c.createdAt).toLocaleDateString('ru-RU')}</span>
            </div>
            <div style={{ padding: '10px 16px 14px' }}>
              {c.positions.map((p, i) => {
                const distributed = p.breakdown.reduce((s, b) => s + (b.qty || 0), 0)
                return (
                  <div key={i} style={{ padding: '10px 0', borderTop: i ? '1px solid #f4f0f8' : 'none' }}>
                    {/* Поставщик → Центр-Склад */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, background: '#f3eeff', color: PURPLE, padding: '2px 9px', borderRadius: 20, fontWeight: 700 }}>{p.supplier}</span>
                      <span style={{ color: '#837c72' }}>→</span>
                      <RalDot code={extractRal(p.name)} size={13} />
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
                      <span style={{ fontWeight: 800, fontSize: 14, color: PURPLE }}>{p.qty} {p.unit}</span>
                      <span style={{ fontSize: 11, color: '#837c72' }}>на Центр-Склад</span>
                    </div>
                    {/* Раскладка по заказчикам */}
                    {p.breakdown.length > 0 ? (
                      <div style={{ marginTop: 8, marginLeft: 14, borderLeft: '2px solid #e3d4f0', paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {p.breakdown.map((b, bi) => (
                          <div key={bi} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                            <span style={{ color: '#837c72' }}>└─</span>
                            <span style={{ flex: 1, fontWeight: 500 }}>{b.client}</span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#837c72' }}>{b.saleCardId}</span>
                            <span style={{ fontWeight: 700 }}>{b.qty} {p.unit}</span>
                          </div>
                        ))}
                        {distributed !== p.qty && (
                          <div style={{ fontSize: 12, color: distributed > p.qty ? '#b03020' : '#8a6f00', marginTop: 2 }}>
                            {distributed > p.qty ? '⚠ распределено больше закупа' : `Остаток на складе: ${p.qty - distributed} ${p.unit}`}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ marginTop: 6, marginLeft: 14, fontSize: 12, color: '#837c72' }}>Раскладка по заказчикам не зафиксирована</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
    </div>
  )
}
