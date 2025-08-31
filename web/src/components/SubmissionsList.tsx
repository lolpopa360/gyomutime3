import { useEffect, useState } from 'react'
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../store/auth'
import { api } from '../api/client'

type Submission = any

export default function SubmissionsList() {
  const { user, role } = useAuth()
  const [items, setItems] = useState<Submission[]>([])
  const [downloading, setDownloading] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [queryText, setQueryText] = useState<string>('')

  useEffect(() => {
    if (!user) return
    let q
    if (role === 'admin') q = query(collection(db, 'submissions'), orderBy('createdAt','desc'))
    else q = query(collection(db, 'submissions'), where('ownerUid','==', user.uid), orderBy('createdAt','desc'))
    const off = onSnapshot(q as any, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => off()
  }, [user, role])

  const download = async (storagePath: string) => {
    try { setDownloading(storagePath); const { downloadUrl } = await api.createDownloadUrl(storagePath); window.open(downloadUrl, '_blank') } finally { setDownloading(null) }
  }

  const changeStatus = async (id: string, status: 'processing'|'completed'|'rejected') => {
    try { setBusy(id+status); await api.updateStatus(id, status as any) } catch(e:any){ alert(e?.message||'오류') } finally { setBusy(null) }
  }

  const uploadResult = async (subId: string) => {
    const inp = document.createElement('input');
    inp.type='file'; inp.multiple=false;
    inp.onchange = async () => {
      const f = inp.files?.[0]; if (!f) return;
      setBusy(subId+'upload');
      try {
        const { uploadUrl, storagePath } = await api.appendResult(subId, f.name, f.type, f.size)
        await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': f.type }, body: f })
        alert('결과 업로드 완료')
      } catch(e:any) {
        alert(e?.message || '오류')
      } finally { setBusy(null) }
    }
    inp.click()
  }

  const exportCsv = () => {
    const headers = ['id','ownerEmail','title','status','category','createdAt']
    const rows = items.map((it:any)=> [it.id, it.ownerEmail||'', it.title||'', it.status||'', it.category||'', formatTime(it.createdAt)] )
    const csv = [headers, ...rows].map(r=> r.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='submissions.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 1000)
  }

  return (
    <div id="section-my" className="glass rounded-xl p-6 mt-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">내 제출{role==='admin' && ' / 전체 제출'}</h2>
        {role==='admin' && <button className="btn-outline" onClick={exportCsv}>CSV 내보내기</button>}
      </div>
      {items.length === 0 ? (
        <p className="text-slate-500 mt-2">아직 제출이 없습니다.</p>
      ) : (
        <>
          {role==='admin' && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <select className="rounded-md border border-slate-300 dark:border-slate-600 bg-white/70 dark:bg-slate-900/50 px-2 py-1" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
                <option value="">전체 상태</option>
                <option value="uploaded">uploaded</option>
                <option value="processing">processing</option>
                <option value="completed">completed</option>
                <option value="rejected">rejected</option>
              </select>
              <input className="rounded-md border border-slate-300 dark:border-slate-600 bg-white/70 dark:bg-slate-900/50 px-3 py-1" placeholder="제목 또는 이메일 검색" value={queryText} onChange={e=>setQueryText(e.target.value)} />
            </div>
          )}
          <ul className="mt-4 grid gap-3">
          {items.filter(it => {
              if (statusFilter && it.status !== statusFilter) return false
              const q = queryText.trim().toLowerCase()
              if (!q) return true
              return String(it.title||'').toLowerCase().includes(q) || String(it.ownerEmail||'').toLowerCase().includes(q)
            }).map(it => (
            <li key={it.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold">{it.title}</div>
                  <div className="text-sm text-slate-500">상태: {it.status}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    생성: {formatTime(it.createdAt)}{it.updatedAt ? ` • 업데이트: ${formatTime(it.updatedAt)}` : ''}
                  </div>
                </div>
                <div className="flex gap-2">
                  {it.results?.map((r:any, idx:number) => (
                    <button key={idx} className="btn-outline" onClick={()=>download(r.storagePath)} disabled={downloading===r.storagePath}>{downloading===r.storagePath?'링크 생성중...':'결과 다운로드'}</button>
                  ))}
                  {role==='admin' && (
                    <>
                      <button className="btn-outline" disabled={busy===it.id+'processing'} onClick={()=>changeStatus(it.id,'processing')}>처리중</button>
                      <button className="btn-outline" disabled={busy===it.id+'completed'} onClick={()=>changeStatus(it.id,'completed')}>완료</button>
                      <button className="btn-outline" disabled={busy===it.id+'rejected'} onClick={()=>changeStatus(it.id,'rejected')}>반려</button>
                      <button className="btn-outline" disabled={busy===it.id+'upload'} onClick={()=>uploadResult(it.id)}>{busy===it.id+'upload'?'업로드 중...':'결과 업로드'}</button>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-3">
                {it.messages?.length>0 && (
                  <ul className="text-sm text-slate-600 dark:text-slate-300">
                    {it.messages.map((m:any,i:number)=> <li key={i}>[{m.by}] {m.text}</li>)}
                  </ul>
                )}
                <div className="mt-2 flex gap-2">
                  <input className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white/70 dark:bg-slate-900/50 px-3 py-2" placeholder="메시지 입력" onKeyDown={async (e)=>{
                    if (e.key==='Enter') {
                      const val = (e.target as HTMLInputElement).value.trim(); if (!val) return;
                      try { await api.addMessage(it.id, val); (e.target as HTMLInputElement).value=''; } catch(e:any){ alert(e?.message||'오류') }
                    }
                  }} />
                  <button className="btn-outline" onClick={async()=>{
                    const inp = (document.activeElement as HTMLInputElement)
                    const val = inp && inp.tagName==='INPUT' ? inp.value.trim() : ''
                    if (!val) return; try { await api.addMessage(it.id, val); inp.value='' } catch(e:any){ alert(e?.message||'오류') }
                  }}>전송</button>
                </div>
              </div>
            </li>
          ))}
          </ul>
        </>
      )}
    </div>
  )
}

function formatTime(t: any) {
  try {
    const d = t?.toDate ? t.toDate() : new Date(t)
    return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
  } catch { return '' }
}
