import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
<<<<<<< HEAD
  const session = await getSession()
  if (!session) redirect('/login?from=/admin')
  if (!['super_admin', 'bookkeeper', 'admin'].includes(session.role)) {
    redirect('/login?from=/admin&reason=wrong_role')
  }
=======
  const cookieStore = await cookies()
  const token = cookieStore.get('ukan_session')?.value
  if (!token) redirect('/login')
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
  return <>{children}</>
}