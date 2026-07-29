'use client'
import { useState, useEffect, useCallback } from 'react'
import { RalDot, extractRal } from '@/lib/ral'
import { useLiveData } from '@/lib/live'

interface Breakdown { client: string; comment: string; saleCardId: string; qty: number }
interface Pos { name: string; qty: number; unit: string; supplier: string; status: string; breakdown: Breakdown[] }
interface Chain { id: string; status: string; createdAt: string; delivered: string | null; positions: Pos[] }

const PURPLE = '#7a3aaa'
const th: React.CSSProperties = { padding: '7px 10px', fontSize: 12, fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '8px 10px', fontSize: 13, verticalAlign: 'top', borderTop: '1px solid #f1efec' }

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 20 }}>🛒 Закуп-отчёт</div>
        <button onClick={load} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #e6e2dc', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>⟳ Обновить</button>
      </div>
      <div style={{ fontSize: 13, color: '#5f5952', marginBottom: 16 }}>
        Цепочка: <b style={{ color: PURPLE }}>Закуп</b> (поставщик · товар · сколько) → <b>Склад</b> (транзит) → <b style={{ color: '#2e8a5e' }}>Продажа</b> (заказчик · кол-во · коммент).
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#5f5952' }}>Загрузка…</div>
        : rows.length === 0
        ? <div style={{ textAlign: 'center', padding: 40, color: '#5f5952', fontSize: 14 }}>Закупов пока нет</div>
        : rows.map(c => (
          <div key={c.id} style={{ background: '#fff', borderRadius: 14, marginBottom: 16, boxShadow: '0 0 0 1.5px #e6e2dc', overflow: 'hidden' }}>
            {/* Шапка закупа */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#faf7fd', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 13, color: PURPLE }}>{c.id}</span>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: c.status === 'Доставлено' ? '#e8f5ee' : '#f3eeff', color: c.status === 'Доставлено' ? '#2e8a5e' : PURPLE }}>{c.status}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#837c72' }}>{new Date(c.createdAt).toLocaleDateString('ru-RU')}</span>
            </div>
            {/* Таблица с группами колонок */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead>
                  <tr>
                    <th colSpan={3} style={{ ...th, background: '#f3eeff', color: PURPLE, textAlign: 'center', borderRight: '2px solid #e6e2dc' }}>ЗАКУП</th>
                    <th style={{ ...th, background: '#eef2ff', color: '#4a5aaa', textAlign: 'center', borderRight: '2px solid #e6e2dc' }}>СКЛАД</th>
                    <th colSpan={3} style={{ ...th, background: '#e8f5ee', color: '#2e8a5e', textAlign: 'center' }}>ПРОДАЖА</th>
                  </tr>
                  <tr style={{ background: '#faf9f7' }}>
                    <th style={th}>Поставщик</th>
                    <th style={th}>Наименование</th>
                    <th style={{ ...th, textAlign: 'right' }}>Куплено</th>
                    <th style={{ ...th, textAlign: 'center', borderLeft: '2px solid #e6e2dc', borderRight: '2px solid #e6e2dc' }}>На складе</th>
                    <th style={th}>Заказчик</th>
                    <th style={{ ...th, textAlign: 'right' }}>Кол-во</th>
                    <th style={th}>Коммент</th>
                  </tr>
                </thead>
                <tbody>
                  {c.positions.flatMap((p, pi) => {
                    const distributed = p.breakdown.reduce((s, b) => s + (b.qty || 0), 0)
                    const remain = p.qty - distributed
                    const bd = p.breakdown.length ? p.breakdown : [null]
                    return bd.map((b, bi) => (
                      <tr key={`${pi}-${bi}`}>
                        {bi === 0 && (
                          <>
                            <td style={{ ...td, borderTop: pi ? '2px solid #ece7e0' : td.borderTop }} rowSpan={bd.length}>
                              <span style={{ fontSize: 12, background: '#f3eeff', color: PURPLE, padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>{p.supplier}</span>
                            </td>
                            <td style={{ ...td, borderTop: pi ? '2px solid #ece7e0' : td.borderTop, fontWeight: 600 }} rowSpan={bd.length}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><RalDot code={extractRal(p.name)} size={12} />{p.name}</span>
                            </td>
                            <td style={{ ...td, borderTop: pi ? '2px solid #ece7e0' : td.borderTop, textAlign: 'right', fontWeight: 800, color: PURPLE, whiteSpace: 'nowrap' }} rowSpan={bd.length}>{p.qty} {p.unit}</td>
                            <td style={{ ...td, borderTop: pi ? '2px solid #ece7e0' : td.borderTop, textAlign: 'center', borderLeft: '2px solid #e6e2dc', borderRight: '2px solid #e6e2dc', whiteSpace: 'nowrap' }} rowSpan={bd.length}>
                              <div style={{ fontSize: 12, color: '#4a5aaa', fontWeight: 600 }}>Центр-Склад</div>
                              {remain !== 0 && <div style={{ fontSize: 11, color: remain > 0 ? '#8a6f00' : '#b03020', marginTop: 2 }}>{remain > 0 ? `остаток ${remain}` : `перебор ${-remain}`}</div>}
                            </td>
                          </>
                        )}
                        {b ? (
                          <>
                            <td style={td}>{b.client}</td>
                            <td style={{ ...td, textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{b.qty} {p.unit}</td>
                            <td style={{ ...td, color: '#5f5952', maxWidth: 240 }}>{b.comment ? (b.comment.length > 80 ? b.comment.slice(0, 80) + '…' : b.comment) : '—'}</td>
                          </>
                        ) : (
                          <td style={{ ...td, color: '#837c72' }} colSpan={3}>Раскладка по заказчикам не зафиксирована</td>
                        )}
                      </tr>
                    ))
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
    </div>
  )
}
