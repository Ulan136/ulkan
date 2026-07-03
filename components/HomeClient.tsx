'use client'

export default function HomeClient() {
  const btn = (variant: 'primary' | 'default' = 'default'): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px',
    borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer', border: 'none',
    background: variant === 'primary' ? '#d4613a' : '#ffffff',
    color: variant === 'primary' ? '#ffffff' : '#26231f',
    boxShadow: variant === 'default' ? '0 0 0 1px #e6e2dc' : 'none',
    textDecoration: 'none', fontFamily: 'inherit',
  })

  // Кабинеты (вход по учётным данным)
  const cabinets: { icon: string; title: string; desc: string; href: string; tag?: string }[] = [
    { icon: '🟠', title: 'Админка', desc: 'Приём заявок, статусы, склад, бухгалтерия, архив.', href: '/login?from=/admin', tag: 'email + пароль' },
    { icon: '👤', title: 'Кабинет заказчика', desc: 'Просмотр и подача заявок, уведомления.', href: '/login', tag: 'телефон' },
    { icon: '🚚', title: 'Портал логиста', desc: 'Доставка, статусы позиций, отчёты смены.', href: '/login', tag: 'телефон' },
    { icon: '🏢', title: 'Портал филиала', desc: 'Приём товара и передача логисту (двойное плечо).', href: '/login', tag: 'телефон' },
    { icon: '🏭', title: 'Портал склада', desc: 'Приход, резервы, расход, остатки.', href: '/login', tag: 'телефон' },
  ]

  const card: React.CSSProperties = { background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 0 0 1px #e6e2dc', display: 'flex', flexDirection: 'column' }

  return (
    <div style={{ minHeight: '100vh', background: '#f1efec', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px', fontFamily: "'Golos Text', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 900, width: '100%' }}>

        {/* Шапка */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 40, height: 40, background: '#d4613a', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18 }}>U</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 20, color: '#211f1c' }}>U-Kan</div>
            <div style={{ fontSize: 11, color: '#8a847c', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Система управления заказами · Логистика металла</div>
          </div>
          <a href="/login" style={{ ...btn('primary'), marginLeft: 'auto' }}>Войти →</a>
        </div>

        <p style={{ color: '#8a847c', fontSize: 14, marginBottom: 28 }}>
          Единый поток карточек — от заявки до доставки и учёта. Выберите свой кабинет.
        </p>

        {/* Кабинеты */}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#8a847c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Кабинеты</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginBottom: 28 }}>
          {cabinets.map(c => (
            <div key={c.title} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>{c.icon}</span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{c.title}</span>
              </div>
              {c.tag && <span style={{ alignSelf: 'flex-start', background: '#f1efec', color: '#8a847c', fontSize: 10, padding: '2px 8px', borderRadius: 20, marginBottom: 8 }}>{c.tag}</span>}
              <p style={{ color: '#8a847c', fontSize: 13, marginBottom: 14, flex: 1 }}>{c.desc}</p>
              <a href={c.href} style={{ ...btn('primary'), alignSelf: 'flex-start' }}>Войти →</a>
            </div>
          ))}
        </div>

        {/* Клиентам без регистрации */}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#8a847c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Клиентам без регистрации</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginBottom: 24 }}>
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>🔍</span>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Трекинг заказа</span>
            </div>
            <p style={{ color: '#8a847c', fontSize: 13, marginBottom: 14, flex: 1 }}>Отслеживание по номеру заказа. Без регистрации.</p>
            <a href="/track" style={{ ...btn('default'), alignSelf: 'flex-start' }}>Открыть →</a>
          </div>
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>✨</span>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Подать заявку</span>
            </div>
            <p style={{ color: '#8a847c', fontSize: 13, marginBottom: 14, flex: 1 }}>Частный заказ без регистрации — оставьте телефон и текст.</p>
            <a href="/track?tab=submit" style={{ ...btn('default'), alignSelf: 'flex-start' }}>Оставить заявку →</a>
          </div>
        </div>

        {/* Нижняя ссылка */}
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <a href="/register" style={{ color: '#8a847c', fontSize: 13 }}>Новый клиент? Зарегистрироваться →</a>
          <span style={{ margin: '0 12px', color: '#d8d3cc' }}>|</span>
          <a href="/login" style={{ color: '#8a847c', fontSize: 13 }}>Войти в систему →</a>
        </div>
      </div>
    </div>
  )
}
