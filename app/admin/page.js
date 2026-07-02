'use client';
import { useState, useEffect } from 'react';

const STATUS_COLORS = {
  'Новый':      { bg:'#e3f2fd', color:'#1565c0' },
  'Принят':     { bg:'#e8f5e9', color:'#2e7d32' },
  'Отправлен':  { bg:'#fff3e0', color:'#e65100' },
  'Доставлен':  { bg:'#f3e5f5', color:'#6a1b9a' },
  'Отменён':    { bg:'#fce4ec', color:'#880e4f' },
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [login, setLogin] = useState('');
  const [pass, setPass] = useState('');
  const [authError, setAuthError] = useState('');
  const [remember, setRemember] = useState(false);
  const [tab, setTab] = useState('home');
  const [lastOrderNum, setLastOrderNum] = useState(0);
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const [orders, setOrders] = useState([]);
  const [shops, setShops] = useState([]);
  const [settings, setSettings] = useState({ markup:30, districts:[], contact:'Арслан', phone:'+7 707 422 30 08' });
  const [expenses, setExpenses] = useState([]);
  const [stats, setStats] = useState({ newOrders:0, total:0, shops:0, sent:0 });
  const [loading, setLoading] = useState(false);
  const [orderFilter, setOrderFilter] = useState('all');

  // Modals
  const [shopModal, setShopModal] = useState(null); // null | {mode:'add'|'edit', data:{}}
  const [expenseModal, setExpenseModal] = useState(false);
  const [newExpense, setNewExpense] = useState({ category:'⛽ Топливо', amount:'', comment:'' });
  const [newDistrict, setNewDistrict] = useState('');
  const [expenseCategories, setExpenseCategories] = useState(['Аренда','Зарплата','Транспорт','Реклама','Прочее']);
  const [newExpCat, setNewExpCat] = useState('');
  const [editExpCat, setEditExpCat] = useState(null);
  const [editExpVal, setEditExpVal] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (sessionStorage.getItem('u2b_auth') === '1' || localStorage.getItem('u2b_auth') === '1') {
        setAuthed(true);
      }
    }
    loadAll();

    // Автообновление каждые 30 секунд
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/orders');
        const data = await res.json();
        if (data.ok && data.orders?.length > 0) {
          const maxNum = Math.max(...data.orders.map(o => o.num || 0));
          setLastOrderNum(prev => {
            if (prev > 0 && maxNum > prev) {
              // Новый заказ! Играем звук
              try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
                osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.4);
              } catch(e) {}
              setNewOrderAlert(true);
              setTimeout(() => setNewOrderAlert(false), 5000);
              setOrders(data.orders);
            }
            return maxNum;
          });
        }
      } catch(e) {}
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  async function seedProducts() {
    setSeeding(true); setSeedResult(null);
    try {
      const res = await fetch('/api/products', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'seedProducts', markup: settings.markup||30 })
      });
      const data = await res.json();
      setSeedResult(data.ok ? `✅ Загружено ${data.count} товаров в Neon БД!` : `❌ ${data.error}`);
    } catch(e) { setSeedResult('❌ ' + e.message); }
    setSeeding(false);
  }

  function addExpCat() {
    if (!newExpCat.trim()) return;
    setExpenseCategories(prev => [...prev, newExpCat.trim()]);
    setNewExpCat('');
  }
  function deleteExpCat(cat) {
    setExpenseCategories(prev => prev.filter(c => c !== cat));
  }
  function saveExpCat(idx) {
    if (!editExpVal.trim()) return;
    setExpenseCategories(prev => prev.map((c,i) => i === idx ? editExpVal.trim() : c));
    setEditExpCat(null);
    setEditExpVal('');
  }

  function doLogin() {
    if (login === '707 422 30 08' && pass === 'Ars1989') {
      sessionStorage.setItem('u2b_auth', '1');
      if (remember) localStorage.setItem('u2b_auth', '1');
      setAuthed(true);
      setAuthError('');
    } else {
      setAuthError('Неверный логин или пароль');
    }
  }

  function doLogout() {
    sessionStorage.removeItem('u2b_auth');
    localStorage.removeItem('u2b_auth');
    setAuthed(false);
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [ordersRes, shopsRes, settingsRes, expensesRes] = await Promise.all([
        fetch('/api/orders').then(r=>r.json()),
        fetch('/api/shops').then(r=>r.json()),
        fetch('/api/settings').then(r=>r.json()),
        fetch('/api/expenses').then(r=>r.json()),
      ]);
      if (ordersRes.ok) {
        setOrders(ordersRes.orders||[]);
        const nums = new Set((ordersRes.orders||[]).map(o=>o.order_num));
        setStats({
          newOrders: (ordersRes.orders||[]).filter(o=>o.status==='Новый').length,
          total: nums.size,
          shops: (shopsRes.shops||[]).length,
          sent: (ordersRes.orders||[]).filter(o=>o.status==='Отправлен').length,
        });
      }
      if (shopsRes.ok) setShops(shopsRes.shops||[]);
      if (settingsRes.ok) setSettings(settingsRes);
      if (expensesRes.ok) setExpenses(expensesRes.expenses||[]);
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  async function updateStatus(orderNum, status) {
    await fetch('/api/orders', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'updateStatus', orderNum, status }) });
    setOrders(prev => prev.map(o => o.order_num===orderNum ? {...o, status} : o));
  }

  async function saveShop(data) {
    const action = shopModal?.mode==='edit' ? 'update' : 'add';
    await fetch('/api/shops', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action, ...data }) });
    setShopModal(null);
    loadAll();
  }

  async function deleteShop(name) {
    if (!confirm(`Удалить магазин "${name}"?`)) return;
    await fetch('/api/shops', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'delete', name }) });
    loadAll();
  }

  async function saveExpense() {
    if (!newExpense.amount) return alert('Введите сумму');
    await fetch('/api/expenses', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(newExpense) });
    setExpenseModal(false);
    setNewExpense({ category:'⛽ Топливо', amount:'', comment:'' });
    loadAll();
  }

  async function updateMarkup(val) {
    await fetch('/api/settings', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'updateMarkup', markup: parseFloat(val) }) });
    setSettings(prev=>({...prev, markup:parseFloat(val)}));
  }

  async function addDistrict() {
    if (!newDistrict.trim()) return;
    await fetch('/api/settings', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'addDistrict', name: newDistrict.trim() }) });
    setSettings(prev=>({...prev, districts:[...prev.districts, newDistrict.trim()]}));
    setNewDistrict('');
  }

  async function deleteDistrict(name) {
    await fetch('/api/settings', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'deleteDistrict', name }) });
    setSettings(prev=>({...prev, districts:prev.districts.filter(d=>d!==name)}));
  }

  // Group orders by order_num
  const grouped = {};
  orders.forEach(o => {
    if (!grouped[o.order_num]) grouped[o.order_num] = [];
    grouped[o.order_num].push(o);
  });
  const orderGroups = Object.entries(grouped).map(([num, items]) => ({ num, items, first:items[0] }));
  const filteredGroups = orderFilter==='all' ? orderGroups : orderGroups.filter(g => g.first.status===orderFilter);

  const NAV = [{id:'home',icon:'🏠',label:'Главная'},{id:'orders',icon:'📦',label:'Заказы'},{id:'shops',icon:'🏪',label:'Магазины'},{id:'expenses',icon:'💸',label:'Расходы'},{id:'settings',icon:'⚙️',label:'Настройки'}];

  if (!authed) return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#1a1a4e,#2d2d8e)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Segoe UI',Arial,sans-serif" }}>
      <div style={{ background:'#fff', borderRadius:20, padding:32, width:320, boxShadow:'0 8px 40px #0004' }}>
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ fontSize:36 }}>🔐</div>
          <div style={{ fontWeight:900, fontSize:22, color:'#1a1a4e', marginTop:8 }}>U2B · ТАКУМА</div>
          <div style={{ fontSize:13, color:'#888', marginTop:4 }}>Вход в систему</div>
        </div>
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:12, color:'#555', marginBottom:4, fontWeight:600 }}>Логин</div>
          <input value={login} onChange={e=>setLogin(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&doLogin()}
            placeholder="Номер телефона"
            style={{ width:'100%', padding:'10px 14px', border:'1.5px solid #e0e0e0', borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box' }}/>
        </div>
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:12, color:'#555', marginBottom:4, fontWeight:600 }}>Пароль</div>
          <input type="password" value={pass} onChange={e=>setPass(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&doLogin()}
            placeholder="Пароль"
            style={{ width:'100%', padding:'10px 14px', border:'1.5px solid #e0e0e0', borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box' }}/>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
          <input type="checkbox" id="remember" checked={remember} onChange={e=>setRemember(e.target.checked)}/>
          <label htmlFor="remember" style={{ fontSize:13, color:'#555', cursor:'pointer' }}>Запомнить меня</label>
        </div>
        {authError && <div style={{ background:'#fce4ec', color:'#c62828', borderRadius:8, padding:'8px 12px', fontSize:13, marginBottom:12 }}>⚠️ {authError}</div>}
        <button onClick={doLogin} style={{ width:'100%', padding:13, background:'linear-gradient(135deg,#1a1a4e,#2d2d8e)', color:'#fff', border:'none', borderRadius:10, fontWeight:800, fontSize:15, cursor:'pointer' }}>
          Войти
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth:520, margin:'0 auto', minHeight:'100vh', background:'#f0f2f8', paddingBottom:70 }}>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#1a1a4e,#2d2d8e)', color:'#fff', padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, zIndex:50 }}>
        <div>
          <div style={{ fontSize:10, opacity:.6, letterSpacing:2 }}>U2B · ТАКУМА</div>
          <div style={{ fontSize:18, fontWeight:900 }}>{NAV.find(n=>n.id===tab)?.label||'Главная'}</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <a href="/warehouse" style={{ background:'#4caf50', color:'#fff', borderRadius:8, padding:'5px 10px', fontWeight:700, fontSize:12, textDecoration:'none' }}>📦 Склад</a>
          <a href="/invoice" style={{ background:'#ff9800', color:'#fff', borderRadius:8, padding:'5px 10px', fontWeight:700, fontSize:12, textDecoration:'none' }}>📄 Накладная</a>
          <a href="/price" style={{ background:'#fff2', color:'#fff', borderRadius:8, padding:'5px 10px', fontWeight:700, fontSize:12, textDecoration:'none' }}>📄 Прайс</a>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding:16 }}>

        {/* HOME */}
        {tab==='home' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
              {[
                {icon:'📦',val:stats.newOrders,label:'Новых заказов',color:'#2196f3'},
                {icon:'✅',val:stats.total,label:'Всего заказов',color:'#4caf50'},
                {icon:'🏪',val:stats.shops,label:'Магазинов',color:'#ff9800'},
                {icon:'🚚',val:stats.sent,label:'Отправлено',color:'#9c27b0'},
              ].map((s,i)=>(
                <div key={i} style={{ background:'#fff', borderRadius:12, padding:14, display:'flex', alignItems:'center', gap:12, boxShadow:'0 1px 4px #0001' }}>
                  <div style={{ fontSize:28 }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize:26, fontWeight:900, color:s.color, lineHeight:1 }}>{s.val}</div>
                    <div style={{ fontSize:11, color:'#888', marginTop:2 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Быстрые действия */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <a href="/order" style={{ textDecoration:'none' }}>
                <div style={{ background:'linear-gradient(135deg,#ffd700,#ffb300)', borderRadius:12, padding:'14px 12px', display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:26 }}>🛒</span>
                  <div>
                    <div style={{ fontWeight:800, fontSize:13, color:'#1a1a4e' }}>Новый заказ</div>
                    <div style={{ fontSize:11, color:'#5a4a00' }}>Форма для клиента</div>
                  </div>
                </div>
              </a>
              <a href="/invoice" style={{ textDecoration:'none' }}>
                <div style={{ background:'linear-gradient(135deg,#e8f5e9,#c8e6c9)', borderRadius:12, padding:'14px 12px', display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:26 }}>📄</span>
                  <div>
                    <div style={{ fontWeight:800, fontSize:13, color:'#1a1a4e' }}>Загрузить накладную</div>
                    <div style={{ fontSize:11, color:'#2e7d32' }}>Приход на склад</div>
                  </div>
                </div>
              </a>
            </div>

            {/* Ссылка для клиентов */}
            <div style={{ background:'linear-gradient(135deg,#1a1a4e,#2d2d8e)', borderRadius:12, padding:'12px 14px', marginBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontWeight:800, fontSize:13, color:'#fff' }}>🔗 Ссылка для клиентов</div>
                <div style={{ fontSize:11, color:'#aab', marginTop:2 }}>Отправь клиенту — он сделает заказ сам</div>
              </div>
              <button onClick={() => {
                const url = window.location.origin + '/order';
                navigator.clipboard.writeText(url).then(() => {
                  alert('Ссылка скопирована!\n' + url);
                }).catch(() => {
                  prompt('Скопируй ссылку:', url);
                });
              }} style={{ background:'#ffd700', color:'#1a1a4e', border:'none', borderRadius:8, padding:'8px 14px', fontWeight:800, fontSize:13, cursor:'pointer', flexShrink:0 }}>
                📋 Копировать
              </button>
            </div>

            <div style={{ fontSize:13, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Последние заказы</div>
            {orderGroups.slice(0,5).map(g=>(
              <OrderCard key={g.num} g={g} onStatus={updateStatus}/>
            ))}
            {orderGroups.length===0 && <div style={{ textAlign:'center', padding:40, color:'#aaa' }}>Заказов пока нет</div>}
          </div>
        )}

        {/* ORDERS */}
        {tab==='orders' && (
          <div>
            <div style={{ display:'flex', gap:6, marginBottom:12, overflowX:'auto' }}>
              {['all','Новый','Принят','Отправлен','Доставлен'].map(f=>(
                <button key={f} onClick={()=>setOrderFilter(f)}
                  style={{ padding:'6px 12px', border:'none', borderRadius:20, background:orderFilter===f?'#1a1a4e':'#e8e8f0', color:orderFilter===f?'#fff':'#666', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                  {f==='all'?'Все':f}
                </button>
              ))}
            </div>
            {filteredGroups.map(g=><OrderCard key={g.num} g={g} onStatus={updateStatus} expanded/>)}
            {filteredGroups.length===0 && <div style={{ textAlign:'center', padding:40, color:'#aaa' }}>Нет заказов</div>}
          </div>
        )}

        {/* SHOPS */}
        {tab==='shops' && (
          <div>
            <button onClick={()=>setShopModal({mode:'add',data:{name:'',district:'',address:'',phone:'',contact:''}})}
              style={{ width:'100%', padding:12, background:'#1a1a4e', color:'#fff', border:'none', borderRadius:10, fontWeight:800, cursor:'pointer', marginBottom:14 }}>
              + Добавить магазин
            </button>
            {shops.map((s,i)=>(
              <div key={i} style={{ background:'#fff', borderRadius:12, padding:'12px 14px', marginBottom:8, display:'flex', alignItems:'center', gap:10, boxShadow:'0 1px 4px #0001' }}>
                <div style={{ fontSize:26 }}>🏪</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:14 }}>{s.name}</div>
                  <div style={{ fontSize:12, color:'#888' }}>{s.district} · {s.address}</div>
                  <div style={{ fontSize:12, color:'#888' }}>{s.phone}</div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={()=>setShopModal({mode:'edit',data:s})} style={{ width:32,height:32,border:'none',borderRadius:8,background:'#e8e8ff',color:'#1a1a4e',cursor:'pointer',fontSize:16 }}>✏️</button>
                  <button onClick={()=>deleteShop(s.name)} style={{ width:32,height:32,border:'none',borderRadius:8,background:'#fce4ec',color:'#e53935',cursor:'pointer',fontSize:16 }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* EXPENSES */}
        {tab==='expenses' && (
          <div>
            <button onClick={()=>setExpenseModal(true)}
              style={{ width:'100%', padding:12, background:'#c62828', color:'#fff', border:'none', borderRadius:10, fontWeight:800, cursor:'pointer', marginBottom:14 }}>
              + Добавить расход
            </button>
            {expenses.map((e,i)=>(
              <div key={i} style={{ background:'#fff', borderRadius:10, padding:'10px 14px', marginBottom:6, display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow:'0 1px 3px #0001' }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:13 }}>{e.category}</div>
                  <div style={{ fontSize:11, color:'#aaa' }}>{e.comment} · {new Date(e.created_at).toLocaleDateString('ru-RU')}</div>
                </div>
                <div style={{ fontWeight:800, fontSize:14, color:'#c62828' }}>-{Number(e.amount).toLocaleString('ru')} ₸</div>
              </div>
            ))}
          </div>
        )}

        {/* SETTINGS */}
        {tab==='settings' && (
          <div>
            <div style={{ background:'#fff', borderRadius:12, padding:14, marginBottom:12, boxShadow:'0 1px 4px #0001' }}>
              <div style={{ fontWeight:700, marginBottom:10 }}>💰 Наценка</div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <input type="number" value={settings.markup} onChange={e=>updateMarkup(e.target.value)}
                  style={{ width:80, padding:'8px 12px', border:'1.5px solid #ffd700', borderRadius:8, fontSize:18, fontWeight:800, textAlign:'center', outline:'none' }}/>
                <span style={{ fontSize:18, fontWeight:700, color:'#1a1a4e' }}>%</span>
                <span style={{ fontSize:12, color:'#888' }}>→ автоматически в форме клиента</span>
              </div>
            </div>

            {/* Выйти */}
            <div style={{ background:'#fff', borderRadius:12, padding:14, marginBottom:12, boxShadow:'0 1px 4px #0001' }}>
              <button onClick={doLogout} style={{ width:'100%', padding:'12px', background:'#fce4ec', color:'#c62828', border:'none', borderRadius:10, fontWeight:800, fontSize:14, cursor:'pointer' }}>
                🚪 Выйти из системы
              </button>
            </div>

            {/* Seed products button */}
            <div style={{ background:'#fff', borderRadius:12, padding:16, marginBottom:12, boxShadow:'0 1px 4px #0001' }}>
              <div style={{ fontWeight:700, marginBottom:6 }}>📦 Товары в базе данных</div>
              <div style={{ fontSize:12, color:'#888', marginBottom:12 }}>
                Загрузить все 222 товара Такума в Neon БД. Цена продажи рассчитается по текущей наценке ({settings.markup}%).
              </div>
              <button onClick={seedProducts} disabled={seeding}
                style={{ padding:'12px 20px', background:seeding?'#aaa':'#1a1a4e', color:'#fff', border:'none', borderRadius:10, fontWeight:700, fontSize:14, cursor:seeding?'not-allowed':'pointer', width:'100%' }}>
                {seeding ? '⏳ Загружаем 222 товара...' : '🚀 Загрузить все 222 товара в БД'}
              </button>
              {seedResult && (
                <div style={{ marginTop:10, padding:'10px 14px',
                  background:seedResult.startsWith('✅')?'#e8f5e9':'#fce4ec',
                  borderRadius:8, fontSize:13, fontWeight:600,
                  color:seedResult.startsWith('✅')?'#1b5e20':'#c62828' }}>
                  {seedResult}
                </div>
              )}
            </div>

            <div style={{ background:'#fff', borderRadius:12, padding:14, marginBottom:12, boxShadow:'0 1px 4px #0001' }}>
              <div style={{ fontWeight:700, marginBottom:10 }}>📍 Районы</div>
              {settings.districts?.map((d,i)=>(
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid #f0f0f0' }}>
                  <span style={{ fontSize:13 }}>{d}</span>
                  <button onClick={()=>deleteDistrict(d)} style={{ border:'none', background:'#fce4ec', color:'#e53935', borderRadius:6, padding:'3px 8px', cursor:'pointer', fontSize:12 }}>✕</button>
                </div>
              ))}
              <div style={{ display:'flex', gap:8, marginTop:10 }}>
                <input value={newDistrict} onChange={e=>setNewDistrict(e.target.value)} placeholder="Новый район"
                  style={{ flex:1, padding:'8px 12px', border:'1.5px solid #e0e0e0', borderRadius:8, fontSize:13, outline:'none' }}/>
                <button onClick={addDistrict} style={{ padding:'8px 14px', background:'#1a1a4e', color:'#fff', border:'none', borderRadius:8, fontWeight:700, cursor:'pointer' }}>+</button>
              </div>
            </div>

            {/* Категории расходов */}
            <div style={{ background:'#fff', borderRadius:12, padding:14, marginBottom:12, boxShadow:'0 1px 4px #0001' }}>
              <div style={{ fontWeight:700, marginBottom:10 }}>💸 Категории расходов</div>
              {expenseCategories.map((cat, i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid #f0f0f0' }}>
                  {editExpCat === i ? (
                    <div style={{ display:'flex', gap:6, flex:1 }}>
                      <input value={editExpVal} onChange={e=>setEditExpVal(e.target.value)}
                        onKeyDown={e=>e.key==='Enter'&&saveExpCat(i)}
                        style={{ flex:1, padding:'4px 8px', border:'1.5px solid #1a1a4e', borderRadius:6, fontSize:13, outline:'none' }}/>
                      <button onClick={()=>saveExpCat(i)} style={{ border:'none', background:'#1a1a4e', color:'#fff', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12 }}>✓</button>
                      <button onClick={()=>setEditExpCat(null)} style={{ border:'none', background:'#f0f0f0', color:'#555', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:12 }}>✕</button>
                    </div>
                  ) : (
                    <>
                      <span style={{ fontSize:13 }}>{cat}</span>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={()=>{setEditExpCat(i);setEditExpVal(cat);}} style={{ border:'none', background:'#e8f0ff', color:'#1a1a4e', borderRadius:6, padding:'3px 8px', cursor:'pointer', fontSize:12 }}>✏️</button>
                        <button onClick={()=>deleteExpCat(cat)} style={{ border:'none', background:'#fce4ec', color:'#e53935', borderRadius:6, padding:'3px 8px', cursor:'pointer', fontSize:12 }}>✕</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              <div style={{ display:'flex', gap:8, marginTop:10 }}>
                <input value={newExpCat} onChange={e=>setNewExpCat(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&addExpCat()}
                  placeholder="Новая категория..."
                  style={{ flex:1, padding:'7px 10px', border:'1.5px solid #e0e0e0', borderRadius:8, fontSize:13, outline:'none' }}/>
                <button onClick={addExpCat} style={{ padding:'7px 14px', background:'#1a1a4e', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:700 }}>+</button>
              </div>
            </div>

            <div style={{ background:'#fff', borderRadius:12, padding:14, boxShadow:'0 1px 4px #0001' }}>
              <div style={{ fontWeight:700, marginBottom:10 }}>📞 Контакт</div>
              <div style={{ fontSize:13, color:'#555' }}>Арслан: +7 707 422 30 08</div>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'#fff', borderTop:'1px solid #e8e8f0', display:'flex', zIndex:50 }}>
        {NAV.map(n=>(
          <button key={n.id} onClick={()=>setTab(n.id)} style={{ flex:1, padding:'10px 4px 8px', border:'none', background:'transparent', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3, color:tab===n.id?'#1a1a4e':'#aaa' }}>
            <span style={{ fontSize:22 }}>{n.icon}</span>
            <span style={{ fontSize:10, fontWeight:600 }}>{n.label}</span>
          </button>
        ))}
      </div>

      {/* SHOP MODAL */}
      {shopModal && <ShopModal data={shopModal.data} mode={shopModal.mode} districts={settings.districts||[]} onSave={saveShop} onClose={()=>setShopModal(null)}/>}

      {/* EXPENSE MODAL */}
      {expenseModal && (
        <div style={{ position:'fixed', inset:0, background:'#0006', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:'16px 16px 0 0', width:'100%', maxWidth:480, padding:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
              <span style={{ fontWeight:800, fontSize:16 }}>Новый расход</span>
              <button onClick={()=>setExpenseModal(false)} style={{ background:'#f0f0f0', border:'none', borderRadius:8, width:32, height:32, cursor:'pointer', fontSize:18 }}>×</button>
            </div>
            <select value={newExpense.category} onChange={e=>setNewExpense(p=>({...p,category:e.target.value}))}
              style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #e0e0e0', borderRadius:8, fontSize:14, outline:'none', marginBottom:10 }}>
              {['⛽ Топливо','🍽 Еда','🗂 Офис','📦 Склад','🧾 Налоги','📌 Прочее'].map(c=><option key={c}>{c}</option>)}
            </select>
            <input type="number" value={newExpense.amount} onChange={e=>setNewExpense(p=>({...p,amount:e.target.value}))} placeholder="Сумма ₸"
              style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #e0e0e0', borderRadius:8, fontSize:14, outline:'none', marginBottom:10, boxSizing:'border-box' }}/>
            <input value={newExpense.comment} onChange={e=>setNewExpense(p=>({...p,comment:e.target.value}))} placeholder="Комментарий"
              style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #e0e0e0', borderRadius:8, fontSize:14, outline:'none', marginBottom:14, boxSizing:'border-box' }}/>
            <button onClick={saveExpense} style={{ width:'100%', padding:14, background:'#c62828', color:'#fff', border:'none', borderRadius:10, fontWeight:800, fontSize:15, cursor:'pointer' }}>
              💸 Сохранить расход
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderCard({ g, onStatus, expanded }) {
  const [open, setOpen] = useState(expanded||false);
  const sc = STATUS_COLORS[g.first.status] || { bg:'#f5f5f5', color:'#666' };
  const totalQty = g.items.reduce((s,i)=>s+Number(i.qty),0);
  const totalSum = g.items.reduce((s,i)=>s+Number(i.price||0)*Number(i.qty),0);
  const date = g.first.created_at ? new Date(g.first.created_at).toLocaleDateString('ru-RU') : '';

  return (
    <div style={{ background:'#fff', borderRadius:12, marginBottom:8, overflow:'hidden', boxShadow:'0 1px 4px #0001', borderLeft:`4px solid ${sc.color}` }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ padding:'12px 14px', cursor:'pointer' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontWeight:900, fontSize:15, color:'#1a1a4e' }}>{g.num}</div>
            <div style={{ fontSize:13, color:'#555', marginTop:2 }}>🏪 {g.first.shop_name}</div>
            <div style={{ fontSize:11, color:'#aaa' }}>{date} · {g.items.length} позиц. · {totalQty} шт. · {totalSum.toLocaleString('ru')} ₸</div>
          </div>
          <select value={g.first.status} onClick={e=>e.stopPropagation()} onChange={e=>onStatus(g.num,e.target.value)}
            style={{ border:`1.5px solid ${sc.color}`, borderRadius:8, padding:'5px 8px', fontSize:11, fontWeight:700, color:sc.color, background:sc.bg, outline:'none', cursor:'pointer' }}>
            {['Новый','Принят','Отправлен','Доставлен','Отменён'].map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      {open && (
        <div style={{ borderTop:'1px solid #f0f0f0', padding:'10px 14px', background:'#fafafa' }}>
          <div style={{ fontSize:11, color:'#888', marginBottom:6 }}>{g.first.address} · {g.first.phone}</div>
          {g.items.map((item,i)=>(
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'4px 0', borderBottom:'1px solid #f0f0f0' }}>
              <span style={{ fontWeight:700 }}>{item.art}</span>
              <span style={{ color:'#555' }}>{item.qty} шт. {item.price ? '· '+(Number(item.price)*Number(item.qty)).toLocaleString('ru')+' ₸' : ''}</span>
            </div>
          ))}
          {g.first.note && <div style={{ marginTop:6, fontSize:12, color:'#888', background:'#f0f0f0', padding:'4px 8px', borderRadius:6 }}>💬 {g.first.note}</div>}
        </div>
      )}
    </div>
  );
}

function ShopModal({ data, mode, districts, onSave, onClose }) {
  const [form, setForm] = useState(data);
  return (
    <div style={{ position:'fixed', inset:0, background:'#0006', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:'16px 16px 0 0', width:'100%', maxWidth:480, padding:20, maxHeight:'85vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
          <span style={{ fontWeight:800, fontSize:16 }}>{mode==='edit'?'Редактировать':'Добавить магазин'}</span>
          <button onClick={onClose} style={{ background:'#f0f0f0', border:'none', borderRadius:8, width:32, height:32, cursor:'pointer', fontSize:18 }}>×</button>
        </div>
        {[{label:'Название *',key:'name'},{label:'Адрес',key:'address'},{label:'Телефон',key:'phone'},{label:'Контакт',key:'contact'}].map(f=>(
          <div key={f.key} style={{ marginBottom:10 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#777', marginBottom:4 }}>{f.label}</label>
            <input value={form[f.key]||''} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
              style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #e0e0e0', borderRadius:8, fontSize:14, outline:'none', boxSizing:'border-box' }}/>
          </div>
        ))}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#777', marginBottom:4 }}>Район</label>
          <select value={form.district||''} onChange={e=>setForm(p=>({...p,district:e.target.value}))}
            style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #e0e0e0', borderRadius:8, fontSize:14, outline:'none' }}>
            <option value="">— выберите —</option>
            {districts.map(d=><option key={d}>{d}</option>)}
          </select>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={onClose} style={{ flex:1, padding:12, background:'#f0f0f0', border:'none', borderRadius:10, fontWeight:700, cursor:'pointer' }}>Отмена</button>
          <button onClick={()=>{ if(!form.name) return alert('Введите название'); onSave(form); }}
            style={{ flex:1, padding:12, background:'#4caf50', color:'#fff', border:'none', borderRadius:10, fontWeight:800, cursor:'pointer' }}>✅ Сохранить</button>
        </div>
      </div>
    </div>
  );
}
