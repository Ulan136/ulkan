'use client'
import { useState, useEffect, useCallback } from 'react'
import { COLORS } from '@/lib/colors'

interface NomItem {
  id: string
  name: string
  unit: string
  group: string
  cat: string
  subgroup: string
}

// ─── Полная структура групп ───────────────────────────────────────────────────
const TREE: Record<string, Record<string, string[]>> = {
  'Водосток': {
    'Дёке люкс': [],
    'Дёке премиум': [],
    'Дёке серый люкс': [],
    'Дёке стандарт': [],
    'Модерн бюджет 7024': [],
    'Модерн бюджет 8017': [],
    'Модерн бюджет 9003': [],
  },
  'Готовая продукция': {},
  'Материалы': {},
  'Товары': {
    'Армстронг': [],
    'Евро брус': ['Металл профиль', 'Меллиус', 'КМК', 'Разные'],
    'Комплектующие': ['1015', '2004', '3005', '5005', '7004', '7024', '8017', '9003', 'Без цвета', 'Жёлтый', 'Тёмное дерево'],
    'Корабельный брус': [],
    'Крепежные материалы': [],
    'Ленарная панель': [],
    'Металлочерепица': ['Андалузия 7024', 'Андалузия 8019', 'Зелёный 6007', 'Красный 3005', 'Серый 7024', 'Шоколадный 8017'],
    'Проф лист С8': [],
  },
  'Услуги': {},
}

const INP: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 7, fontSize: 13, border: '1.5px solid #e6e2dc', background: '#fff', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }
const LBL: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#8a847c', marginBottom: 4, display: 'block', letterSpacing: '.04em' }

