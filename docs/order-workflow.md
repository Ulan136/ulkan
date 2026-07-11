# Карта workflow заказа

Извлечено из `app/api/orders/[id]/action/route.ts` (эндпоинт `POST /api/orders/:id/action`).
Документ описывает поведение **как есть** на момент этапа 4a — код не менялся.

## Как устроен обработчик

```
POST /api/orders/:id/action   body = { action, ...payload }
```

1. `requireSession(req)` — нет сессии → 401.
2. Загружается заказ с позициями (`orderInclude`); нет заказа → 404 «Карточка не найдена».
3. `switch (action)` наполняет две локальные переменные: `updateData` (частичный патч заказа) и `historyText`.
4. После `switch`:
   - если `Object.keys(updateData).length > 0` → `prisma.order.update({ data: updateData })`;
   - если `historyText` непустой → `prisma.history.create({ cardId, action: historyText, userName: session.name })`;
   - возвращается перечитанный заказ `{ success: true, order }`.
5. Любое исключение внутри `try` → 500 «Ошибка выполнения действия».

> **Важно про «откуда».** В коде **нет проверок исходного состояния** (screen/block/status) ни для одного action, кроме `sendArchive` (требует `posted1C`). То есть любой переход технически применим из любого состояния. В колонке «откуда» ниже указано **логически ожидаемое** исходное состояние (по комментариям и потоку экранов), а не проверяемое кодом.

Ожидаемый поток экранов:
```
incoming ──accept──▶ reception ──take──▶ (block=processing) ──process──▶ outgoing
   ▲                                                                        │
   └──────── (все позиции Доставлено: updatePos/markAll) ◀───────────────────┘
incoming ──sendAcc──▶ accounting ──postAcc──▶ bookkeeping ──sendArchive──▶ archive
```

---

## 1. Таблица переходов

