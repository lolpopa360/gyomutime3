import { motion } from 'framer-motion'
import { useAuth } from '../store/auth'
import { useNavigate, Link } from 'react-router-dom'
import NavBar from '../components/NavBar'

export default function Landing() {
  const { user, signIn } = useAuth()
  const nav = useNavigate()
  const handleStart = async () => {
    if (user) return nav('/app')
    await signIn()
    nav('/app')
  }
  return (
    <div className="min-h-full bg-[radial-gradient(80%_40%_at_50%_0%,rgba(16,185,129,0.08),transparent_60%)] dark:bg-[radial-gradient(80%_40%_at_50%_0%,rgba(16,185,129,0.12),transparent_60%)]">
      <NavBar />
      <main>
        {/* Hero */}
        <section className="relative">
          <div className="mx-auto max-w-6xl px-6 py-16 md:py-24 text-center">
            <div className="inline-flex items-center gap-2 text-xs md:text-sm px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-400/30">
              <span className="size-2 rounded-full bg-emerald-400" />
              AI‑Powered Optimization Engine
            </div>
            <motion.h1 initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:.6}} className="mt-5 text-4xl md:text-6xl font-extrabold tracking-tight">
              지능형 시간표 <span className="text-emerald-400">최적화</span> 시스템
            </motion.h1>
            <motion.p initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:.1,duration:.6}} className="mt-6 text-lg text-muted-foreground">
              고급 알고리즘과 머신러닝 기반 스케줄링. 복잡한 제약을 자동 분석하여 최적의 시간표를 생성합니다.
            </motion.p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link className="btn-primary" to="/auth">무료로 시작하기</Link>
              <a className="btn-outline" href="#features">서비스 둘러보기</a>
            </div>

            {/* KPIs */}
            <div className="mt-12 grid grid-cols-3 max-w-2xl mx-auto text-center">
              <div>
                <div className="text-2xl font-bold text-emerald-400">99.7%</div>
                <div className="text-sm text-muted-foreground">최적화 성공률</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-400">&lt;30s</div>
                <div className="text-sm text-muted-foreground">평균 처리 시간</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-400">1000+</div>
                <div className="text-sm text-muted-foreground">제약 조건 처리</div>
              </div>
            </div>
          </div>
        </section>

        {/* Features preview */}
        <section id="features" className="py-12">
          <div className="mx-auto max-w-6xl px-6 grid gap-6 md:grid-cols-3">
            {[
              {title:'시간표 최적화',desc:'다중 제약 조건 하에서 최적 시간표를 생성',icon:'⚙️'},
              {title:'선택과목 분반 배정',desc:'선호도와 제약을 고려한 지능형 분반',icon:'👥'},
              {title:'대용량 처리',desc:'수천 변수와 제약을 동시에 처리',icon:'⚡️'}
            ].map((f,i)=> (
              <div key={i} className="glass rounded-xl p-6">
                <div className="text-3xl">{f.icon}</div>
                <h3 className="mt-3 text-lg font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Deep links */}
        <section className="py-6">
          <div className="mx-auto max-w-6xl px-6 flex flex-wrap gap-3 justify-center">
            <Link to="/timetable" className="btn-primary">시간표 최적화 시작</Link>
            <Link to="/grouping" className="btn-primary">분반 알고리즘 실행</Link>
          </div>
        </section>
      </main>
    </div>
  )
}
