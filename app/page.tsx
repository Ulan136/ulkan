import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import HomeClient from '@/components/HomeClient'

export default async function HomePage() {
  const session = await getSession()

  if (session) {
    // Залогинен — редирект на нужный экран
    if (session.role === 'super_admin' || session.role === 'bookkeeper') redirect('/admin')
    else if (session.role === 'logist' && session.slug) redirect(`/rsp/${session.slug}`)
    else if (session.role === 'warehouse_manager' && session.slug) redirect(`/warehouse/${session.slug}`)
    else if (session.role === 'branch' && session.slug) redirect(`/branch/${session.slug}`)
    else if (session.slug) redirect(`/client/${session.slug}`)
    else redirect('/admin')
  }

  // Не залогинен — публичная главная = лендинг со входами в кабинеты
  return <HomeClient />
}
