import Pusher from 'pusher'

// Серверный Pusher — singleton, инициализируется лениво.
// Без env-ключей возвращает null → pushSignal становится тихим no-op.
let server: Pusher | null = null
let inited = false

function getServerPusher(): Pusher | null {
  if (inited) return server
  inited = true
  const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } = process.env
  if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET) {
    server = null
    return null
  }
  server = new Pusher({
    appId: PUSHER_APP_ID,
    key: PUSHER_KEY,
    secret: PUSHER_SECRET,
    cluster: PUSHER_CLUSTER || 'ap2',
    useTLS: true,
  })
  return server
}

// Послать сигнал «данные изменились» в канал.
// ВАЖНО: await'им триггер до return роута — иначе на serverless (Vercel) функция
// «замерзает» сразу после ответа и не-awaited HTTP-POST в Pusher не успевает уйти,
// сигнал теряется и клиенты ждут страховочный 60-сек поллинг.
// Предохранитель: не ждём Pusher дольше 2.5с (сбой/зависание не вешает API).
// Ошибки глушим; без env-ключей — тихий no-op (мгновенно).
export async function pushSignal(channel: string): Promise<void> {
  const p = getServerPusher()
  if (!p) return
  try {
    await Promise.race([
      p.trigger(channel, 'signal', {}),
      new Promise<void>(resolve => setTimeout(resolve, 2500)),
    ])
  } catch {
    /* никогда не роняем обработчик API из-за realtime */
  }
}
