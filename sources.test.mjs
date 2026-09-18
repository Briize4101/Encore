import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMoc,parseKktix,parseSchedule,dateOnly,safeUrl,scheduleCategoryUrl} from './sources.mjs';
test('multiple performances retain separate dates and unknown time',()=>{
  const events=parseMoc([{UID:'a',title:'Test',webSales:'javascript:alert(1)',showInfo:[{time:'2026/10/24 18:00:00',locationName:'A'},{time:'2026/10/25',locationName:'B'},{time:'2026/13/01'}]}]);
  assert.equal(events.length,2);assert.equal(events[0].time,'18:00');assert.equal(events[1].time,null);assert.notEqual(events[0].id,events[1].id);assert.equal(events[0].ticketUrl,'');
});
test('reject impossible dates and unsafe source links',()=>{assert.equal(dateOnly('2026/02/30'),null);assert.equal(dateOnly('2026/13/01'),null);assert.equal(safeUrl('data:text/html,hi'),'');});
const source={id:'test',name:'Official',artist:'TXT',url:'https://example.com/schedule'};
function row(category,title,date='2026.10',day='24'){return `<a href="/schedule/abc"><p>${date}</p><p>${day}</p><p>[ ${category} ]</p><p>${title}</p></a>`;}
test('only live events with explicit supported country enter calendar',()=>{
  const events=parseSchedule(row('EVENT &amp; LIVE','TOUR IN JAPAN')+row('TV','Tour IN JAPAN TV')+row('LIVE','TOUR IN SEOUL')+row('LIVE','LIVE IN TAIPEI')+row('LIVE','TOUR IN USA')+row('LIVE','JAPAN オンライン配信'),source);
  assert.deepEqual(events.map(e=>e.country),['JP','KR','TW']);assert.equal(events[0].time,null);
});
test('legacy schedule format uses event date outside title link',()=>{const html='<p>2026.09.19</p><p>|</p><p>EVENT &amp; LIVE</p><a href="/schedule/a?CateID=11">TOUR IN JAPAN</a>';assert.equal(parseSchedule(html,source)[0].date,'2026-09-19');});
test('unknown layout fails explicitly instead of reporting no events',()=>{assert.throws(()=>parseSchedule('<a href="/schedule/a">Changed format</a>',source));});
test('find only live category links',()=>{assert.equal(scheduleCategoryUrl('<a href="/schedule?cateid=11">EVENT &amp; LIVE</a>',source),'https://example.com/schedule?cateid=11');});

test('KKTIX uses performance date instead of sale date',()=>{const html='<script type="application/ld+json">[{"@type":"Event","name":"Concert","startDate":"2026-06-21T18:30:00+08:00","offers":[{"validFrom":"2026-05-09T12:00:00+08:00","price":100}]}]</script>';const e=parseKktix(html,{id:'kktix',name:'KKTIX',url:'https://example.com'});assert.equal(e[0].date,'2026-06-21');assert.equal(e[0].time,'18:30');assert.match(e[0].saleAt,/2026-05-09/);});
