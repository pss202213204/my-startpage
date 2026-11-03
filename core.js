/* Pure domain functions, shared by the browser and Node tests. */
(function(root){
  'use strict';
  const uid=()=>globalThis.crypto.randomUUID();
  const dayKey=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  function safeUrl(value){
    const s=String(value).trim();
    const u=new URL(/^[a-z][a-z\d+.-]*:/i.test(s)?s:'https://'+s);
    if(!['http:','https:'].includes(u.protocol)||!u.hostname||u.username||u.password) throw Error('http 또는 https 사이트 주소를 입력해주세요.');
    return u.href;
  }
  const blankSpace=(name,icon='✦')=>({id:uid(),name,icon,links:[],todos:[],notes:[],quote:'작은 시작이 모여, 나만의 하루가 된다.',focus:{},schedule:null});
  function initial(){
    const study=blankSpace('공부','✎');
    study.links=[['학교 LMS','온라인 강의와 수업 자료','https://www.kmooc.kr','K','peach'],['Notion','공부 기록을 차곡차곡','https://www.notion.so','N','stone'],['GitHub','매일 조금씩, 커밋','https://github.com','G','purple'],['백준','오늘도 한 문제씩','https://www.acmicpc.net','B','blue']].map(([title,description,url,letter,color])=>({id:uid(),title,description,url,letter,color}));
    study.links[0].title='K-MOOC';study.links[0].description='새로운 배움을 시작하는 곳';
    study.todos=['이번 주 강의 자료 정리하기','알고리즘 한 문제 풀기','프로젝트 아이디어 메모하기'].map((text,i)=>({id:uid(),text,done:i===0}));
    study.notes=[{id:uid(),text:'완벽하게 하려고 기다리지 말고,\n일단 작게 시작해 보기. ☺',color:'yellow'},{id:uid(),text:'이번 주 목표\n\n• 매일 25분 집중하기\n• 배운 내용 한 줄로 남기기',color:'pink'}];
    const daily=blankSpace('일상','☀');daily.links=[{id:uid(),title:'YouTube',description:'좋아하는 영상과 음악',url:'https://www.youtube.com/',letter:'Y',color:'peach'}];
    const career=blankSpace('취업 준비','▣');career.links=[{id:uid(),title:'원티드',description:'나에게 맞는 기회 찾기',url:'https://www.wanted.co.kr/',letter:'W',color:'blue'}];
    return {version:1,activeId:study.id,spaces:[study,daily,career],settings:{theme:'cream',background:'',autoSwitch:false,focusMinutes:25,snowMotion:true},timer:null};
  }
  function bounded(v,max,label){if(typeof v!=='string'||v.length>max)throw Error(label+' 형식이 올바르지 않습니다.');return v;}
  function validateSpace(s){
    if(!s||typeof s!=='object')throw Error('공간 형식이 올바르지 않습니다.');
    const out=blankSpace(bounded(s.name,30,'공간 이름').trim(),bounded(s.icon||'✦',8,'아이콘'));if(!out.name)throw Error('공간 이름이 필요합니다.');
    for(const [key,max] of [['links',100],['todos',200],['notes',30]])if(!Array.isArray(s[key])||s[key].length>max)throw Error('공간의 항목 수 또는 형식을 확인해주세요.');
    out.links=s.links.map(l=>({id:uid(),title:bounded(l.title,50,'사이트 이름'),description:bounded(l.description||'',100,'설명'),url:safeUrl(l.url),letter:String(l.title||'?').slice(0,1).toUpperCase(),color:['peach','stone','purple','blue'].includes(l.color)?l.color:'stone'}));
    out.todos=s.todos.map(t=>({id:uid(),text:bounded(t.text,200,'할 일'),done:t.done===true}));
    out.notes=s.notes.map(n=>({id:uid(),text:bounded(n.text,3000,'메모'),color:['yellow','pink','green'].includes(n.color)?n.color:'yellow'}));
    out.quote=bounded(s.quote||'',200,'좌우명');
    if(s.focus&&typeof s.focus==='object')for(const [k,v] of Object.entries(s.focus)){if(/^\d{4}-\d{2}-\d{2}$/.test(k)&&Number.isFinite(v)&&v>=0&&v<=86400)out.focus[k]=Math.floor(v);}
    if(s.schedule){const {start,end}=s.schedule;if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end)||start===end)throw Error('자동 전환 시간을 확인해주세요.');out.schedule={start,end};}
    return out;
  }
  function validateBackup(data){
    if(data?.version!==1||!Array.isArray(data.spaces)||!data.spaces.length||data.spaces.length>20)throw Error('지원하는 내 시작페이지 백업 파일이 아닙니다.');
    const spaces=data.spaces.map(validateSpace),index=data.spaces.findIndex(s=>s.id===data.activeId),settings=data.settings||{};
    if(settings.background&&(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(settings.background)||settings.background.length>2100000))throw Error('배경 이미지 형식이 올바르지 않습니다.');
    return {version:1,activeId:spaces[Math.max(0,index)].id,spaces,settings:{theme:['cream','sage','lavender','night','gaming','retro','cork','snow'].includes(settings.theme)?settings.theme:'cream',background:settings.background||'',snowMotion:settings.snowMotion!==false,autoSwitch:settings.autoSwitch===true,focusMinutes:[15,25,50].includes(settings.focusMinutes)?settings.focusMinutes:25},timer:null};
  }
  function inRange(time,start,end){return start<end?time>=start&&time<end:time>=start||time<end;}
  function scheduledSpace(spaces,date){const time=String(date.getHours()).padStart(2,'0')+':'+String(date.getMinutes()).padStart(2,'0');return spaces.find(s=>s.schedule&&inRange(time,s.schedule.start,s.schedule.end));}
  function settleTimer(state,now){
    const t=state.timer;if(!t||t.status!=='running')return false;
    const until=Math.min(now,t.endsAt),from=t.accountedAt||t.startedAt;
    if(until>from){const s=state.spaces.find(s=>s.id===t.spaceId);let cursor=from;
      while(s&&cursor<until){const date=new Date(cursor),next=new Date(date);next.setHours(24,0,0,0);const stop=Math.min(until,next.getTime());s.focus[dayKey(date)]=(s.focus[dayKey(date)]||0)+(stop-cursor)/1000;cursor=stop;}
      t.accountedAt=until;
    }
    t.remaining=Math.max(0,t.endsAt-now);if(!t.remaining){t.status='done';return true;}return false;
  }
  function loadStored(storage,key){
    const existing=storage.getItem(key);if(existing!==null)return existing;
    const candidates=[];
    for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k!==key&&k.endsWith(".workspace.v1")){try{const raw=storage.getItem(k);validateBackup(JSON.parse(raw));candidates.push({key:k,raw});}catch{}}}
    if(candidates.length!==1)return null;
    const previous=candidates[0];
    try{storage.setItem(key,previous.raw);storage.removeItem(previous.key);}catch{}
    return previous.raw;
  }
  const api={loadStored,uid,dayKey,safeUrl,blankSpace,initial,validateSpace,validateBackup,inRange,scheduledSpace,settleTimer};
  root.Startpage=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
