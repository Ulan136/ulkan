import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login?from=/admin')
  if (!['super_admin', 'bookkeeper', 'admin'].includes(session.role)) {
    redirect('/login?from=/admin&reason=wrong_role')
  }
  return <>{children}</>
}