'use client';
import { useState, useEffect, useRef } from 'react';

const CAT_ICONS = { 'Масляные': '🛢', 'Воздушные': '🌬', 'Салонные': '🪟' };
const TRANSLIT = {
  'бмв':'bmw','тойота':'toyota','хендай':'hyundai','киа':'kia','ниссан':'nissan',
  'мерседес':'mercedes','мерс':'mercedes','ауди':'audi','фольксваген':'volkswagen',
  'вольво':'volvo','шевроле':'chevrolet','опель':'opel','мазда':'mazda',
  'митсубиси':'mitsubishi','субару':'subaru','лексус':'lexus','хонда':'honda',
  'рено':'renault','форд':'ford','тесла':'tesla','геели':'geely','чери':'chery',
  'лада':'lada','камри':'camry','прадо':'prado','гольф':'golf','поло':'polo',
  'солярис':'solaris','крета':'creta','туксон':'tucson','спортейдж':'sportage',
  'логан':'logan','дастер':'duster','веста':'vesta','тигго':'tiggo','хавал':'haval',
  'атлас':'atlas','рио':'rio','соренто':'sorento','королла':'corolla','рав4':'rav4',
  'х5':'x5','х6':'x6','а3':'a3','а4':'a4','а6':'a6','паджеро':'pajero',
  'лансер':'lancer','форестер':'forester','импреза':'impreza','аутлендер':'outlander',
};

function smartNorm(q) {
  q = (q||'').toLowerCase().trim();
  for (const [r,e] of Object.entries(TRANSLIT)) q = q.replace(new RegExp(r,'g'),e);
  return q;
}

