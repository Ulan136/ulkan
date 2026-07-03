'use client'
import { useState, useEffect, useCallback } from 'react'

interface ReportRow { name: string; qty: number; unit: string; note: string }
interface Report { id: string; date: string; status: string; comment: string; rows: ReportRow[]; logist: { name: string } }
interface Order { id: string; from: string; to: string; screen: string; status: string; comment: string; positions: { id: string; name1c: string; oral: string; qty: number; unit: string; status: string }[] }

const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : ''
const fmtFull = (d?: string) => d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' }) : ''

export default function LogistPortal({ userName, userId }: { userName: string; userId: string }) {
  const [tab, setTab] = useState<'active' | 'report' | 'reports' | 'profile'>('active')
  const [orders, setOrders] = useState<Order[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [selected, setSelected] = useState<Order | null>(null)
  const [rows, setRows] = useState<ReportRow[]>([{ name: '', qty: 1, unit: 'шт', note: '' }])
  const [comment, setComment] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  const load = useCallback(async () => {
    const [ords, reps] = await Promise.all([
      fetch('/api/orders/all').then(r => r.json()),
      fetch('/api/reports/daily').then(r => r.json()),
    ])
    setOrders(Array.isArray(ords) ? ords.filter((o: Order) => o.screen === 'outgoing') : [])
    setReports(Array.isArray(reps) ? reps.filter((r: Report) => r.logist?.name === userName) : [])
  }, [userName])

  useEffect(() => { load() }, [load])

  const addRow = () => setRows(r => [...r, { name: '', qty: 1, unit: 'шт', note: '' }])
  const removeRow = (i: number) => setRows(r => r.filter((_, j) => j !== i))
  const updateRow = (i: number, field: keyof ReportRow, val: string | number) =>
    setRows(r => r.map((row, j) => j === i ? { ...row, [field]: val } : row))

  const submitReport = async () => {
    const validRows = rows.filter(r => r.name)
    setLoading(true)
    try {
      await fetch('/api/reports/daily', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, comment, rows: validRows }),
      })
      showToast('Отчёт отправлен!')
      setRows([{ name: '', qty: 1, unit: 'шт', note: '' }]); setComment('')
      setTab('reports'); load()
    } catch { showToast('Ошибка') }
    finally { setLoading(false) }
  }

  const updatePos = async (orderId: string, posId: string, status: string) => {
    await fetch(`/api/orders/${orderId}/action`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updatePos', posId, status }),
    })
    showToast('Обновлено'); load()
  }

  const inp: React.CSSProperties = { padding: '10px 12px', border: '1.5px solid #e0dbd3', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', color: '#26231f', outline: 'none', background: '#fff' }
  const POS_STATUSES = ['В работе', 'Готово к отгрузке', 'В пути', 'Доставлено']

  return (
    <div style={{ maxWidth: 432, margin: '0 auto', background: '#f1efec', minHeight: '100vh', fontFamily: 'Golos Text, system-ui, sans-serif', paddingBottom: 80 }}>
      {/* Шапка */}
      <div style={{ background: '#d4613a', padding: '16px 20px', color: '#fff' }}>
        <div style={{ fontSize: 12, opacity: 0.8 }}>U-Kan · Логист</div>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{userName}</div>
      </div>

      {/* Контент */}
      <div style={{ padding: '16px' }}>

        {tab === 'active' && (
          <div>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: '#211f1c' }}>
              В работе ({orders.length})
            </h3>
            {orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9d9690', background: '#fff', borderRadius: 12 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                <div>Все заказы выполнены</div>
              </div>
            ) : orders.map(o => (
              <div key={o.id} onClick={() => setSelected(o)} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 8, border: '1px solid #e8e3db', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: '#d4613a' }}>{o.id}</span>
                  <span style={{ fontSize: 11, color: '#9d9690' }}>{o.positions.length} поз.</span>
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{o.from}</div>
                {o.positions.slice(0, 2).map(p => (
                  <div key={p.id} style={{ fontSize: 12, color: '#6b655b' }}>{p.name1c || p.oral} — {p.qty} {p.unit}</div>
                ))}
                {o.positions.length > 2 && <div style={{ fontSize: 11, color: '#9d9690' }}>ещё {o.positions.length - 2}...</div>}
              </div>
            ))}
          </div>
        )}

        {tab === 'report' && (
          <div>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#211f1c' }}>Новый отчёт</h3>
            <div style={{ background: '#fff', borderRadius: 12, padding: '16px', border: '1px solid #e8e3db', marginBottom: 12 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b655b', display: 'block', marginBottom: 4 }}>Дата смены</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b655b', display: 'block', marginBottom: 8 }}>Что сделано</label>
                {rows.map((row, i) => (
                  <div key={i} style={{ marginBottom: 8, background: '#fafaf9', borderRadius: 8, padding: '10px 12px', border: '1px solid #f1efec' }}>
                    <input value={row.name} onChange={e => updateRow(i, 'name', e.target.value)} placeholder="Позиция / работа"
                      style={{ ...inp, width: '100%', boxSizing: 'border-box', marginBottom: 6 }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input type="number" value={row.qty} onChange={e => updateRow(i, 'qty', Number(e.target.value))} style={{ ...inp, width: 70 }} min={1} />
                      <select value={row.unit} onChange={e => updateRow(i, 'unit', e.target.value)} style={{ ...inp, flex: 1 }}>
                        {['шт', 'кг', 'лист', 'рулон', 'уп', 'м'].map(u => <option key={u}>{u}</option>)}
                      </select>
                      {rows.length > 1 && (
                        <button onClick={() => removeRow(i)} style={{ padding: '0 10px', background: '#faeaea', color: '#b03020', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                      )}
                    </div>
                    <input value={row.note} onChange={e => updateRow(i, 'note', e.target.value)} placeholder="Примечание..."
                      style={{ ...inp, width: '100%', boxSizing: 'border-box', marginTop: 6 }} />
                  </div>
                ))}
                <button onClick={addRow} style={{ padding: '9px 16px', background: '#f1efec', color: '#6b655b', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
                  + Добавить позицию
                </button>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b655b', display: 'block', marginBottom: 4 }}>Комментарий</label>
                <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Проблемы, замечания..."
                  style={{ ...inp, width: '100%', boxSizing: 'border-box', resize: 'none' } as React.CSSProperties} />
              </div>
            </div>

            <button onClick={submitReport} disabled={loading} style={{ width: '100%', padding: '13px', background: loading ? '#e0dbd3' : '#d4613a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
              {loading ? 'Отправляем...' : 'Отправить отчёт'}
            </button>
          </div>
        )}

        {tab === 'reports' && (
          <div>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>Мои отчёты</h3>
            {reports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9d9690', background: '#fff', borderRadius: 12 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                <div>Отчётов пока нет</div>
              </div>
            ) : reports.map(r => (
              <div key={r.id} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 8, border: '1px solid #e8e3db' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{fmtFull(r.date)}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: r.status === 'approved' ? '#e8f5ee' : '#fdf8e1', color: r.status === 'approved' ? '#2e8a5e' : '#8a6f00' }}>
                    {r.status === 'approved' ? 'Принят' : r.status === 'rejected' ? 'Отклонён' : 'На проверке'}
                  </span>
                </div>
                {r.rows.map((row, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#6b655b', marginBottom: 2 }}>• {row.name} — {row.qty} {row.unit}</div>
                ))}
                {r.comment && <div style={{ fontSize: 12, color: '#9d9690', marginTop: 4, fontStyle: 'italic' }}>{r.comment}</div>}
              </div>
            ))}
          </div>
        )}

        {tab === 'profile' && (
          <div>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>Профиль</h3>
            <div style={{ background: '#fff', borderRadius: 12, padding: '20px', border: '1px solid #e8e3db', marginBottom: 12 }}>
              <div style={{ width: 56, height: 56, background: '#d4613a', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 24 }}>{userName[0]}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#211f1c', marginBottom: 4 }}>{userName}</div>
              <div style={{ fontSize: 13, color: '#9d9690' }}>Логист · U-Kan</div>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #e8e3db' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1efec', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, color: '#6b655b' }}>Заказов в работе</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#d4613a' }}>{orders.length}</span>
              </div>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1efec', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, color: '#6b655b' }}>Отчётов отправлено</span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{reports.length}</span>
              </div>
              <button onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login' }}
                style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 14, color: '#b03020', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                Выйти из системы
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Нижнее меню */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 432, background: '#fff', borderTop: '1px solid #e8e3db', display: 'flex', zIndex: 50 }}>
        {([
          { k: 'active', label: 'В работе', icon: '🚚', badge: orders.length },
          { k: 'report', label: 'Отчёт', icon: '✏' },
          { k: 'reports', label: 'История', icon: '📋' },
          { k: 'profile', label: 'Профиль', icon: '👤' },
        ] as const).map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            flex: 1, padding: '12px 4px 14px', background: 'none', border: 'none', cursor: 'pointer',
            color: tab === t.k ? '#d4613a' : '#9d9690', fontFamily: 'inherit', position: 'relative',
          }}>
            <div style={{ fontSize: 22 }}>{t.icon}</div>
            <div style={{ fontSize: 10, fontWeight: tab === t.k ? 700 : 400 }}>{t.label}</div>
            {'badge' in t && t.badge > 0 && (
              <div style={{ position: 'absolute', top: 8, right: '50%', transform: 'translateX(8px)', width: 16, height: 16, background: '#d4613a', borderRadius: '50%', fontSize: 9, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {t.badge}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Модаль деталей заказа */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxHeight: '80vh', background: '#fff', borderRadius: '16px 16px 0 0', overflow: 'auto', padding: '20px 20px 32px' }}>
            <div style={{ width: 40, height: 4, background: '#e0dbd3', borderRadius: 2, margin: '0 auto 16px' }} />
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#d4613a', fontSize: 14, marginBottom: 4 }}>{selected.id}</div>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 12 }}>{selected.from}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9d9690', marginBottom: 8, textTransform: 'uppercase' }}>Позиции</div>
            {selected.positions.map(p => (
              <div key={p.id} style={{ background: '#fafaf9', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{p.name1c || p.oral}</div>
                <div style={{ fontSize: 12, color: '#6b655b', marginBottom: 8 }}>{p.qty} {p.unit}</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {POS_STATUSES.map(ps => (
                    <button key={ps} onClick={() => updatePos(selected.id, p.id, ps)}
                      style={{ padding: '5px 10px', background: p.status === ps ? '#d4613a' : '#f1efec', color: p.status === ps ? '#fff' : '#6b655b', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: p.status === ps ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {ps}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#211f1c', color: '#fff', padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500, zIndex: 200, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  )
}

const POS_STATUSES = ['В работе', 'Готово к отгрузке', 'В пути', 'Доставлено']
