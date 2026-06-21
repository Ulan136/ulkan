'use client'

export default function HomePage() {
  const copy = (url: string) => {
    try { navigator.clipboard.writeText(url) } catch {}
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div style={{ minHeight: '100vh', background: '#f1efec', fontFamily: "'Golos Text', system-ui, sans-serif", padding: '40px 20px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#d4613a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 18 }}>U</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>U-Kan</div>
            <div style={{ fontSize: 11, color: '#8a847c', letterSpacing: .4 }}>СИСТЕМА УПРАВЛЕНИЯ ЗАКАЗАМИ · ЛОГИСТИКА МЕТАЛЛА</div>
          </div>
        </div>

        <p style={{ color: '#6b655b', fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
          Выберите интерфейс. Все роли работают с единым потоком карточек — от заявки до архива.
        </p>

        <div style={{ background: '#211f1c', borderRadius: 14, padding: 24, marginBottom: 16, color: '#cfc9c0' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#fff', marginBottom: 6 }}>🟠 Админка</div>
          <p style={{ fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>Приёмка, статусы, цены, документы, 1С — полный контроль.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {['приём заявок', 'статусы позиций', 'цены · документы · 1С'].map(t => (
              <span key={t} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#3a3631', color: '#bdb7ae' }}>{t}</span>
            ))}
          </div>
          <a href="/login?from=/admin" style={{ background: '#d4613a', color: '#fff', padding: '10px 18px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>Открыть админку →</a>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e6e2dc', padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>👤 Кабинет заказчика</div>
            <p style={{ fontSize: 13, color: '#8a847c', marginBottom: 14, lineHeight: 1.5 }}>Создание заявок, трекинг, изменения.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href="/client" style={{ background: '#d4613a', color: '#fff', padding: '8px 14px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 12 }}>Войти по телефону →</a>
              <a href="/register" style={{ border: '1px solid #e0dcd5', background: '#fff', color: '#26231f', padding: '8px 12px', borderRadius: 8, textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>Регистрация</a>
              <button onClick={() => copy(`${origin}/client`)} style={{ border: '1px solid #e0dcd5', background: '#fff', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>📋 Ссылка</button>
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e6e2dc', padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>🚚 Трекинг</div>
            <p style={{ fontSize: 13, color: '#8a847c', marginBottom: 14, lineHeight: 1.5 }}>Отслеживание и внешние заявки без регистрации.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href="/track" style={{ background: '#d4613a', color: '#fff', padding: '8px 14px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 12 }}>Открыть →</a>
              <button onClick={() => copy(`${origin}/track`)} style={{ border: '1px solid #e0dcd5', background: '#fff', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>📋 Ссылка</button>
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e6e2dc', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>📦 Портал логиста</span>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: '#fff0ea', color: '#c0532a', fontWeight: 600 }}>мобильный</span>
          </div>
          <p style={{ fontSize: 13, color: '#8a847c', marginBottom: 14 }}>Входящие/исходящие позиции, отчёт по смене.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/login?role=logist" style={{ background: '#211f1c', color: '#fff', padding: '8px 14px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 12 }}>Войти →</a>
          </div>
        </div>
      </div>
    </div>
  )
}