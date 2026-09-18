import {dateOnly} from './sources.mjs';
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const datePattern=new RegExp('('+months.join('|')+')\\s+(\\d{1,2}),?\\s+(20\\d{2})','g');
export function concertTitle(notice,city=''){
 const explicit=notice.body.match(/Concert title:\s*([^\n]+)/i)?.[1];
 const quoted=notice.title.match(/『([^』]*(?:TOUR|CONCERT)[^』]*)』/i)?.[1];
 const title=(explicit||quoted||notice.title.replace(/^\[[^\]]+\]\s*/,'').replace(/\s+(?:Announcement|Open Announcement|Ticket Information)$/i,'')).trim();
 return city?`${title} - ${city.toUpperCase()}`:title;
}
export function noticeEvents(notice){
 const events=[];const {body,title,artist,url,countries}=notice;
 if(notice.kind==='festival'&&!notice.festival?.artists.length)return [];
 if(notice.kind==='comeback')return notice.release?.date?[{id:`comeback:${url.split('/').pop()}`,artist,title:`${artist} 回歸／發行 · ${title.replace(/^\[[^\]]+\]\s*/, '')}`,kind:'comeback',date:notice.release.date,time:null,timezone:notice.release.timezone||'Asia/Seoul',venue:'新作品發行',source:'Weverse 公告',sourceId:'weverse',sourceUrl:url,description:notice.release.evidence+'\n依原公告發行日顯示為全天活動；完整發行時間及版本請核對原文。',uncertaintyReasons:notice.uncertaintyReasons||[]}]:[];
 if(/online live|live viewing|streaming|cinema|生中継|ライブビューイング/i.test(title))return [];
 let venue=body.match(/(?:▶\s*|-\s*)Venue:\s*([^\n]+)/i)?.[1]||'場館請見原公告';
 let city='';
 for(const line of body.split('\n')){
  if(/^\[(?:Tokyo|Aichi|Osaka|Fukuoka|Kanagawa|Saga|Miyagi|Nagano|Chiba|Saitama|Hyogo|Hiroshima|Yokohama)\]\s+\S/i.test(line)&&countries.length===1){city=line.match(/^\[([^\]]+)\]/)[1];venue=line.replace(/^\[[^\]]+\]\s*/, '');}
  // Only explicit performance-date fields or lines containing doors/show times.
  if(!/(?:▶\s*Date:|^-\s*(?:Time|Date):|Concert begins|Show starts|開演)/i.test(line)||/presale|raffle|application|予約|受付/i.test(line))continue;
  if(countries.length!==1)continue;
  const matches=[...line.matchAll(datePattern)];
  for(let i=0;i<matches.length;i++){const m=matches[i];const date=`${m[3]}-${String(months.indexOf(m[1])+1).padStart(2,'0')}-${m[2].padStart(2,'0')}`;if(!dateOnly(date))continue;
   const segment=line.slice(m.index,matches[i+1]?.index||line.length);const before=line.slice(i?matches[i-1].index+matches[i-1][0].length:0,m.index);let time=null;
   const clock=segment.match(/(?:Concert begins|Show starts)(?:\s+at)?\s*(\d{1,2}):(\d{2})/i);const ampm=(/▶\s*Date:/.test(line)?before:segment).match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
   if(clock)time=`${clock[1].padStart(2,'0')}:${clock[2]}`;else if(ampm)time=`${String(Number(ampm[1])%12+(ampm[3].toUpperCase()==='PM'?12:0)).padStart(2,'0')}:${ampm[2]||'00'}`;
   events.push({id:`weverse:${url.split('/').pop()}:${date}`,artist,title:concertTitle(notice,city),noticeTitle:title,date,time,venue,country:countries[0],timezone:{TW:'Asia/Taipei',JP:'Asia/Tokyo',KR:'Asia/Seoul'}[countries[0]],source:'Weverse 公告',sourceId:'weverse',sourceUrl:url,description:'由公告中的明確演出日期欄位匯入；售票與異動請查看原公告。'});
  }
 }
 if(notice.kind==='festival'&&new Set(events.map(e=>e.date)).size>1)return [];
 return [...new Map(events.map(e=>[e.id,e])).values()].map(e=>notice.kind==='festival'?{...e,eventType:'festival',artists:notice.festival.artists,uncertaintyReasons:notice.uncertaintyReasons||[]}:e);
}
