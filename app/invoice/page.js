'use client';
import { useState, useRef } from 'react';

const CAT_ICONS = { 'Масляные': '🛢', 'Воздушные': '🌬', 'Салонные': '🪟', 'Прочие': '📦' };

export default function InvoicePage() {
  const [step, setStep]         = useState(1); // 1=upload, 2=preview, 3=done
  const [items, setItems]       = useState([]);
  const [invoiceInfo, setInvoiceInfo] = useState({ num: '', date: '', supplier: 'Такума' });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [result, setResult]     = useState(null);
  const fileRef = useRef();

  // ── Read PDF as text ──────────────────────────────────────────────────────
  async function handleFile(file) {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      // Use PDF.js to extract text
      const text = await extractPDFText(file);
      
      // Extract invoice number and date
      const numMatch  = text.match(/накладная\s*[№#]\s*(\d+)/i);
      const dateMatch = text.match(/от\s+(\d+\s+\w+\s+\d{4})/i);
      if (numMatch)  setInvoiceInfo(p => ({...p, num: numMatch[1]}));
      if (dateMatch) setInvoiceInfo(p => ({...p, date: dateMatch[1]}));

      // Parse items via API
      const res = await fetch('/api/invoice', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'parseInvoice', text })
      });
      const data = await res.json();
      
      if (data.ok && data.items.length > 0) {
        setItems(data.items);
        setStep(2);
      } else {
        setError('Товары Такума не найдены в накладной. Проверьте формат файла.');
      }
    } catch (e) {
      setError('Ошибка чтения PDF: ' + e.message);
    }
    setLoading(false);
  }

  async function extractPDFText(file) {
    // Load PDF.js
    if (!window.pdfjsLib) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + '\n';
    }
    return text;
  }

  // ── Update qty/price manually ─────────────────────────────────────────────
  function updateItem(idx, field, value) {
    setItems(prev => prev.map((item, i) =>
      i === idx ? {...item, [field]: field === 'qty' ? parseInt(value)||0 : parseFloat(value)||0} : item
    ));
  }

  function removeItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  // ── Confirm purchase ──────────────────────────────────────────────────────
  async function confirm() {
    if (items.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/invoice', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          action: 'confirmPurchase',
          items,
          supplier:    invoiceInfo.supplier,
          invoiceNum:  invoiceInfo.num,
          invoiceDate: invoiceInfo.date,
        })
      });
      const data = await res.json();
      if (data.ok) {
        setResult(data);
        setStep(3);
      } else {
        setError('Ошибка: ' + data.error);
      }
    } catch (e) {
      setError('Ошибка соединения');
    }
    setLoading(false);
  }

  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const totalSum = items.reduce((s, i) => s + i.qty * i.price_buy, 0);

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', minHeight: '100vh', background: '#f0f2f8', fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#1a1a4e,#2d2d8e)', color: '#fff', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 10, opacity: .6, letterSpacing: 2 }}>U2B · ТАКУМА</div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>📄 Загрузка накладной</div>
        </div>
        <a href="/admin" style={{ background: '#fff2', color: '#fff', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>← Админ</a>
      </div>

      {/* Progress */}
      <div style={{ background: '#fff', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 1px 4px #0001' }}>
        {[{n:1,l:'Загрузить PDF'},{n:2,l:'Проверить'},{n:3,l:'Готово'}].map((s,i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800,
                background: step > s.n ? '#1a1a4e' : step === s.n ? '#ffd700' : '#e8e8f0',
                color: step > s.n ? '#fff' : step === s.n ? '#1a1a4e' : '#aaa' }}>
                {step > s.n ? '✓' : s.n}
              </div>
              <span style={{ fontSize: 12, fontWeight: step === s.n ? 700 : 400, color: step >= s.n ? '#1a1a4e' : '#aaa' }}>{s.l}</span>
            </div>
            {i < 2 && <div style={{ flex: 1, height: 2, margin: '0 8px', background: step > s.n ? '#1a1a4e' : '#e8e8f0' }}/>}
          </div>
        ))}
      </div>

      <div style={{ padding: 16 }}>

        {/* STEP 1: Upload */}
        {step === 1 && (
          <div>
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 12, boxShadow: '0 1px 4px #0001' }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>📋 Формат накладной Такума</div>
              <div style={{ background: '#f5f5f5', borderRadius: 8, padding: 12, fontSize: 12, color: '#555', lineHeight: 1.8, fontFamily: 'monospace' }}>
                Расходная накладная № 141 от 30 июня 2026 г.<br/>
                1 | 00000000113 | Воздушный фильтр Такума TA 2420 B | 10,000 шт | 788,00 | 7 880,00<br/>
                2 | 00000000197 | Масляный фильтр Такума T01 5016 M | 10,000 шт | 634,00 | 6 340,00
              </div>
              <div style={{ fontSize: 11, color: '#4caf50', marginTop: 8 }}>✅ Система автоматически распознаёт артикулы TA, TO, TK, T01</div>
            </div>

            {/* Upload zone */}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
              style={{ border: '2px dashed #1a1a4e', borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer', background: '#fff', transition: 'background .15s' }}>
              <div style={{ fontSize: 50, marginBottom: 10 }}>📄</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a4e', marginBottom: 6 }}>Нажмите — откроется проводник</div>
              <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>Выберите PDF накладную от Такума</div>
              <div style={{ background: '#1a1a4e', color: '#fff', borderRadius: 10, padding: '10px 24px', display: 'inline-block', fontWeight: 700, fontSize: 14 }}>
                📂 Открыть проводник
              </div>
              <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])}/>
            </div>

            {loading && (
              <div style={{ textAlign: 'center', padding: 30, color: '#1a1a4e' }}>
                <div style={{ width: 40, height: 40, border: '3px solid #e0e0e0', borderTopColor: '#1a1a4e', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 12px' }}/>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                Читаем накладную...
              </div>
            )}

            {error && (
              <div style={{ background: '#fce4ec', border: '1px solid #ef9a9a', borderRadius: 10, padding: 12, marginTop: 12, color: '#c62828', fontSize: 13 }}>
                ⚠️ {error}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Preview */}
        {step === 2 && (
          <div>
            {/* Invoice info */}
            <div style={{ background: '#e8f0ff', borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>📋 Данные накладной</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { label: 'Накладная №', key: 'num', placeholder: '141' },
                  { label: 'Дата', key: 'date', placeholder: '30 июня 2026' },
                  { label: 'Поставщик', key: 'supplier', placeholder: 'Такума' },
                ].map(f => (
                  <div key={f.key} style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>{f.label}</div>
                    <input value={invoiceInfo[f.key]} onChange={e => setInvoiceInfo(p => ({...p, [f.key]: e.target.value}))}
                      placeholder={f.placeholder}
                      style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #c5cae9', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}/>
                  </div>
                ))}
              </div>
            </div>

            {/* Items table */}
            <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px #0001', marginBottom: 12 }}>
              <div style={{ background: '#1a1a4e', color: '#fff', padding: '10px 14px', fontWeight: 700, fontSize: 13 }}>
                Распознано товаров: {items.length} позиций · {totalQty} шт.
              </div>
              {items.map((item, idx) => (
                <div key={idx} style={{ padding: '10px 14px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10, background: idx%2===0?'#fff':'#fafafa' }}>
                  <div style={{ fontSize: 20, flexShrink: 0 }}>{CAT_ICONS[item.category]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#1a1a4e' }}>{item.art}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{item.category}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#aaa', textAlign: 'center' }}>Кол-во</div>
                      <input type="number" value={item.qty} onChange={e => updateItem(idx, 'qty', e.target.value)}
                        style={{ width: 60, padding: '5px 6px', border: '1.5px solid #e0e0e0', borderRadius: 6, fontSize: 13, fontWeight: 700, textAlign: 'center', outline: 'none' }}/>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#aaa', textAlign: 'center' }}>Цена ₸</div>
                      <input type="number" value={item.price_buy} onChange={e => updateItem(idx, 'price_buy', e.target.value)}
                        style={{ width: 80, padding: '5px 6px', border: '1.5px solid #e0e0e0', borderRadius: 6, fontSize: 13, fontWeight: 700, textAlign: 'center', outline: 'none' }}/>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: '#aaa' }}>Сумма</div>
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#1a1a4e' }}>{(item.qty * item.price_buy).toLocaleString('ru')} ₸</div>
                    </div>
                    <button onClick={() => removeItem(idx)}
                      style={{ width: 28, height: 28, border: 'none', borderRadius: 6, background: '#fce4ec', color: '#e53935', cursor: 'pointer', fontSize: 14 }}>✕</button>
                  </div>
                </div>
              ))}
              <div style={{ padding: '12px 14px', background: '#e8f5e9', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15 }}>
                <span>ИТОГО: {items.length} позиц. · {totalQty} шт.</span>
                <span style={{ color: '#1b5e20' }}>{totalSum.toLocaleString('ru')} ₸</span>
              </div>
            </div>

            {error && (
              <div style={{ background: '#fce4ec', borderRadius: 10, padding: 10, marginBottom: 12, color: '#c62828', fontSize: 13 }}>⚠️ {error}</div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setStep(1); setItems([]); setError(''); }}
                style={{ flex: 1, padding: 12, background: '#f0f0f0', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                ← Загрузить другой
              </button>
              <button onClick={confirm} disabled={loading || items.length === 0}
                style={{ flex: 2, padding: 14, background: loading ? '#aaa' : '#4caf50', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? '⏳ Сохраняем...' : `✅ Подтвердить приход (${items.length} позиц.)`}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Done */}
        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 70, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#1a1a4e', marginBottom: 8 }}>Приход оформлен!</div>
            <div style={{ background: '#e8f5e9', border: '2px solid #4caf50', borderRadius: 12, padding: 16, marginBottom: 20, display: 'inline-block' }}>
              <div style={{ fontSize: 14, color: '#2e7d32', fontWeight: 700 }}>Накладная № {invoiceInfo.num}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#1b5e20', margin: '6px 0' }}>{result?.updated} позиций</div>
              <div style={{ fontSize: 12, color: '#888' }}>{invoiceInfo.date} · {invoiceInfo.supplier}</div>
            </div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
              Остатки на складе обновлены автоматически
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <a href="/warehouse" style={{ padding: '12px 20px', background: '#1a1a4e', color: '#fff', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>
                📦 Посмотреть склад
              </a>
              <button onClick={() => { setStep(1); setItems([]); setInvoiceInfo({num:'',date:'',supplier:'Такума'}); setResult(null); }}
                style={{ padding: '12px 20px', background: '#f0f0f0', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                + Новая накладная
              </button>
            </div>
          </div>
        )}

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
