import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useEffect } from 'react'
import { useTheme } from '../store/theme'

export default function AppShell() {
  const { user, signOut, role, loading } = useAuth()
  const nav = useNavigate()
  useEffect(() => { if (!loading && !user) nav('/auth') }, [loading, user])
  const { theme, toggle } = useTheme()
  if (!user) return null
  return (
    <div className="min-h-full grid grid-cols-12">
      <aside className="col-span-12 md:col-span-3 lg:col-span-2 p-4 glass">
        <div className="flex items-center justify-between">
          <div className="font-semibold">대시보드</div>
          <div className="flex items-center gap-2">
            <button className="btn-outline" onClick={toggle}>{theme==='dark'?'라이트':'다크'}</button>
            <button className="btn-outline" onClick={signOut}>로그아웃</button>
          </div>
        </div>
        <nav className="mt-6 grid gap-2">
          <Link className="btn-outline" to="/app">홈</Link>
          <a className="btn-outline" href="#" onClick={(e)=>{e.preventDefault();document.getElementById('section-submit')?.scrollIntoView({behavior:'smooth'})}}>제출</a>
          <a className="btn-outline" href="#" onClick={(e)=>{e.preventDefault();document.getElementById('section-my')?.scrollIntoView({behavior:'smooth'})}}>내 제출</a>
          {role === 'admin' && <a className="btn-outline" href="#" onClick={(e)=>{e.preventDefault();document.getElementById('section-admin')?.scrollIntoView({behavior:'smooth'})}}>관리자</a>}
          {user.email === 'yangchanhee11@gmail.com' && <a className="btn-outline" href="#" onClick={(e)=>{e.preventDefault();document.getElementById('section-super')?.scrollIntoView({behavior:'smooth'})}}>관리자 관리</a>}
        </nav>
      </aside>
      <main className="col-span-12 md:col-span-9 lg:col-span-10 p-6">
        <Outlet />
      </main>
    </div>
  )
}
