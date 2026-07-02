'use client';
import { useState, useEffect } from 'react';

const CAT_ICONS = { 'Масляные': '🛢', 'Воздушные': '🌬', 'Салонные': '🪟' };

export default function WarehousePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('all');
  const [filter, setFilter] = useState('all'); // all | low | empty | ok
  const [allowAllNeg, setAllowAllNeg] = useState(false);
  const [globalToggling, setGlobalToggling] = useState(false);
  const [markup, setMarkup] = useState(30);
  const [markupSaving, setMarkupSaving] = useState(false);
  const [markupSaved, setMarkupSaved] = useState(false);
  const [editingArt, setEditingArt] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadWarehouse();
    fetch('/api/settings').then(r=>r.json()).then(d=>{
      if(d.ok) setMarkup(d.markup||30);
    }).catch(()=>{});
  }, []);

  async function saveMarkup(val) {
    setMarkupSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ action:'updateMarkup', markup: val })
      });
      setMarkup(val);
      setMarkupSaved(true);
      setTimeout(() => setMarkupSaved(false), 2000);
    } catch(e) { console.error(e); }
    setMarkupSaving(false);
  }

  async function saveStock(art, newStock) {
    setSaving(true);
    try {
      await fetch('/api/warehouse', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'adjustStock', art, stock: newStock })
      });
      setProducts(prev => prev.map(p => p.art === art ? {
        ...p,
        stock: newStock,
        remaining: newStock - Number(p.reserved||0) - Number(p.sold||0)
      } : p));
    } catch(e) { console.error(e); }
    setSaving(false);
    setEditingArt(null);
  }

  async function loadWarehouse() {
    setLoading(true);
    try {
      const res = await fetch('/api/warehouse');
      const data = await res.json();
      if (data.ok) {
        setProducts(data.products || []);
        const allAllow = data.products?.every(p => p.allow_negative);
        setAllowAllNeg(allAllow || false);
      }
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  async function toggleNegative(art, allow) {
    setProducts(prev => prev.map(p => p.art === art ? {...p, allow_negative: allow} : p));
    await fetch('/api/warehouse', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action: 'toggleNegative', art, allow })
    });
  }

  async function toggleAllNegative(allow) {
    setGlobalToggling(true);
    setAllowAllNeg(allow);
    setProducts(prev => prev.map(p => ({...p, allow_negative: allow})));
    await fetch('/api/warehouse', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action: 'toggleAllNegative', allow })
    });
    setGlobalToggling(false);
  }

  const filtered = products.filter(p => {
    if (cat !== 'all' && p.category !== cat) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.art.toLowerCase().includes(q) && !p.app?.toLowerCase().includes(q)) return false;
    }
    const rem = Number(p.remaining || 0);
    if (filter === 'empty' && rem > 0) return false;
    if (filter === 'low' && (rem <= 0 || rem > 5)) return false;
    if (filter === 'ok' && rem <= 5) return false;
    return true;
  });

  const stats = {
    total: products.length,
    ok: products.filter(p => Number(p.remaining) > 5).length,
    low: products.filter(p => Number(p.remaining) > 0 && Number(p.remaining) <= 5).length,
    empty: products.filter(p => Number(p.remaining) <= 0).length,
    allowNeg: products.filter(p => p.allow_negative).length,
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', minHeight: '100vh', background: '#f0f2f8', fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#1a1a4e,#2d2d8e)', color: '#fff', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 10, opacity: .6, letterSpacing: 2 }}>U2B · ТАКУМА</div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>📦 Склад</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display:'flex', gap:8 }}>
          <a href="/invoice" style={{ background:'#ff9800', color:'#fff', borderRadius:8, padding:'5px 12px', fontSize:12, fontWeight:700, textDecoration:'none' }}>📄 Загрузить накладную</a>
          <a href="/admin" style={{ background:'#fff2', color:'#fff', borderRadius:8, padding:'5px 12px', fontSize:12, fontWeight:700, textDecoration:'none' }}>← Админ</a>
        </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { val: stats.ok,    label: 'В наличии', color: '#2e7d32', bg: '#e8f5e9', icon: '🟢', id: 'ok' },
            { val: stats.low,   label: 'Мало (≤5)',  color: '#e65100', bg: '#fff3e0', icon: '🟡', id: 'low' },
            { val: stats.empty, label: 'Нет',        color: '#b71c1c', bg: '#fce4ec', icon: '🔴', id: 'empty' },
            { val: stats.allowNeg, label: 'Минус разр.', color: '#6a1b9a', bg: '#f3e5f5', icon: '⚠️', id: 'neg' },
          ].map((s, i) => (
            <div key={i} onClick={() => setFilter(filter === s.id ? 'all' : s.id)}
              style={{ background: filter === s.id ? s.bg : '#fff', border: `2px solid ${filter === s.id ? s.color : '#e0e0e0'}`, borderRadius: 12, padding: '12px 10px', cursor: 'pointer', textAlign: 'center', transition: 'all .15s' }}>
              <div style={{ fontSize: 22 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1.1 }}>{s.val}</div>
              <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Наценка */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '12px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px #0001' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>💰 Наценка на все товары</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Изменится везде — прайс, заказ, накладная</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input type="number" value={markup}
              onChange={e => setMarkup(parseFloat(e.target.value)||0)}
              onBlur={e => saveMarkup(parseFloat(e.target.value)||0)}
              style={{ width:70, padding:'6px 10px', border:'2px solid #ffd700', borderRadius:8, fontSize:18, fontWeight:800, textAlign:'center', outline:'none' }}/>
            <span style={{ fontWeight:800, fontSize:16 }}>%</span>
            {markupSaved && <span style={{ color:'#4caf50', fontSize:12, fontWeight:700 }}>✅ Сохранено!</span>}
          </div>
        </div>

        {/* Global toggle */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px #0001' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>⚠️ Продажа в минус</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Разрешить продажу при нулевом остатке для всех товаров</div>
          </div>
          <button onClick={() => toggleAllNegative(!allowAllNeg)} disabled={globalToggling}
            style={{ padding: '8px 16px', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 13,
              background: allowAllNeg ? '#e53935' : '#4caf50', color: '#fff', opacity: globalToggling ? .6 : 1 }}>
            {globalToggling ? '...' : allowAllNeg ? '🔴 Запретить всем' : '🟢 Разрешить всем'}
          </button>
        </div>

        {/* Search + filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Поиск по артикулу..."
            style={{ flex: 1, minWidth: 200, padding: '9px 14px', border: '1.5px solid #e0e0e0', borderRadius: 10, fontSize: 14, outline: 'none' }}/>
          <div style={{ display: 'flex', gap: 4 }}>
            {['all','Масляные','Воздушные','Салонные'].map((c, i) => (
              <button key={i} onClick={() => setCat(c === 'all' ? 'all' : c)}
                style={{ padding: '9px 12px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: (c === 'all' ? cat === 'all' : cat === c) ? '#1a1a4e' : '#e8e8f0',
                  color: (c === 'all' ? cat === 'all' : cat === c) ? '#fff' : '#666' }}>
                {c === 'all' ? 'Все' : CAT_ICONS[c]}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>⏳</div>
            Загружаем склад...
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px #0001' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '130px 80px 1fr 70px 70px 70px 70px 100px', background: '#1a1a4e', color: '#fff', padding: '10px 14px', fontSize: 11, fontWeight: 700, gap: 8 }}>
              <span>Артикул</span>
              <span>Кат.</span>
              <span>Применимость</span>
              <span style={{ textAlign: 'center' }}>Приход</span>
              <span style={{ textAlign: 'center' }}>Резерв</span>
              <span style={{ textAlign: 'center' }}>Продано</span>
              <span style={{ textAlign: 'center' }}>Остаток</span>
              <span style={{ textAlign: 'center' }}>Минус</span>
            </div>

            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Нет товаров</div>
            ) : filtered.map((p, i) => {
              const rem = Number(p.remaining || 0);
              const remColor = rem <= 0 ? '#b71c1c' : rem <= 5 ? '#e65100' : '#2e7d32';
              const remBg = rem <= 0 ? '#fce4ec' : rem <= 5 ? '#fff3e0' : '#e8f5e9';

              return (
                <div key={p.art} style={{ display: 'grid', gridTemplateColumns: '130px 80px 1fr 70px 70px 70px 70px 100px', padding: '9px 14px', borderBottom: '1px solid #f0f0f8', background: i % 2 === 0 ? '#fff' : '#fafafa', gap: 8, alignItems: 'center', transition: 'background .1s' }}>
                  <div style={{ fontWeight: 800, fontSize: 12, color: '#1a1a4e' }}>{p.art}</div>
                  <div style={{ fontSize: 18 }}>{CAT_ICONS[p.category] || '📦'}</div>
                  <div style={{ fontSize: 11, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.app}</div>
                  {/* Приход — кликабельный */}
                  <div style={{ textAlign: 'center' }}>
                    {editingArt === p.art ? (
                      <div style={{ display:'flex', alignItems:'center', gap:4, justifyContent:'center' }}>
                        <input type="number" value={editQty} onChange={e => setEditQty(e.target.value)}
                          autoFocus onKeyDown={e => { if(e.key==='Enter') saveStock(p.art, parseInt(editQty)||0); if(e.key==='Escape') setEditingArt(null); }}
                          style={{ width:55, padding:'3px 6px', border:'2px solid #1a1a4e', borderRadius:6, fontSize:13, fontWeight:700, textAlign:'center', outline:'none' }}/>
                        <button onClick={() => saveStock(p.art, parseInt(editQty)||0)} disabled={saving}
                          style={{ padding:'3px 7px', border:'none', borderRadius:6, background:'#4caf50', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700 }}>✓</button>
                        <button onClick={() => setEditingArt(null)}
                          style={{ padding:'3px 7px', border:'none', borderRadius:6, background:'#f0f0f0', color:'#555', cursor:'pointer', fontSize:13 }}>✕</button>
                      </div>
                    ) : (
                      <div onClick={() => { setEditingArt(p.art); setEditQty(String(Number(p.stock||0))); }}
                        style={{ fontSize:13, color:'#2196f3', fontWeight:600, cursor:'pointer', padding:'2px 6px', borderRadius:6, border:'1px dashed transparent' }}
                        title="Нажмите для редактирования">
                        {Number(p.stock||0)} ✏️
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 13, color: '#ff9800', fontWeight: 600 }}>{Number(p.reserved || 0)}</div>
                  <div style={{ textAlign: 'center', fontSize: 13, color: '#9c27b0', fontWeight: 600 }}>{Number(p.sold || 0)}</div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ background: remBg, color: remColor, borderRadius: 6, padding: '3px 8px', fontSize: 13, fontWeight: 800 }}>
                      {rem}
                    </span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <button onClick={() => toggleNegative(p.art, !p.allow_negative)}
                      style={{ padding: '4px 10px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                        background: p.allow_negative ? '#fce4ec' : '#e8f5e9',
                        color: p.allow_negative ? '#c62828' : '#2e7d32' }}>
                      {p.allow_negative ? '🔴 Да' : '🟢 Нет'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: '#aaa' }}>
          Показано: {filtered.length} из {products.length} товаров
        </div>
      </div>

      {/* Кнопка назад для iPhone */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'#fff', borderTop:'1px solid #e0e0e0', padding:'8px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', zIndex:100 }}>
        <button onClick={()=>window.history.back()} style={{ background:'#f0f0f0', border:'none', borderRadius:10, padding:'10px 20px', fontWeight:700, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
          ← Назад
        </button>
        <button onClick={()=>window.scrollTo({top:0,behavior:'smooth'})} style={{ background:'#f0f0f0', border:'none', borderRadius:10, padding:'10px 20px', fontWeight:700, fontSize:14, cursor:'pointer' }}>
          ↑ Вверх
        </button>
      </div>
      <div style={{ height:60 }}/>
    </div>
  );
}
