'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchClientOrders, createClientOrder, fetchNotifications, markNotificationRead, logout, orderAction } from '@/lib/api'
import { Order, SessionUser, Notification } from '@/lib/types'
import { cardProgress } from '@/lib/display'
import { todayLocal } from '@/lib/dates'
import { useLiveData } from '@/lib/live'

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 2300); return () => clearTimeout(t) }, [onClose])
  return <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', background: '#211f1c', color: '#fff', padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 500, zIndex: 9999, animation: 'uktoast .25s ease both', whiteSpace: 'nowrap' }}>{msg}</div>
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    'В ожидании': { bg: '#eef2ff', color: '#4a5aaa' }, 'Новая заявка': { bg: '#eef2ff', color: '#4a5aaa' },
    'Принят': { bg: '#fff0ea', color: '#c0532a' }, 'В обработке': { bg: '#fff0ea', color: '#c0532a' }, 'В работе': { bg: '#fff0ea', color: '#c0532a' },
    'Готово к отгрузке': { bg: '#fdf8e1', color: '#8a6f00' }, 'В пути': { bg: '#fdf8e1', color: '#8a6f00' },
    'Доставлено': { bg: '#e8f5ee', color: '#2e8a5e' }, 'Принято филиалом': { bg: '#e8f5ee', color: '#2e8a5e' }, 'К учёту': { bg: '#e8f5ee', color: '#2e8a5e' },
    'Бухгалтерия': { bg: '#e8f5ee', color: '#2e8a5e' }, 'Отменён': { bg: '#faeaea', color: '#b03020' }, 'Черновик': { bg: '#efece8', color: '#6b655b' },
  }
  const s = map[status] || { bg: '#efece8', color: '#6b655b' }
  return <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, fontWeight: 600, background: s.bg, color: s.color }}>{status}</span>
}

function barColor(pct: number) { return pct >= 100 ? '#3a9d6e' : pct >= 60 ? '#c4a832' : '#d4613a' }

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
function fmtDateTime(d?: string) {
  if (!d) return '—'
  const date = new Date(d), diff = Math.floor((Date.now() - date.getTime()) / 60000)
  if (diff < 1) return 'только что'
  if (diff < 60) return `${diff} мин`
  if (diff < 1440) return `${Math.floor(diff / 60)} ч`
  return fmtDate(d)
}

interface Props { user: SessionUser; clientUser: { name: string; slug: string; phone?: string } }

