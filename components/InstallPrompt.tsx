'use client'
import { useState, useEffect } from 'react'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Не показываем если уже установлено как PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true
    if (isStandalone) return

    // Не показываем если пользователь уже закрывал баннер
    if (localStorage.getItem('ukan-install-dismissed') === '1') return

    function handler(e: any) {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setShow(false)
  }

  function handleDismiss() {
    setShow(false)
    localStorage.setItem('ukan-install-dismissed', '1')
  }

  if (!show) return null

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: 16, right: 16, zIndex: 9999,
      background: '#211f1c', borderRadius: 14, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 8px 24px rgba(0,0,0,.3)',
      maxWidth: 420, margin: '0 auto',
    }}>
      <div style={{ width: 40, height: 40, background: '#d4613a', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>U</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>Установить U-Kan</div>
        <div style={{ color: '#8c857a', fontSize: 11 }}>Быстрый доступ с экрана телефона</div>
      </div>
      <button onClick={handleDismiss} style={{ background: 'none', border: 'none', color: '#8c857a', fontSize: 18, cursor: 'pointer', padding: 4, flexShrink: 0 }}>✕</button>
      <button onClick={handleInstall} style={{ background: '#d4613a', border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
        Установить
      </button>
    </div>
  )
}
