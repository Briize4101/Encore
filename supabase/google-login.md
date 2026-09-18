# Google 登入設定

1. 在 Google Cloud Console → Google Auth Platform 設定 Branding、Audience，建立 OAuth Client，類型選 Web application。測試模式時將要登入的帳號加入 Test users。
2. Google Client 的 Authorized redirect URIs 加入：
   `https://bblyiwsbckewesumlams.supabase.co/auth/v1/callback`
3. Supabase → Authentication → Sign In / Providers → Google：啟用 Google，貼上剛建立的 Client ID 與 Client Secret，儲存。Secret 只需填入 Supabase，不用傳給我或放進網站前端。
4. Supabase → Authentication → URL Configuration → Redirect URLs 加入：
   `http://127.0.0.1:4173/api/auth/callback**`
   若也使用 localhost，再加入 `http://localhost:4173/api/auth/callback**`。
   本機的 wildcard 用於 callback 的一次性 flow 參數。正式部署時改為正式 HTTPS 網域。
5. Site URL 保持 `http://127.0.0.1:4173/`。
6. 回網站 → 登入 → 使用 Google 登入。首次 Google 登入會透過 Supabase 建立帳號，不需要另設網站密碼。團體設定沿用既有 fan_preferences 資料表與 RLS。

官方文件：https://supabase.com/docs/guides/auth/social-login/auth-google
