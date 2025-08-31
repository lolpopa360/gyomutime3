import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useTheme } from '../store/theme'

type Mode = 'login' | 'signup'

function ErrorText({ msg }: { msg: string }) {
  if (!msg) return null
  return <p className="mt-2 text-sm text-destructive">{msg}</p>
}

export default function AuthPage() {
  const nav = useNavigate()
  const { theme, toggle } = useTheme()
  const { signIn, signInEmail, signUpEmail, resetPassword, user } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const toApp = () => nav('/app')

  useEffect(() => { if (user) toApp() }, [user])

  const onGoogle = async () => {
    setError(''); setInfo(''); setLoading(true)
    try { await signIn(); toApp() } catch (e:any) { setError(mapError(e?.code || 'auth/error')) } finally { setLoading(false) }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setInfo('')
    if (mode === 'signup' && password !== confirm) { setError('비밀번호 확인이 일치하지 않습니다.'); return }
    setLoading(true)
    try {
      if (mode === 'login') {
        await signInEmail(email, password)
        toApp()
      } else {
        await signUpEmail(name, email, password)
        setInfo('가입이 완료되었습니다. 확인 이메일이 발송되었습니다.')
        toApp()
      }
    } catch (e:any) {
      setError(mapError(e?.code || 'auth/error'))
    } finally { setLoading(false) }
  }

  const onReset = async () => {
    setError(''); setInfo('')
    if (!email) { setError('이메일을 입력하세요.'); return }
    setLoading(true)
    try { await resetPassword(email); setInfo('비밀번호 재설정 메일을 보냈습니다.') } catch (e:any) { setError(mapError(e?.code || 'auth/error')) } finally { setLoading(false) }
  }

  return (
    <div className="min-h-full flex items-center justify-center px-6 py-12 bg-background text-foreground">
      <div className="w-full max-w-md">
        <div className="glass rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold">{mode==='login'?'로그인':'회원가입'}</h1>
            <button className="btn-outline" onClick={toggle}>{theme==='dark'?'라이트':'다크'}</button>
          </div>

          <div className="flex rounded-md overflow-hidden border border-border mb-4">
            <button className={`flex-1 px-3 py-2 text-sm ${mode==='login'?'bg-secondary text-secondary-foreground':'hover:bg-muted'}`} onClick={()=>setMode('login')}>로그인</button>
            <button className={`flex-1 px-3 py-2 text-sm ${mode==='signup'?'bg-secondary text-secondary-foreground':'hover:bg-muted'}`} onClick={()=>setMode('signup')}>회원가입</button>
          </div>

          <form onSubmit={onSubmit} className="grid gap-3">
            {mode==='signup' && (
              <label className="grid gap-1">
                <span className="text-sm text-muted-foreground">이름</span>
                <input className="rounded-md border border-input bg-card px-3 py-2" placeholder="홍길동" value={name} onChange={e=>setName(e.target.value)} required />
              </label>
            )}
            <label className="grid gap-1">
              <span className="text-sm text-muted-foreground">이메일</span>
              <input className="rounded-md border border-input bg-card px-3 py-2" type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} required />
            </label>
            <label className="grid gap-1">
              <span className="text-sm text-muted-foreground">비밀번호</span>
              <input className="rounded-md border border-input bg-card px-3 py-2" type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} required />
            </label>
            {mode==='signup' && (
              <label className="grid gap-1">
                <span className="text-sm text-muted-foreground">비밀번호 확인</span>
                <input className="rounded-md border border-input bg-card px-3 py-2" type="password" placeholder="••••••••" value={confirm} onChange={e=>setConfirm(e.target.value)} required />
              </label>
            )}

            {mode==='login' && (
              <div className="text-right">
                <button type="button" className="text-sm text-primary hover:underline" onClick={onReset}>비밀번호 재설정</button>
              </div>
            )}

            <button className="btn-primary" disabled={loading}>
              {loading ? '처리 중...' : (mode==='login' ? '로그인' : '회원가입')}
            </button>
            <button type="button" className="btn-outline" onClick={onGoogle} disabled={loading}>Google로 계속하기</button>
          </form>

          <ErrorText msg={error} />
          {info && <p className="mt-2 text-sm text-green-600 dark:text-green-400">{info}</p>}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <Link className="hover:underline" to="/">홈으로</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function mapError(code: string): string {
  switch (code) {
    case 'auth/invalid-email': return '이메일 형식이 올바르지 않습니다.'
    case 'auth/user-disabled': return '비활성화된 계정입니다.'
    case 'auth/user-not-found': return '해당 이메일의 사용자가 없습니다.'
    case 'auth/wrong-password': return '비밀번호가 올바르지 않습니다.'
    case 'auth/email-already-in-use': return '이미 사용 중인 이메일입니다.'
    case 'auth/weak-password': return '비밀번호가 너무 약합니다. (6자 이상)'
    case 'auth/popup-closed-by-user': return '팝업이 닫혔습니다.'
    default: return '요청 처리 중 오류가 발생했습니다.'
  }
}
