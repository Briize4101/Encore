import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {groups} from './dist/fan-data.js';
import {plain} from './sources.mjs';
import {releaseInfo,eventUncertainty} from './release-info.mjs';
import {noticeEvents} from './notice-events.mjs';
import {festivalInfo} from './festivals.mjs';
const cache=new URL('./data/announcements.json',import.meta.url);
let state={notices:[],sources:[],updatedAt:null},pending=null,last=0;
try{state=JSON.parse(await readFile(cache,'utf8'));}catch{}
const seeds={txt:[39106],enhypen:[35099,37455],boynextdoor:[35847],andteam:[38989,39001],riize:[32821,26847],nctwish:[33506,34967,28778],bts:[36080,32916],cortis:[34026]};
async function get(url){const r=await fetch(url,{headers:{'User-Agent':'Googlebot'},signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.text();}
export function parseNotice(html,artist,url){const title=plain(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');const raw=html.match(/<p\b[^>]*class="[^"]*whitespace-pre-wrap[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1];if(!title||!raw)throw Error('公開公告內容未提供');const body=raw.split(/\n|<br\s*\/?>/i).map(plain).join('\n');
 const release=releaseInfo(title,body);
 const festival=festivalInfo(title,body,artist);
 const concert=/concert|tour|演唱會|콘서트|투어|공연|コンサート|ツアー|公演/i.test(title);
 if((!concert&&!release&&!festival)||/merch|popup|pop-up|상품|굿즈|グッズ|cinema|上映|팬사인|fansign/i.test(title))return null;
 const regionText=title+' '+body.replace(/\b(?:KST|JST)\b/g,'');const countries=[];
 if(/taiwan|taipei|taoyuan|kaohsiung|台灣|台湾|台北|臺北|桃園|高雄/i.test(regionText))countries.push('TW');
 if(/japan|tokyo|osaka|nagoya|fukuoka|yokohama|chiba|miyagi|nagano|saga|日本|東京|大阪|名古屋|福岡|横浜|千葉|宮城|長野|佐賀/i.test(regionText))countries.push('JP');
 if(/seoul|in korea|kspo|goyang|busan|incheon|서울|고양|부산|首爾|ソウル/i.test(regionText))countries.push('KR');
 if(!countries.length&&!release)return null;
 const kind=release?'comeback':festival?'festival':/ticket|presale|pre-sale|raffle|예매|티켓|チケット|先行|抽選|售票|預售/i.test(title)?'ticket':'concert';
 const lines=body.split('\n');const snippets=lines.flatMap((line,i)=>/presale|general sale|application period|先行|受付期間|예매|售票|預售/i.test(line)?[line,lines[i+1]||'']:[]).filter(Boolean).slice(0,10);
 const notice={id:url,artist,title,body:body.slice(0,20000),url,countries,kind,release,festival,snippets,checkedAt:new Date().toISOString()};
 const uncertaintyReasons=release?[...release.uncertaintyReasons]:festival?[...festival.uncertaintyReasons]:[];
 if(!release&&kind==='concert'){const events=noticeEvents(notice);if(!events.length)uncertaintyReasons.push('尚未從公告辨識出可直接加入月曆的演出日期，請查看原文或圖片。');else uncertaintyReasons.push(...new Set(events.flatMap(e=>eventUncertainty(e).uncertaintyReasons)));}
 if(!release&&kind==='ticket'&&!snippets.length)uncertaintyReasons.push('尚未辨識出明確售票時間，請查看原公告。');
 if(festival&&!noticeEvents(notice).length&&!uncertaintyReasons.length)uncertaintyReasons.push('尚未辨識出各團體的明確演出日期，請確認分日名單及原公告。');
 return {...notice,uncertaintyReasons};
}
export function announcementState(){return {...state,notices:state.notices.map(n=>({...n,uncertaintyReasons:[...(n.uncertaintyReasons||[]),...(state.sources.some(s=>s.artist===n.artist&&!s.ok)?['此團體有公告更新失敗，部分資訊需核對原文。']:[])]})),syncing:!!pending};}
export function refreshAnnouncements(){if(pending)return pending;if(Date.now()-last<60000)return Promise.resolve(state);last=Date.now();pending=(async()=>{const notices=new Map(state.notices.map(n=>[n.id,n]));const sources=[];
 for(let start=0;start<groups.length;start+=2){await Promise.all(groups.slice(start,start+2).map(async([artist,slug])=>{try{const url=`https://weverse.io/${slug}/highlight?hl=en`;const html=await get(url);const ids=[...new Set([...(seeds[slug]||[]).map(String),...[...html.matchAll(new RegExp('/'+slug+'/notice/(\\d+)','g'))].map(m=>m[1])])];if(!ids.length)throw Error('公開首頁未提供公告連結');let failures=0;
 for(const id of ids){const link=`https://weverse.io/${slug}/notice/${id}`;try{const n=parseNotice(await get(link),artist,link);if(n)notices.set(link,{...n,firstDetectedAt:notices.get(link)?.firstDetectedAt||n.checkedAt});else notices.delete(link);}catch{failures++;}}
 sources.push({artist,url,ok:failures===0,error:failures?`${failures} 則公告無法讀取`:null,count:ids.length});}catch(e){sources.push({artist,ok:false,error:e.message});}}));}
 state={notices:[...notices.values()].sort((a,b)=>b.firstDetectedAt.localeCompare(a.firstDetectedAt)),sources,updatedAt:new Date().toISOString()};await mkdir(new URL('./data/',import.meta.url),{recursive:true});await writeFile(new URL('./data/announcements.json.tmp',import.meta.url),JSON.stringify(state,null,2));await rename(new URL('./data/announcements.json.tmp',import.meta.url),cache);return state;})().finally(()=>pending=null);return pending;}