export default function OrderPage() {
  const [step, setStep] = useState(1);
  const [products, setProducts] = useState([]);
  const [prices, setPrices] = useState({});
  const [markup, setMarkup] = useState(30);
  const [settings, setSettings] = useState({ contact:'Арслан', phone:'+7 707 422 30 08', districts:[] });
  const [cart, setCart] = useState({});
  const [cat, setCat] = useState('all');
  const [search, setSearch] = useState('');
  const [shop, setShop] = useState({ name:'', district:'', address:'', phone:'', contact:'' });
  const [note, setNote] = useState('');
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [savedShops, setSavedShops] = useState([]);
  const [showShops, setShowShops] = useState(false);

  useEffect(() => {
    // Load products
    // Load products from Neon DB
    fetch('/api/products').then(r=>r.json()).then(d => {
      if (d.ok && d.products?.length > 0) {
        setProducts(d.products.map(p => ({
          art: p.art,
          category: p.category,
          app: p.app,
          price: p.price_buy || p.price || 0,
        })));
      }
    }).catch(() => {});

    // Load settings + prices
    Promise.all([
      fetch('/api/settings').then(r=>r.json()),
      fetch('/api/prices').then(r=>r.json()),
      fetch('/api/shops').then(r=>r.json())
    ]).then(([s, p, sh]) => {
      if (s.ok) setSettings(s);
      if (p.ok) { setPrices(p.prices||{}); setMarkup(p.markup||30); }
      if (sh.ok) setSavedShops(sh.shops||[]);
      setPricesLoading(false);
    }).catch(() => setPricesLoading(false));
  }, []);

  // Dynamic import of products
  useEffect(() => {
    fetch('/api/prices').then(r=>r.json()).then(d => {
      if (!d.ok) return;
      // Merge prices into products
      setProducts(prev => prev.map(p => ({
        ...p,
        price: d.prices?.[p.art]?.buy || p.price || 0,
        priceSell: d.prices?.[p.art]?.sell || Math.ceil((p.price||0)*(1+markup/100)/10)*10
      })));
    });
  }, [markup]);

  function sellPrice(art, buyPrice) {
    if (prices[art]?.sell) return prices[art].sell;
    const buy = prices[art]?.buy || buyPrice || 0;
    return Math.ceil(buy * (1 + markup/100) / 10) * 10;
  }

  const filtered = products.filter(p => {
    if (cat !== 'all' && p.category !== cat) return false;
    if (!search) return true;
    const q = smartNorm(search);
    return q.split(/\s+/).every(w =>
      p.art.toLowerCase().includes(w) || smartNorm(p.app).includes(w)
    );
  });

  const cartItems = products.filter(p => cart[p.art] > 0).map(p => ({
    ...p, qty: cart[p.art], sell: sellPrice(p.art, p.price)
  }));
  const total = cartItems.reduce((s, i) => s + i.sell * i.qty, 0);

  function setQty(art, qty) {
    setCart(prev => {
      const next = {...prev};
      if (qty <= 0) delete next[art];
      else next[art] = qty;
      return next;
    });
  }

  async function submit() {
    if (cartItems.length === 0) return alert('Добавьте товары');
    setLoading(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          action: 'newOrder',
          ...shop,
          shopName: shop.name,
          note,
          items: cartItems.map(i => ({
            art: i.art, category: i.category, app: i.app,
            qty: i.qty, price: i.sell
          }))
        })
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess({ orderNum: data.orderNum, items: cartItems, total, shop, date: new Date().toLocaleDateString('ru-RU') });
        setCart({});
        setNote('');
      } else {
        alert('Ошибка: ' + data.error);
      }
    } catch(e) {
      alert('Ошибка соединения');
    }
    setLoading(false);
  }

  if (success) return <SuccessScreen data={success} onNew={() => { setSuccess(null); setStep(1); }} />;

  return (
    <div style={{ maxWidth:480, margin:'0 auto', minHeight:'100vh', background:'#f0f2f8' }}>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#1a1a4e,#2d2d8e)', color:'#fff', padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, zIndex:50 }}>
        <div>
          <div style={{ fontSize:10, opacity:.6, letterSpacing:2 }}>U2B · ТАКУМА</div>
          <div style={{ fontSize:17, fontWeight:900 }}>Прайс-лист фильтров · Заказ</div>
        </div>
        <div style={{ background:'#ffd700', color:'#1a1a4e', borderRadius:8, padding:'5px 12px', fontWeight:800, fontSize:13 }}>TAKUMA</div>
      </div>

      {pricesLoading && (
        <div style={{ background:'#1a1a4e', color:'#fff', padding:'8px 20px', fontSize:12, display:'flex', alignItems:'center', gap:8, justifyContent:'center' }}>
          <div style={{ width:14, height:14, border:'2px solid #fff4', borderTopColor:'#ffd700', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
          Загружаем актуальные цены...
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* Progress */}
      <div style={{ background:'#fff', padding:'12px 20px', display:'flex', alignItems:'center', boxShadow:'0 1px 4px #0001' }}>
        {[{n:1,l:'Магазин'},{n:2,l:'Товары'},{n:3,l:'Итог'}].map((s,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, flexShrink:0, background: step>s.n?'#1a1a4e': step===s.n?'#ffd700':'#e8e8f0', color: step>s.n?'#fff': step===s.n?'#1a1a4e':'#aaa' }}>
                {step>s.n?'✓':s.n}
              </div>
              <span style={{ fontSize:12, fontWeight:step===s.n?700:400, color:step>=s.n?'#1a1a4e':'#aaa' }}>{s.l}</span>
            </div>
            {i<2 && <div style={{ flex:1, height:2, margin:'0 8px', background:step>s.n?'#1a1a4e':'#e8e8f0' }}/>}
          </div>
        ))}
      </div>

      <div style={{ padding:'16px 16px 100px' }}>

        {/* STEP 1 */}
        {step===1 && (
          <div>
            <div style={{ background:'#fff', border:'1.5px solid #e8e8f0', borderRadius:12, padding:14, marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>Ваш магазин</div>
              {[
                {label:'Название магазина *', key:'name', placeholder:'Магазин Арслан'},
                {label:'Адрес *', key:'address', placeholder:'ул. Толеби 3, Шымкент'},
                {label:'Телефон *', key:'phone', placeholder:'+7 707 422 30 08', type:'tel'},
                {label:'Контактное лицо *', key:'contact', placeholder:'Ваше имя'},
              ].map(f => (
                <div key={f.key} style={{ marginBottom:10 }}>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#777', marginBottom:4 }}>{f.label}</label>
                  <input type={f.type||'text'} value={shop[f.key]} onChange={e=>setShop(p=>({...p,[f.key]:e.target.value}))}
                    placeholder={f.placeholder} style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #e0e0e0', borderRadius:8, fontSize:14, outline:'none', boxSizing:'border-box' }}/>
                </div>
              ))}
              <div style={{ marginBottom:10 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#777', marginBottom:4 }}>Район</label>
                <select value={shop.district} onChange={e=>setShop(p=>({...p,district:e.target.value}))}
                  style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #e0e0e0', borderRadius:8, fontSize:14, outline:'none' }}>
                  <option value="">— выберите —</option>
                  {(settings.districts||['Жайылма','Шолаккорган','Ордабасы','Байдибек','Отырар','Сайрам']).map(d=>(
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            {savedShops.length > 0 && (
              <button onClick={()=>setShowShops(!showShops)} style={{ width:'100%', padding:12, background:'#f0f0ff', border:'1.5px solid #1a1a4e', borderRadius:10, color:'#1a1a4e', fontWeight:700, fontSize:14, cursor:'pointer', marginBottom:8 }}>
                📋 Выбрать из сохранённых магазинов
              </button>
            )}
            {showShops && savedShops.map((s,i)=>(
              <div key={i} onClick={()=>{ setShop({name:s.name,district:s.district||'',address:s.address||'',phone:s.phone||'',contact:s.contact||''}); setShowShops(false); }}
                style={{ padding:'10px 14px', border:'1.5px solid #e0e0e0', borderRadius:10, marginBottom:6, cursor:'pointer', background:'#fafafa' }}>
                <div style={{ fontWeight:700 }}>🏪 {s.name}</div>
                <div style={{ fontSize:12, color:'#888' }}>{s.district} · {s.address}</div>
              </div>
            ))}

            <button onClick={()=>{ if(!shop.name||!shop.address||!shop.phone||!shop.contact) return alert('Заполните все поля *'); setStep(2); }}
              style={{ width:'100%', padding:14, background:'#1a1a4e', color:'#fff', border:'none', borderRadius:12, fontWeight:800, fontSize:15, cursor:'pointer' }}>
              Далее → Выбрать товары
            </button>
          </div>
        )}

        {/* STEP 2 */}
        {step===2 && (
          <div>
            <div style={{ position:'relative', marginBottom:12 }}>
              <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:16 }}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск: toyota, бмв, камри..."
                style={{ width:'100%', padding:'10px 14px 10px 38px', border:'1.5px solid #e0e0e0', borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box' }}/>
            </div>

            <div style={{ display:'flex', gap:6, marginBottom:12, overflowX:'auto' }}>
              {['Все','🛢 Масляные','🌬 Воздушные','🪟 Салонные'].map((t,i)=>{
                const cats = [null,'Масляные','Воздушные','Салонные'];
                const active = cat===(cats[i]||'all');
                return <button key={i} onClick={()=>setCat(cats[i]||'all')} style={{ padding:'6px 14px', border:'none', borderRadius:20, background:active?'#1a1a4e':'#e8e8f0', color:active?'#fff':'#666', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>{t}</button>;
              })}
            </div>

            <div>
              {filtered.map(p => {
                const qty = cart[p.art]||0;
                const sp = sellPrice(p.art, p.price);
                return (
                  <div key={p.art} style={{ background:qty>0?'#e8f5e9':'#fff', border:`1.5px solid ${qty>0?'#4caf50':'#e8e8f0'}`, borderRadius:12, padding:'12px 14px', marginBottom:8, display:'flex', alignItems:'center', gap:10 }}>
                    {/* Price block */}
                    <div style={{ textAlign:'center', minWidth:70, background:'#f0f0ff', borderRadius:8, padding:'6px 4px', flexShrink:0 }}>
                      <div style={{ fontSize:9, color:'#aaa', textTransform:'uppercase' }}>цена</div>
                      <div style={{ fontSize:14, fontWeight:900, color:'#1a1a4e' }}>{sp.toLocaleString('ru')} ₸</div>
                      {qty>0 && <div style={{ fontSize:10, color:'#4caf50', fontWeight:700 }}>= {(sp*qty).toLocaleString('ru')} ₸</div>}
                    </div>
                    {/* Info */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:800, fontSize:13, color:'#1a1a4e' }}>{CAT_ICONS[p.category]} {p.art}</div>
                      <div style={{ fontSize:11, color:'#888', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.app}</div>
                      {qty>0 && (
                        <div style={{ display:'flex', gap:4, marginTop:6, flexWrap:'wrap' }}>
                          {[5,10,15,20,25,30].map(n=>(
                            <button key={n} onClick={()=>setQty(p.art,n)}
                              style={{ padding:'4px 7px', border:`1.5px solid ${qty===n?'#1a1a4e':'#ddd'}`, borderRadius:6, background:qty===n?'#1a1a4e':'#f5f5f5', color:qty===n?'#fff':'#555', fontSize:12, fontWeight:700, cursor:'pointer' }}>{n}</button>
                          ))}
                          <input type="number" value={qty} min="1" onChange={e=>setQty(p.art,parseInt(e.target.value)||0)}
                            style={{ width:46, padding:'4px 6px', border:'1.5px solid #ccc', borderRadius:6, fontSize:12, fontWeight:700, textAlign:'center', outline:'none' }}/>
                          <button onClick={()=>setQty(p.art,0)} style={{ padding:'4px 8px', border:'none', borderRadius:6, background:'#fce4ec', color:'#e53935', fontSize:13, cursor:'pointer' }}>✕</button>
                        </div>
                      )}
                    </div>
                    {qty===0 && (
                      <button onClick={()=>setQty(p.art,5)} style={{ padding:'7px 12px', border:'1.5px solid #1a1a4e', borderRadius:8, background:'#f0f0ff', color:'#1a1a4e', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>+ Добавить</button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Total bar */}
            {cartItems.length>0 && (
              <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'#1a1a4e', padding:'12px 16px', boxShadow:'0 -2px 12px #0003' }}>
                <div style={{ maxWidth:480, margin:'0 auto', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ color:'#fff' }}>
                    <div style={{ fontSize:11, opacity:.7 }}>{cartItems.length} позиц. · {cartItems.reduce((s,i)=>s+i.qty,0)} шт.</div>
                    <div style={{ fontSize:20, fontWeight:900, color:'#ffd700' }}>{total.toLocaleString('ru')} ₸</div>
                  </div>
                  <button onClick={()=>setStep(3)} style={{ background:'#ffd700', color:'#1a1a4e', border:'none', borderRadius:10, padding:'10px 20px', fontWeight:800, fontSize:14, cursor:'pointer' }}>
                    Оформить →
                  </button>
                </div>
              </div>
            )}

            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button onClick={()=>setStep(1)} style={{ flex:'0 0 auto', padding:'12px 20px', background:'transparent', color:'#1a1a4e', border:'1.5px solid #1a1a4e', borderRadius:10, fontWeight:700, cursor:'pointer' }}>← Назад</button>
              {cartItems.length>0 && <button onClick={()=>setStep(3)} style={{ flex:1, padding:12, background:'#1a1a4e', color:'#fff', border:'none', borderRadius:10, fontWeight:800, cursor:'pointer' }}>Далее → Итог</button>}
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step===3 && (
          <div>
            <div style={{ background:'#f0f0ff', borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
              <div style={{ fontSize:11, color:'#aaa', marginBottom:4 }}>МАГАЗИН</div>
              <div style={{ fontWeight:700, fontSize:14 }}>{shop.name}</div>
              <div style={{ fontSize:12, color:'#888' }}>{shop.district} · {shop.address}</div>
              <div style={{ fontSize:12, color:'#888' }}>{shop.phone} · {shop.contact}</div>
            </div>

            <div style={{ background:'#fff', border:'1.5px solid #e8e8f0', borderRadius:12, padding:14, marginBottom:12 }}>
              <div style={{ fontSize:11, color:'#aaa', marginBottom:8 }}>ТОВАРЫ ({cartItems.length} позиц.)</div>
              {cartItems.map((item,i)=>(
                <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f0f0f0', fontSize:13 }}>
                  <div>
                    <div style={{ fontWeight:700 }}>{CAT_ICONS[item.category]} {item.art}</div>
                    <div style={{ fontSize:11, color:'#aaa' }}>{item.app?.substring(0,40)}</div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0, marginLeft:8 }}>
                    <div style={{ fontSize:11, color:'#888' }}>{item.qty} × {item.sell.toLocaleString('ru')} ₸</div>
                    <div style={{ fontWeight:800 }}>{(item.qty*item.sell).toLocaleString('ru')} ₸</div>
                  </div>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:10, fontWeight:800, fontSize:16 }}>
                <span>ИТОГО</span>
                <span style={{ color:'#1a1a4e' }}>{total.toLocaleString('ru')} ₸</span>
              </div>
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#777', marginBottom:4 }}>Примечание</label>
              <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Пожелания, срочность..." rows={2}
                style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #e0e0e0', borderRadius:8, fontSize:14, resize:'none', outline:'none', boxSizing:'border-box' }}/>
            </div>

            <div style={{ fontSize:11, color:'#aaa', textAlign:'center', marginBottom:8 }}>Цены актуальны на момент заказа</div>

            <button onClick={submit} disabled={loading}
              style={{ width:'100%', padding:14, background:loading?'#aaa':'#4caf50', color:'#fff', border:'none', borderRadius:12, fontWeight:800, fontSize:15, cursor:loading?'not-allowed':'pointer', marginBottom:8 }}>
              {loading ? '⏳ Отправляем...' : '✅ Отправить заказ'}
            </button>
            <button onClick={()=>setStep(2)} style={{ width:'100%', padding:12, background:'transparent', color:'#1a1a4e', border:'1.5px solid #1a1a4e', borderRadius:12, fontWeight:700, cursor:'pointer' }}>← Назад</button>
          </div>
        )}
      </div>
    </div>
  );
}

function SuccessScreen({ data, onNew }) {
  function downloadPDF() {
    // Canvas-based PDF — кириллица работает нативно
    const canvas = document.createElement('canvas');
    const scale = 2;
    const W = 794;
    const rowH = 36;
    const headerH = 200;
    const footerH = 80;
    const H = headerH + data.items.length * rowH + footerH;
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    // Фон
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);

    // Шапка синяя
    ctx.fillStyle = '#1a1a4e';
    ctx.fillRect(0, 0, W, 60);

    // TAKUMA
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('TAKUMA', 20, 38);

    // Накладная номер
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px Arial';
    ctx.fillText('Накладная ' + data.orderNum, 130, 28);
    ctx.font = '11px Arial';
    ctx.fillStyle = '#ccc';
    ctx.fillText('Арслан: +7 707 422 30 08', 130, 46);
    ctx.textAlign = 'right';
    ctx.fillText(data.date, W - 20, 38);
    ctx.textAlign = 'left';

    // Инфо о магазине
    ctx.fillStyle = '#333';
    ctx.font = 'bold 13px Arial';
    ctx.fillText('Магазин: ' + data.shop.name, 20, 84);
    ctx.font = '12px Arial';
    ctx.fillStyle = '#555';
    ctx.fillText('Адрес: ' + (data.shop.address || ''), 20, 102);
    ctx.fillText('Тел: ' + (data.shop.phone || ''), 20, 118);

    // Разделитель
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, 130);
    ctx.lineTo(W - 20, 130);
    ctx.stroke();

    // Заголовок таблицы
    const tY = 140;
    ctx.fillStyle = '#1a1a4e';
    ctx.fillRect(20, tY, W - 40, 30);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Arial';
    const cols = [28, 55, 190, 500, 590, W - 25];
    const hdrs = ['№', 'Артикул', 'Применимость', 'Кол-во', 'Цена', 'Сумма'];
    const aligns = ['left','left','left','center','right','right'];
    hdrs.forEach((h, i) => {
      ctx.textAlign = aligns[i];
      const x = aligns[i] === 'right' ? cols[i] : aligns[i] === 'center' ? (cols[i] + (cols[i+1]||cols[i]+80))/2 : cols[i];
      ctx.fillText(h, x, tY + 20);
    });

    // Строки товаров
    let total = 0;
    data.items.forEach((item, idx) => {
      const y = tY + 30 + idx * rowH;
      ctx.fillStyle = idx % 2 === 0 ? '#fff' : '#f8f8ff';
      ctx.fillRect(20, y, W - 40, rowH);
      ctx.strokeStyle = '#eee';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(20, y, W - 40, rowH);

      const cy = y + rowH * 0.62;
      const sum = (item.sell || 0) * (item.qty || 0);
      total += sum;

      ctx.fillStyle = '#999';
      ctx.font = '10px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(String(idx + 1), cols[0], cy);

      ctx.fillStyle = '#1a1a4e';
      ctx.font = 'bold 11px Arial';
      ctx.fillText(item.art || '', cols[1], cy);

      ctx.fillStyle = '#444';
      ctx.font = '10px Arial';
      const appText = (item.app || '').substring(0, 44);
      ctx.fillText(appText, cols[2], cy);

      ctx.fillStyle = '#333';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(String(item.qty || 0) + ' шт', (cols[3] + cols[4]) / 2 - 10, cy);

      ctx.textAlign = 'right';
      ctx.font = '11px Arial';
      ctx.fillStyle = '#666';
      ctx.fillText((item.sell || 0).toLocaleString('ru') + ' \u20B8', cols[4], cy);

      ctx.font = 'bold 12px Arial';
      ctx.fillStyle = '#1a1a4e';
      ctx.fillText(sum.toLocaleString('ru') + ' \u20B8', cols[5], cy);
      ctx.textAlign = 'left';
    });

    // Итого
    const totY = tY + 30 + data.items.length * rowH;
    ctx.fillStyle = '#e8f5e9';
    ctx.fillRect(20, totY, W - 40, 40);
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(20, totY, W - 40, 40);

    ctx.fillStyle = '#1b5e20';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('ИТОГО:', cols[2], totY + 26);

    ctx.textAlign = 'right';
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = '#1a1a4e';
    ctx.fillText(total.toLocaleString('ru') + ' \u20B8', cols[5], totY + 27);
    ctx.textAlign = 'left';

    // Подпись
    ctx.fillStyle = '#aaa';
    ctx.font = '9px Arial';
    ctx.fillText('U2B \u00B7 ТАКУМА \u00B7 Арслан +7 707 422 30 08', 20, totY + 65);
    ctx.textAlign = 'right';
    ctx.fillText(data.date, W - 20, totY + 65);
    ctx.textAlign = 'left';

    // Генерация PDF
    const imgData = canvas.toDataURL('image/png');
    const loadPDF = () => {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [W, H] });
      pdf.addImage(imgData, 'PNG', 0, 0, W, H);
      pdf.save('Накладная_' + data.orderNum + '_' + (data.shop.name || '') + '.pdf');
    };
    if (window.jspdf) { loadPDF(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = loadPDF;
    document.head.appendChild(s);
  }

  return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'40px 16px', textAlign:'center' }}>
      <div style={{ fontSize:70 }}>✅</div>
      <div style={{ fontSize:22, fontWeight:900, color:'#1a1a4e', margin:'12px 0 8px' }}>Заказ принят!</div>
      <div style={{ background:'#e8f5e9', border:'2px solid #4caf50', borderRadius:14, padding:'14px 24px', display:'inline-block', margin:'8px 0 16px' }}>
        <div style={{ fontSize:10, color:'#888' }}>НОМЕР ЗАКАЗА</div>
        <div style={{ fontSize:32, fontWeight:900, color:'#2e7d32', letterSpacing:2 }}>{data.orderNum}</div>
        <div style={{ fontSize:12, color:'#888' }}>{data.date}</div>
      </div>

      <div style={{ background:'#f9f9f9', border:'1.5px dashed #ccc', borderRadius:12, padding:14, margin:'0 0 14px', textAlign:'left' }}>
        <div style={{ fontWeight:800, fontSize:14, color:'#1a1a4e', marginBottom:8 }}>📋 Накладная</div>
        <div style={{ fontSize:12, color:'#888', marginBottom:8 }}>{data.shop.name} · {data.shop.address} · {data.date}</div>
        {data.items.map((item,i) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid #f0f0f0', fontSize:12 }}>
            <div><span style={{ fontWeight:700 }}>{item.art}</span><span style={{ color:'#aaa', marginLeft:6 }}>{(item.app||'').substring(0,30)}</span></div>
            <div style={{ textAlign:'right', marginLeft:8 }}>
              <span style={{ color:'#888' }}>{item.qty} × {item.sell.toLocaleString('ru')} ₸ = </span>
              <span style={{ fontWeight:700 }}>{(item.qty*item.sell).toLocaleString('ru')} ₸</span>
            </div>
          </div>
        ))}
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:10, fontWeight:800, fontSize:15 }}>
          <span>ИТОГО</span><span style={{ color:'#1a1a4e' }}>{data.total.toLocaleString('ru')} ₸</span>
        </div>
      </div>

      <button onClick={downloadPDF} style={{ width:'100%', padding:14, background:'#1a1a4e', color:'#fff', border:'none', borderRadius:12, fontWeight:800, fontSize:15, cursor:'pointer', marginBottom:8 }}>
        📥 Скачать накладную PDF
      </button>
      <div style={{ color:'#888', fontSize:13, margin:'8px 0 12px' }}>Арслан: +7 707 422 30 08</div>
      <button onClick={onNew} style={{ width:'100%', padding:12, background:'transparent', color:'#1a1a4e', border:'1.5px solid #1a1a4e', borderRadius:12, fontWeight:700, cursor:'pointer' }}>
        + Новый заказ
      </button>
    </div>
  );
}
