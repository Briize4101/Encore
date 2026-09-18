import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {findArtists} from './festivals.mjs';
export const GROUPS=['BTS','RIIZE','&TEAM','BOYNEXTDOOR','CORTIS','ENHYPEN','NCT WISH','TXT'];
const flags=['newEvents','ticketTomorrow','raffleTomorrow'];
const hash=s=>createHash('sha256').update(s).digest('hex');
export const taipeiDay=t=>new Date(+new Date(t)+8*3600000).toISOString().slice(0,10);
const timestamp=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:\d{2})$/.test(s)&&Number.isFinite(Date.parse(s));
const matches=(e,artists)=>(e.artists?.length?e.artists:findArtists((e.artist||'')+' '+e.title)).some(a=>artists.includes(a));
const identity=e=>hash([e.artist,e.kind||'concert',e.title,e.date,e.raffleEdge||''].join('|'));
function link(s){try{const u=new URL(s);return u.protocol==='https:'?u.href:'';}catch{return '';}}
export function candidates(events,p,now){
 const tomorrow=taipeiDay(now+86400000),today=taipeiDay(now),out=[];
 for(const e of events){
  if(!matches(e,p.artists)||['birthday','anniversary'].includes(e.kind))continue;
  const id=identity(e),base={event:e,identity:id};
  if(p.newEvents&&!p.seen.includes(id)&&(e.kind==='notice'||e.date>=today))out.push({...base,key:'new:'+id,type:'newEvents',label:'新收錄的活動／公告'});
  // Only explicitly zoned sale timestamps are eligible. Never use the concert date as a sale date.
  const sale=e.kind==='raffle'?(e.raffleEdge==='start'?e.raffle?.start:null):e.saleAt;
  if(p.ticketTomorrow&&timestamp(sale)&&taipeiDay(sale)===tomorrow)out.push({...base,key:'sale:'+id+':'+sale,type:'ticketTomorrow',label:e.kind==='raffle'?'明天開始登記／抽選':'明天開始售票',at:sale});
  const end=e.kind==='raffle'&&e.raffleEdge==='end'?e.raffle?.end:null;
  if(p.raffleTomorrow&&timestamp(end)&&taipeiDay(end)===tomorrow)out.push({...base,key:'end:'+id+':'+end,type:'raffleTomorrow',label:'明天抽選／登記截止',at:end});
 }
 return [...new Map(out.map(x=>[x.key,x])).values()];
}
const time=(s,zone)=>new Date(s).toLocaleString('zh-TW',{timeZone:zone,hour12:false});
export function emailText(items){return items.map(x=>`${x.label}\n${x.event.title}\n${x.at?'台灣時間：'+time(x.at,'Asia/Taipei')+'\n日本時間：'+time(x.at,'Asia/Tokyo'):x.event.date?'活動日期：'+x.event.date:'公告日期／活動時間請確認官方原文'}${x.event.raffle?.requiresRegistration?'\n須已完成 Weverse 事前登記；未登記者不能參加此階段。':''}${x.event.uncertaintyReasons?.length?'\n？部分資訊待確認，請核對原文。':''}\n${link(x.event.sourceUrl)||link(x.event.url)}`).join('\n\n────────\n\n')+'\n\n你收到此信是因為已在 Encore 開啟通知。可在網站右上角「Email 通知」關閉。';}
export async function createEmailNotifications({file=new URL('./data/email-notifications.json',import.meta.url),env=process.env,getEvents,fetchImpl=fetch,now=()=>Date.now()}={}){
 let state={users:{},jobs:{}};
 try{state=JSON.parse(await readFile(file,'utf8'));if(!state.users||!state.jobs)throw Error('invalid notification store');}catch(e){if(e.code!=='ENOENT')throw e;}
 // Serialise mutations and dispatches so a preference update cannot be lost to a send.
 let tail=Promise.resolve();const locked=fn=>{const task=tail.then(fn);tail=task.catch(()=>{});return task;};
 const ready=()=>!!(env.RESEND_API_KEY&&env.EMAIL_FROM);
 async function save(){await mkdir(new URL('./',file),{recursive:true});const tmp=new URL(file.href+'.tmp');await writeFile(tmp,JSON.stringify(state,null,2));await rename(tmp,file);}
 const status=id=>{const p=state.users[id];return {configured:ready(),preferences:Object.fromEntries(flags.map(k=>[k,!!p?.[k]])),email:p?.email||'',lastError:p?.lastError||'',lastSentAt:p?.lastSentAt||null};};
 return {
  status,
  update: (user,value)=>locked(async()=>{
   if(flags.some(k=>typeof value[k]!=='boolean')||!Array.isArray(value.artists)||value.artists.length>8||value.artists.some(a=>!GROUPS.includes(a)))throw Error('請選擇有效的通知設定與團體。');
   if(!user.email||!user.email_confirmed_at)throw Error('請先驗證帳號信箱，再啟用 Email 通知。');
   const old=state.users[user.id],baseline=getEvents().filter(e=>matches(e,value.artists)).map(identity);
   state.users[user.id]={...old,...Object.fromEntries(flags.map(k=>[k,value[k]])),email:user.email,artists:value.artists,seen:[...new Set([...(old?.seen||[]),...baseline])],lastError:''};
   await save();return status(user.id);
  }),
  follows:(id,artists)=>locked(async()=>{const p=state.users[id];if(!p)return;p.seen=[...new Set([...p.seen,...getEvents().filter(e=>matches(e,artists.filter(a=>!p.artists.includes(a)))).map(identity)])];p.artists=artists;await save();}),
  tick:()=>locked(async()=>{
   if(!ready())return;
   const events=getEvents(),t=now();
   for(const[id,p]of Object.entries(state.users)){
    if(!flags.some(k=>p[k]))continue;
    const all=candidates(events,p,t);
    // Next-day reminders are sent at/after 09:00 Taipei; new discoveries need not wait.
    const due=all.filter(x=>x.type==='newEvents'||new Date(t+8*3600000).getUTCHours()>=9);
    for(const x of due){const key=hash(id+'|'+x.key);if(state.jobs[key])continue;state.jobs[key]={user:id,item:x,status:'pending',created:t};}
    p.seen=[...new Set([...p.seen,...events.filter(e=>matches(e,p.artists)).map(identity)])];
   }
   await save();
   for(const[key,j]of Object.entries(state.jobs)){
    if(j.status!=='pending')continue;const p=state.users[j.user];
    if(!p||!p[j.item.type]||!matches(j.item.event,p.artists)){j.status='cancelled';continue;}
    if(j.item.type!=='newEvents'&&taipeiDay(j.item.at)!==taipeiDay(t+86400000)){j.status='expired';continue;}
    if(j.firstAttempt&&t-j.firstAttempt>=23*3600000){j.status='uncertain';p.lastError='有通知寄送結果不明，已停止重試以免重複寄信，請查看 Resend 紀錄。';continue;}
    if(j.lastAttempt&&t-j.lastAttempt<15*60000)continue;
    j.firstAttempt??=t;j.lastAttempt=t;
    // Persist the exact payload before sending; retries reuse it and its idempotency key.
    j.body??={from:env.EMAIL_FROM,to:[p.email],subject:'Encore｜'+j.item.label+' · '+(j.item.event.artist||'追蹤團體'),text:emailText([j.item])};
    if(j.body.to[0]!==p.email){j.status='cancelled';continue;}
    await save();
    try{const r=await fetchImpl('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'encore-'+key},body:JSON.stringify(j.body),signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok||!d.id)throw Error('send');j.status='sent';j.providerId=d.id;p.lastSentAt=new Date(t).toISOString();p.lastError='';}catch{p.lastError='寄信服務暫時失敗；會重試，請確認寄件網域、API key 與額度。';}
    await save();
   }
   await save();
  })
 };
}