export default function NomenclatureScreen() {
  const [items, setItems] = useState<NomItem[]>([])
  const [loading, setLoading] = useState(false)

  // Выбранный путь в дереве
  const [selGroup, setSelGroup] = useState<string | null>(null)
  const [selCat, setSelCat] = useState<string | null>(null)
  const [selSubgroup, setSelSubgroup] = useState<string | null>(null)

  // Раскрытые группы
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({})

  // Поиск
  const [search, setSearch] = useState('')

  // Редактирование
  const [editItem, setEditItem] = useState<NomItem | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', unit: 'шт', group: '', cat: '', subgroup: '' })
  const [toast, setToast] = useState('')

  function showMsg(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/nomenclature?all=1')
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch { showMsg('Ошибка загрузки') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Фильтрация товаров
  const filtered = items.filter(item => {
    if (search) return item.name.toLowerCase().includes(search.toLowerCase())
    if (selSubgroup) return item.group === selGroup && item.cat === selCat && item.subgroup === selSubgroup
    if (selCat) return item.group === selGroup && item.cat === selCat
    if (selGroup) return item.group === selGroup
    return true
  })

  // Счётчики
  function countGroup(g: string) { return items.filter(i => i.group === g).length }
  function countCat(g: string, c: string) { return items.filter(i => i.group === g && i.cat === c).length }
  function countSubgroup(g: string, c: string, s: string) { return items.filter(i => i.group === g && i.cat === c && i.subgroup === s).length }

  async function handleSave(item: NomItem) {
    try {
      await fetch('/api/nomenclature', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) })
      setEditItem(null)
      load()
      showMsg('✓ Сохранено')
    } catch { showMsg('Ошибка') }
  }

  async function handleCreate() {
    if (!newItem.name) { showMsg('Введите название'); return }
    try {
      await fetch('/api/nomenclature', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newItem) })
      setShowAdd(false)
      setNewItem({ name: '', unit: 'шт', group: selGroup || '', cat: selCat || '', subgroup: selSubgroup || '' })
      load()
      showMsg('✓ Добавлено')
    } catch { showMsg('Ошибка') }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить?')) return
    try {
      await fetch(`/api/nomenclature?id=${id}`, { method: 'DELETE' })
      load()
      showMsg('✓ Удалено')
    } catch { showMsg('Ошибка') }
  }

  // Автозаполнение группы при открытии модалки добавления
  function openAdd() {
    setNewItem({ name: '', unit: 'шт', group: selGroup || '', cat: selCat || '', subgroup: selSubgroup || '' })
    setShowAdd(true)
  }

  const groups = Object.keys(TREE)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', overflow: 'hidden' }}>
      {/* Toast */}
      {toast && <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: '#211f1c', color: '#fff', padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 500, zIndex: 9999 }}>{toast}</div>}

      {/* Шапка */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 20 }}>📦 Номенклатура</div>
        <span style={{ fontSize: 13, color: '#8a847c' }}>{items.length} позиций</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <input style={{ ...INP, width: 240 }} placeholder="🔍 Поиск по названию..." value={search} onChange={e => { setSearch(e.target.value); if (e.target.value) { setSelGroup(null); setSelCat(null); setSelSubgroup(null) } }} />
          <button onClick={load} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #e6e2dc', background: '#fff', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>⟳</button>
          <button onClick={openAdd} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: COLORS.primary, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>+ Добавить</button>
        </div>
      </div>

      {/* Основа */}
      <div style={{ display: 'flex', gap: 16, flex: 1, overflow: 'hidden' }}>

        {/* ── Дерево групп ── */}
        <div style={{ width: 240, flexShrink: 0, background: '#fff', borderRadius: 12, boxShadow: '0 0 0 1.5px #e6e2dc', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 14px', background: '#f8f6f3', borderBottom: '1px solid #e6e2dc', fontSize: 11, fontWeight: 700, color: '#8a847c', letterSpacing: '.04em' }}>ГРУППЫ</div>
          <div style={{ overflowY: 'auto', flex: 1 }}>

            {/* Все */}
            <div onClick={() => { setSelGroup(null); setSelCat(null); setSelSubgroup(null); setSearch('') }}
              style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 13, fontWeight: !selGroup && !search ? 700 : 400, color: !selGroup && !search ? COLORS.primary : '#26231f', background: !selGroup && !search ? '#fff8f5' : '#fff', borderLeft: `3px solid ${!selGroup && !search ? COLORS.primary : 'transparent'}`, display: 'flex', justifyContent: 'space-between' }}>
              <span>Все</span>
              <span style={{ fontSize: 11, color: '#8a847c' }}>{items.length}</span>
            </div>

            {/* Группы */}
            {groups.map(g => {
              const cats = Object.keys(TREE[g])
              const isOpen = openGroups[g]
              const isSelG = selGroup === g && !selCat

              return (
                <div key={g}>
                  {/* Группа */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '9px 14px', cursor: 'pointer', background: isSelG ? '#fff8f5' : '#fff', borderLeft: `3px solid ${isSelG ? COLORS.primary : 'transparent'}` }}
                    onClick={() => { setSelGroup(g); setSelCat(null); setSelSubgroup(null); setSearch('') }}>
                    <span onClick={e => { e.stopPropagation(); setOpenGroups(p => ({ ...p, [g]: !p[g] })) }}
                      style={{ marginRight: 6, fontSize: 11, color: '#8a847c', width: 14, textAlign: 'center', flexShrink: 0 }}>
                      {cats.length > 0 ? (isOpen ? '▼' : '▶') : ''}
                    </span>
                    <span style={{ fontSize: 14, marginRight: 6 }}>📁</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: isSelG ? 700 : 400, color: isSelG ? COLORS.primary : '#26231f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g}</span>
                    <span style={{ fontSize: 11, color: '#8a847c', flexShrink: 0 }}>{countGroup(g)}</span>
                  </div>

                  {/* Подгруппы (категории) */}
                  {isOpen && cats.map(cat => {
                    const subgroups = TREE[g][cat]
                    const isCatOpen = openCats[`${g}/${cat}`]
                    const isSelC = selGroup === g && selCat === cat && !selSubgroup

                    return (
                      <div key={cat}>
                        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px 8px 28px', cursor: 'pointer', background: isSelC ? '#fff8f5' : '#fff', borderLeft: `3px solid ${isSelC ? COLORS.primary : 'transparent'}` }}
                          onClick={() => { setSelGroup(g); setSelCat(cat); setSelSubgroup(null); setSearch('') }}>
                          <span onClick={e => { e.stopPropagation(); setOpenCats(p => ({ ...p, [`${g}/${cat}`]: !p[`${g}/${cat}`] })) }}
                            style={{ marginRight: 6, fontSize: 10, color: '#8a847c', width: 12, textAlign: 'center', flexShrink: 0 }}>
                            {subgroups.length > 0 ? (isCatOpen ? '▼' : '▶') : ''}
                          </span>
                          <span style={{ fontSize: 13, marginRight: 6 }}>📂</span>
                          <span style={{ flex: 1, fontSize: 12, fontWeight: isSelC ? 700 : 400, color: isSelC ? COLORS.primary : '#4a4640', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
                          <span style={{ fontSize: 10, color: '#8a847c', flexShrink: 0 }}>{countCat(g, cat)}</span>
                        </div>

                        {/* Подподгруппы */}
                        {isCatOpen && subgroups.map(sub => {
                          const isSelS = selGroup === g && selCat === cat && selSubgroup === sub
                          return (
                            <div key={sub}
                              onClick={() => { setSelGroup(g); setSelCat(cat); setSelSubgroup(sub); setSearch('') }}
                              style={{ display: 'flex', alignItems: 'center', padding: '7px 14px 7px 46px', cursor: 'pointer', background: isSelS ? '#fff8f5' : '#fff', borderLeft: `3px solid ${isSelS ? COLORS.primary : 'transparent'}` }}>
                              <span style={{ fontSize: 12, marginRight: 6 }}>📄</span>
                              <span style={{ flex: 1, fontSize: 12, fontWeight: isSelS ? 700 : 400, color: isSelS ? COLORS.primary : '#6b655b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>
                              <span style={{ fontSize: 10, color: '#8a847c', flexShrink: 0 }}>{countSubgroup(g, cat, sub)}</span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Таблица товаров ── */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Хлебные крошки */}
          <div style={{ fontSize: 12, color: '#8a847c', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ cursor: 'pointer', color: COLORS.primary }} onClick={() => { setSelGroup(null); setSelCat(null); setSelSubgroup(null) }}>Все</span>
            {selGroup && <><span>›</span><span style={{ cursor: 'pointer', color: COLORS.primary }} onClick={() => { setSelCat(null); setSelSubgroup(null) }}>{selGroup}</span></>}
            {selCat && <><span>›</span><span style={{ cursor: 'pointer', color: COLORS.primary }} onClick={() => setSelSubgroup(null)}>{selCat}</span></>}
            {selSubgroup && <><span>›</span><span style={{ color: '#26231f', fontWeight: 600 }}>{selSubgroup}</span></>}
            {search && <span style={{ color: '#26231f', fontWeight: 600 }}>Поиск: "{search}"</span>}
            <span style={{ marginLeft: 'auto', color: '#8a847c' }}>{filtered.length} позиций</span>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 0 0 1.5px #e6e2dc', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f6f3' }}>
                  {['НАИМЕНОВАНИЕ', 'ЕД.', 'ГРУППА', 'КАТЕГОРИЯ', 'ПОДГРУППА', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#8a847c', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
            </table>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loading
                ? <div style={{ padding: 30, textAlign: 'center', color: '#8a847c' }}>Загрузка...</div>
                : filtered.length === 0
                ? <div style={{ padding: 30, textAlign: 'center', color: '#8a847c' }}>
                    {search ? 'Ничего не найдено' : 'Нет позиций в этой группе'}
                    <div style={{ marginTop: 12 }}>
                      <button onClick={openAdd} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: COLORS.primary, color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>+ Добавить позицию</button>
                    </div>
                  </div>
                : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {filtered.map((item, i) => (
                        <tr key={item.id} style={{ borderTop: '1px solid #f1efec' }}>
                          <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 500 }}>
                            {editItem?.id === item.id
                              ? <input style={{ ...INP, fontSize: 12 }} value={editItem.name} onChange={e => setEditItem(p => p ? { ...p, name: e.target.value } : p)} autoFocus />
                              : item.name
                            }
                          </td>
                          <td style={{ padding: '9px 14px', width: 70 }}>
                            {editItem?.id === item.id
                              ? <input style={{ ...INP, fontSize: 12, width: 55 }} value={editItem.unit} onChange={e => setEditItem(p => p ? { ...p, unit: e.target.value } : p)} />
                              : <span style={{ fontSize: 12, color: '#8a847c' }}>{item.unit}</span>
                            }
                          </td>
                          <td style={{ padding: '9px 14px', width: 130 }}>
                            {editItem?.id === item.id
                              ? <select style={{ ...INP, fontSize: 12 }} value={editItem.group} onChange={e => setEditItem(p => p ? { ...p, group: e.target.value, cat: '', subgroup: '' } : p)}>
                                  <option value="">—</option>
                                  {Object.keys(TREE).map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                              : <span style={{ fontSize: 12, color: '#8a847c' }}>{item.group || '—'}</span>
                            }
                          </td>
                          <td style={{ padding: '9px 14px', width: 160 }}>
                            {editItem?.id === item.id
                              ? <select style={{ ...INP, fontSize: 12 }} value={editItem.cat} onChange={e => setEditItem(p => p ? { ...p, cat: e.target.value, subgroup: '' } : p)}>
                                  <option value="">—</option>
                                  {editItem.group && Object.keys(TREE[editItem.group] || {}).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                              : <span style={{ fontSize: 12, color: '#8a847c' }}>{item.cat || '—'}</span>
                            }
                          </td>
                          <td style={{ padding: '9px 14px', width: 140 }}>
                            {editItem?.id === item.id
                              ? <select style={{ ...INP, fontSize: 12 }} value={editItem.subgroup} onChange={e => setEditItem(p => p ? { ...p, subgroup: e.target.value } : p)}>
                                  <option value="">—</option>
                                  {editItem.cat && (TREE[editItem.group]?.[editItem.cat] || []).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              : <span style={{ fontSize: 12, color: '#8a847c' }}>{item.subgroup || '—'}</span>
                            }
                          </td>
                          <td style={{ padding: '9px 14px', width: 120 }}>
                            {editItem?.id === item.id
                              ? <div style={{ display: 'flex', gap: 4 }}>
                                  <button onClick={() => handleSave(editItem)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: COLORS.primary, color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600 }}>✓</button>
                                  <button onClick={() => setEditItem(null)} style={{ padding: '4px 8px', borderRadius: 6, border: '1.5px solid #e6e2dc', background: '#fff', cursor: 'pointer', fontSize: 12 }}>✕</button>
                                </div>
                              : <div style={{ display: 'flex', gap: 4 }}>
                                  <button onClick={() => setEditItem({ ...item })} style={{ padding: '4px 8px', borderRadius: 6, border: '1.5px solid #e6e2dc', background: '#fff', cursor: 'pointer', fontSize: 12 }}>✏️</button>
                                  <button onClick={() => handleDelete(item.id)} style={{ padding: '4px 8px', borderRadius: 6, border: '1.5px solid #faeaea', background: '#fff', cursor: 'pointer', fontSize: 12 }}>🗑</button>
                                </div>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              }
            </div>
          </div>
        </div>
      </div>

      {/* ── Модалка добавления ── */}
      {showAdd && (
        <div onClick={() => setShowAdd(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480 }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 20 }}>+ Добавить позицию</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={LBL}>НАИМЕНОВАНИЕ *</label><input style={INP} value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} placeholder="Название товара..." autoFocus /></div>
              <div><label style={LBL}>ЕД. ИЗМЕРЕНИЯ</label><input style={INP} value={newItem.unit} onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))} placeholder="шт" /></div>
              <div>
                <label style={LBL}>ГРУППА</label>
                <select style={INP} value={newItem.group} onChange={e => setNewItem(p => ({ ...p, group: e.target.value, cat: '', subgroup: '' }))}>
                  <option value="">— без группы —</option>
                  {Object.keys(TREE).map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              {newItem.group && Object.keys(TREE[newItem.group] || {}).length > 0 && (
                <div>
                  <label style={LBL}>КАТЕГОРИЯ</label>
                  <select style={INP} value={newItem.cat} onChange={e => setNewItem(p => ({ ...p, cat: e.target.value, subgroup: '' }))}>
                    <option value="">—</option>
                    {Object.keys(TREE[newItem.group]).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
              {newItem.cat && (TREE[newItem.group]?.[newItem.cat] || []).length > 0 && (
                <div>
                  <label style={LBL}>ПОДГРУППА</label>
                  <select style={INP} value={newItem.subgroup} onChange={e => setNewItem(p => ({ ...p, subgroup: e.target.value }))}>
                    <option value="">—</option>
                    {(TREE[newItem.group][newItem.cat] || []).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowAdd(false)} style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid #e6e2dc', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>Отмена</button>
              <button onClick={handleCreate} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: COLORS.primary, color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>Добавить →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
