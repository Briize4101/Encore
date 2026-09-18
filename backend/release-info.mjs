import {dateOnly} from './sources.mjs';
const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
export function releaseInfo(title,body){
 const isRelease=(/comeback|回歸|컴백|カムバック|(?:album|single|\bep\b).*(?:release|pre.?order)|(?:release|pre.?order).*(?:album|single|\bep\b)|앨범.*(?:발매|예약)|(?:발매|예약).*앨범|リリース|発売|發行|发行/i.test(title)||(/\brelease\b/i.test(title)&&/album|single|\bEP\b/i.test(body)))&&!/merch|vinyl|reissue|再発|グッズ|fansign|fan.sign|팬사인|特典会|サイン会|download.*event|release party|music show|購入特典/i.test(title);
 if(!isRelease)return null;
 const lines=body.split('\n');const candidates=[];
 for(let i=0;i<lines.length;i++){
  let line=lines[i];if(!/release\s*(?:date|schedule)|(?:album|single) release\s*:|(?:will be|to be|is) released|発売日|リリース日|発[売表]日時|발매\s*일|발매\s*일시|發行日期|发行日期|回歸日期|컴백\s*일/i.test(line))continue;
  if(/pre.?order|予約|預購|예약/.test(line.toLowerCase()))continue;
  if(!/20\d{2}/.test(line))line+=' '+(lines[i+1]||'');
  const dates=[];
  for(const m of line.matchAll(/(20\d{2})\s*[年년./-]\s*(\d{1,2})\s*[月월./-]\s*(\d{1,2})/g))dates.push(`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`);
  const english=new RegExp('('+months.join('|')+')\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*\\([^)]*\\))?,?\\s+(20\\d{2})','gi');
  for(const m of line.matchAll(english))dates.push(`${m[3]}-${String(months.indexOf(m[1].toLowerCase())+1).padStart(2,'0')}-${m[2].padStart(2,'0')}`);
  for(const date of dates.filter(dateOnly))candidates.push({date,line});
 }
 const unique=[...new Set(candidates.map(c=>c.date))];const reasons=[];
 if(unique.length===0)reasons.push('公告提到回歸／發行，但尚未辨識到含年份的明確發行日；不會推測日期放入月曆。');
 if(unique.length>1)reasons.push('公告包含多個發行日期，可能是不同版本或地區，需查看原文確認。');
 if(/TBA|to be announced|tentative|待定|另行公布|추후\s*공지|未定/i.test(candidates.map(c=>c.line).join(' ')))reasons.push('發行日期段落含有待定或另行公布資訊。');
 const date=unique.length===1&&!reasons.length?unique[0]:null;
 const evidence=date?candidates.find(c=>c.date===date).line:'';
 const zone=/KST/.test(evidence)?'Asia/Seoul':/JST/.test(evidence)?'Asia/Tokyo':null;
 return {date,evidence,timezone:zone,uncertaintyReasons:reasons};
}
export function eventUncertainty(e,failed=false){const reasons=[...(e.uncertaintyReasons||[])];if(failed)reasons.push('來源最近更新失敗，目前顯示上次收錄資料。');if(!e.kind){if(!e.time)reasons.push('來源尚未提供可辨識的開演時間。');if(!e.venue||/請見|待公告|待確認/.test(e.venue))reasons.push('場館尚未確認，請查看原公告。');}return {...e,uncertaintyReasons:[...new Set(reasons)]};}