| action | откуда (ожид.) | куда (updateData) | guard | побочные эффекты |
|---|---|---|---|---|
| `accept` | incoming | `screen=reception, block=waiting, status=Принят` | — | History: «Принят в приёмку» |
| `take` | reception | `status=В обработке, block=processing` | — | History: «Взят в обработку». **Позиции:** если `positions.length===0 && comment` — парсит `comment` построчно и `createMany` позиций (см. Особые сценарии) |
| `process` | reception (block 2) | `screen=outgoing, status=В работе, block=''` | — | **Склад:** для каждой позиции с `supplier='Центр Склад' && qty>0 && name1c` → `reserveStock(pos.id, name1c, qty)`. History: «Отправлен в Исходящие» или «…(зарезервировано N позиций на складе)» если N>0 |
| `updatePos` | outgoing | `{}` обычно; при полной доставке → `screen=incoming, status=Доставлено, toacc=true, delivered=now` | — | Обновляет статус одной позиции (`payload.posId`,`payload.status`). См. эффекты ниже и авто-правило «все доставлены» |
| `markAll` | outgoing | `screen=incoming, status=Доставлено, toacc=true, delivered=now` | — | `updateMany` все позиции → `Доставлено`. Notify client «Заказ {id} доставлен!». Авто-приход на склад если `to='Центр Склад'` |
| `sendAcc` | incoming | `screen=accounting, status=К учёту` | — | History: «Отправлен к учёту» |
| `postAcc` | accounting | `screen=bookkeeping, status=Бухгалтерия, toacc=false` | — | History: «Проведён в бухгалтерию» |
| `returnOut` | outgoing | `screen=incoming, status=В ожидании, block='', toacc=false` | — | History: «Возвращён из исходящих» |
| `returnToAcc` | bookkeeping | `screen=accounting, status=К учёту, toacc=true` | — | History: «Возвращён к учёту» |
| `cancel` | любое | `isCancelled=true, status=Отменён, screen=incoming, cancelReason=payload.reason\|\|''` | — | History: «Отменён» (+ `: reason` если задан) |
| `restore` | cancelled | `isCancelled=false, status=В ожидании, screen=incoming, cancelReason=''` | — | History: «Восстановлен из отменённых» |
| `updateOrder` | любое | условно `to` и/или `deadline` (только если поле в payload) | — | History: **пусто** (`historyText=''`) → запись в History НЕ создаётся. Если ни `to`, ни `deadline` не переданы — `updateData` пуст → апдейта тоже нет |
| `branchForward` | outgoing/incoming (филиал) | `from=payload.branchName\|\|order.to, screen=outgoing, status=В работе, toacc=false, delivered=null` | — | `updateMany` все позиции → `В работе` (сброс). History: «Передано филиалом {name} → второе плечо доставки» |
| `branchAccept` | outgoing (филиал) | `status=Принято филиалом` | — | History: «Товар принят филиалом {name}» |
| `confirmChg` | любое (isChanged) | `isChanged=false` | — | Notify client (если `contactId`): «Изменение по заказу {id} принято». History: «Изменение подтверждено» |
| `postpone` | любое | `postponed=!order.postponed` (тоггл) | — | History: «Снят с отложенных» / «Отложен» (по старому значению) |
| `createDoc` | bookkeeping | `invoice=true` (type=invoice) / `fact=true` (type=fact) | — | History: «Счёт сформирован» (invoice) иначе «Счёт-фактура сформирована» |
| `post1C` | bookkeeping | `posted1C=true` | — | History: «Проведён в 1С» |
| `sendArchive` | bookkeeping | `screen=archive, status=Архив` | **`!order.posted1C` → 400 «Сначала проведите в 1С»** | History: «Отправлен в архив» |
| `changeOrder` | любое (клиент) | `isChanged=true, changeText=payload.changeText\|\|'', changePhone=payload.changePhone\|\|''` | — | notifyAdmins «Клиент изменил заказ {id}». History: «Клиент внёс изменение» |
| `addPos` | любое | `{}` (карточка не патчится) | — | Создаёт позицию (`generatePosId(id, existing.length+1)`). Если `supplier='Центр Склад' && qty>0` → `reserveStock`. Если `payload.resp` — ищет логиста по имени+роли и notify «Вам назначена позиция…». History: «Добавлена позиция: {name}» |
| `updatePosDetail` | любое | `{}` | — | Полное обновление позиции. Если `oldPos.supplier='Центр Склад' && new supplier='Центр Склад' && diff≠0` → `updateReserve`. History: **не пишется** (намеренно) |
| `deletePos` | любое | `{}` | — | `position.delete(payload.posId)`. History: «Позиция удалена». **Резерв склада не корректируется** |
| `updateCard` | любое | `from,to,comment,phone,deadline,projectId,specProjectId,contactId` | — | History: «Карточка обновлена» |
| `default` | — | — | неизвестный action → 400 «Неизвестный action: {action}» | — |

### Эффекты `updatePos` подробно
Порядок внутри case:
1. `position.update({ id: posId, status: posStatus })`.
2. Если `pos.supplier='Центр Склад' && posStatus='Доставлено'` → `releaseStock(posId, name1c||oral, qty)` (**списание + снятие резерва**).
3. Если `session.role==='logist'` → `historyText = «Логист {name}: {name1c||oral} → {status}»`.
4. Если `order.contactId` — notify клиента по карте статусов:
   - `Готово к отгрузке` → «Позиция "…" готова к отгрузке»
   - `В пути` → «Позиция "…" в пути»
   - `Доставлено` → «Позиция "…" доставлена»
5. Перечитывает все позиции и применяет **авто-правило «все доставлены»** (см. секцию 2).

Если авто-правило не сработало и роль ≠ logist → `updateData={}` и `historyText=''` → **ни апдейта карточки, ни записи History** (позиция меняется «молча»).

---

## 2. Автоматические правила

Переходы, срабатывающие не напрямую по action, а по условию внутри `updatePos` / `markAll`.

