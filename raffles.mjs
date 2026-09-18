import {dateOnly} from './sources.mjs';
const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
function points(line){
 const english=new RegExp('(\\d{1,2}):(\\d{2}),?\\s*(?:[A-Za-z]+,\\s*)?('+months.join('|')+'),?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?','gi');
 const found=[...line.matchAll(english)].map(m=>({year:m[5]?+m[5]:null,month:months.indexOf(m[3].toLowerCase())+1,day:+m[4],hour:+m[1],minute:+m[2]}));if(found.length===2)return found;
 return [...line.matchAll(/(?:(20\d{2})[年./-])?(\d{1,2})[月./-](\d{1,2})日?(?:\s*[（(][^）)]*[）)])?\s*(\d{1,2}):(\d{2})/g)].map(m=>({year:m[1]?+m[1]:null,month:+m[2],day:+m[3],hour:+m[4],minute:+m[5]}));
}
export function raffleWindows(n){
 if(!/membership\s*\([^)]*(?:GLOBAL|\bGL\b)|GLOBAL\s*(?:\/\s*US)?\s*(?:MEMBERSHIP|會員)|海外.*(?:会員|會員)|グローバル.*会員/i.test(n.title)||!n.countries?.includes('JP'))return [];
 const lines=n.body.split('\n'),windows=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i];if(!/Raffle (?:Sign-up|Entry) Period|(?:Weverse.*(?:事前|参加).*申込|抽選(?:受付|申込)|事前登録|登記|抽選申請)(?:期間|時間)/i.test(line))continue;
  const evidence=line+(points(line).length===2?'':' '+(lines[i+1]||''));const p=points(evidence);if(p.length!==2||(!p[0].year&&!p[1].year))continue;
  const [a,b]=p;if(!a.year)a.year=b.year-(a.month>b.month?1:0);if(!b.year)b.year=a.year+(b.month<a.month?1:0);
  const format=v=>`${v.year}-${String(v.month).padStart(2,'0')}-${String(v.day).padStart(2,'0')}`;
  if(p.some(v=>!dateOnly(format(v))||v.hour>23||v.minute>59))continue;
  if(!/JST|Japan Standard Time|日本時間|日本標準時/.test(n.body))continue;
  const iso=v=>`${format(v)}T${String(v.hour).padStart(2,'0')}:${String(v.minute).padStart(2,'0')}:00+09:00`;
  const start=iso(a),end=iso(b);if(Date.parse(end)<=Date.parse(start))continue;
  const stage=/Sign-up|事前|登記/i.test(line)?'registration':'entry';const label=stage==='registration'?'Weverse 事前登記':'Lawson 正式抽選';
  windows.push({id:`${n.url.split('/').pop()}:${stage}:${format(a)}`,artist:n.artist,title:n.title,stage,label,start,end,evidence,sourceUrl:n.url,requiresRegistration:stage==='entry'&&/Only members who finished their raffle sign-up|事前.*(?:必要|完成)/i.test(n.body)});
 }
 return [...new Map(windows.map(w=>[w.id,w])).values()];
}
export function raffleEvents(notice){return raffleWindows(notice).flatMap(w=>['start','end'].map(edge=>({id:`raffle:${w.id}:${edge}`,artist:w.artist,title:`${w.artist} GLOBAL 日本巡演 · ${w.label}${edge==='start'?'開始':'截止'}`,kind:'raffle',date:w[edge].slice(0,10),time:w[edge].slice(11,16),timezone:'Asia/Tokyo',country:'JP',venue: w.stage==='registration'?'Weverse 線上登記':'Lawson Ticket 線上抽選',source:'Weverse GLOBAL 抽選公告',sourceId:'weverse',sourceUrl:w.sourceUrl,noticeTitle:w.title,raffle:w,raffleEdge:edge,description:`日本時間（JST / UTC+9）。台灣時間比日本慢 1 小時。\n${w.evidence}\n${w.requiresRegistration?'必須已完成 Weverse 事前登記才能參加此階段。':''}`,uncertaintyReasons:notice.uncertaintyReasons||[]})));}
