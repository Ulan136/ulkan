import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AdminApp from '@/components/AdminApp'

export default async function AdminPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  return <AdminApp user={session} />
}