### 2.1. Правило «все позиции Доставлено» (только в `updatePos`)
После обновления статуса позиции:
```
updatedPositions = все позиции карточки
allDone = updatedPositions.every(status === 'Доставлено')
if (allDone && length > 0):
   updateData = { screen: incoming, status: Доставлено, toacc: true, delivered: new Date() }
   historyText = 'Все позиции доставлены'
   notify(contactId, '✅ Заказ {id} полностью доставлен!')      // если contactId
   notifyAdmins('Заказ {id} полностью доставлен')
   → далее авто-приход на склад (2.3)
```

### 2.2. Полная доставка через `markAll`
`markAll` форсирует то же целевое состояние (`incoming/Доставлено/toacc/delivered`), но:
- notify клиенту другой текст: «Заказ {id} доставлен!» (без ✅ и без слова «полностью»);
- **НЕ вызывает `notifyAdmins`**;
- **НЕ вызывает `releaseStock`** по позициям «Центр Склад» (в отличие от пути через `updatePos`, где каждая позиция списывалась при переходе в «Доставлено»).

### 2.3. Авто-приход на склад при доставке в «Центр Склад»
Внутри и `updatePos` (в ветке allDone), и `markAll`:
```
if (order.to === 'Центр Склад'):
   centerSklad = supplier where name='Центр Склад'
   if (centerSklad):
      for pos in positions where name1c && qty>0:
         incomeStock(pos.name1c, pos.qty, centerSklad.id)   // приход
      historyText = 'Все позиции доставлены → приход на склад (N позиций)'  // перезаписывает
```
Код этого блока **продублирован** дословно в `updatePos` и `markAll`.

### 2.4. Тоггл-правила (не отдельные состояния, но зависят от текущего)
- `postpone`: `postponed = !order.postponed`, текст History по старому значению.
- `confirmChg`/`changeOrder`: флаг `isChanged` вкл/выкл + уведомления.

---

## 3. Особые сценарии

### 3.1. `take` — парсинг заявки из текста
Срабатывает только если у карточки **нет позиций** и есть `comment`.
- Разбивает `comment` по `\n`, берёт непустые строки.
- Для каждой строки — regex:
  ```
  /(\d+(?:[.,]\d+)?)\s*(шт|м2|м²|кв\.?м|кг|рулон|усл)\b/i
  ```
  - **qty** = число из группы 1, `,`→`.`, `parseFloat`; если совпадения нет → `0`.
  - **unit** = группа 2 в нижнем регистре с нормализацией:
    - `кв.м`/`кв м` → `м2`
    - `м²` (U+00B2) → `м2`
    - остальные (`шт`, `кг`, `рулон`, `усл`, уже `м2`) — как есть.
    - если совпадения нет → `'шт'`.
- Каждая позиция: `id=generatePosId(id, i+1)`, `oral=строка целиком (trim)`, `qty`, `unit`, `status='В работе'`.
- `name1c` не заполняется (пустой) — распознаётся только «устное» описание.

### 3.2. `branchForward` / `branchAccept` — двухплечевая доставка
**`branchForward`** (филиал передаёт дальше, «плечо 2»):
- `updateMany` **все** позиции → `status='В работе'` (сброс любых финальных статусов, включая «Доставлено»).
- Патч карточки: `from = payload.branchName || order.to` (получатель становится отправителем), `screen='outgoing'`, `status='В работе'`, `toacc=false`, `delivered=null` (сброс штампа доставки).
- History: «Передано филиалом {name} → второе плечо доставки».

**`branchAccept`** (филиал принял товар):
- Только `status='Принято филиалом'`. Экран/позиции не трогаются.
- History: «Товар принят филиалом {name}».

---

## 4. Подозрительные места

