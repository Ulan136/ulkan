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

// Послать сигнал «данные изменились» в канал. Fire-and-forget:
// не ждём ответ Pusher, ошибки глушим — API-ответ не тормозится.
// Без env-ключей — тихий no-op.
export function pushSignal(channel: string): void {
  const p = getServerPusher()
  if (!p) return
  try {
    p.trigger(channel, 'signal', {}).catch(() => {})
  } catch {
    /* никогда не роняем обработчик API из-за realtime */
  }
}
