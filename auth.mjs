import {randomBytes,createHash} from 'node:crypto';
export function authConfig(env){
 const url=(env.SUPABASE_URL||'').replace(/\/$/,'');const key=env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||'';
 if(!url||!key)return null;
 const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('Supabase URL 必須是 HTTPS 專案網址');
 let publicKey=key.startsWith('sb_publishable_');if(!publicKey){try{publicKey=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon';}catch{}}
 if(!publicKey)throw Error('請使用 Supabase Publishable 或 anon key');
 return {url,key};
}
export function createAuthHandler({env=process.env,fetchImpl=fetch,now=()=>Date.now(),notifications}={}){
 let config;try{config=authConfig(env);}catch{config=null;}
 const sessions=new Map(),attempts=new Map(),oauth=new Map();const maxAge=7*86400000;
 const reply=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const cookie=(res,id)=>res.setHeader('Set-Cookie',`encore_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${id?604800:0}`);
 const userInfo=user=>({id:user.id,email:user.email||''});
 async function call(path,{body,token,method='POST'}={}){const r=await fetchImpl(config.url+'/auth/v1/'+path,{method,headers:{apikey:config.key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});let data={};try{data=await r.json();}catch{}return {ok:r.ok,status:r.status,data};}
 async function credentials(req){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8192)throw Error('body');}const value=JSON.parse(raw);if(typeof value.email!=='string'||typeof value.password!=='string'||!value.password||value.password.length>1024||value.email.length>254||!/^\S+@\S+\.\S+$/.test(value.email.trim()))throw Error('body');return {email:value.email.trim(),password:value.password};}
 return async(req,res,url)=>{
  if(!url.pathname.startsWith('/api/auth/'))return false;
  const route=url.pathname.slice('/api/auth/'.length);
  if(!['session','login','signup','logout','follows','google','callback','notifications'].includes(route)){reply(res,404,{error:'找不到功能'});return true;}
  if(!(['follows','notifications'].includes(route)?['GET','PUT']:[['session','callback'].includes(route)?'GET':'POST']).includes(req.method)){reply(res,405,{error:'不支援此方法'});return true;}
  if(req.method!=='GET'&&(req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']==='cross-site')){reply(res,403,{error:'請從本站登入'});return true;}
  for(const[id,s]of sessions)if(s.until<=now())sessions.delete(id);
  const id=req.headers.cookie?.match(/(?:^|;\s*)encore_session=([a-f0-9]{64})(?:;|$)/)?.[1];const session=sessions.get(id);
  if(route==='logout'){sessions.delete(id);cookie(res,'');if(config&&session)void call('logout?scope=local',{token:session.access}).catch(()=>{});reply(res,200,{user:null});return true;}
  if(!config){reply(res,route==='session'?200:503,{configured:false,user:null,error:route==='login'?'登入尚未啟用，請稍後再試。':undefined});return true;}
  try{
   for(const[k,v]of oauth)if(v.until<=now())oauth.delete(k);
   if(route==='google'){
    const settings=await call('settings',{method:'GET'});
    if(!settings.ok||!settings.data.external?.google){reply(res,503,{error:'Google 登入尚未啟用。請在 Supabase 的 Authentication → Sign In / Providers → Google 設定並啟用。'});return true;}
    const nonce=randomBytes(32).toString('hex'),verifier=randomBytes(48).toString('base64url');
    const old=req.headers.cookie?.match(/(?:^|;\s*)encore_oauth=([a-f0-9]{64})(?:;|$)/)?.[1];oauth.delete(old);
    oauth.set(nonce,{verifier,until:now()+600000,host:req.headers.host});
    const redirect=new URL('http://'+req.headers.host+'/api/auth/callback');redirect.searchParams.set('flow',nonce);
    const authorize=new URL(config.url+'/auth/v1/authorize');authorize.searchParams.set('provider','google');authorize.searchParams.set('redirect_to',redirect.href);authorize.searchParams.set('code_challenge',createHash('sha256').update(verifier).digest('base64url'));authorize.searchParams.set('code_challenge_method','s256');
    res.setHeader('Set-Cookie',`encore_oauth=${nonce}; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=600`);reply(res,200,{url:authorize.href});return true;
   }
   if(route==='callback'){
    const nonce=req.headers.cookie?.match(/(?:^|;\s*)encore_oauth=([a-f0-9]{64})(?:;|$)/)?.[1],flow=oauth.get(nonce);oauth.delete(nonce);
    const clear='encore_oauth=; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=0';
    const fail=()=>{res.setHeader('Set-Cookie',clear);res.writeHead(303,{Location:'/?login_error=google','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end();return true;};
    const code=url.searchParams.get('code');if(!flow||flow.host!==req.headers.host||url.searchParams.get('flow')!==nonce||!code||code.length>2048||url.searchParams.has('error'))return fail();
    let r;try{r=await call('token?grant_type=pkce',{body:{auth_code:code,code_verifier:flow.verifier}});}catch{return fail();}
    const d=r.data;if(!r.ok||!d.user?.id||!d.access_token||!d.refresh_token)return fail();
    const sid=randomBytes(32).toString('hex');sessions.delete(id);sessions.set(sid,{access:d.access_token,refresh:d.refresh_token,expires:now()+(d.expires_in||3600)*1000,until:now()+maxAge,user:userInfo(d.user)});
    res.setHeader('Set-Cookie',[clear,`encore_session=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800`]);res.writeHead(303,{Location:'/','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end();return true;
   }
   if(route==='login'||route==='signup'){
    const client=req.socket.remoteAddress||'local';for(const[k,v]of attempts)if(v.until<=now())attempts.delete(k);const attempt=attempts.get(client)||{count:0,until:now()+60000};attempts.set(client,attempt);if(++attempt.count>10){reply(res,429,{error:'登入嘗試過於頻繁，請稍候一分鐘。'});return true;}
    let body;try{body=await credentials(req);}catch{reply(res,400,{error:'請輸入有效的 Email 和密碼。'});return true;}
    if(route==='signup'){
     if(body.password.length<8){reply(res,400,{error:'註冊密碼至少需要 8 個字元。'});return true;}
     const r=await call('signup?redirect_to='+encodeURIComponent('http://'+req.headers.host+'/'),{body});
     if(!r.ok){reply(res,r.status===429?429:400,{error:'無法完成註冊，請確認密碼符合要求或稍後重試。'});return true;}
     reply(res,200,{message:'若此信箱可註冊，請查看驗證信（包含垃圾郵件），完成驗證後再登入。若已有帳號，請直接登入。'});return true;
    }
    const r=await call('token?grant_type=password',{body});if(!r.ok){reply(res,r.status===429?429:401,{error:r.status===429?'請稍後再試。':'登入失敗，請確認 Email、密碼與信箱驗證狀態。'});return true;}
    const d=r.data;if(!d.user?.id||!d.access_token||!d.refresh_token)throw Error('invalid auth response');
    const sid=randomBytes(32).toString('hex');sessions.delete(id);sessions.set(sid,{access:d.access_token,refresh:d.refresh_token,expires:now()+(d.expires_in||3600)*1000,until:now()+maxAge,user:userInfo(d.user)});cookie(res,sid);reply(res,200,{configured:true,user:userInfo(d.user)});return true;
   }
   if(!session){reply(res,['follows','notifications'].includes(route)?401:200,{configured:true,user:null,error:['follows','notifications'].includes(route)?'請先登入。':undefined});return true;}
   if(session.expires-now()<60000){
    session.refreshing??=call('token?grant_type=refresh_token',{body:{refresh_token:session.refresh}}).then(r=>{if(!r.ok||!r.data.access_token||!r.data.refresh_token||!r.data.user?.id){sessions.delete(id);return false;}Object.assign(session,{access:r.data.access_token,refresh:r.data.refresh_token,expires:now()+(r.data.expires_in||3600)*1000,user:userInfo(r.data.user)});return true;}).finally(()=>delete session.refreshing);
    if(!await session.refreshing){cookie(res,'');reply(res,['follows','notifications'].includes(route)?401:200,{configured:true,user:null,error:'登入已過期，請重新登入。'});return true;}
   }
   if(route==='notifications'){
    if(!notifications){reply(res,503,{error:'通知服務尚未就緒。'});return true;}
    if(req.method==='GET'){reply(res,200,notifications.status(session.user.id));return true;}
    let value;try{let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8192)throw Error();}value=JSON.parse(raw);}catch{reply(res,400,{error:'通知設定格式錯誤。'});return true;}
    const check=await call('user',{method:'GET',token:session.access});if(!check.ok||check.data.id!==session.user.id){reply(res,401,{error:'登入已過期，請重新登入。'});return true;}
    try{reply(res,200,await notifications.update(check.data,value));}catch(e){reply(res,400,{error:e.message.startsWith('請')?e.message:'無法儲存通知設定，請稍後重試。'});}return true;
   }
   if(route==='follows'){
    let body;
    if(req.method==='PUT'){
     try{let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8192)throw Error();}const a=JSON.parse(raw).followedArtists;
      const known=['BTS','RIIZE','&TEAM','BOYNEXTDOOR','CORTIS','ENHYPEN','NCT WISH','TXT'];
      if(!Array.isArray(a)||a.length>8||a.some(x=>!known.includes(x)))throw Error();
      body={user_id:session.user.id,followed_artists:[...new Set(a)],updated_at:new Date(now()).toISOString()};
     }catch{reply(res,400,{error:'請選擇支援的團體。'});return true;}
    }
    if(body&&notifications)await notifications.follows(session.user.id,body.followed_artists);
    const query=body?'on_conflict=user_id':'user_id=eq.'+encodeURIComponent(session.user.id)+'&select=followed_artists&limit=1';
    const r=await fetchImpl(config.url+'/rest/v1/member_inf?'+query,{method:body?'POST':'GET',headers:{apikey:config.key,Authorization:'Bearer '+session.access,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
    if(!r.ok){reply(res,503,{error:'追蹤設定無法讀取或儲存。請確認已在 Supabase 執行新版 supabase/setup.sql 建立 member_inf，再重試。'});return true;}
    const rows=await r.json();if(!Array.isArray(rows))throw Error('invalid preferences');
    reply(res,200,{exists:rows.length>0,followedArtists:rows[0]?.followed_artists||[]});return true;
   }
   reply(res,200,{configured:true,user:session.user});return true;
  }catch{reply(res,502,{error:'登入服務暫時無法連線，請稍後重試。'});return true;}
 };
}