export default function ClientApp({ user, clientUser }: Props) {
  const [orders, setOrders] = useState<Order[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const isBranch = user.role === 'branch'
  const [tab, setTab] = useState<'orders' | 'incoming' | 'new' | 'notifications'>('orders')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [toast, setToast] = useState('')
  const [copied, setCopied] = useState('')

  // Новая заявка
  const [newText, setNewText] = useState('')
  const [newDeadline, setNewDeadline] = useState('')
  const [newLoading, setNewLoading] = useState(false)
  const [newResult, setNewResult] = useState<{ order: Order; trackingUrl: string } | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)

  // Лоадер показываем только на первой загрузке. Фоновые live-обновления не
  // трогают loading — иначе каждый сигнал перерисовывал бы весь кабинет
  // (мигание «Загрузка…»), из-за чего клик по вкладке мог теряться.
  const didInit = useRef(false)
  const load = useCallback(async () => {
    if (!didInit.current) setLoading(true)
    try {
      const [ord, notifs] = await Promise.all([fetchClientOrders() as any, fetchNotifications() as any])
      setOrders(ord); setNotifications(notifs)
    } catch (e: any) {
      if (e?.message === 'Не авторизован' || e?.message === 'Нет доступа') setSessionExpired(true)
    }
    finally { didInit.current = true; setLoading(false) }
  }, [])

  // Пока открыта форма «Новая заявка» — паузим live-обновление (как editingRef
  // в порталах): входящий сигнал не перерисовывает форму и не сбрасывает ввод.
  const formPausedRef = useRef(false)
  formPausedRef.current = tab === 'new' && !newResult

  // Realtime канал 'orders' (+ polling-fallback). Загрузка при монтировании и по сигналу.
  useLiveData('orders', load, [], formPausedRef)

  // Дефолт «Желаемая дата» = сегодня при открытии вкладки «Новая заявка»
  // (в момент открытия, не при монтировании; пустое поле — не перетираем введённое)
  useEffect(() => {
    if (tab === 'new') setNewDeadline(d => d || todayLocal())
  }, [tab])

  const unread = notifications.filter(n => !n.read).length
  // Для филиала — входящие карточки (адресованные мне)
  const incomingOrders = orders.filter(o => o.to === clientUser.name && o.fromId !== user.id)
  const myOrders = orders.filter(o => o.fromId === user.id)
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://ulkan.vercel.app'

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key); setTimeout(() => setCopied(''), 2000)
    setToast('Скопировано!')
  }

  async function handleNewOrder(e: React.FormEvent) {
    e.preventDefault()
    setNewLoading(true)
    try {
      // Получателя ("to") клиент не указывает — приёмка проставит его на столе приёмки
      const r = await createClientOrder({ text: newText, deadline: newDeadline || undefined }) as any
      setNewResult(r); load()
    } catch (e: any) { setToast(e.message) }
    finally { setNewLoading(false) }
  }

  async function handleReadNotif(id: string) {
    await markNotificationRead(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const inp: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, border: '1.5px solid #e6e2dc', background: '#fff', outline: 'none', fontFamily: 'inherit' }

  if (sessionExpired) {
    return (
      <div style={{ minHeight: '100vh', background: '#f1efec', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Golos Text', system-ui, sans-serif" }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: 28, maxWidth: 340, textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,.15)' }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>🔒</div>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Сессия устарела</div>
          <div style={{ color: '#8a847c', fontSize: 14, marginBottom: 18 }}>Войдите заново, чтобы продолжить.</div>
          <button onClick={() => logout()} style={{ padding: '11px 24px', background: '#d4613a', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            Выйти и войти заново
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1efec', fontFamily: "'Golos Text', system-ui, sans-serif" }}>
      {toast && <Toast msg={toast} onClose={() => setToast('')} />}

      {/* Шапка */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e6e2dc', padding: '0 20px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', alignItems: 'center', height: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: '#d4613a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>U</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{clientUser.name}</div>
              <div style={{ fontSize: 11, color: '#8a847c' }}>Кабинет заказчика</div>
            </div>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Ссылки */}
            <div style={{ fontSize: 12, color: '#8a847c', display: 'flex', gap: 12 }}>
              <span>Ваш кабинет:
                <button onClick={() => copy(`${base}/client/${clientUser.slug}`, 'cab')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#d4613a', marginLeft: 6, fontFamily: 'inherit', fontSize: 12 }}>
                  {copied === 'cab' ? '✓' : '📋 Скопировать'}
                </button>
              </span>
            </div>
            <button onClick={logout} style={{ padding: '6px 14px', border: '1.5px solid #e6e2dc', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#8a847c', fontFamily: 'inherit' }}>
              Выйти
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 880, margin: '0 auto', padding: 20 }}>

        {/* Табы */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {[
            ...(isBranch ? [{ key: 'incoming', label: `📥 Входящие (${incomingOrders.length})` }] : []),
            { key: 'orders', label: `Мои заявки (${myOrders.length})` },
            { key: 'new', label: '+ Новая заявка' },
            { key: 'notifications', label: `Уведомления${unread > 0 ? ` (${unread})` : ''}` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', background: tab === t.key ? '#d4613a' : '#fff', color: tab === t.key ? '#fff' : '#26231f', boxShadow: '0 0 0 1px #e6e2dc' }}>
              {t.label}
            </button>
          ))}
          <div style={{ marginLeft: 'auto' }}>
            <button onClick={load} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #e6e2dc', background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>⟳</button>
          </div>
        </div>

        {/* === ВХОДЯЩИЕ (для Филиала) === */}
        {tab === 'incoming' && (
          <div className="anim-fade">
            {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#8a847c' }}>Загрузка...</div>
              : incomingOrders.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', boxShadow: '0 0 0 1px #e6e2dc' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📥</div>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Нет входящих карточек</div>
                  <div style={{ color: '#8a847c', fontSize: 13 }}>Карточки появятся когда вас назначат получателем</div>
                </div>
              ) : incomingOrders.map(o => {
                const pct = cardProgress(o)
                const allDelivered = o.positions.length > 0 && o.positions.every(p => p.status === 'Доставлено')
                const accepted = o.status === 'Принято филиалом'
                return (
                  <div key={o.id} style={{ background: '#fff', borderRadius: 14, marginBottom: 12, boxShadow: '0 0 0 1px #e6e2dc', overflow: 'hidden' }}>
                    {/* Шапка */}
                    <div style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={() => setSelectedOrder(selectedOrder?.id === o.id ? null : o)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#d4613a' }}>{o.id}</span>
                          <StatusBadge status={o.status} />
                        </div>
                        <span style={{ fontSize: 12, color: '#8a847c' }}>{fmtDate(o.createdAt)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#26231f', marginBottom: 6 }}>
                        {o.from} → <strong>{o.to || 'не распределено'}</strong>
                        {o.deadline && <span style={{ color: '#8a847c', marginLeft: 8 }}>до {fmtDate(o.deadline)}</span>}
                      </div>
                      {/* Прогресс */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 5, background: '#f1efec', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: barColor(pct), borderRadius: 3, transition: 'width .3s' }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: barColor(pct), minWidth: 36, textAlign: 'right' }}>{pct}%</span>
                      </div>
                    </div>

                    {/* Детали */}
                    {selectedOrder?.id === o.id && (
                      <div style={{ padding: '0 16px 16px' }}>
                        {/* Позиции */}
                        {o.positions.length > 0 && (
                          <div style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#8a847c', marginBottom: 8, letterSpacing: '.04em' }}>ПОЗИЦИИ</div>
                            {o.positions.map((p, i) => (
                              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f1efec' }}>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name1c || p.oral}</div>
                                  {p.resp && <div style={{ fontSize: 11, color: '#8a847c' }}>Логист: {p.resp}</div>}
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <span style={{ fontSize: 12, color: '#8a847c' }}>{p.qty > 0 ? `${p.qty} ${p.unit}` : '—'}</span>
                                  <StatusBadge status={p.status} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Кнопки действий филиала */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                          {allDelivered && !accepted && (
                            <button onClick={async () => {
                              await orderAction(o.id, 'branchAccept', { branchName: clientUser.name })
                              load(); setToast('✓ Товар принят')
                            }} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#d4613a', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>
                              ✓ Принял товар
                            </button>
                          )}
                          {accepted && (
                            <button onClick={async () => {
                              await orderAction(o.id, 'branchForward', { branchName: clientUser.name })
                              load(); setToast('✓ Передано логисту')
                            }} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#d4613a', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>
                              К доставке →
                            </button>
                          )}
                          {!allDelivered && (
                            <span style={{ fontSize: 12, color: '#8a847c', padding: '9px 0' }}>⏳ Ожидаем доставку от логиста...</span>
                          )}
                        </div>

                        <a href={o.trackingLink} target="_blank" rel="noreferrer" style={{ color: '#d4613a', fontSize: 13, textDecoration: 'none', fontWeight: 500 }}>
                          Трекинг →
                        </a>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        )}

        {/* === МОИ ЗАЯВКИ === */}
        {tab === 'orders' && (
          <div className="anim-fade">
            {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#8a847c' }}>Загрузка...</div>
              : myOrders.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', boxShadow: '0 0 0 1px #e6e2dc' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Заявок пока нет</div>
                  <button onClick={() => setTab('new')} style={{ padding: '10px 20px', background: '#d4613a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Подать заявку</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {orders.map(o => {
                    const pct = cardProgress(o)
                    return (
                      <div key={o.id} onClick={() => setSelectedOrder(selectedOrder?.id === o.id ? null : o)}
                        style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 0 0 1px #e6e2dc', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 13, color: '#d4613a' }}>{o.id}</span>
                          <StatusBadge status={o.status} />
                          {o.isChanged && <span style={{ fontSize: 10, background: '#fff0ea', color: '#c0532a', padding: '1px 8px', borderRadius: 20, fontWeight: 600 }}>ИЗМЕНЕНИЕ</span>}
                          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#8a847c' }}>{fmtDate(o.createdAt)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: o.positions.length > 0 ? 10 : 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: o.to ? undefined : '#a39c92' }}>→ {o.to || 'не распределено'}</span>
                          {o.deadline && <span style={{ fontSize: 12, color: '#8a847c' }}>до {fmtDate(o.deadline)}</span>}
                          <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: barColor(pct) }}>{pct}%</span>
                        </div>
                        {o.positions.length > 0 && (
                          <div style={{ height: 4, background: '#f1efec', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: barColor(pct), transition: 'width .3s', borderRadius: 4 }} />
                          </div>
                        )}

                        {/* Раскрытые детали */}
                        {selectedOrder?.id === o.id && (
                          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1efec' }}>
                            {o.comment && <div style={{ fontSize: 13, color: '#8a847c', marginBottom: 10 }}>Комментарий: {o.comment}</div>}
                            {o.positions.length > 0 && (
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#8a847c', marginBottom: 8 }}>ПОЗИЦИИ</div>
                                {o.positions.map(p => (
                                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1efec' }}>
                                    <span style={{ fontSize: 13 }}>{p.name1c || p.oral}</span>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                      <span style={{ fontSize: 12, color: '#8a847c' }}>{p.qty} {p.unit}</span>
                                      <StatusBadge status={p.status} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Кнопки для филиала */}
                            {user.role === 'branch' && o.screen === 'outgoing' && (
                              <div style={{ marginTop: 14, padding: '12px 14px', background: '#f8f6f3', borderRadius: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, color: '#8a847c', fontWeight: 600 }}>ДЕЙСТВИЯ ФИЛИАЛА:</span>
                                {o.status !== 'Принято филиалом' && (
                                  <button onClick={async e => {
                                    e.stopPropagation()
                                    await orderAction(o.id, 'branchAccept', { branchName: clientUser.name })
                                    load()
                                    setToast('✓ Товар принят филиалом')
                                  }} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#d4613a', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>
                                    ✓ Принял
                                  </button>
                                )}
                                {o.status === 'Принято филиалом' && (
                                  <>
                                    <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: '#e8f5ee', color: '#2e8a5e', fontWeight: 600 }}>✓ Принято</span>
                                    <button onClick={async e => {
                                      e.stopPropagation()
                                      await orderAction(o.id, 'branchForward', { branchName: clientUser.name })
                                      load()
                                      setToast('✓ Передано логисту для доставки клиенту')
                                    }} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#d4613a', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>
                                      К доставке →
                                    </button>
                                  </>
                                )}
                              </div>
                            )}

                            <div style={{ marginTop: 12 }}>
                              <a href={o.trackingLink} target="_blank" rel="noreferrer" style={{ color: '#d4613a', fontSize: 13, textDecoration: 'none', fontWeight: 500 }}>
                                Открыть трекинг →
                              </a>
                              <button onClick={e => { e.stopPropagation(); copy(o.trackingLink, o.id) }} style={{ marginLeft: 12, border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#8a847c', fontFamily: 'inherit' }}>
                                {copied === o.id ? '✓ Скопировано' : '📋 Ссылка'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            }
          </div>
        )}

        {/* === НОВАЯ ЗАЯВКА === */}
        {tab === 'new' && (
          <div className="anim-fade">
            {newResult ? (
              <div style={{ background: '#fff', borderRadius: 14, padding: 32, boxShadow: '0 0 0 1px #e6e2dc', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: 20, color: '#2e8a5e', marginBottom: 8 }}>Заявка {newResult.order.id} создана!</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
                  <button onClick={() => { setNewResult(null); setNewText(''); setNewDeadline(''); setTab('orders') }} style={{ padding: '10px 20px', background: '#fff', border: '1.5px solid #e6e2dc', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>Мои заявки</button>
                  <a href={newResult.trackingUrl} target="_blank" rel="noreferrer" style={{ padding: '10px 20px', background: '#d4613a', color: '#fff', borderRadius: 8, fontWeight: 600, textDecoration: 'none', fontSize: 14 }}>Отслеживать →</a>
                </div>
              </div>
            ) : (
              <div style={{ background: '#fff', borderRadius: 14, padding: 28, boxShadow: '0 0 0 1px #e6e2dc', maxWidth: 560 }}>
                <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Новая заявка</div>
                <div style={{ color: '#8a847c', fontSize: 13, marginBottom: 24 }}>Заполните форму — менеджер свяжется с вами</div>
                <form onSubmit={handleNewOrder} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#8a847c', marginBottom: 4, display: 'block' }}>ОПИСАНИЕ ЗАЯВКИ *</label>
                    <textarea style={{ ...inp, minHeight: 100, resize: 'vertical' }} value={newText} onChange={e => setNewText(e.target.value)} placeholder="Что нужно заказать, в каком количестве..." required />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#8a847c', marginBottom: 4, display: 'block' }}>ЖЕЛАЕМЫЙ СРОК</label>
                    <input style={inp} type="date" value={newDeadline} onChange={e => setNewDeadline(e.target.value)} />
                  </div>
                  <button type="submit" disabled={newLoading} style={{ padding: '12px', background: '#d4613a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: newLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                    {newLoading ? 'Отправка...' : 'ОТПРАВИТЬ ЗАЯВКУ →'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* === УВЕДОМЛЕНИЯ === */}
        {tab === 'notifications' && (
          <div className="anim-fade">
            {notifications.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', boxShadow: '0 0 0 1px #e6e2dc' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
                <div style={{ color: '#8a847c' }}>Уведомлений пока нет</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {notifications.map(n => (
                  <div key={n.id} onClick={() => !n.read && handleReadNotif(n.id)}
                    style={{ background: n.read ? '#fff' : '#fff8f5', borderRadius: 10, padding: '14px 18px', boxShadow: `0 0 0 1px ${n.read ? '#e6e2dc' : '#f3c8b0'}`, cursor: n.read ? 'default' : 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600 }}>{n.text}</div>
                      {!n.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d4613a', flexShrink: 0, marginTop: 3 }} />}
                    </div>
                    <div style={{ fontSize: 11, color: '#8a847c', marginTop: 4 }}>{fmtDateTime(n.createdAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
