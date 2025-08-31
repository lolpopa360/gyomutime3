// Simple contact and constrained chatbot for site-only help

function qs(s, r=document){ return r.querySelector(s) }

function main(){
  const form = qs('#contact-form')
  form?.addEventListener('submit', (e)=>{
    e.preventDefault()
    const fd = new FormData(form)
    // Persist locally as a demo. In production, send to backend or email service
    const saved = JSON.parse(localStorage.getItem('support.tickets')||'[]')
    saved.push({ email: fd.get('email'), subject: fd.get('subject'), message: fd.get('message'), at: new Date().toISOString() })
    localStorage.setItem('support.tickets', JSON.stringify(saved))
    alert('접수되었습니다. 빠르게 확인 후 답변드리겠습니다. (데모: 로컬 저장)')
    form.reset()
  })

  const log = qs('#chat-log')
  const chatForm = qs('#chat-form')
  const input = qs('#chat-input')
  const add = (by, text) => {
    const div = document.createElement('div')
    div.className = 'msg'
    div.style.margin = '.25rem 0'
    div.innerHTML = `<div style="display:flex; gap:.5rem;">${by==='bot'?'<span>🤖</span>':'<span>🙂</span>'}<div>${text}</div></div>`
    log.appendChild(div); log.scrollTop = log.scrollHeight
  }
  add('bot','안녕하세요! 교무타임 고객지원 챗봇입니다. 웹사이트 사용 관련 질문만 답변합니다.')
  chatForm?.addEventListener('submit',(e)=>{
    e.preventDefault()
    const q = (input.value||'').trim(); if(!q) return
    add('me', q)
    // site-only guard
    const siteKeywords = ['로그인','회원가입','관리자','시간표','분반','파일','업로드','다운로드','데이터','양식','문의','에러','오류','설정','테마']
    const containsSite = siteKeywords.some(k=> q.includes(k))
    if (!containsSite) {
      add('bot','본 챗봇은 웹사이트 사용 관련 질문만 도와드립니다. 사이트 이용에 관한 질문을 해주세요.')
    } else {
      // naive rule-based answers
      if (q.includes('로그인')) add('bot','로그인은 우측 상단 버튼을 눌러 이메일/비밀번호 또는 Google로 진행할 수 있습니다.')
      else if (q.includes('회원') || q.includes('가입')) add('bot','회원가입은 로그인 창에서 이메일/비밀번호로 진행하세요. 이미 존재하는 이메일은 가입할 수 없습니다.')
      else if (q.includes('데이터') && q.includes('양식')) add('bot','데이터 양식은 홈 하단 “데이터 양식 다운로드”에서 내려받을 수 있습니다. 관리자는 관리자 콘솔의 “데이터 양식” 탭에서 등록/수정 가능합니다.')
      else if (q.includes('테마')) add('bot','상단 내비게이션의 테마 전환 버튼으로 라이트/다크를 변경할 수 있습니다.')
      else add('bot','문의 주신 내용은 확인 후 도와드리겠습니다. 보다 구체적으로 페이지와 동작을 알려주시면 더 빨리 해결됩니다.')
    }
    input.value=''
  })
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main, { once:true })
else main()

