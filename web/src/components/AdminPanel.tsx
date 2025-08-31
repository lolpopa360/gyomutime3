import { useState } from 'react'
import { useAuth } from '../store/auth'
import { api } from '../api/client'

export default function AdminPanel() {
  const { role } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  if (role !== 'admin') return null
  return (
    <div id="section-admin" className="glass rounded-xl p-6 mt-6">
      <h2 className="text-xl font-semibold">관리자 작업</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">제출 상태 변경, 결과 업로드 등은 상세 화면에서 구현 확장 가능. 아래는 간단한 관리자 권한 부여/회수(슈퍼관리자 전용).</p>
      <div className="mt-3 flex gap-2">
        <input className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white/70 dark:bg-slate-900/50 px-3 py-2" placeholder="사용자 이메일" value={email} onChange={e=>setEmail(e.target.value)} />
        <button className="btn-outline" disabled={loading} onClick={async()=>{ setLoading(true); try{ await api.setAdmin(email, true); alert('관리자 권한 부여'); } catch(e:any){ alert(e?.message||'오류'); } finally{ setLoading(false); } }}>부여</button>
        <button className="btn-outline" disabled={loading} onClick={async()=>{ setLoading(true); try{ await api.setAdmin(email, false); alert('관리자 권한 해제'); } catch(e:any){ alert(e?.message||'오류'); } finally{ setLoading(false); } }}>해제</button>
      </div>
    </div>
  )
}

