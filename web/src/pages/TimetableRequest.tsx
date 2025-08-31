import NavBar from '../components/NavBar'
import { Link } from 'react-router-dom'
import { useState } from 'react'

export default function TimetableRequest() {
  const [gradeSlots, setGradeSlots] = useState({
    mon: '7교시', tue: '7교시', wed: '7교시', thu: '7교시', fri: '7교시'
  })
  const [fileName, setFileName] = useState('선택된 파일 없음')
  const onPick = () => {
    const i = document.createElement('input'); i.type='file'; i.accept='.xlsx,.xls';
    i.onchange = () => setFileName(i.files?.[0]?.name || '선택된 파일 없음'); i.click()
  }
  return (
    <div className="min-h-full">
      <NavBar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-400/30">
            <span className="size-2 rounded-full bg-emerald-400" /> 시간표 최적화 엔진
          </div>
          <h1 className="mt-4 text-3xl md:text-5xl font-extrabold">시간표 생성 요청</h1>
          <p className="mt-2 text-muted-foreground">고급 제약 조건을 설정하여 최적화된 시간표를 자동 생성합니다.</p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <section className="glass rounded-xl p-6">
            <h2 className="text-lg font-semibold">시간표 제약 조건 설정</h2>
            <div className="mt-4 grid gap-4">
              <label className="grid gap-1">
                <span className="text-sm text-muted-foreground">담당자 이름</span>
                <input className="rounded-md border border-input bg-card px-3 py-2" placeholder="담당자 성함을 입력해주세요" />
              </label>
              <div>
                <div className="text-sm text-muted-foreground">시간표 데이터 파일 (.xlsx) *</div>
                <div className="mt-2 flex items-center gap-2">
                  <button className="btn-primary" onClick={onPick}>파일 선택</button>
                  <div className="text-sm text-muted-foreground">{fileName}</div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="font-medium">요일별 교시 수 설정</h3>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {Object.entries({mon:'월요일',tue:'화요일',wed:'수요일',thu:'목요일',fri:'금요일'}).map(([k,l]) => (
                  <div key={k} className="grid gap-1">
                    <span className="text-xs text-muted-foreground">{l}</span>
                    <select className="rounded-md border border-input bg-card px-2 py-2" value={(gradeSlots as any)[k]} onChange={e=>setGradeSlots(s=>({...s,[k]:e.target.value}))}>
                      {['6교시','7교시','8교시'].map(o=> <option key={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <h3 className="font-medium">이동수업 연속 제한</h3>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <select className="rounded-md border border-input bg-card px-3 py-2">
                  <option>1학년</option><option>2학년</option><option>3학년</option>
                </select>
                <select className="rounded-md border border-input bg-card px-3 py-2">
                  <option>2교시 연속</option><option>3교시 연속</option>
                </select>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">선택한 학년의 선택과목을 연속으로 몇 교시까지 배치할지 설정</p>
            </div>

            <div className="mt-6">
              <h3 className="font-medium">특정 교사 시간 제외 설정</h3>
              <p className="mt-2 text-xs text-muted-foreground">예: 김선생님 월요일 1교시 제외</p>
              <div className="mt-2 grid gap-2">
                <div className="grid grid-cols-4 gap-2">
                  <input className="rounded-md border border-input bg-card px-3 py-2" placeholder="교사명" />
                  <select className="rounded-md border border-input bg-card px-3 py-2"><option>요일</option><option>월</option><option>화</option><option>수</option><option>목</option><option>금</option></select>
                  <select className="rounded-md border border-input bg-card px-3 py-2">{Array.from({length:8},(_,i)=>i+1).map(i=> <option key={i}>{i}교시</option>)}</select>
                  <button className="btn-outline">추가</button>
                </div>
              </div>
              <div className="mt-3 rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                최적화 성능 안내: 제약이 많을수록 해 탐색이 어려워집니다. 꼭 필요한 제약 위주로 설정하세요.
              </div>
            </div>

            <div className="mt-6">
              <button className="w-full btn-primary">시간표 최적화 시작</button>
            </div>
          </section>

          <aside className="grid gap-6">
            <section className="glass rounded-xl p-6">
              <h2 className="text-lg font-semibold">데이터 입력 형식</h2>
              <div className="mt-4 rounded-lg border border-border bg-card p-3">
                <div className="grid grid-cols-5 text-center text-sm">
                  <div className="bg-emerald-900/30 text-emerald-300 rounded-md py-2">학생ID</div>
                  <div className="bg-emerald-900/30 text-emerald-300 rounded-md py-2">수학심화</div>
                  <div className="bg-emerald-900/30 text-emerald-300 rounded-md py-2">물리학</div>
                  <div className="bg-emerald-900/30 text-emerald-300 rounded-md py-2">화학</div>
                  <div className="bg-emerald-900/30 text-emerald-300 rounded-md py-2">영어회화</div>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">1 = 희망함, 0 = 희망하지 않음</div>
              </div>
            </section>

            <section className="glass rounded-xl p-6">
              <h2 className="text-lg font-semibold">최적화 알고리즘 프로세스</h2>
              <ol className="mt-4 space-y-2 text-sm">
                {['제약 조건 매트릭스 생성','리소스 합당 최적화 실행','충돌 검증 및 해결','최적 시간표 결과 생성'].map((s,i)=> (
                  <li key={i} className="flex items-center gap-2"><Step n={i+1}/>{s}</li>
                ))}
              </ol>
            </section>

            <section className="glass rounded-xl p-6">
              <h2 className="text-lg font-semibold">알고리즘 최적화 목표</h2>
              <ul className="mt-3 grid gap-2 text-sm">
                {['교사-교실-시간 충돌 최소화','이동수업 연속성 제약 준수','교사 워크로드 균형','교실 활용도 극대화'].map((s,i)=> (
                  <li key={i} className="flex items-center gap-2"><Check />{s}</li>
                ))}
              </ul>
              <div className="mt-4 rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                처리 시간: 제약 복잡도에 따라 1–24시간 소요될 수 있습니다.
              </div>
              <div className="mt-4 text-right">
                <Link className="btn-outline" to="/">홈으로</Link>
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  )
}

function Step({ n }: { n:number }) {
  return (
    <span className="inline-flex items-center justify-center size-6 rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30 text-xs font-semibold">{n}</span>
  )
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
  )
}

