<<<<<<< HEAD
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
=======
// app/page.tsx — Главная страница U-Kan
import Link from 'next/link'

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', background: '#f1efec', fontFamily: 'Golos Text, system-ui, sans-serif' }}>
      {/* Hero */}
      <section style={{ padding: '80px 24px 60px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{ width: 36, height: 36, background: '#d4613a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>Ю</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 20, color: '#26231f', letterSpacing: '-0.3px' }}>U-Kan</span>
        </div>

        <div style={{ maxWidth: 680 }}>
          <p style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#d4613a', marginBottom: 16 }}>
            Логистика металлопроката
          </p>
          <h1 style={{ fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 700, lineHeight: 1.1, color: '#211f1c', margin: '0 0 20px', letterSpacing: '-1px' }}>
            Заказы под контролем.<br />Металл в срок.
          </h1>
          <p style={{ fontSize: 18, color: '#6b655b', lineHeight: 1.6, margin: '0 0 40px' }}>
            Платформа для управления поставками металлопроката:
            от заявки до архива, с трекингом для клиента.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/register" style={{ padding: '14px 28px', background: '#d4613a', color: '#fff', borderRadius: 10, fontWeight: 600, fontSize: 15, textDecoration: 'none', display: 'inline-block' }}>
              Оставить заявку
            </Link>
            <Link href="/track" style={{ padding: '14px 28px', background: '#fff', color: '#26231f', border: '1.5px solid #e0dbd3', borderRadius: 10, fontWeight: 600, fontSize: 15, textDecoration: 'none', display: 'inline-block' }}>
              Отследить заказ
            </Link>
            <Link href="/login" style={{ padding: '14px 28px', color: '#6b655b', fontWeight: 500, fontSize: 15, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Войти в систему →
            </Link>
          </div>
        </div>
      </section>

      {/* Этапы */}
      <section style={{ padding: '60px 24px', borderTop: '1px solid #e8e3db' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#211f1c', marginBottom: 36, letterSpacing: '-0.3px' }}>Как работает система</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {[
              { n: '1', title: 'Заявка', desc: 'Клиент оформляет заказ онлайн или по телефону', icon: '📋' },
              { n: '2', title: 'Приёмка', desc: 'Менеджер принимает и обрабатывает заявку', icon: '📦' },
              { n: '3', title: 'Исходящие', desc: 'Логист формирует и контролирует позиции', icon: '🚚' },
              { n: '4', title: 'К учёту', desc: 'Доставленные позиции идут на учёт', icon: '🧾' },
              { n: '5', title: 'Архив', desc: 'Закрытые заказы в базе с историей', icon: '📂' },
            ].map(s => (
              <div key={s.n} style={{ background: '#fff', borderRadius: 12, padding: '24px 20px', border: '1px solid #e8e3db' }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{s.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#d4613a', marginBottom: 6 }}>ШАГ {s.n}</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#211f1c', marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: '#6b655b', lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Для клиентов */}
      <section style={{ padding: '60px 24px', background: '#fff', borderTop: '1px solid #e8e3db', borderBottom: '1px solid #e8e3db' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: '#211f1c', marginBottom: 16, letterSpacing: '-0.3px' }}>Вы — заказчик?</h2>
          <p style={{ fontSize: 16, color: '#6b655b', lineHeight: 1.6, marginBottom: 32 }}>
            Оставьте заявку за 2 минуты и получите персональную ссылку для отслеживания вашего заказа в реальном времени.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" style={{ padding: '14px 32px', background: '#d4613a', color: '#fff', borderRadius: 10, fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>
              Зарегистрироваться
            </Link>
            <Link href="/track" style={{ padding: '14px 32px', background: '#f1efec', color: '#26231f', borderRadius: 10, fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>
              Отследить заказ
            </Link>
          </div>
        </div>
      </section>

      {/* Футер */}
      <footer style={{ padding: '32px 24px', textAlign: 'center', color: '#9d9690', fontSize: 13 }}>
        © 2026 U-Kan · Логистика металлопроката ·{' '}
        <Link href="/login" style={{ color: '#d4613a', textDecoration: 'none' }}>Вход для сотрудников</Link>
      </footer>
    </main>
  )
}
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
