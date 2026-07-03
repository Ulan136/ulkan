import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import HomeClient from '@/components/HomeClient'

export default async function HomePage() {
  // Если уже залогинен — редиректим сразу
  const session = await getSession()
  if (session) {
    if (session.role === 'super_admin' || session.role === 'bookkeeper') redirect('/admin')
    else if (session.role === 'logist') redirect(`/rsp/${session.slug}`)
    else if (session.role === 'warehouse_manager') redirect(`/warehouse/${session.slug}`)
    else if (session.role === 'branch') redirect(`/branch/${session.slug}`)
    else if (session.role === 'client' || session.role === 'supplier_client') redirect(`/client/${session.slug}`)
  }

  return <HomeClient />
}
