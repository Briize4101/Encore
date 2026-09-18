import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
import {candidates,emailText,createEmailNotifications,taipeiDay} from '../email-notifications.mjs';
const p={artists:['BTS'],seen:[],newEvents:true,ticketTomorrow:true,raffleTomorrow:true};
const t=Date.parse('2026-09-18T09:00:00+08:00');
const concert={id:'a',artist:'BTS',title:'BTS concert',date:'2026-11-19',sourceUrl:'https://weverse.io/bts/notice/1'};
test('tomorrow uses Taiwan date and explicit sale time, never the concert date',()=>{
 const events=[{...concert,date:'2026-09-19'}, {...concert,title:'sale',saleAt:'2026-09-20T00:30:00+09:00'}, {...concert,title:'unknown timezone',saleAt:'2026-09-19T10:00'}, {...concert,artist:'BEAST IN BLACK',title:'unfollowed',saleAt:'2026-09-19T12:00:00+08:00'}];
 const due=candidates(events,p,t).filter(x=>x.type==='ticketTomorrow');assert.equal(due.length,1);assert.equal(due[0].event.title,'sale');assert.equal(taipeiDay('2026-09-20T00:30:00+09:00'),'2026-09-19');
});
test('raffle start and deadline are distinct and prerequisite is explicit',()=>{
 const r={...concert,kind:'raffle',raffle:{start:'2026-09-19T13:00:00+09:00',end:'2026-09-19T23:59:00+09:00',requiresRegistration:true}};
 const due=candidates([{...r,raffleEdge:'start'},{...r,raffleEdge:'end'}],{...p,newEvents:false},t);assert.deepEqual(due.map(x=>x.type),['ticketTomorrow','raffleTomorrow']);assert.match(emailText(due),/未登記者不能參加/);assert.match(emailText(due),/台灣時間/);
});
test('baseline, filtering, persistent deduplication, opt-out and disabled service',async()=>{
 const file=pathToFileURL(join(await mkdtemp(join(tmpdir(),'encore-mail-')),'state.json'));let events=[concert],sent=[];
 const options={file,env:{RESEND_API_KEY:'test',EMAIL_FROM:'test@example.com'},getEvents:()=>events,now:()=>t,fetchImpl:async(u,o)=>{sent.push(JSON.parse(o.body));return{ok:true,json:async()=>({id:'sent'})}}};
 const user={id:'one',email:'one@example.com',email_confirmed_at:'2026-01-01'};let service=await createEmailNotifications(options);
 await assert.rejects(service.update({...user,email_confirmed_at:null},p),/驗證/);await service.update(user,p);await service.tick();assert.equal(sent.length,0);
 events.push({...concert,title:'new concert',id:'b'});await service.tick();assert.equal(sent.length,1);await service.tick();assert.equal(sent.length,1);
 service=await createEmailNotifications(options);await service.tick();assert.equal(sent.length,1);
 await service.update(user,{...p,newEvents:false,ticketTomorrow:false,raffleTomorrow:false});events.push({...concert,title:'third'});await service.tick();assert.equal(sent.length,1);
 const disabled=await createEmailNotifications({...options,env:{}});assert.equal(disabled.status(user.id).configured,false);await disabled.tick();assert.equal(sent.length,1);
});
test('next-day reminder waits until 9am and retries with identical idempotency payload',async()=>{
 let time=Date.parse('2026-09-18T08:00:00+08:00'),calls=[];const file=pathToFileURL(join(await mkdtemp(join(tmpdir(),'encore-mail-')),'state.json'));
 const service=await createEmailNotifications({file,env:{RESEND_API_KEY:'test',EMAIL_FROM:'a@example.com'},now:()=>time,getEvents:()=>[{...concert,saleAt:'2026-09-19T12:00:00+08:00'}],fetchImpl:async(u,o)=>{calls.push(o);if(calls.length===1)throw Error('timeout');return{ok:true,json:async()=>({id:'ok'})}}});
 await service.update({id:'a',email:'a@example.com',email_confirmed_at:'yes'},p);await service.tick();assert.equal(calls.length,0);time+=3600000;await service.tick();assert.equal(calls.length,1);time+=5*60000;await service.tick();assert.equal(calls.length,1);time+=10*60000;await service.tick();assert.equal(calls.length,2);assert.equal(calls[0].body,calls[1].body);assert.equal(calls[0].headers['Idempotency-Key'],calls[1].headers['Idempotency-Key']);
});
