'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchAllOrders, orderAction, createDailyReport, logout } from '@/lib/api'
import { Order, SessionUser } from '@/lib/types'

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 2300); return () => clearTimeout(t) }, [onClose])
  return <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#211f1c', color: '#fff', padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 500, zIndex: 9999, animation: 'uktoast .25s ease both', whiteSpace: 'nowrap' }}>{msg}</div>
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    'В ожидании': { bg: '#eef2ff', color: '#4a5aaa' }, 'Принят': { bg: '#fff0ea', color: '#c0532a' },
    'В обработке': { bg: '#fff0ea', color: '#c0532a' }, 'В работе': { bg: '#fff0ea', color: '#c0532a' },
    'Готово к отгрузке': { bg: '#fdf8e1', color: '#8a6f00' }, 'В пути': { bg: '#fdf8e1', color: '#8a6f00' },
    'Доставлено': { bg: '#e8f5ee', color: '#2e8a5e' },
  }
  const s = map[status] || { bg: '#efece8', color: '#6b655b' }
  return <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{status}</span>
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

const POS_STATUSES = ['В работе', 'Готово к отгрузке', 'В пути', 'Доставлено']

interface Props { user: SessionUser; logistUser: { name: string; slug: string } }

export default function LogistPortal({ user, logistUser }: Props) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'active' | 'report'>('active')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)

  // Форма отчёта
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10))
  const [reportComment, setReportComment] = useState('')
  const [reportRows, setReportRows] = useState([{ fromWho: '', name: '', qtyIn: '', commentIn: '', toWho: '', qtyOut: '', commentOut: '', invoiceNum: '' }])
  const [reportSent, setReportSent] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const all = await fetchAllOrders() as Order[]
      // Логист видит только карточки с его именем в позициях или карточки в outgoing
      const mine = all.filter(o => o.screen === 'outgoing' || o.positions.some(p => p.resp === user.name || p.resp === logistUser.name))
      setOrders(mine)
    } catch {}
    finally { setLoading(false) }
  }, [user.name, logistUser.name])

  useEffect(() => { load() }, [load])

  async function updatePosStatus(cardId: string, posId: string, status: string) {
    setUpdating(posId)
    try {
      await orderAction(cardId, 'updatePos', { posId, status })
      setToast(`Статус: ${status}`)
      load()
    } catch (e: any) { setToast(e.message) }
    finally { setUpdating(null) }
  }

  async function submitReport(e: React.FormEvent) {
    e.preventDefault()
    setReportLoading(true)
    try {
      await createDailyReport({
        date: reportDate,
        comment: reportComment,
        rows: reportRows.filter(r => r.name).map(r => ({ ...r, qtyIn: Number(r.qtyIn) || 0, qtyOut: Number(r.qtyOut) || 0 })),
      })
      setReportSent(true)
      setToast('Отчёт отправлен!')
    } catch (e: any) { setToast(e.message) }
    finally { setReportLoading(false) }
  }

  function addRow() {
    setReportRows(prev => [...prev, { fromWho: '', name: '', qtyIn: '', commentIn: '', toWho: '', qtyOut: '', commentOut: '', invoiceNum: '' }])
  }
  function updateRow(i: number, field: string, val: string) {
    setReportRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  }
  function removeRow(i: number) {
    setReportRows(prev => prev.filter((_, idx) => idx !== i))
  }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 7, fontSize: 13, border: '1.5px solid #e6e2dc', background: '#fff', outline: 'none', fontFamily: 'inherit' }

  return (
    <div style={{ minHeight: '100vh', background: '#f1efec', fontFamily: "'Golos Text', system-ui, sans-serif", maxWidth: 432, margin: '0 auto' }}>
      {toast && <Toast msg={toast} onClose={() => setToast('')} />}

      {/* Шапка */}
      <div style={{ background: '#211f1c', padding: '16px 20px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>📦 Портал логиста</div>
            <div style={{ color: '#8c857a', fontSize: 12 }}>{logistUser.name}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={load} style={{ background: '#322f2b', border: 'none', borderRadius: 7, padding: '6px 10px', color: '#cfc9c0', cursor: 'pointer', fontSize: 14 }}>⟳</button>
            <button onClick={logout} style={{ background: '#322f2b', border: 'none', borderRadius: 7, padding: '6px 10px', color: '#cfc9c0', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Выйти</button>
          </div>
        </div>

        {/* Табы */}
        <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
          {[{ key: 'active', label: `Заявки (${orders.length})` }, { key: 'report', label: '+ Отчёт' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)} style={{ flex: 1, padding: '8px', borderRadius: 7, border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', background: tab === t.key ? '#d4613a' : '#322f2b', color: tab === t.key ? '#fff' : '#8c857a' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px 12px' }}>

        {/* === ЗАЯВКИ === */}
        {tab === 'active' && (
          <div className="anim-fade">
            {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#8a847c' }}>Загрузка...</div>
              : orders.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: 12, padding: 32, textAlign: 'center', boxShadow: '0 0 0 1px #e6e2dc' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                  <div style={{ color: '#8a847c', fontSize: 13 }}>Нет активных заявок</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {orders.map(o => (
                    <div key={o.id} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 0 0 1px #e6e2dc' }}>
                      {/* Заголовок карточки */}
                      <div onClick={() => setExpanded(expanded === o.id ? null : o.id)} style={{ cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 12, color: '#d4613a' }}>{o.id}</span>
                          <StatusBadge status={o.status} />
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{o.from} → {o.to || '—'}</div>
                        <div style={{ fontSize: 12, color: '#8a847c' }}>{o.positions.length} позиций · срок {fmtDate(o.deadline)}</div>
                      </div>

                      {/* Позиции */}
                      {expanded === o.id && o.positions.length > 0 && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1efec' }}>
                          {o.positions.map(p => (
                            <div key={p.id} style={{ marginBottom: 12, padding: 12, background: '#faf8f6', borderRadius: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name1c || p.oral}</div>
                                  <div style={{ fontSize: 12, color: '#8a847c' }}>{p.qty} {p.unit}{p.resp ? ` · ${p.resp}` : ''}</div>
                                </div>
                                <StatusBadge status={p.status} />
                              </div>
                              {/* Кнопки смены статуса */}
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {POS_STATUSES.filter(s => s !== p.status).map(s => (
                                  <button key={s} onClick={() => updatePosStatus(o.id, p.id, s)} disabled={updating === p.id}
                                    style={{ padding: '5px 10px', borderRadius: 6, border: '1.5px solid #e6e2dc', background: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, opacity: updating === p.id ? .5 : 1 }}>
                                    → {s}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}

        {/* === ОТЧЁТ === */}
        {tab === 'report' && (
          <div className="anim-fade">
            {reportSent ? (
              <div style={{ background: '#fff', borderRadius: 12, padding: 32, textAlign: 'center', boxShadow: '0 0 0 1px #e6e2dc' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: '#2e8a5e', marginBottom: 8 }}>Отчёт отправлен!</div>
                <button onClick={() => { setReportSent(false); setReportRows([{ fromWho: '', name: '', qtyIn: '', commentIn: '', toWho: '', qtyOut: '', commentOut: '', invoiceNum: '' }]); setReportComment('') }}
                  style={{ padding: '10px 20px', background: '#d4613a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Новый отчёт
                </button>
              </div>
            ) : (
              <form onSubmit={submitReport}>
                <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: '0 0 0 1px #e6e2dc' }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Ежедневный отчёт</div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#8a847c', marginBottom: 4, display: 'block' }}>ДАТА</label>
                    <input style={inp} type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#8a847c', marginBottom: 4, display: 'block' }}>КОММЕНТАРИЙ</label>
                    <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={reportComment} onChange={e => setReportComment(e.target.value)} placeholder="Общий комментарий к отчёту..." />
                  </div>
                </div>

                {/* Строки отчёта */}
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Строки отчёта</div>
                {reportRows.map((row, i) => (
                  <div key={i} style={{ background: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: '0 0 0 1px #e6e2dc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>Строка {i + 1}</span>
                      {reportRows.length > 1 && <button type="button" onClick={() => removeRow(i)} style={{ border: 'none', background: 'none', color: '#b03020', cursor: 'pointer', fontSize: 18, padding: 0 }}>×</button>}
                    </div>
                    {[
                      { f: 'fromWho', label: 'ОТ КОГО' }, { f: 'name', label: 'НАИМЕНОВАНИЕ *' },
                      { f: 'qtyIn', label: 'КОЛ-ВО ПРИХОД', type: 'number' }, { f: 'commentIn', label: 'КОММЕНТАРИЙ ПРИХОД' },
                      { f: 'toWho', label: 'КОМУ' }, { f: 'qtyOut', label: 'КОЛ-ВО РАСХОД', type: 'number' },
                      { f: 'commentOut', label: 'КОММЕНТАРИЙ РАСХОД' }, { f: 'invoiceNum', label: '№ НАКЛАДНОЙ' },
                    ].map(({ f, label, type }) => (
                      <div key={f} style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: 10, fontWeight: 600, color: '#8a847c', marginBottom: 3, display: 'block' }}>{label}</label>
                        <input style={inp} type={type || 'text'} value={(row as any)[f]} onChange={e => updateRow(i, f, e.target.value)} />
                      </div>
                    ))}
                  </div>
                ))}

                <button type="button" onClick={addRow} style={{ width: '100%', padding: '10px', border: '1.5px dashed #e6e2dc', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13, color: '#8a847c', fontFamily: 'inherit', marginBottom: 12 }}>
                  + Добавить строку
                </button>

                <button type="submit" disabled={reportLoading} style={{ width: '100%', padding: '13px', background: '#d4613a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: reportLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {reportLoading ? 'Отправка...' : 'ОТПРАВИТЬ ОТЧЁТ →'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
