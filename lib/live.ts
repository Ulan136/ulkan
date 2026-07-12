'use client'
import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'

// ── Абстракция транспорта real-time ──
// subscribe(channel, onSignal) → возвращает функцию отписки.
export interface LiveTransport {
  subscribe(channel: string, onSignal: () => void): () => void
}

// ── Polling: интервал + мгновенный сигнал при возврате фокуса/видимости/сети ──
class PollingTransport implements LiveTransport {
  constructor(private intervalMs: number) {}
  subscribe(_channel: string, onSignal: () => void): () => void {
    const id = setInterval(onSignal, this.intervalMs)
    const onVisible = () => { if (typeof document !== 'undefined' && document.visibilityState === 'visible') onSignal() }
    const onFocus = () => onSignal()
    const onOnline = () => onSignal()
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible)
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus)
      window.addEventListener('online', onOnline)
    }
    return () => {
      clearInterval(id)
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible)
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus)
        window.removeEventListener('online', onOnline)
      }
    }
  }
}

// ── Pusher: одно подключение на всё приложение (singleton) + страховочный polling ──
let pusherClient: any = null
let pusherInited = false
function getPusherClient(): any {
  if (pusherInited) return pusherClient
  pusherInited = true
  if (typeof window === 'undefined') { pusherClient = null; return null }
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY
  if (!key) { pusherClient = null; return null }
  try {
    // Динамический require, чтобы pusher-js не попадал в серверный бандл
    const Pusher = require('pusher-js')
    pusherClient = new Pusher(key, { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap2' })
  } catch {
    pusherClient = null
  }
  return pusherClient
}

class PusherTransport implements LiveTransport {
  constructor(private safetyPoll: LiveTransport) {}
  subscribe(channel: string, onSignal: () => void): () => void {
    const client = getPusherClient()
    // если Pusher недоступен в рантайме — деградируем в polling
    if (!client) return this.safetyPoll.subscribe(channel, onSignal)
    const ch = client.subscribe(channel)  // идемпотентно; канал держим на весь сеанс
    ch.bind('signal', onSignal)
    const stopPoll = this.safetyPoll.subscribe(channel, onSignal)  // страховка 60с
    return () => {
      try { ch.unbind('signal', onSignal) } catch {}
      stopPoll()
      // сам канал не отписываем — на нём могут остаться другие подписчики
    }
  }
}

// getTransport: есть NEXT_PUBLIC_PUSHER_KEY → Pusher + polling 60с; нет → polling 10с.
let transport: LiveTransport | null = null
export function getTransport(): LiveTransport {
  if (transport) return transport
  const hasPusher = typeof window !== 'undefined' && !!process.env.NEXT_PUBLIC_PUSHER_KEY
  transport = hasPusher
    ? new PusherTransport(new PollingTransport(60000))
    : new PollingTransport(10000)
  return transport
}

// ── Хук: загрузка при монтировании и по сигналу канала ──
// pausedRef?.current === true → сигнал копится (pending) и выполняется при снятии паузы.
export function useLiveData(
  channel: string,
  load: () => void,
  deps: any[] = [],
  pausedRef?: MutableRefObject<boolean> | { current: boolean },
) {
  const loadRef = useRef(load)
  loadRef.current = load
  const pendingRef = useRef(false)

  // Подписка на канал + начальная загрузка (пере-подписка при смене channel/deps)
  useEffect(() => {
    loadRef.current()
    const onSignal = () => {
      if (pausedRef?.current) { pendingRef.current = true; return }
      loadRef.current()
    }
    const unsub = getTransport().subscribe(channel, onSignal)
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, ...deps])

  // Флаш отложенного сигнала после снятия паузы (лёгкая проверка раз в секунду,
  // load вызывается только если есть pending и пауза снята)
  useEffect(() => {
    const id = setInterval(() => {
      if (pendingRef.current && !pausedRef?.current) {
        pendingRef.current = false
        loadRef.current()
      }
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
