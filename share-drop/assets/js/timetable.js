// Enhancements for timetable page interactions

function qs(sel, root=document){ return root.querySelector(sel) }
function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)) }

function setDisabledMove(disabled){
  qsa('.chk-grade').forEach(cb => { cb.disabled = disabled; cb.checked = false })
  const max = qs('#max-move'); if (max){ max.disabled = disabled; max.value = '0' }
}

function main(){
  const noneBtn = qs('#move-none')
  if (noneBtn){
    noneBtn.addEventListener('click', (e)=>{ e.preventDefault(); setDisabledMove(true) })
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main, { once: true })
else main()