**Расхождения `markAll` vs `updatePos` (авто-правило):**
1. `markAll` **не шлёт `notifyAdmins`**, а `updatePos`-путь шлёт. Разное поведение для одного и того же бизнес-события «заказ полностью доставлен».
2. `markAll` **не списывает резерв** (`releaseStock`) для позиций «Центр Склад». При доставке через `updatePos` каждая позиция списывалась в шаге «→ Доставлено», а `markAll` проставляет «Доставлено» массово в обход этой логики → **резерв повисает**.
3. Разные тексты клиенту: «✅ … полностью доставлен!» vs «Заказ … доставлен!».

**Утечки/неконсистентность склада:**
4. `deletePos` удаляет позицию, но **не снимает резерв**. Если удалить зарезервированную позицию «Центр Склад» — `reserved` останется завышенным.
5. `updatePosDetail` корректирует резерв только когда `supplier` был И остаётся «Центр Склад». При **смене** поставщика с «Центр Склад» на другой резерв не снимается; при смене на «Центр Склад» резерв не создаётся.
6. Ключ склада неоднороден: `process` резервирует по `name1c` (и требует `name1c`); `addPos` резервирует по `name1c || oral`; `updatePos` списывает по `name1c || oral`. При позиции без `name1c` резерв мог быть создан под `oral`, а `incomeStock`/поиск идут по `name1c` — возможны рассинхроны по имени.

**История/аудит:**
7. `updatePos` при не-полной доставке и роли ≠ logist меняет статус позиции **без записи в History** (при этом клиенту уведомление может уйти) — дыра в аудите.
8. `updateOrder` **никогда** не пишет History (`historyText=''`). Изменения `to`/`deadline` не журналируются.
9. `updatePosDetail` намеренно не пишет History (задокументировано в коде), но вместе с (7) означает, что правки позиций почти не отслеживаются.

**Логические баги:**
10. `createDoc`: если `payload.type` не `invoice` и не `fact`, `updateData` остаётся `{}` (флаг не ставится), но `historyText` уходит в **else** → пишется «Счёт-фактура сформирована» без реального формирования. Ложная запись в History.
11. Отсутствие guard'ов исходного состояния: можно, например, `sendAcc` напрямую из `incoming`, `accept` уже архивной карточки, `post1C` без прохождения бухгалтерии. Единственный guard — `sendArchive` требует `posted1C`.
12. `branchForward` затирает `delivered` и все статусы позиций — если вызван по ошибке на уже доставленном заказе, данные о первой доставке теряются безвозвратно.

**Статусы-литералы, встречающиеся один раз (возможные «сироты»/опечатки):**
- **`'Принято филиалом'`** (`branchAccept`) — нет ни в `PCT`/прогрессе (`lib/orderMetrics.ts`), ни в `STAGES` трекинга (`app/api/track/route.ts`), ни в `statusStyle` (`lib/display.ts`). На UI отрисуется дефолтным «черновик»-стилем, в прогрессе = 0%.
- **`'В обработке'`** (`take`) — есть в `statusStyle`, но отсутствует в `PCT` и в `STAGES` (там есть только через маппинг «Принят»=2/«В обработке»=2 — фактически в `STAGES` он присутствует; в `PCT` — нет, даёт 0%).
- Прочие статусы (`Принят`, `В работе`, `Доставлено`, `К учёту`, `Бухгалтерия`, `В ожидании`, `Отменён`, `Архив`) используются более одного раза и присутствуют в связанных картах.

> Значения статусов и экранов — **строковые литералы без единого источника истины**. Любая опечатка молча ломает фильтрацию/прогресс/стиль, т.к. нигде нет enum'а.

---

## 5. Предложение структуры для `services/orderWorkflow.ts`

Идея: описать переходы **декларативно**, а императивные эффекты вынести в переиспользуемые функции. Роут станет тонким: найти определение по `action`, проверить guard, применить патч, выполнить эффекты, записать History.

