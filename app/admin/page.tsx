import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AdminApp from '@/components/AdminApp'

export default async function AdminPage() {
  const session = await getSession()
  if (!session) redirect('/login?from=/admin')

  // Не админ попал на /admin (например, клиент без slug после логина) — уводим
  // в его кабинет вместо белого экрана (AdminApp грузит админ-данные и падает).
  if (session.role !== 'super_admin' && session.role !== 'bookkeeper') {
    if (session.role === 'logist' && session.slug) redirect(`/rsp/${session.slug}`)
    if (session.role === 'warehouse_manager' && session.slug) redirect(`/warehouse/${session.slug}`)
    if (session.role === 'branch' && session.slug) redirect(`/branch/${session.slug}`)
    if (session.slug) redirect(`/client/${session.slug}`)
    redirect('/login')
  }

  return <AdminApp user={session} />
}
