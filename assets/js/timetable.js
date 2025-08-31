// Enhancements for timetable page interactions + n8n submission

function qs(sel, root=document){ return root.querySelector(sel) }
function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)) }

function setDisabledMove(disabled){
  qsa('.chk-grade').forEach(cb => { cb.disabled = disabled; cb.checked = false })
  const max = qs('#max-move'); if (max){ max.disabled = disabled; max.value = '0' }
}

async function submitTimetable(){
  try {
    if (!window.N8N_TIMETABLE_WEBHOOK){
      alert('n8n TIMETABLE_WEBHOOK이 설정되지 않았습니다. assets/js/n8n-config.js를 확인하세요.')
      return
    }
    const name = (qs('#tt-name')?.value || '').trim()
    const file = qs('#tt-file')?.files?.[0]
    const excludeRule = (qs('#tt-exclude')?.value || '').trim()
    const weekdayPeriods = {
      mon: parseInt(qs('#tt-p-mon')?.value || '0', 10),
      tue: parseInt(qs('#tt-p-tue')?.value || '0', 10),
      wed: parseInt(qs('#tt-p-wed')?.value || '0', 10),
      thu: parseInt(qs('#tt-p-thu')?.value || '0', 10),
      fri: parseInt(qs('#tt-p-fri')?.value || '0', 10),
    }
    const maxMove = parseInt(qs('#max-move')?.value || '0', 10)
    const moveGrades = qsa('.chk-grade:checked').map(cb => cb.value)

    if (!name){ alert('담당자 이름을 입력하세요.'); return }
    if (!file){ alert('시간표 데이터 파일을 선택하세요.'); return }

    const res = await window.n8nClient.submitTimetable({ name, excludeRule, weekdayPeriods, moveGrades, maxMove, file })
    const url = res?.colab_url || res?.url || res?.open_url
    if (url){
      window.open(url, '_blank', 'noopener')
      alert('Colab에서 노트북이 열립니다. "런타임"→"모두 실행"을 눌러 실행하세요.')
    } else {
      alert('요청이 접수되었지만 Colab URL이 응답에 없습니다. n8n 흐름 구성을 확인하세요.')
    }
  } catch (err) {
    console.error(err)
    alert('제출 중 오류: ' + (err?.message || '오류'))
  }
}

function main(){
  const noneBtn = qs('#move-none')
  if (noneBtn){
    noneBtn.addEventListener('click', (e)=>{ e.preventDefault(); setDisabledMove(true) })
  }
  const fi = qs('#tt-file'); const label = qs('#tt-file-label')
  fi?.addEventListener('change', () => { if (label) label.textContent = fi.files?.[0]?.name || '선택된 파일 없음' })
  qs('#tt-submit')?.addEventListener('click', (e)=>{ e.preventDefault(); submitTimetable() })
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main, { once: true })
else main()
