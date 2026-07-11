'use client'
import { useState, useEffect } from 'react'
import { fetchTrack, submitExternalOrder, submitTrackChange, loginPhone } from '@/lib/api'
import { TrackData } from '@/lib/types'

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 2300); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', background: '#211f1c', color: '#fff', padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 500, zIndex: 9999, animation: 'uktoast .25s ease both', whiteSpace: 'nowrap' }}>
      {msg}
    </div>
  )
}

const STEPS = ['Заявка', 'Принят', 'В работе', 'Готово', 'Доставлено']

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    'В ожидании': { bg: '#eef2ff', color: '#4a5aaa' }, 'Новая заявка': { bg: '#eef2ff', color: '#4a5aaa' },
    'Принят': { bg: '#fff0ea', color: '#c0532a' }, 'В обработке': { bg: '#fff0ea', color: '#c0532a' }, 'В работе': { bg: '#fff0ea', color: '#c0532a' },
    'Готово к отгрузке': { bg: '#fdf8e1', color: '#8a6f00' }, 'В пути': { bg: '#fdf8e1', color: '#8a6f00' },
    'Доставлено': { bg: '#e8f5ee', color: '#2e8a5e' }, 'Принято филиалом': { bg: '#e8f5ee', color: '#2e8a5e' }, 'Архив': { bg: '#eef2ff', color: '#4a5aaa' },
    'Отменён': { bg: '#faeaea', color: '#b03020' },
  }
  const s = map[status] || { bg: '#efece8', color: '#6b655b' }
  return <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, fontWeight: 600, background: s.bg, color: s.color }}>{status}</span>
}

function barColor(pct: number) { return pct >= 100 ? '#3a9d6e' : pct >= 60 ? '#c4a832' : '#d4613a' }

// Стиль подписи этапа (двухплечевые заказы). Цвета из палитры (hex).
function legStageStyle(label: string): { bg: string; color: string } {
  return label.includes('Изготовление')
    ? { bg: '#fff0ea', color: '#c0532a' } // 1-е плечо · изготовление
    : { bg: '#eef2ff', color: '#4a5aaa' } // 2-е плечо · доставка
}

