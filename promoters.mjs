import {plain,dateOnly} from './sources.mjs';
import {findArtists} from './festivals.mjs';
export function parsePromoter(html,source){const text=plain(html);
 if(source.type==='bts-tw'){
  const m=text.match(/時間\s*[：:]\s*(20\d{2})\/(\d{1,2})\/(\d{1,2}(?:\s*&\s*\d{1,2})*)/);if(!m)throw Error('BTS 台灣場日期欄位無法辨識');
  return m[3].split('&').map(d=>`${m[1]}-${m[2].padStart(2,'0')}-${d.trim().padStart(2,'0')}`).filter(dateOnly).map(date=>({id:`bts-tw:${date}`,artist:'BTS',title:"BTS WORLD TOUR 'ARIRANG' IN KAOHSIUNG",date,time:null,country:'TW',timezone:'Asia/Taipei',venue:'高雄國家體育場（世運主場館）',source:source.name,sourceId:source.id,sourceUrl:source.url,ticketUrl:'https://tixcraft.com/activity/detail/26_btskns',description:'依 Live Nation Taiwan 活動日期欄位收錄。開演時間、票況與異動請核對主辦及拓元頁面。'}));
 }
 // Read each day's singer paragraph only. Historical winners and actor lists are not a lineup.
 if(!/AAA 2026/.test(text)||!/12월 5일\s*[~～]\s*6일/.test(text))throw Error('AAA 2026 活動日期無法確認');
 const paragraphs=[...text.matchAll(/가수 부문에는\s*([\s\S]*?)(?:출연해|출연을 확정)/g)].slice(0,2);if(paragraphs.length!==2)throw Error('AAA 分日歌手名單格式改變');
 return paragraphs.map((m,i)=>{const solo=/연준\(투모로우바이투게더\)/.test(m[1]);const artists=findArtists(m[1].replace(/연준\(투모로우바이투게더\)/g,''));const labels=[...artists];if(solo){artists.push('TXT');labels.push('TXT（YEONJUN 個人出演）');}return {id:`aaa2026:day${i+1}`,artist:artists.join(' / '),artists,lineupLabels:labels,eventType:'festival',title:`2026 AAA 亞洲明星盛典 · 第 ${i+1} 天`,date:`2026-12-0${i+5}`,time:null,country:'TW',timezone:'Asia/Taipei',venue:'高雄國家體育場（世運主場館）',source:source.name,sourceId:source.id,sourceUrl:source.url,ticketUrl:'https://tixcraft.com/activity/detail/26_aaa',description:'依 AAA 官方 2026/9/15 公布的分日歌手名單收錄。僅列出你設定的八團及相關個人出演；不把歷屆得獎名單當作今年出演名單。正式時間請查看拓元活動頁。'};}).filter(e=>e.artists.length);
}
