# Encore 追星行事曆

雙擊 start.cmd，開啟 http://127.0.0.1:4173 。需要 Node.js 22 以上，不需 npm 套件。保持啟動視窗執行才能自動更新。程式僅綁定本機，未公開部署。

## 功能
- 桌面版左側 2/3 月曆、右側 1/3 Weverse Announcement；窄螢幕上下排列。
- 團體、搜尋、月份、月曆／列表、台灣／日本／韓國及活動類型篩選。
- 點活動開啟詳情、原始公告、來源提供的售票連結與平台快捷連結。
- 演唱會詳情勾選「我會到場」，月曆上方出現 D-N／D-DAY；取消即移除。依場地當地日期計算，過去日期不顯示倒數。
- 追蹤團體儲存在 Supabase member_inf；雲端未設定好時可先存於瀏覽器。到場倒數與收藏依帳號儲存在瀏覽器，不跨裝置同步。
- 八團共 50 個生日及 8 個出道紀念日每年循環，依收錄時官方成員名單，不會自動更新成員名單。生日不受國家篩選限制。可在 frontend/fan-data.js 編輯。
- BTS 紫、RIIZE 橘、&TEAM 粉、BOYNEXTDOOR 藍、CORTIS 黃、ENHYPEN 深紅、NCT WISH 薄荷、TXT 深綠。

## 來源與限制
演唱會每 6 小時更新：文化部公開資料、TXT／ENHYPEN／&TEAM／BOYNEXTDOOR／CORTIS 日本官方行程及使用者指定的 &TEAM KKTIX 活動頁。失敗會保留舊資料並顯示錯誤。前版無法確認的 BTS 網域已移除，舊快取該來源不再顯示。

Weverse 每 30 分鐘讀取八團公開首頁顯示的公告及程式內已確認的公告連結，分類台日韓演唱會、巡演及售票內容。不是私人 API 或完整歷史公告訂閱，不同步 Weverse 追蹤變更。新增追蹤名稱不會自動增加來源。首頁只有少量公告，可能漏收；會員限定、純圖片及格式改變也可能無法辨識。「首次收錄」不是官方發布時間，售票片段保留原文時區。

公告內具明確英文演出日期欄位或開演時間行的內容自動加入月曆；其他格式只顯示公告，請查看原文。預售與開賣日不會當成演出日。不同來源可能重複收錄，保留各自出處。取消及異動以原公告為準。

六個售票網址皆已保留。KKTIX 指定活動已串接；其餘為查詢入口，不宣稱完整串接。检查時拓元回傳 HTTP 401；ibon 與 TicketPlus 公開 HTML 為動態頁面。Tickets in Japan／PIA 可讀取入口，但未實作全站場次解析。不繞過登入、驗證碼或存取限制，也不代購。相關公告依團體與地區比對，未必同一場次。

## 程式與驗證
- backend/server.mjs：本機服務、API、場次排程。
- backend/sources.mjs：官方行程／文化部／KKTIX 解析。
- backend/announcements.mjs：Weverse 公開公告偵測。
- backend/notice-events.mjs：明確演出日期解析。
- frontend/：前端，fan-data.js 含配色及年度紀念日來源連結。
- data/events.json 與 data/announcements.json：公開資料快取。
- node --test：驗證日期、來源、演出與售票日期區分、公告誤判、生日循環和倒數時區。

此電腦的全域 npm 指令有缺檔；本專案不依賴 npm，使用 node backend/server.mjs 啟動、node --test 驗證即可。

## 回歸與待確認標記
- 新專輯／單曲公告會顯示「回歸／發行」，明確發行日以全天活動加入月曆；不把預購日期當回歸日。
- 支援公告內明確的英文、中文／日文／韓文年月日欄位。缺少年份、日期待定、多個日期或未辨識格式時不猜日期，公告旁顯示問號。
- 點公告旁「？」可展開原因及原文連結。活動缺少開演時間、場館，或來源最近更新失敗，也會標示需要確認。
- 跨地區發行公告不受演出地區篩選限制；歷史發行日需切換至對應月份查看。
- 追加測試：node --test sources.test.mjs features.test.mjs comeback.test.mjs。

## 拼盤／音樂節
官方行程及可讀取的 Weverse 公告會辨識音樂節、KCON、SMTOWN、Summer Sonic、聯合演唱會等活動，提供「拼盤／音樂節」篩選與已收錄的出演團體標籤。沿用台日韓範圍、原始公告連結、到場勾選和倒數。名單以官方藝人行程或明確出演欄位為依據，不將一般文字提及當出演。多日活動若沒有辨識到分日名單，僅保留公告和問號，不推定每個團體每天出演。偵測仍受既有來源與公告格式涵蓋範圍限制，未串接所有音樂節網站。