function fmtTime(iso: string) {
  const d = new Date(iso), diff = Math.floor((Date.now() - d.getTime()) / 60000)
  if (diff < 1) return 'только что'
  if (diff < 60) return `${diff} мин`
  if (diff < 1440) return `${Math.floor(diff / 60)} ч`
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

export default function TrackingApp() {
  const [tab, setTab] = useState<'track' | 'submit'>('track')
  const [searchId, setSearchId] = useState('')
  const [trackData, setTrackData] = useState<TrackData | null>(null)
  const [trackErr, setTrackErr] = useState('')
  const [trackLoading, setTrackLoading] = useState(false)
  const [toast, setToast] = useState('')

  // Форма изменения
  const [changeText, setChangeText] = useState('')
  const [changePhone, setChangePhone] = useState('+7')
  const [changeSent, setChangeSent] = useState(false)

  // Форма подачи заявки
  const [subName, setSubName] = useState('')
  const [subPhone, setSubPhone] = useState('+7')
  const [subText, setSubText] = useState('')
  const [subResult, setSubResult] = useState<{ cardId: string; trackingUrl: string; clientUrl: string } | null>(null)
  const [subLoading, setSubLoading] = useState(false)
  const [subErr, setSubErr] = useState('')
  const [subCopied, setSubCopied] = useState('')

  // Вход по телефону
  const [loginPhone2, setLoginPhone2] = useState('+7')
  const [loginErr, setLoginErr] = useState('')
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const id = params.get('id')
      if (id) { setSearchId(id); doSearch(id) }
      if (params.get('tab') === 'submit') setTab('submit')
    }
  }, [])

  async function doSearch(id?: string) {
    const qid = (id || searchId).trim()
    if (!qid) return
    setTrackLoading(true); setTrackErr(''); setTrackData(null)
    try {
      const data = await fetchTrack(qid) as TrackData
      setTrackData(data)
    } catch (e: any) { setTrackErr(e.message || 'Заказ не найден') }
    finally { setTrackLoading(false) }
  }

  async function handleChange(e: React.FormEvent) {
    e.preventDefault()
    if (!trackData) return
    await submitTrackChange(trackData.id, changeText, changePhone)
    setChangeSent(true)
    setToast('✓ Изменение отправлено менеджеру')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubErr(''); setSubLoading(true)
    try {
      const r = await submitExternalOrder({ name: subName, phone: subPhone, text: subText }) as any
      setSubResult(r)
    } catch (e: any) { setSubErr(e.message) }
    finally { setSubLoading(false) }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginErr('')
    try {
      const r = await loginPhone(loginPhone2) as any
      window.location.href = `/client/${r.slug}`
    } catch (e: any) { setLoginErr(e.message || 'Пользователь не найден') }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setSubCopied(key)
    setTimeout(() => setSubCopied(''), 2000)
    setToast('Скопировано!')
  }

  const inp: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, border: '1.5px solid #e6e2dc', background: '#fff', outline: 'none', fontFamily: 'inherit' }
  const btn = (v: 'primary' | 'default' = 'default'): React.CSSProperties => ({
    padding: '10px 20px', borderRadius: 8, fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    background: v === 'primary' ? '#d4613a' : '#fff', color: v === 'primary' ? '#fff' : '#26231f',
    boxShadow: v === 'default' ? '0 0 0 1px #e6e2dc' : 'none',
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f1efec', fontFamily: "'Golos Text', system-ui, sans-serif" }}>
      {toast && <Toast msg={toast} onClose={() => setToast('')} />}

      <div style={{ maxWidth: 920, margin: '0 auto', padding: '32px 16px' }}>

        {/* Шапка */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{ width: 38, height: 38, background: '#d4613a', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 17 }}>U</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>U-Kan</div>
            <div style={{ fontSize: 11, color: '#8a847c' }}>Отслеживание заказа</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={() => setShowLogin(!showLogin)} style={btn()}>👤 Войти</button>
          </div>
        </div>

        {/* Вход по телефону */}
        {showLogin && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 0 0 1px #e6e2dc' }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Войти в кабинет заказчика</div>
            <form onSubmit={handleLogin} style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inp, flex: 1 }} value={loginPhone2} onChange={e => setLoginPhone2(e.target.value)} placeholder="+7 700 000 00 00" required />
              <button type="submit" style={{ ...btn('primary'), whiteSpace: 'nowrap' }}>ВОЙТИ →</button>
            </form>
            {loginErr && <div style={{ color: '#b03020', fontSize: 13, marginTop: 8 }}>{loginErr}</div>}
          </div>
        )}

        {/* Переключатель вкладок */}
        <div style={{ display: 'flex', gap: 4, background: '#e6e2dc', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
          {(['track', 'submit'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 20px', borderRadius: 7, border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#211f1c' : '#8a847c', boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,.1)' : 'none' }}>
              {t === 'track' ? '📦 Отслеживание заказа' : '✨ Подать заявку'}
            </button>
          ))}
        </div>

        {/* === ТРЕКИНГ === */}
        {tab === 'track' && (
          <div className="anim-fade">
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 0 0 1px #e6e2dc' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ ...inp, flex: 1, fontFamily: "'JetBrains Mono', monospace" }} value={searchId} onChange={e => setSearchId(e.target.value)}
                  placeholder="C-054-060626" onKeyDown={e => e.key === 'Enter' && doSearch()} />
                <button onClick={() => doSearch()} style={{ ...btn('primary'), whiteSpace: 'nowrap' }}>Найти →</button>
              </div>
            </div>

            {trackLoading && <div style={{ textAlign: 'center', padding: 40, color: '#8a847c' }}>Загрузка...</div>}
            {trackErr && <div style={{ background: '#faeaea', color: '#b03020', borderRadius: 10, padding: 16, fontSize: 14 }}>{trackErr}</div>}

            {trackData && (
              <div className="anim-fade">
                {/* Hero карточка */}
                <div style={{ background: '#fff', borderRadius: 14, padding: 24, marginBottom: 16, boxShadow: '0 0 0 1px #e6e2dc' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ fontSize: 32 }}>{trackData.stage >= 5 ? '✅' : trackData.stage >= 3 ? '🚚' : '🏗'}</div>
                      <div>
                        <StatusBadge status={trackData.status} />
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 18, marginTop: 4 }}>{trackData.id}</div>
                        <div style={{ color: '#8a847c', fontSize: 12, marginTop: 2 }}>обновлено {fmtTime(new Date().toISOString())}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 28, fontWeight: 700, color: barColor(trackData.progress) }}>{trackData.progress}%</div>
                      {trackData.legStage && (
                        <div style={{ marginTop: 6, display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20, ...legStageStyle(trackData.legStage) }}>
                          {trackData.legStage}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Прогресс бар */}
                  <div style={{ height: 6, background: '#f1efec', borderRadius: 4, marginBottom: 20, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${trackData.progress}%`, background: barColor(trackData.progress), transition: 'width .5s ease', borderRadius: 4 }} />
                  </div>

                  {/* Timeline шаги */}
                  <div style={{ display: 'flex', gap: 0 }}>
                    {STEPS.map((step, i) => {
                      const done = i + 1 < trackData.stage
                      const current = i + 1 === trackData.stage
                      return (
                        <div key={step} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                          {i > 0 && <div style={{ position: 'absolute', top: 13, right: '50%', left: '-50%', height: 2, background: done ? '#3a9d6e' : '#e6e2dc', zIndex: 0 }} />}
                          <div style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, fontSize: 11, fontWeight: 700, background: done ? '#3a9d6e' : current ? '#d4613a' : '#e6e2dc', color: done || current ? '#fff' : '#8a847c' }}>
                            {done ? '✓' : i + 1}
                          </div>
                          <div style={{ fontSize: 10, color: done ? '#2e8a5e' : current ? '#d4613a' : '#8a847c', marginTop: 6, fontWeight: current ? 700 : 400, textAlign: 'center' }}>{step}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Сетка: позиции + детали */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {/* Левая */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Позиции */}
                    <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 0 0 1px #e6e2dc' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Позиции заказа</div>
                      {trackData.positions.length === 0
                        ? <div style={{ color: '#8a847c', fontSize: 13 }}>Позиции не сформированы</div>
                        : trackData.positions.map((p, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < trackData.positions.length - 1 ? '1px solid #f1efec' : 'none' }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                              <div style={{ fontSize: 12, color: '#8a847c' }}>{p.qty} {p.unit}</div>
                            </div>
                            <StatusBadge status={p.status} />
                          </div>
                        ))
                      }
                    </div>

                    {/* Форма изменения */}
                    {trackData.status !== 'Доставлено' && trackData.status !== 'Архив' && (
                      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 0 0 1px #e6e2dc' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Внести изменение</div>
                        {changeSent
                          ? <div style={{ color: '#2e8a5e', fontSize: 13, padding: '10px 0' }}>✓ Изменение отправлено менеджеру</div>
                          : (
                            <form onSubmit={handleChange} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <textarea style={{ ...inp, resize: 'vertical', minHeight: 80 }} value={changeText} onChange={e => setChangeText(e.target.value)} placeholder="Текст изменения..." required />
                              <input style={inp} value={changePhone} onChange={e => setChangePhone(e.target.value)} placeholder="+7 ___ ___ __ __" />
                              <button type="submit" style={btn('primary')}>Отправить</button>
                            </form>
                          )
                        }
                      </div>
                    )}
                  </div>

                  {/* Правая */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Детали */}
                    <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 0 0 1px #e6e2dc' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Детали заказа</div>
                      {trackData.details.map((d, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < trackData.details.length - 1 ? '1px solid #f1efec' : 'none' }}>
                          <span style={{ fontSize: 12, color: '#8a847c' }}>{d.k}</span>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{d.v}</span>
                        </div>
                      ))}
                    </div>

                    {/* История */}
                    <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 0 0 1px #e6e2dc' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>История</div>
                      {trackData.history.slice(0, 6).map((h, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: i < Math.min(trackData.history.length, 6) - 1 ? '1px solid #f1efec' : 'none', alignItems: 'flex-start' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? '#d4613a' : '#d8d3cc', marginTop: 6, flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13 }}>{h.action}</div>
                            <div style={{ fontSize: 11, color: '#8a847c' }}>{fmtTime(h.time)}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Контакты */}
                    <div style={{ background: '#fff0ea', borderRadius: 12, padding: 16, boxShadow: '0 0 0 1px #f3d5c6' }}>
                      <div style={{ fontSize: 12, color: '#8a847c', marginBottom: 4 }}>Вопросы? Звоните:</div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: '#d4613a' }}>+7 727 350 12 00</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === ПОДАТЬ ЗАЯВКУ === */}
        {tab === 'submit' && (
          <div className="anim-fade">
            {subResult ? (
              <div style={{ background: '#fff', borderRadius: 14, padding: 32, boxShadow: '0 0 0 1px #e6e2dc', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: 20, color: '#2e8a5e', marginBottom: 8 }}>Заявка {subResult.cardId} принята!</div>
                <p style={{ color: '#8a847c', fontSize: 13, marginBottom: 20 }}>Сохраните ссылки для отслеживания</p>

                {[{ label: 'Кабинет', url: subResult.clientUrl, key: 'cab' }, { label: 'Трекинг', url: subResult.trackingUrl, key: 'trk' }].map(({ label, url, key }) => (
                  <div key={key} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#8a847c', marginBottom: 4, textAlign: 'left' }}>{label.toUpperCase()}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ flex: 1, background: '#f1efec', borderRadius: 7, padding: '8px 12px', fontSize: 12, wordBreak: 'break-all', textAlign: 'left' }}>{url}</span>
                      <button onClick={() => copy(url, key)} style={btn()}>{subCopied === key ? '✓' : '📋'}</button>
                    </div>
                  </div>
                ))}
                <a href={subResult.clientUrl} style={{ display: 'block', marginTop: 16, padding: '12px', background: '#d4613a', color: '#fff', borderRadius: 8, fontWeight: 700, textDecoration: 'none', fontSize: 15 }}>
                  Открыть кабинет →
                </a>
              </div>
            ) : (
              <div style={{ maxWidth: 480, margin: '0 auto', background: '#fff', borderRadius: 14, padding: 28, boxShadow: '0 0 0 1px #e6e2dc' }}>
                <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Подать заявку</div>
                <div style={{ color: '#8a847c', fontSize: 13, marginBottom: 24 }}>Заполните форму — получите ссылку для отслеживания</div>

                {subErr && <div style={{ background: '#faeaea', color: '#b03020', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>{subErr}</div>}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#8a847c', marginBottom: 4, display: 'block' }}>ФИО / КОМПАНИЯ *</label>
                    <input style={inp} value={subName} onChange={e => setSubName(e.target.value)} placeholder="Нипа Алматы" required />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#8a847c', marginBottom: 4, display: 'block' }}>ТЕЛЕФОН *</label>
                    <input style={inp} value={subPhone} onChange={e => setSubPhone(e.target.value)} placeholder="+7 700 000 00 00" required />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#8a847c', marginBottom: 4, display: 'block' }}>ТЕКСТ ЗАЯВКИ *</label>
                    <textarea style={{ ...inp, minHeight: 100, resize: 'vertical' }} value={subText} onChange={e => setSubText(e.target.value)} placeholder="Опишите что нужно..." required />
                  </div>
                  <button type="submit" disabled={subLoading} style={{ ...btn('primary'), padding: '12px', fontSize: 15, fontWeight: 700 }}>
                    {subLoading ? 'Отправка...' : 'ОТПРАВИТЬ ЗАЯВКУ →'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
