'use client'
import { useState } from 'react'

export default function HomePage() {
  const [copied, setCopied] = useState('')
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://ulkan.vercel.app'

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  const btnStyle = (variant: 'primary' | 'default' | 'dark' = 'default'): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px',
    borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer', border: 'none',
    background: variant === 'primary' ? '#d4613a' : variant === 'dark' ? '#d4613a' : '#ffffff',
    color: variant === 'primary' || variant === 'dark' ? '#ffffff' : '#26231f',
    boxShadow: variant === 'default' ? '0 0 0 1px #e6e2dc' : 'none',
    textDecoration: 'none', fontFamily: 'inherit',
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f1efec', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
      <div style={{ maxWidth: 800, width: '100%' }}>

        {/* Шапка */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 40, height: 40, background: '#d4613a', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18 }}>U</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 20, color: '#211f1c' }}>U-Kan</div>
            <div style={{ fontSize: 11, color: '#8a847c', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Система управления заказами · Логистика металла</div>
          </div>
        </div>

        <p style={{ color: '#8a847c', fontSize: 14, marginBottom: 28 }}>
          Выберите интерфейс. Все роли работают с единым потоком карточек — от заявки до доставки и учёта.
        </p>

        {/* Блок Админки */}
        <div style={{ background: '#211f1c', borderRadius: 14, padding: 24, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>🟠</span>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Админка</span>
            <span style={{ background: '#3a3631', color: '#cfc9c0', fontSize: 11, padding: '2px 8px', borderRadius: 20, marginLeft: 4 }}>10+ экранов</span>
          </div>
          <p style={{ color: '#8c857a', fontSize: 13, marginBottom: 16 }}>
            Полный контроль: приём заявок, статусы позиций, управление поставщиками, склад, архив, аналитика, бухгалтерия.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {['приём заявок', 'статусы позиций', 'цены · документы · 1С'].map(t => (
              <span key={t} style={{ background: '#322f2b', color: '#a39c92', fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>{t}</span>
            ))}
          </div>
          <a href="/admin" style={{ ...btnStyle('dark'), background: '#d4613a', color: '#fff' }}>Открыть админку →</a>
        </div>

        {/* Кабинет + Трекинг */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 0 0 1px #e6e2dc' }}>
            <div style={{ fontSize: 18, marginBottom: 6 }}>👤</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Кабинет заказчика</div>
            <p style={{ color: '#8a847c', fontSize: 13, marginBottom: 14 }}>Просмотр заявок, подача новых, уведомления о статусах. Вход по телефону.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href="/client/nipa-almaty" style={btnStyle('primary')}>Открыть кабинет →</a>
              <button onClick={() => copy(`${base}/client/`, 'cabinet')} style={btnStyle()}>
                {copied === 'cabinet' ? '✓' : '📋'} Ссылка
              </button>
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 0 0 1px #e6e2dc' }}>
            <div style={{ fontSize: 18, marginBottom: 6 }}>🚚</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Трекинг / Внешние заявки</div>
            <p style={{ color: '#8a847c', fontSize: 13, marginBottom: 14 }}>Публичное отслеживание заказа по ID. Подача заявки без регистрации.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href="/track" style={btnStyle('primary')}>Открыть трекинг →</a>
              <button onClick={() => copy(`${base}/track`, 'track')} style={btnStyle()}>
                {copied === 'track' ? '✓' : '📋'} Ссылка
              </button>
            </div>
          </div>
        </div>

        {/* Портал логиста */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 0 0 1px #e6e2dc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 18 }}>📦</span>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Портал логиста</span>
              <span style={{ background: '#e8f5ee', color: '#2e8a5e', fontSize: 10, padding: '2px 8px', borderRadius: 20 }}>мобильный</span>
            </div>
            <p style={{ color: '#8a847c', fontSize: 13, margin: 0 }}>Мобильный интерфейс для логистов: обновление статусов, ежедневные отчёты.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/rsp/listogib" style={btnStyle('primary')}>Открыть портал →</a>
            <button onClick={() => copy(`${base}/rsp/`, 'rsp')} style={btnStyle()}>
              {copied === 'rsp' ? '✓' : '📋'} Ссылка
            </button>
          </div>
        </div>

        {/* Регистрация */}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <a href="/register" style={{ color: '#8a847c', fontSize: 13 }}>Новый клиент? Зарегистрироваться →</a>
          <span style={{ margin: '0 12px', color: '#d8d3cc' }}>|</span>
          <a href="/login" style={{ color: '#8a847c', fontSize: 13 }}>Войти в систему →</a>
        </div>
      </div>
    </div>
  )
}
