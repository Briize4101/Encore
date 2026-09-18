import { createHash } from 'node:crypto';

export const DEFAULT_ARTISTS = ['TXT','RIIZE','&TEAM','BOYNEXTDOOR','CORTIS','ENHYPEN','NCT WISH','BTS'];
export const SOURCES = [
 {id:'bts-tw',name:'Live Nation Taiwan · BTS 高雄',artist:'BTS',type:'bts-tw',url:'https://www.livenation.com.tw/event/bts-world-tour-arirang-in-kaohsiung-kaohsiung-tickets-edp1675887'},
 {id:'aaa2026',name:'AAA 官方分日陣容',type:'aaa2026',url:'https://www.asiaartistawards.com/news/detail/187663'},
  {id:'kktix',name:'KKTIX &TEAM 台北場',artist:'&TEAM',url:'https://kklivetw.kktix.cc/events/efb2a871',type:'kktix',coverage:'使用者提供的單一活動頁'},
  { id:'moc', name:'文化部演唱會開放資料', url:'https://cloud.culture.tw/frontsite/trans/SearchShowAction.do?method=doFindTypeJ&category=17', type:'moc', coverage:'台灣公開收錄場次' },
  { id:'enhypen', name:'ENHYPEN 官方行程', artist:'ENHYPEN', url:'https://enhypen-jp.weverse.io/schedule', type:'schedule', coverage:'ENHYPEN 日本官網公開行程' },
  { id:'txt', name:'TXT 官方行程', artist:'TXT', url:'https://txt-official.jp/schedule/', type:'schedule', coverage:'TXT 日本官網公開行程' },
  { id:'andteam', name:'&TEAM 官方行程', artist:'&TEAM', url:'https://www.andteam-official.jp/schedule', type:'schedule', coverage:'&TEAM 日本官網公開行程' },
  { id:'boynextdoor', name:'BOYNEXTDOOR 官方行程', artist:'BOYNEXTDOOR', url:'https://boynextdoor-official.jp/schedule', type:'schedule', coverage:'BOYNEXTDOOR 日本官網公開行程' },
  { id:'cortis', name:'CORTIS 官方行程', artist:'CORTIS', url:'https://cortis-official.jp/schedule', type:'schedule', coverage:'CORTIS 日本官網公開行程' },
];
export function plain(value='') { return String(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/&#x([0-9a-f]+);/gi,(_,v)=>String.fromCodePoint(parseInt(v,16))).replace(/&#(\d+);/g,(_,v)=>String.fromCodePoint(Number(v))).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim(); }
export function safeUrl(value) { try { const u=new URL(value); return ['https:','http:'].includes(u.protocol)?u.href:''; } catch { return ''; } }
export function dateOnly(value) { const m=String(value||'').match(/^(\d{4})[/-](\d{2})[/-](\d{2})/); if(!m)return null;const d=`${m[1]}-${m[2]}-${m[3]}`;const parsed=new Date(d+'T00:00:00Z');return !Number.isNaN(+parsed)&&parsed.toISOString().slice(0,10)===d?d:null; }
function id(value) { return createHash('sha256').update(value).digest('hex').slice(0,20); }
function base(source, fields) { return {source:source.name,sourceId:source.id,sourceUrl:source.url,artist:source.artist||'',time:null,venue:'場館請見官方公告',description:'',price:'',...fields}; }
export function parseMoc(rows, source=SOURCES.find(s=>s.id==='moc')) {
  if(!Array.isArray(rows))throw new Error('公開資料格式已改變');
  return rows.flatMap(row=>(row.showInfo||[]).flatMap(show=>{
    const date=dateOnly(show.time);if(!date)return [];
    return [base(source,{id:id(`moc:${row.UID}:${show.time}:${show.locationName}`),title:plain(row.title),date,time:String(show.time).match(/\b\d{2}:\d{2}(?=:|$)/)?.[0]||null,country:'TW',timezone:'Asia/Taipei',venue:plain(show.locationName||show.location||'場館待公告'),address:plain(show.location),description:plain(row.descriptionFilterHtml),price:plain(show.price),artist:plain(row.showUnit),sourceUrl:safeUrl(row.sourceWebPromote)||source.url,ticketUrl:safeUrl(row.webSales)})];
  }));
}
export function parseSchedule(html, source) {
  const events=[]; let sawSchedule=false;let recognized=false;
  for(const m of html.matchAll(/<a\b[^>]*href="([^\"]*\/schedule\/[^\"]+)"[^>]*>([\s\S]*?)<\/a>/gi)){
    sawSchedule=true;
    let p=[...m[2].matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(x=>plain(x[1]));
    if(!p.length){const before=html.slice(Math.max(0,m.index-1000),m.index);const legacy=[...before.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].slice(-3).map(x=>plain(x[1]));const d=legacy[0]?.match(/^(\d{4}\.\d{2})\.(\d{2})$/);if(d)p=[d[1],d[2],legacy[2],plain(m[2])];}
    const match=p[0]?.match(/^(\d{4})\.(\d{2})$/);if(!match||!/^\d{1,2}$/.test(p[1]||''))continue;
    recognized=true;
    if(!/LIVE|EVENT/i.test(p[2]||''))continue;
    const title=p.slice(3).filter(t=>t!=='NEW').join(' ').replace(/^NEW\s*/, '');
    if(!title||/オンライン|配信|上映|ライブビューイング|POP.UP|特典会|お渡し|サイン会|握手|撮影会|生中継/i.test(title))continue;
    // Never infer a country solely because a Japanese site published an event.
    const country=/TAIPEI|KAOHSIUNG|TAIWAN|台湾|台北|高雄/i.test(title)?'TW':/SEOUL|BUSAN|INCHEON|KOREA|韓国|ソウル|釜山|Weverse Con Festival/i.test(title)?'KR':/JAPAN|日本|東京|大阪|愛知|福岡|神奈川|兵庫|宮城|長野|千葉|埼玉|佐賀|香川|ROCK IN JAPAN/i.test(title)?'JP':null;
    if(!country)continue;
    const date=dateOnly(`${match[1]}-${match[2]}-${p[1].padStart(2,'0')}`);if(!date)continue;
    const canonical=new URL(plain(m[1]),source.url);canonical.search='';const url=canonical.href;
    events.push(base(source,{id:id(`${source.id}:${url}:${date}`),title,date,country,timezone:country==='TW'?'Asia/Taipei':country==='JP'?'Asia/Tokyo':'Asia/Seoul',sourceUrl:url,description:'日期來自藝人官方 SCHEDULE 的演出日期，不使用新聞發布日期。開演時間與場館請查閱原始公告。'}));
  }
  if(!sawSchedule||!recognized)throw new Error('無法辨識官方行程結構，保留上次資料');
  return events;
}
export function scheduleCategoryUrl(html,source){
  for(const m of html.matchAll(/<a\b[^>]*href="([^\"]*\/schedule\?cateid=\d+)"[^>]*>([\s\S]*?)<\/a>/gi))if(/LIVE|EVENT/.test(plain(m[2])))return new URL(plain(m[1]),source.url).href;
  const match=html.match(/streamController\.enqueue\(("(?:\\.|[^"\\])*")\)/);
  if(match){try{const values=JSON.parse(JSON.parse(match[1]));for(const item of values){if(!item||Array.isArray(item)||typeof item!=='object')continue;const obj=Object.fromEntries(Object.entries(item).map(([k,v])=>[values[Number(k.slice(1))],values[v]]));if(typeof obj.id==='number'&&typeof obj.name==='string'&&/LIVE|EVENT/.test(obj.name)){const url=new URL(source.url);url.searchParams.set('categoryId',obj.id);return url.href;}}}catch{}}
  return null;
}

export function parseKktix(html,source){const events=[];for(const script of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)){let data;try{data=JSON.parse(script[1]);}catch{continue;}for(const e of [data].flat()){if(e['@type']!=='Event'||!dateOnly(e.startDate))continue;events.push(base(source,{id:id(source.id+e.startDate),title:plain(e.name),date:dateOnly(e.startDate),time:e.startDate.slice(11,16),country:'TW',timezone:'Asia/Taipei',venue:plain(e.location?.name),address:plain(e.location?.address),ticketUrl:source.url,price:[...new Set((e.offers||[]).map(o=>o.price))].join(' / ')+' TWD',description:'售票時間與現況請查看 KKTIX 活動頁。',saleAt:e.offers?.[0]?.validFrom}));}}if(!events.length)throw Error('KKTIX 活動日期格式無法辨識');return events;}
