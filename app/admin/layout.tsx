import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('ukan_session')?.value
  if (!token) redirect('/login')
  return <>{children}</>
}
