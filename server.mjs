import {createEmailNotifications} from './email-notifications.mjs';
import {createAuthHandler} from './auth.mjs';
import {raffleEvents} from './raffles.mjs';
import {parsePromoter} from './promoters.mjs';
import {decorateFestival} from './festivals.mjs';
import {eventUncertainty} from './release-info.mjs';
import {noticeEvents} from './notice-events.mjs';
import {announcementState,refreshAnnouncements} from './announcements.mjs';
import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {SOURCES,DEFAULT_ARTISTS,parseMoc,parseKktix,parseSchedule,scheduleCategoryUrl} from './sources.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
try{process.loadEnvFile(path.join(root,'.env'));}catch(e){if(e.code!=='ENOENT')console.error('無法讀取登入設定檔');}
let handleAuth;
const cachePath=path.join(root,'data','events.json');
const interval=6*60*60*1000;
let state={events:[],sources:[],updatedAt:null};let pending=null;let lastAttempt=0;
try{const saved=JSON.parse(await readFile(cachePath,'utf8'));if(Array.isArray(saved.events)&&Array.isArray(saved.sources))state=saved;}catch{}
async function download(url){const r=await fetch(url,{signal:AbortSignal.timeout(25000),headers:{'User-Agent':'EncoreCalendar/1.0 (personal event calendar)','Accept':'text/html,application/json'}});if(!r.ok)throw new Error(`來源回應 HTTP ${r.status}`);return r;}
async function refresh(){
  if(pending)return pending;
  if(Date.now()-lastAttempt<60000)return state;
  lastAttempt=Date.now();
  pending=(async()=>{
    const results=await Promise.allSettled(SOURCES.map(async source=>{
      const response=await download(source.url);
      let events;
      if(source.type==='moc')events=parseMoc(await response.json(),source);
      else if(['bts-tw','aaa2026'].includes(source.type))events=parsePromoter(await response.text(),source);
      else if(source.type==='kktix')events=parseKktix(await response.text(),source);
      else {const html=await response.text();events=parseSchedule(html,source);const categoryUrl=scheduleCategoryUrl(html,source);if(categoryUrl){const categoryHtml=await (await download(categoryUrl)).text();events.push(...parseSchedule(categoryHtml,source));if(new URL(categoryUrl).searchParams.has('categoryId')){for(let page=2;page<=4;page++){const u=new URL(categoryUrl);u.searchParams.set('page',page);const moreHtml=await (await download(u.href)).text();let more;try{more=parseSchedule(moreHtml,source);}catch{if(!moreHtml.includes('href="/schedule/'))break;throw new Error('官方行程分頁結構已改變');}events.push(...more);if(more.length&&more.every(e=>e.date<new Date().toISOString().slice(0,10)))break;}}}events=[...new Map(events.map(e=>[e.id,e])).values()];}
      return {events,source:{...source,ok:true,count:events.length,updatedAt:new Date().toISOString(),error:null}};
    }));
    const events=[],sources=[];
    results.forEach((r,i)=>{const source=SOURCES[i];if(r.status==='fulfilled'){events.push(...r.value.events);sources.push(r.value.source);}else{events.push(...state.events.filter(e=>e.sourceId===source.id));sources.push({...source,ok:false,count:state.events.filter(e=>e.sourceId===source.id).length,updatedAt:state.sources.find(s=>s.id===source.id)?.updatedAt||null,error:r.reason?.message||'資料來源暫時無法連線'});}});
    // Stable IDs collapse duplicate entries within a source; distinct sources stay attributable.
    const unique=[...new Map(events.map(e=>[e.id,e])).values()].sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
    const next={events:unique,sources,updatedAt:new Date().toISOString()};
    await mkdir(path.dirname(cachePath),{recursive:true});await writeFile(cachePath+'.tmp',JSON.stringify(next,null,2),'utf8');await rename(cachePath+'.tmp',cachePath);state=next;return state;
  })().finally(()=>{pending=null;});return pending;
}
state.events=state.events.filter(e=>e.sourceId!=='bts');state.sources=state.sources.filter(e=>e.id!=='bts');
function payload(){return {...state,events:[...state.events,...announcementState().notices.flatMap(n=>[...noticeEvents(n),...raffleEvents(n)])].map(decorateFestival).filter(e=>e.eventType!=='festival'||e.artists?.length).map(e=>eventUncertainty(e,state.sources.some(s=>s.id===e.sourceId&&!s.ok))).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||''))),defaultArtists:DEFAULT_ARTISTS,refreshHours:6,syncing:!!pending};}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
const files=new Map([['/','index.html'],['/app.js','app.js'],['/auth.js','auth.js'],['/email-ui.js','email-ui.js'],['/raffle-ui.js','raffle-ui.js'],['/avatar-data.js','avatar-data.js'],['/fan-data.js','fan-data.js'],['/announcements.js','announcements.js'],['/style.css','style.css']]);
const server=http.createServer(async(req,res)=>{
  try{
    const host=req.headers.host||'';if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))return json(res,403,{error:'只允許本機存取'});
    const url=new URL(req.url,'http://'+host);
    if(await handleAuth(req,res,url))return;
    if(url.pathname==='/api/announcements'&&req.method==='GET')return json(res,200,announcementState());
    if(url.pathname==='/api/announcements/sync'&&req.method==='POST'){if(req.headers.origin&&req.headers.origin!=='http://'+host)return json(res,403,{error:'來源不符'});void refreshAnnouncements().catch(console.error);return json(res,202,announcementState());}
    if(url.pathname==='/api/events'&&req.method==='GET')return json(res,200,payload());
    if(url.pathname==='/api/sync'&&req.method==='POST'){
      if(req.headers.origin&&req.headers.origin!=='http://'+host)return json(res,403,{error:'來源不符'});
      await refresh();return json(res,200,payload());
    }
    if(req.method!=='GET')return json(res,405,{error:'不支援此方法'});
    const filename=files.get(url.pathname);if(!filename)return json(res,404,{error:'找不到頁面'});
    const body=await readFile(path.join(root,'dist',filename));res.writeHead(200,{'Content-Type':filename.endsWith('.html')?'text/html; charset=utf-8':filename.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data: https://phinf.wevpstatic.net; base-uri 'self'; frame-ancestors 'none'"});res.end(body);
  }catch(e){console.error(e.message);json(res,500,{error:'暫時無法更新，請稍後再試。既有資料已保留。'});}
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'網站已啟動或 4173 連接埠被占用。請開啟 http://127.0.0.1:4173':e.message);process.exitCode=1;});

setInterval(()=>void refresh().catch(e=>console.error(e.message)),interval).unref();

void refreshAnnouncements().catch(console.error);setInterval(()=>void refreshAnnouncements().catch(console.error),30*60*1000).unref();

const notifications=await createEmailNotifications({getEvents:()=>[...payload().events,...announcementState().notices.filter(n=>!['ticket'].includes(n.kind)).map(n=>({...n,kind:'notice',sourceUrl:n.url}))]});
handleAuth=createAuthHandler({notifications});
setTimeout(()=>void notifications.tick().catch(()=>console.error('Email 通知檢查失敗')),15000).unref();
setInterval(()=>void notifications.tick().catch(()=>console.error('Email 通知檢查失敗')),5*60000).unref();

server.listen(Number(process.env.PORT)||4173,'127.0.0.1',()=>{console.log('Encore calendar: http://127.0.0.1:'+(Number(process.env.PORT)||4173));if(!state.updatedAt||Date.now()-Date.parse(state.updatedAt)>interval)void refresh().catch(e=>console.error(e.message));});
