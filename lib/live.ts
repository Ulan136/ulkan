'use client'
import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'

// ── Абстракция транспорта real-time ──
// subscribe(channel, onSignal) → возвращает функцию отписки.
export interface LiveTransport {
  subscribe(channel: string, onSignal: () => void): () => void
}

// ── Polling: интервал + мгновенный сигнал при возврате видимости/сети ──
class PollingTransport implements LiveTransport {
  constructor(private intervalMs: number) {}
  subscribe(_channel: string, onSignal: () => void): () => void {
    const id = setInterval(onSignal, this.intervalMs)
    const onVisible = () => { if (typeof document !== 'undefined' && document.visibilityState === 'visible') onSignal() }
    const onOnline = () => onSignal()
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible)
    if (typeof window !== 'undefined') window.addEventListener('online', onOnline)
    return () => {
      clearInterval(id)
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible)
      if (typeof window !== 'undefined') window.removeEventListener('online', onOnline)
    }
  }
}

// ── Pusher: одно подключение на всё приложение (singleton) ──
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
    pusherClient.connection?.bind('state_change', (s: any) =>
      console.debug('[live] Pusher connection:', s.previous, '→', s.current))
  } catch {
    pusherClient = null
  }
  return pusherClient
}

// ── Pusher-транспорт: real-time через WS + АДАПТИВНАЯ страховка ──
// При живом WS (connected) фоновая страховка почти пассивна (раз в 5 минут) —
// не дёргаем load() и не перерисовываем интерфейс. Часто (20с) страховка
// тикает ТОЛЬКО пока WS не connected (disconnected/unavailable/connecting).
// При reconnect'е — один немедленный сигнал, чтобы догнать пропущенное.
class PusherTransport implements LiveTransport {
  subscribe(channel: string, onSignal: () => void): () => void {
    const client = getPusherClient()
    // Pusher недоступен в рантайме → активный поллинг (fallback)
    if (!client) return new PollingTransport(20000).subscribe(channel, onSignal)

    const ch = client.subscribe(channel)      // идемпотентно; канал держим на весь сеанс
    const handler = () => onSignal()
    ch.bind('signal', handler)

    const conn = client.connection
    const CONNECTED_MS = 5 * 60 * 1000         // WS жив → страховка почти пассивна
    const DOWN_MS = 20 * 1000                  // WS не connected → 20с

    let tick: any = null
    const isConnected = () => conn?.state === 'connected'
    const schedule = () => {
      if (tick) clearInterval(tick)
      tick = setInterval(onSignal, isConnected() ? CONNECTED_MS : DOWN_MS)
    }
    schedule()

    const onState = (s: any) => {
      const wasConn = s.previous === 'connected'
      const nowConn = s.current === 'connected'
      if (nowConn && !wasConn) onSignal()      // reconnect → один догоняющий сигнал
      if (nowConn !== wasConn) schedule()      // сменился режим страховки (частота)
    }
    conn?.bind('state_change', onState)

    // Возврат вкладки/сети — дешёвый догоняющий сигнал (по событию, не периодически)
    const onVisible = () => { if (typeof document !== 'undefined' && document.visibilityState === 'visible') onSignal() }
    const onOnline = () => onSignal()
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible)
    if (typeof window !== 'undefined') window.addEventListener('online', onOnline)

    return () => {
      try { ch.unbind('signal', handler) } catch {}
      if (tick) clearInterval(tick)
      try { conn?.unbind('state_change', onState) } catch {}
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible)
      if (typeof window !== 'undefined') window.removeEventListener('online', onOnline)
      // сам канал не отписываем — на нём могут остаться другие подписчики
    }
  }
}

// getTransport: есть ключ Pusher → WS + адаптивная страховка; нет → поллинг 10с.
let transport: LiveTransport | null = null
export function getTransport(): LiveTransport {
  if (transport) return transport
  const hasPusher = typeof window !== 'undefined' && !!process.env.NEXT_PUBLIC_PUSHER_KEY
  transport = hasPusher ? new PusherTransport() : new PollingTransport(10000)
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

  // Флаш отложенного сигнала после снятия паузы (лёгкая проверка раз в секунду)
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