```ts
// Тип патча состояния карточки
type OrderPatch = Partial<Pick<Order,
  'screen'|'block'|'status'|'toacc'|'posted1C'|'invoice'|'fact'|
  'isCancelled'|'cancelReason'|'isChanged'|'postponed'|'delivered'|'from'|'to'>>

interface ActionContext {
  order: OrderWithPositions
  payload: Record<string, any>
  session: SessionUser
}

interface Effect {
  (ctx: ActionContext): Promise<void>
}

interface TransitionDef {
  // Патч карточки: статичный объект или функция от контекста
  patch?: OrderPatch | ((ctx: ActionContext) => OrderPatch)
  // Guard: вернуть текст ошибки (→ 400) или null если ок
  guard?: (ctx: ActionContext) => string | null
  // Текст History: строка, функция, или null если писать не нужно
  history?: string | ((ctx: ActionContext) => string) | null
  // Императивные побочные эффекты (склад, уведомления, позиции)
  effects?: Effect[]
}

const TRANSITIONS: Record<string, TransitionDef> = {
  accept:  { patch: { screen: 'reception', block: 'waiting', status: 'Принят' }, history: 'Принят в приёмку' },
  process: {
    patch: { screen: 'outgoing', status: 'В работе', block: '' },
    effects: [reserveCenterSkladPositions],
    history: (ctx) => reservedCount(ctx) > 0
      ? `Отправлен в Исходящие (зарезервировано ${reservedCount(ctx)} позиций на складе)`
      : 'Отправлен в Исходящие',
  },
  sendArchive: {
    guard: ({ order }) => order.posted1C ? null : 'Сначала проведите в 1С',
    patch: { screen: 'archive', status: 'Архив' },
    history: 'Отправлен в архив',
  },
  updateOrder: {
    patch: ({ payload }) => ({
      ...(payload.to !== undefined ? { to: payload.to } : {}),
      ...(payload.deadline !== undefined ? { deadline: payload.deadline ? new Date(payload.deadline) : null } : {}),
    }),
    history: null, // не журналируется
  },
  // …остальные action
}
```

### Эффекты-функции (кандидаты на вынос в `lib/stock` / `services/orderEffects.ts`)
| Функция | Из какого action | Что делает |
|---|---|---|
| `reserveCenterSkladPositions(ctx)` | `process` | резерв всех позиций «Центр Склад» |
| `parseCommentIntoPositions(ctx)` | `take` | парсинг comment → `createMany` |
| `applyPositionStatus(ctx)` | `updatePos` | обновить статус позиции + списание + notify клиента |
| `checkAllDelivered(ctx)` | `updatePos`,`markAll` | **авто-правило** «все доставлены» (единый источник вместо дубля) |
| `incomeOnDeliveryToCenter(ctx)` | `updatePos`,`markAll` | авто-приход на склад (сейчас продублирован) |
| `createPosition(ctx)` | `addPos` | создать позицию + резерв + notify логиста |
| `updatePositionDetail(ctx)` | `updatePosDetail` | обновить позицию + `updateReserve` |
| `releaseOnDelete(ctx)` | `deletePos` | удалить позицию + **снять резерв** (закрывает баг №4) |
| `resetPositionsForSecondLeg(ctx)` | `branchForward` | сброс позиций «В работе» |

### Что это даёт
- **Авто-правило и авто-приход** — одна функция (`checkAllDelivered`) вместо двух копий, что автоматически чинит расхождения `markAll` vs `updatePos` (пункты 1–2 раздела 4).
- **Guard'ы** становятся явным полем — легко добавить проверки исходного состояния (`from`), закрыв пункт 11.
- **Статусы/экраны** — вынести в `const SCREENS`/`const STATUSES` (или enum), убрав россыпь литералов и «сирот» вроде `'Принято филиалом'`.
- Роут сводится к: `const def = TRANSITIONS[action] ?? throw400; guard; patch; effects; history`.

> Это предложение (этап 4a — только документ). Рефакторинг самого роута — отдельный этап.
