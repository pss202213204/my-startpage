/* MOA: no account or server required; all personal data stays in this browser. */
'use strict';
const $=s=>document.querySelector(s),M=Moa,KEY='moa.workspace.v1';
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state,loadError=false,filter='all',calendarDate=new Date(),lastScheduleKey='',toastTimeout;
try{
  const raw=localStorage.getItem(KEY);
  if(raw){const parsed=JSON.parse(raw);state=M.validateBackup(parsed);
    const t=parsed.timer,now=Date.now(),i=parsed.spaces.findIndex(s=>s.id===t?.spaceId);
    if(t&&i>=0&&['running','paused','done'].includes(t.status)&&Number.isFinite(t.duration)&&t.duration>0&&t.duration<=3000000&&Number.isFinite(t.remaining)&&t.remaining>=0&&t.remaining<=t.duration&&Number.isFinite(t.endsAt)&&t.endsAt<=now+3000000&&Number.isFinite(t.accountedAt)&&t.accountedAt<=now&&Number.isFinite(t.startedAt)&&t.startedAt<=t.accountedAt&&t.accountedAt>=t.endsAt-t.duration){state.timer={...t,spaceId:state.spaces[i].id};M.settleTimer(state,now);}
  }else state=M.initial();
}catch{state=M.initial();loadError=true;}
const current=()=>state.spaces.find(s=>s.id===state.activeId)||state.spaces[0];
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(state));$('#saveState').textContent='이 브라우저에 자동 저장';return true;}
  catch{$('#saveState').textContent='저장 실패 · 백업이 필요해요';toast('저장 공간이 부족하거나 차단되어 있어요. 백업 파일을 내려받아주세요.');return false;}
}
function modal(title,content){$('#modalTitle').textContent=title;$('#modalBody').innerHTML=content;if(!$('#modal').open)$('#modal').showModal();setTimeout(()=>$('#modalBody input:not([type=file]), #modalBody textarea')?.focus(),0);}
function closeModal(){$('#modal').close();}
$('#closeModal').onclick=closeModal;
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
const errorLine='<p class="dialog-error" id="dialogError" role="alert"></p>';
function onForm(handler){$('#modalForm').onsubmit=e=>{e.preventDefault();try{handler(new FormData(e.target));}catch(err){$('#dialogError').textContent=err.message;}};}
function render(){
  const s=current();document.body.dataset.theme=state.settings.theme;
  const background=state.settings.background;document.body.classList.toggle('has-background',!!background);document.body.style.setProperty('--user-bg',background?`url("${background}")`:'none');
  $('#spaces').innerHTML=state.spaces.map(sp=>`<button class="space-tab ${sp.id===s.id?'active':''}" data-space="${sp.id}" ${sp.id===s.id?'aria-current="page"':''}><span class="space-symbol">${escapeHTML(sp.icon)}</span><span class="space-name">${escapeHTML(sp.name)}</span></button>`).join('');
  $('#spaceCount').textContent=String(state.spaces.length).padStart(2,'0');$('#breadcrumb').textContent=s.name;$('#quoteText').textContent=s.quote||'나만의 한 문장을 적어보세요.';
  $('#linkCount').textContent=String(s.links.length).padStart(2,'0');
  $('#links').innerHTML=s.links.map(l=>`<article class="link-card"><a class="link-anchor" href="${escapeHTML(l.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHTML(l.title)} (새 탭)"><span class="link-icon ${l.color}">${escapeHTML(l.letter)}</span><span class="link-info"><strong>${escapeHTML(l.title)}</strong><small>${escapeHTML(l.description||new URL(l.url).hostname)}</small></span></a><div class="link-tools"><button data-edit-link="${l.id}" aria-label="${escapeHTML(l.title)} 수정">✎</button><button data-delete-link="${l.id}" aria-label="${escapeHTML(l.title)} 삭제">×</button></div></article>`).join('')+(s.links.length<100?'<button class="add-link-card" data-action="new-link">＋ 새로운 바로가기</button>':'');
  renderTodos();renderNotes();renderCalendar();renderTimer();updateClock();
}
function renderTodos(){
  const todos=current().todos,done=todos.filter(t=>t.done).length;
  $('#todoCount').textContent=`${done}/${todos.length}`;$('#todoProgress').style.width=(todos.length?done/todos.length*100:0)+'%';
  $('#todos').innerHTML=todos.filter(t=>filter==='all'||(filter==='done'?t.done:!t.done)).map(t=>`<div class="todo-row ${t.done?'done':''}"><input class="todo-check" type="checkbox" id="todo-${t.id}" data-todo="${t.id}" ${t.done?'checked':''}><label for="todo-${t.id}">${escapeHTML(t.text)}</label><button data-delete-todo="${t.id}" aria-label="할 일 삭제">×</button></div>`).join('')||'<p class="empty">'+(filter==='done'?'완료한 할 일이 여기에 모여요.':filter==='open'?'남은 할 일이 없어요. 수고했어요!':'가벼운 할 일 하나로 시작해볼까요?')+'</p>';
  $('#todoSummary').textContent=todos.length?`${todos.length-done}개의 할 일이 남았어요`:'당신의 작은 시작을 응원해요';
  document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('selected',b.dataset.filter===filter);b.setAttribute('aria-pressed',String(b.dataset.filter===filter));});
}
function renderNotes(){
  $('#notes').innerHTML=current().notes.map(n=>`<article class="note ${n.color}"><textarea data-note="${n.id}" aria-label="스티커 메모" placeholder="생각을 자유롭게 적어보세요" maxlength="3000">${escapeHTML(n.text)}</textarea><div class="note-footer"><div class="note-colors">${['yellow','pink','green'].map(c=>`<button data-note-color="${n.id}" data-color="${c}" aria-label="${({yellow:'노랑',pink:'분홍',green:'초록'})[c]} 메모지" aria-pressed="${n.color===c}"></button>`).join('')}</div><span>나만의 메모</span><button data-delete-note="${n.id}" aria-label="메모 삭제">×</button></div></article>`).join('')||'<p class="empty">잊고 싶지 않은 생각을 메모로 남겨보세요.</p>';
}
function renderCalendar(){
  const year=calendarDate.getFullYear(),month=calendarDate.getMonth(),today=M.dayKey(),start=new Date(year,month,1);start.setDate(1-start.getDay());
  $('#calendarTitle').textContent=`${year}년 ${month+1}월`;
  const cells=Math.ceil((new Date(year,month,1).getDay()+new Date(year,month+1,0).getDate())/7)*7;
  $('#calendar').innerHTML=Array.from({length:cells},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);const isToday=M.dayKey(d)===today;return `<span class="calendar-day ${d.getMonth()!==month?'outside':''} ${d.getDay()===0?'sunday':''} ${isToday?'today':''}" ${isToday?'aria-current="date"':''}>${d.getDate()}</span>`;}).join('');
}
function updateClock(){const now=new Date();$('#liveClock').textContent=now.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false});$('#dateText').textContent=now.toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'});}
function renderTimer(){
  const t=state.timer,remaining=t?.remaining??state.settings.focusMinutes*60000;
  const seconds=Math.ceil(remaining/1000);$('#timerText').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  $('#timerStart').textContent=t?.status==='running'?'Ⅱ 잠시 쉬기':t?.status==='paused'?'▶ 이어서 집중':'▶ 집중 시작';
  const owner=t&&state.spaces.find(s=>s.id===t.spaceId);
  $('#timerLabel').textContent=t?.status==='done'?'잘했어요! 집중을 마쳤어요':t?.status==='paused'?'잠깐 쉬어도 괜찮아요':owner&&owner.id!==current().id?`${owner.name} 공간에서 집중 중`:'나를 위한 집중 시간';
  $('#timerArc').style.strokeDashoffset=552.92*(1-remaining/(t?.duration||state.settings.focusMinutes*60000));
  const total=Math.floor((current().focus[M.dayKey()]||0)/60);$('#focusTotal').textContent=total>=60?`${Math.floor(total/60)}시간 ${total%60}분`:`${total}분`;
}
$('#todoForm').onsubmit=e=>{e.preventDefault();const text=$('#todoInput').value.trim();if(!text)return;const s=current();if(s.todos.length>=200){toast('할 일은 공간당 200개까지 등록할 수 있어요.');return;}s.todos.push({id:M.uid(),text,done:false});$('#todoInput').value='';save();renderTodos();};
document.addEventListener('change',e=>{if(e.target.dataset.todo){const t=current().todos.find(t=>t.id===e.target.dataset.todo);if(t)t.done=e.target.checked;save();renderTodos();}});
document.addEventListener('input',e=>{if(e.target.dataset.note){const n=current().notes.find(n=>n.id===e.target.dataset.note);if(n)n.text=e.target.value;save();}});
function spaceDialog(space){
  const edit=!!space;
  modal(edit?'공간 설정':'새로운 공간 만들기',`<form id="modalForm"><label class="field">공간 이름<input name="name" value="${escapeHTML(space?.name||'')}" maxlength="30" required placeholder="예: 사이드 프로젝트"></label><label class="field">공간 아이콘<select name="icon">${['✎','☀','▣','✦','♫','☕','⌘','♡'].map(i=>`<option ${space?.icon===i?'selected':''}>${i}</option>`).join('')}</select></label><label class="field">나만의 한 문장<input name="quote" maxlength="200" value="${escapeHTML(space?.quote||'작은 시작이 모여, 나만의 하루가 된다.')}" placeholder="이 공간의 좌우명"></label><label class="settings-row"><input type="checkbox" name="scheduled" ${space?.schedule?'checked':''}> 이 공간으로 자동 전환할 시간 정하기</label><div class="settings-row" style="margin-top:12px"><label class="field">시작<input type="time" name="start" value="${space?.schedule?.start||'09:00'}" required></label><label class="field">종료<input type="time" name="end" value="${space?.schedule?.end||'18:00'}" required></label></div><p class="hint">설정에서 자동 전환을 켜면 적용돼요. 종료가 시작보다 이르면 다음 날까지 이어집니다.</p>${errorLine}<div class="dialog-actions"><button type="button" class="secondary-btn" data-action="close">취소</button><button class="primary-btn">${edit?'변경 저장':'공간 만들기'}</button></div></form>`);
  onForm(f=>{const name=f.get('name').trim();if(!name)throw Error('공간 이름을 입력해주세요.');if(state.spaces.some(s=>s.id!==space?.id&&s.name===name))throw Error('같은 이름의 공간이 있어요.');if(!edit&&state.spaces.length>=20)throw Error('공간은 20개까지 만들 수 있어요.');const schedule=f.has('scheduled')?{start:f.get('start'),end:f.get('end')}:null;if(schedule){if(schedule.start===schedule.end)throw Error('시작과 종료 시간을 다르게 정해주세요.');for(let i=0;i<1440;i++){const time=String(Math.floor(i/60)).padStart(2,'0')+':'+String(i%60).padStart(2,'0');if(M.inRange(time,schedule.start,schedule.end)&&state.spaces.some(s=>s.id!==space?.id&&s.schedule&&M.inRange(time,s.schedule.start,s.schedule.end)))throw Error('다른 공간의 자동 전환 시간과 겹쳐요.');}}
    const s=space||M.blankSpace(name);Object.assign(s,{name,icon:f.get('icon'),quote:f.get('quote').trim(),schedule});if(!edit){state.spaces.push(s);state.activeId=s.id;}lastScheduleKey='';save();closeModal();render();toast(edit?'공간 설정을 저장했어요.':'새로운 공간을 만들었어요.');});
}
function linkDialog(link){
  const s=current();if(!link&&s.links.length>=100){toast('바로가기는 공간당 100개까지 등록할 수 있어요.');return;}
  modal(link?'바로가기 수정':'자주 가는 곳 추가',`<form id="modalForm"><label class="field">사이트 이름<input name="title" maxlength="50" required value="${escapeHTML(link?.title||'')}" placeholder="예: GitHub"></label><label class="field">사이트 주소<input name="url" maxlength="2000" required value="${escapeHTML(link?.url||'')}" placeholder="https://github.com" inputmode="url"></label><label class="field">한 줄 설명<input name="description" maxlength="100" value="${escapeHTML(link?.description||'')}" placeholder="어떤 곳인지 가볍게 적어주세요"></label><label class="field">아이콘 색<select name="color">${[['stone','차분한 회색'],['peach','따뜻한 살구'],['purple','연보라'],['blue','맑은 파랑']].map(([k,v])=>`<option value="${k}" ${link?.color===k?'selected':''}>${v}</option>`).join('')}</select></label>${errorLine}<div class="dialog-actions"><button type="button" class="secondary-btn" data-action="close">취소</button><button class="primary-btn">${link?'변경 저장':'추가하기'}</button></div></form>`);
  onForm(f=>{const title=f.get('title').trim();if(!title)throw Error('사이트 이름을 입력해주세요.');const url=M.safeUrl(f.get('url'));const value={title,url,description:f.get('description').trim(),letter:title.slice(0,1).toUpperCase(),color:f.get('color')};if(link)Object.assign(link,value);else s.links.push({id:M.uid(),...value});save();closeModal();render();toast('바로가기를 저장했어요.');});
}
function quoteDialog(){const s=current();modal('나만의 한 문장',`<form id="modalForm"><p class="dialog-copy">이 공간에 들어올 때마다 만나고 싶은 말을 적어보세요.</p><label class="field">좌우명<textarea name="quote" maxlength="200">${escapeHTML(s.quote)}</textarea></label>${errorLine}<div class="dialog-actions"><button class="primary-btn">저장하기</button></div></form>`);onForm(f=>{s.quote=f.get('quote').trim();save();closeModal();render();});}
function download(name,data){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function settingsDialog(){
  modal('내 공간, 내 취향대로',`<div class="setting-section"><h3>화면 색상</h3><div class="theme-options">${[['cream','크림','#f6f5f1'],['sage','세이지','#e4ebdf'],['lavender','라벤더','#ece6f3'],['night','밤','#2c352e']].map(([key,label,color])=>`<button class="theme-choice" data-theme="${key}" aria-pressed="${state.settings.theme===key}"><span class="swatch" style="background:${color}"></span>${label}</button>`).join('')}</div></div><div class="setting-section"><h3>나만의 배경 이미지</h3><div class="settings-row"><label class="secondary-btn" style="cursor:pointer;text-align:center">이미지 선택<input type="file" id="backgroundInput" accept="image/png,image/jpeg,image/webp" hidden></label><button class="secondary-btn" data-action="remove-background">배경 지우기</button></div><p class="hint">JPG, PNG, WebP · 최대 5MB. 저장할 때 화면에 맞게 압축해요.</p></div><div class="setting-section"><h3>시간에 맞춰 공간 전환</h3><label class="settings-row"><input type="checkbox" id="autoSwitch" ${state.settings.autoSwitch?'checked':''}> 자동 공간 전환 켜기</label><p class="hint">이 페이지가 열려 있을 때 기기 시간을 기준으로 전환해요. 겹치는 시간에는 목록의 첫 공간이 우선됩니다.</p>${state.spaces.map(s=>`<div class="space-manage"><span>${escapeHTML(s.icon)} ${escapeHTML(s.name)}<small class="hint"> ${s.schedule?s.schedule.start+'–'+s.schedule.end:'시간 미설정'}</small></span><div><button class="muted-btn" data-edit-space="${s.id}">수정</button> <button class="muted-btn" data-delete-space="${s.id}">삭제</button></div></div>`).join('')}</div><div class="setting-section"><h3>안전하게 보관하기</h3><div class="settings-row"><button class="secondary-btn" data-action="export">전체 백업 내보내기</button><button class="secondary-btn" data-action="import">백업 복원</button></div><p class="hint">데이터는 현재 브라우저에 보관돼요. 브라우저 데이터를 지우기 전에 백업해주세요. 다른 기기와 자동으로 동기화되지는 않아요.</p></div><p class="hint">공간 템플릿은 왼쪽 메뉴에서 파일로 공유할 수 있어요.</p><div class="dialog-actions"><button class="primary-btn" data-action="close">완료</button></div>`);
  $('#autoSwitch').onchange=e=>{state.settings.autoSwitch=e.target.checked;lastScheduleKey='';save();checkSchedule();};
  $('#backgroundInput').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error('5MB 이하의 JPG, PNG, WebP 이미지를 선택해주세요.');const bitmap=await createImageBitmap(file),ratio=Math.min(1,1600/bitmap.width,1200/bitmap.height),canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const image=canvas.toDataURL('image/jpeg',.75);if(image.length>2100000)throw Error('이미지가 너무 복잡해요. 더 작은 이미지를 선택해주세요.');const previous=state.settings.background;state.settings.background=image;if(!save())state.settings.background=previous;else toast('배경 이미지를 바꿨어요.');render();}catch(err){toast(err.message||'이미지를 불러오지 못했어요.');}};
}
function templateDialog(){
  modal('좋은 공간은 나눌 수 있으니까',`<p class="dialog-copy">기본 템플릿으로 시작하거나, 나만의 구성을 파일로 공유해보세요.</p>${[['study','✎','공부를 위한 공간','강의 · 문제 풀이 · 학습 기록'],['daily','☀','일상을 위한 공간','일상 기록 · 음악 · 작은 할 일'],['career','▣','취업 준비 공간','채용 정보 · 포트폴리오 · 면접 준비']].map(([key,icon,title,desc])=>`<div class="template-card"><div class="template-icon">${icon}</div><div><strong>${title}</strong><p>${desc}</p></div><button data-template="${key}">추가 ＋</button></div>`).join('')}<div class="setting-section" style="margin-top:24px"><h3>현재 공간 공유하기</h3><p class="dialog-copy">사이트 구성과 좌우명만 내보내요. 개인 할 일, 메모, 집중 기록, 시간 설정은 제외됩니다.</p><button class="secondary-btn" data-action="export-template">공간 템플릿 내보내기 ↗</button></div><button class="secondary-btn" data-action="import-template">친구의 템플릿 가져오기</button><p class="hint">파일을 복사해 각자 사용하는 방식이에요. 실시간 공동 편집은 지원하지 않아요.</p>`);
}
function addTemplate(kind){if(state.spaces.length>=20){toast('공간은 최대 20개까지 만들 수 있어요.');return;}const defaults=M.initial(),index={study:0,daily:1,career:2}[kind],s=defaults.spaces[index];if(kind==='career')s.todos=['이력서 최신 내용 반영하기','포트폴리오 프로젝트 정리하기','관심 기업 채용 공고 확인하기'].map(text=>({id:M.uid(),text,done:false}));let name=s.name,num=2;while(state.spaces.some(sp=>sp.name===name))name=`${s.name} ${num++}`;s.name=name;state.spaces.push(s);state.activeId=s.id;save();closeModal();render();toast('템플릿으로 공간을 만들었어요.');}
async function importFile(file,template){
  if(!file)return;try{if(file.size>4*1024*1024)throw Error('4MB 이하의 JSON 파일을 선택해주세요.');const raw=JSON.parse(await file.text());let data;if(template){if(raw.type!=='moa-template'||raw.version!==1)throw Error('모아 공간 템플릿 파일을 선택해주세요.');if(state.spaces.length>=20)throw Error('공간은 최대 20개까지 만들 수 있어요.');data=M.validateSpace(raw.space);data.todos=[];data.notes=[];data.focus={};data.schedule=null;}else data=M.validateBackup(raw);
    const summary=template?`${escapeHTML(data.name)} · 바로가기 ${data.links.length}개`:`공간 ${data.spaces.length}개 · 바로가기 ${data.spaces.reduce((n,s)=>n+s.links.length,0)}개`;
    modal(template?'새 공간으로 가져오기':'백업을 복원할까요?',`<p class="dialog-copy">${template?'기존 공간은 그대로 유지되고 새 공간이 추가됩니다.':'현재 모든 공간과 설정이 백업 내용으로 교체됩니다. 먼저 현재 데이터를 백업해주세요. 진행 중인 타이머는 종료됩니다.'}</p><div class="import-preview">${summary}</div><div class="dialog-actions">${template?'':'<button class="secondary-btn" data-action="export">현재 데이터 백업</button>'}<button class="secondary-btn" data-action="close">취소</button><button class="primary-btn" id="confirmImport">${template?'공간 추가':'복원하기'}</button></div>`);
    $('#confirmImport').onclick=()=>{if(template){let name=data.name,num=2;while(state.spaces.some(s=>s.name===name))name=`${data.name.slice(0,24)} ${num++}`;data.name=name;state.spaces.push(data);state.activeId=data.id;}else state=data;lastScheduleKey='';save();closeModal();render();toast(template?'공간 템플릿을 가져왔어요.':'백업을 복원했어요.');};
  }catch(err){toast(err instanceof SyntaxError?'JSON 파일을 읽을 수 없어요. 파일 형식을 확인해주세요.':err.message);}
}
$('#backupInput').onchange=e=>{importFile(e.target.files[0],false);e.target.value='';};$('#templateInput').onchange=e=>{importFile(e.target.files[0],true);e.target.value='';};
function confirmDeleteSpace(s){if(state.spaces.length<=1){toast('최소 한 개의 공간은 남겨주세요.');return;}modal('이 공간을 삭제할까요?',`<p class="dialog-copy">${escapeHTML(s.name)} 공간의 바로가기 ${s.links.length}개, 할 일 ${s.todos.length}개, 메모 ${s.notes.length}개와 집중 기록을 삭제해요. 삭제 후 되돌릴 수 없으니 필요한 내용은 먼저 백업해주세요.</p><div class="dialog-actions"><button class="secondary-btn" data-action="export">전체 백업</button><button class="secondary-btn" data-action="close">취소</button><button class="danger-btn" id="confirmDelete">공간 삭제</button></div>`);$('#confirmDelete').onclick=()=>{if(state.timer?.spaceId===s.id)state.timer=null;state.spaces=state.spaces.filter(sp=>sp.id!==s.id);if(state.activeId===s.id)state.activeId=state.spaces[0].id;save();closeModal();render();toast('공간을 삭제했어요.');};}
function confirmDeleteItem(title,operation){modal(title,`<p class="dialog-copy">이 항목을 삭제할까요?</p><div class="dialog-actions"><button class="secondary-btn" data-action="close">취소</button><button class="danger-btn" id="confirmDelete">삭제</button></div>`);$('#confirmDelete').onclick=()=>{operation();save();closeModal();render();};}
function toggleTimer(){
  const now=Date.now();M.settleTimer(state,now);let t=state.timer;
  if(t?.status==='running'){t.status='paused';}
  else if(t?.status==='paused'){t.status='running';t.startedAt=now;t.accountedAt=now;t.endsAt=now+t.remaining;}
  else{const duration=state.settings.focusMinutes*60000;state.timer={spaceId:current().id,status:'running',duration,remaining:duration,startedAt:now,accountedAt:now,endsAt:now+duration};}
  save();renderTimer();
}
function focusOptions(){modal('나에게 맞는 집중 시간',`<p class="dialog-copy">${state.timer&&state.timer.status!=='done'?'시간 변경은 현재 타이머를 초기화한 뒤 적용됩니다.':'작게 시작해도 좋아요. 집중할 시간을 골라주세요.'}</p><div class="timer-options">${[15,25,50].map(m=>`<button data-minutes="${m}" class="${state.settings.focusMinutes===m?'selected':''}">${m}분</button>`).join('')}</div>`);}
function checkSchedule(){if(!state.settings.autoSwitch)return;const now=new Date(),s=M.scheduledSpace(state.spaces,now),key=s?M.dayKey(now)+s.id+s.schedule.start:'';if(key&&key!==lastScheduleKey){lastScheduleKey=key;if(state.activeId!==s.id){state.activeId=s.id;filter='all';save();render();toast(`지금은 ${s.name} 시간이에요. 공간을 전환했어요.`);}}if(!key)lastScheduleKey='';}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;const d=b.dataset,s=current();
  if(d.space){state.activeId=d.space;filter='all';save();render();return;}
  if(d.filter){filter=d.filter;renderTodos();return;}
  if(d.editLink){linkDialog(s.links.find(l=>l.id===d.editLink));return;}
  if(d.deleteLink){confirmDeleteItem('바로가기 삭제',()=>{s.links=s.links.filter(l=>l.id!==d.deleteLink);});return;}
  if(d.deleteTodo){s.todos=s.todos.filter(t=>t.id!==d.deleteTodo);save();renderTodos();return;}
  if(d.deleteNote){confirmDeleteItem('스티커 메모 삭제',()=>{s.notes=s.notes.filter(n=>n.id!==d.deleteNote);});return;}
  if(d.noteColor){const n=s.notes.find(n=>n.id===d.noteColor);if(n)n.color=d.color;save();renderNotes();return;}
  if(d.theme){state.settings.theme=d.theme;save();render();document.querySelectorAll('[data-theme]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.theme===d.theme)));return;}
  if(d.editSpace){spaceDialog(state.spaces.find(sp=>sp.id===d.editSpace));return;}
  if(d.deleteSpace){confirmDeleteSpace(state.spaces.find(sp=>sp.id===d.deleteSpace));return;}
  if(d.template){addTemplate(d.template);return;}
  if(d.minutes){M.settleTimer(state,Date.now());state.settings.focusMinutes=Number(d.minutes);state.timer=null;save();closeModal();renderTimer();return;}
  switch(d.action){
    case 'new-space':spaceDialog();break;
    case 'new-link':linkDialog();break;
    case 'new-note':if(s.notes.length>=30){toast('메모는 공간당 30개까지 만들 수 있어요.');break;}s.notes.push({id:M.uid(),text:'',color:'yellow'});save();renderNotes();$('#notes .note:last-child textarea').focus();break;
    case 'quote':quoteDialog();break;
    case 'settings':settingsDialog();break;
    case 'templates':templateDialog();break;
    case 'close':closeModal();break;
    case 'clear-done':s.todos=s.todos.filter(t=>!t.done);save();renderTodos();break;
    case 'remove-background':state.settings.background='';save();render();toast('배경 이미지를 지웠어요.');break;
    case 'timer-toggle':toggleTimer();break;
    case 'timer-reset':M.settleTimer(state,Date.now());state.timer=null;save();renderTimer();break;
    case 'focus-options':focusOptions();break;
    case 'month-prev':calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth()-1,1);renderCalendar();break;
    case 'month-next':calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth()+1,1);renderCalendar();break;
    case 'month-today':calendarDate=new Date();renderCalendar();break;
    case 'export':M.settleTimer(state,Date.now());download(`moa-backup-${M.dayKey()}.json`,{...state,timer:null});toast('백업 파일을 내보냈어요.');break;
    case 'import':$('#backupInput').click();break;
    case 'export-template':download('moa-space-template.json',{type:'moa-template',version:1,space:{...s,todos:[],notes:[],focus:{},schedule:null}});toast('개인 기록을 제외한 공간 템플릿을 내보냈어요.');break;
    case 'import-template':$('#templateInput').click();break;
    case 'help':modal('모아에 오신 걸 환영해요',`<p class="dialog-copy">왼쪽에서 공간을 바꾸면 바로가기, 할 일, 메모, 좌우명이 함께 바뀝니다. 집중 시간은 시작한 공간에 기록돼요.</p><p class="dialog-copy">설정에서 공간 이름·자동 전환 시간·색상·배경을 바꿀 수 있어요. 메모는 입력 즉시 저장되며, 전체 백업은 설정 메뉴에서 내려받을 수 있어요.</p><p class="dialog-copy">이 브라우저에만 저장되는 개인용 앱이에요. 다른 기기로 옮길 때는 백업 파일을 사용해주세요. 여러 탭에서 동시에 수정하면 마지막 저장이 반영됩니다.</p><div class="dialog-actions"><button class="secondary-btn" data-action="templates">공간 템플릿</button><button class="primary-btn" data-action="settings">설정 열기</button></div>`);break;
  }
});
let tick=0,lastDay=M.dayKey();
setInterval(()=>{const complete=M.settleTimer(state,Date.now());renderTimer();if(complete){save();toast('집중 시간을 마쳤어요. 수고했어요!');}if(++tick%15===0&&state.timer?.status==='running')save();if(tick%10===0){updateClock();checkSchedule();if(lastDay!==M.dayKey()){lastDay=M.dayKey();renderCalendar();}}},1000);
document.addEventListener('visibilitychange',()=>{if(document.hidden){M.settleTimer(state,Date.now());save();}else{M.settleTimer(state,Date.now());renderTimer();updateClock();checkSchedule();}});
window.addEventListener('pagehide',()=>{M.settleTimer(state,Date.now());save();});
window.addEventListener('storage',e=>{if(e.key===KEY)toast('다른 탭에서 내용이 바뀌었어요. 최신 내용을 보려면 새로고침해주세요.');});
render();checkSchedule();if(loadError)toast('저장된 내용을 읽지 못해 기본 공간을 열었어요. 백업 파일을 복원할 수 있어요.');
