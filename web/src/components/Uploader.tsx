import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '../api/client'

const ACCEPT = [
  'application/pdf','application/zip','application/x-zip-compressed',
  'text/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/json','image/png','image/jpeg','image/webp'
]

const Schema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  category: z.enum(['기타','이미지','문서','데이터','코드'])
})

type FormValues = z.infer<typeof Schema>

export default function Uploader() {
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { category: '기타' }
  })

  const onDrop = (sel: FileList | null) => {
    if (!sel) return
    const list = Array.from(sel).filter(f => ACCEPT.includes(f.type))
    setFiles(prev => [...prev, ...list])
  }

  const onSubmit = async (v: FormValues) => {
    if (!files.length) return alert('파일을 선택하세요')
    setBusy(true)
    try {
      // 1) create submission
      const meta = files.map(f => ({ name: f.name, size: f.size, contentType: f.type }))
      const created = await api.createSubmission({ title: v.title, description: v.description || '', category: v.category, filesMeta: meta })
      const sid = created.id as string
      // 2) upload each file via signed URL
      for (const f of files) {
        const { uploadUrl } = await api.createUploadUrl(sid, f.name, f.type, f.size)
        await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': f.type }, body: f })
      }
      alert('제출이 완료되었습니다.')
      setFiles([])
      reset()
    } catch (e: any) {
      alert(e?.message || '업로드 중 오류가 발생했습니다')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div id="section-submit" className="glass rounded-xl p-6">
      <h2 className="text-xl font-semibold">파일 제출</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">PDF, ZIP, CSV, XLSX 등 허용</p>
      <div className="mt-4">
        <label className="block text-sm font-medium">제목</label>
        <input className="w-full mt-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white/70 dark:bg-slate-900/50 px-3 py-2" {...register('title')} />
        {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>}
      </div>
      <div className="mt-3">
        <label className="block text-sm font-medium">설명</label>
        <textarea className="w-full mt-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white/70 dark:bg-slate-900/50 px-3 py-2" rows={3} {...register('description')} />
      </div>
      <div className="mt-3">
        <label className="block text-sm font-medium">카테고리</label>
        <select className="w-full mt-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white/70 dark:bg-slate-900/50 px-3 py-2" {...register('category')}>
          <option>기타</option>
          <option>이미지</option>
          <option>문서</option>
          <option>데이터</option>
          <option>코드</option>
        </select>
      </div>

      <div className="mt-4">
        <div className="rounded-md border border-dashed border-slate-300 dark:border-slate-600 p-6 text-center cursor-pointer"
             onDragOver={(e)=>{e.preventDefault()}}
             onDrop={(e)=>{e.preventDefault(); onDrop(e.dataTransfer.files)}}
             onClick={()=>{
               const inp = document.createElement('input');
               inp.type='file'; inp.multiple=true; inp.accept=ACCEPT.join(',');
               inp.onchange=()=> onDrop(inp.files);
               inp.click();
             }}>
          파일을 드래그하거나 클릭하여 선택
        </div>
        {files.length>0 && (
          <ul className="mt-3 text-sm grid gap-1">
            {files.map((f,i)=> <li key={i} className="flex justify-between"><span>{f.name}</span><span className="text-slate-500">{(f.size/1024/1024).toFixed(2)} MB</span></li>)}
          </ul>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button className="btn-primary" disabled={busy} onClick={handleSubmit(onSubmit)}>{busy? '제출 중...' : '제출'}</button>
        <button className="btn-outline" disabled={busy} onClick={()=>{setFiles([]); reset();}}>초기화</button>
      </div>
    </div>
  )
}

