// app/admin/layout.tsx
import { redirect } from 'next/navigation'
import { getSessionFromRequest } from '@/lib/auth'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // На серверном компоненте используем cookies()
  const cookieStore = cookies()
  const token = cookieStore.get('ukan_session')?.value
  if (!token) redirect('/login')
  return <>{children}</>
}
