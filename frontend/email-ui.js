export function initEmailNotifications(getArtists){
 const panel=document.querySelector('.account-controls'),button=document.createElement('button');button.textContent='Email 通知';button.hidden=true;panel.append(button);
 const dialog=document.createElement('dialog');dialog.innerHTML='<button class="close" type="button" aria-label="關閉">×</button><h2>Email 通知</h2><p>寄到登入帳號已驗證的信箱，只通知你追蹤的團體。</p><form><label><input type="checkbox" name="newEvents"> 新活動／公告收錄時</label><label><input type="checkbox" name="ticketTomorrow"> 明天開始售票／抽選登記</label><label><input type="checkbox" name="raffleTomorrow"> 明天抽選／登記截止</label><p class="muted">明日提醒：台灣時間上午 9 點起檢查。網站服務須持續執行；未確認售票時間的資料不會猜測寄送。</p><p class="email-message" role="status"></p><button class="primary" type="submit">儲存通知設定</button></form>';dialog.id='email-dialog';document.body.append(dialog);
 const form=dialog.querySelector('form'),message=dialog.querySelector('.email-message'),save=form.querySelector('[type=submit]');let generation=0;
 const fields=['newEvents','ticketTomorrow','raffleTomorrow'];
 async function request(options){const r=await fetch('/api/auth/notifications',{...options,headers:{'Content-Type':'application/json'}});const d=await r.json();if(!r.ok)throw Error(d.error||'通知服務無法連線');return d;}
 function show(d){for(const k of fields)form.elements[k].checked=d.preferences[k];message.textContent=(d.configured?'寄信服務已設定。':'尚未設定寄信服務；可先儲存偏好，但目前不會寄信。')+(d.email?' 收件信箱：'+d.email:'')+(d.lastError?' '+d.lastError:'');}
 window.addEventListener('encore-auth-change',({detail})=>{generation++;button.hidden=!detail.user;dialog.close();form.reset();message.textContent='';});
 dialog.querySelector('.close').onclick=()=>dialog.close();
 button.onclick=async()=>{const g=generation;dialog.showModal();save.disabled=true;message.textContent='讀取中…';try{const d=await request();if(g===generation){show(d);save.disabled=false;}}catch(e){if(g===generation)message.textContent=e.message;}};
 form.onsubmit=async event=>{event.preventDefault();const g=generation;save.disabled=true;message.textContent='儲存中…';try{const d=await request({method:'PUT',body:JSON.stringify({...Object.fromEntries(fields.map(k=>[k,form.elements[k].checked])),artists:getArtists()})});if(g===generation){show(d);message.textContent='設定已儲存。'+message.textContent;}}catch(e){if(g===generation)message.textContent=e.message;}finally{if(g===generation)save.disabled=false;}};
}