## 漏收與標題修正
已增設 Live Nation Taiwan 的 BTS 高雄場日期來源，以及 AAA 2026 官方分日歌手名單來源，皆跟隨場次排程每六小時檢查。AAA 名單排除歷屆獲獎者，YEONJUN 個人出演另行標示。
預設顯示只看我的團體；所有來源模式會明示包含未追蹤藝人。不再因介紹內提及團體就視為該團體演出。
月曆以巡演名稱及演出城市顯示，原售票／抽選公告標題保留於活動詳情，公告欄仍顯示原始標題。
八團頭像採本次取得的 Weverse 官方團體 profile image URL，由 Weverse 圖片網域載入；不是自動同步登入帳號，也不會持續更新頭像。可更新 frontend/avatar-data.js。
完整檢查指令：node --test sources.test.mjs features.test.mjs comeback.test.mjs festivals.test.mjs promoters.test.mjs pending.test.mjs

## GLOBAL 日本巡演抽選
月曆將 Weverse 事前登記與 Lawson 正式抽選分開，分別收錄開始、截止兩個時間點，標記為 GLOBAL 抽選登記，絕不作為演唱會日期。詳情與月曆上方期限區顯示日本時間及台灣時間、尚未開始／受理中／已截止；24 小時內的開始或截止另有標示。需要前置登記的後續抽選會明確提醒，不能因後續期間仍開放就推定尚可取得資格。已截止的階段仍在原日期可查看。
目前解析已明確標示 GLOBAL／GL 會員、日本地區、日本時區且包含完整年份與時間的公告期間。英文與年月日數字格式可解析，無法確定時不猜測。Weverse 公開首頁偵測仍可能漏收；Codex 對話另已建立每 6 小時檢查公開官方消息的提醒，必須有可執行的本機 Codex 環境，不保證離線或電腦關機時執行。網頁本身不是背景推播服務。

## Supabase Email／Password 登入
登入介面位於頁首，支援已有帳號的 Email／Password 登入、登出、狀態恢復和權杖更新。此版本不含註冊、重設密碼或 Supabase 資料表同步；追蹤、收藏與到場仍是原本的瀏覽器本機偏好。
在專案根目錄建立 .env（參考 .env.example），設定 SUPABASE_URL 以及 SUPABASE_PUBLISHABLE_KEY（或 SUPABASE_ANON_KEY），再重啟 start.cmd。請使用 public／anon key，不使用 service_role 或 secret key。Supabase 需啟用 Email 登入，帳號須已建立並符合該專案信箱驗證規則。
密碼只用來向 Supabase 驗證，不保存到檔案或 localStorage。Supabase access／refresh tokens 保留在本機伺服器記憶體，瀏覽器只有 HttpOnly／SameSite cookie。伺服器重啟後需重新登入；登入工作階段最多七天。本專案仍僅運行於 localhost，沒有新增對外部署。
尚未提供連線設定時會清楚標示登入未啟用，不建立假登入。auth.test.mjs 使用模擬 Supabase 回應驗證成功／失敗、跨站防護、session 清除和 refresh 併發；真實登入需設定專案後由使用者在介面操作。
GLOBAL 抽選區已移到「接下來的演出」下方。

## 帳號與個人追蹤設定
1. Supabase SQL Editor 執行 `supabase/setup.sql`，建立有 RLS 的個人追蹤資料表。
2. Authentication → URL Configuration：Site URL 設為 `http://127.0.0.1:4173/`，Redirect URLs 加入相同網址（若使用 localhost，也加入 `http://localhost:4173/`）。正式上線後改用正式網址。
3. 右上角登入視窗下方可註冊；完成信箱驗證後登入，勾選團體並儲存。
4. 團體追蹤儲存在 Supabase。收藏與到場倒數仍儲存於此瀏覽器，按帳號分開；不會跨裝置同步。
5. 伺服器重新啟動後須重新登入。訪客顯示八團資料；登入後只顯示該帳號選擇的團體。

## 從 GitHub 下載後啟動
1. 安裝 Node.js 22 以上。
2. 將 `.env.example` 複製為 `.env`，填入自己的 Supabase Project URL 與 Publishable key。
3. 在 Supabase SQL Editor 執行 `supabase/setup.sql`，建立 `member_inf`（Email 與追蹤團體）。Google 登入見 `supabase/google-login.md`。
4. 執行 `node backend/server.mjs`，開啟 `http://127.0.0.1:4173/`。
5. Email 通知設定見 `email-setup.md`。通知狀態與來源快取由程式在 `data/` 自動建立，首次更新可能需要等待。

本 repository 不包含 `.env`、會員 Email／寄送紀錄、下載快取與本機備份。設定文件中的範例專案網址需換成自己的專案。
GitHub 用來存放原始碼；此網站需要 Node.js 後端，不能直接使用 GitHub Pages 提供完整登入與寄信功能。

## 資料夾結構

```text
fandom-calendar/
├─ frontend/          # HTML、CSS、瀏覽器 JavaScript
├─ backend/           # Node.js、API、資料解析
│  ├─ server.mjs      # 後端入口
│  └─ tests/          # 自動化測試
├─ data/              # 原有快取與通知紀錄，不上傳 GitHub
├─ supabase/          # SQL 與登入設定說明
├─ .env              # 本機設定，不上傳 GitHub
├─ package.json
└─ start.cmd          # Windows 啟動入口
```

從根目錄執行 `node backend/server.mjs` 或雙擊 `start.cmd`。前端仍由後端提供，不需分開啟動。資料與環境設定路徑以程式所在位置解析，不依賴終端機目前的資料夾。
