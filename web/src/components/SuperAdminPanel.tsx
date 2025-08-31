import { useAuth } from '../store/auth'
import { api } from '../api/client'
import { useState } from 'react'

export default function SuperAdminPanel() {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [make, setMake] = useState(true)
  const [loading, setLoading] = useState(false)
  if (!user || user.email !== 'yangchanhee11@gmail.com') return null
  const submit = async () => {
    setLoading(true)
    try { await api.setAdmin(email, make); alert('완료') } catch (e:any) { alert(e?.message || '오류') } finally { setLoading(false) }
  }
  return (
    <div id="section-super" className="glass rounded-xl p-6 mt-6">
      <h2 className="text-xl font-semibold">슈퍼관리자: 관리자 관리</h2>
      <div className="mt-3 grid gap-2 md:flex md:items-center">
        <input className="md:flex-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white/70 dark:bg-slate-900/50 px-3 py-2" value={email} onChange={e=>setEmail(e.target.value)} placeholder="이메일"/>
        <select className="rounded-md border border-slate-300 dark:border-slate-600 bg-white/70 dark:bg-slate-900/50 px-3 py-2" value={String(make)} onChange={e=>setMake(e.target.value==='true')}>
          <option value="true">부여</option>
          <option value="false">해제</option>
        </select>
        <button className="btn-primary" disabled={loading} onClick={submit}>{loading?'처리 중...':'실행'}</button>
      </div>
      <p className="text-sm text-slate-500 mt-2">주의: 이 작업은 슈퍼관리자만 가능합니다.</p>
    </div>
  )
}

