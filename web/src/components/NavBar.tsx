import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useTheme } from '../store/theme'

export default function NavBar() {
  const { user, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const nav = useNavigate()

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md border-b border-border bg-background/60">
      <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-3">
          <span className="size-6 rounded-md bg-emerald-500" />
          <div className="leading-tight">
            <div className="font-semibold">교무타임</div>
            <div className="text-[11px] text-muted-foreground">Gyomutime</div>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-2 text-sm">
          <a className="btn-outline" href="https://github.com/" target="_blank" rel="noreferrer">이용 가이드</a>
          <a className="btn-outline" href="#features">서비스 둘러보기</a>
          <Link className="btn-outline" to="/app">관리자 콘솔</Link>
          <button className="btn-outline" onClick={toggle}>{theme==='dark'?'라이트':'다크'}</button>
          {user ? (
            <button className="btn-outline" onClick={()=>{signOut(); nav('/')}}>로그아웃</button>
          ) : (
            <Link className="btn-outline" to="/auth">로그인</Link>
          )}
        </nav>
        <div className="md:hidden flex items-center gap-2">
          <button className="btn-outline" onClick={toggle}>{theme==='dark'?'라이트':'다크'}</button>
          {user ? <button className="btn-outline" onClick={()=>{signOut(); nav('/')}}>로그아웃</button> : <Link className="btn-outline" to="/auth">로그인</Link>}
        </div>
      </div>
    </header>
  )
}

