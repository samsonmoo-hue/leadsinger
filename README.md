# leadsinger｜同拍領唱提示

網站：https://samsonmoo-hue.github.io/leadsinger/

1. 領唱先建立房間，名稱就是歌名。
2. 團員選擇已建立的房間與領唱／樂手身分。
3. 領唱點選「從頭、副歌、尾句、音樂繼續」，同房裝置即時更新。

前端由 GitHub Pages 的 `main` 分支 `/docs` 發布；後端使用 Firebase `leadsinger` 專案的 Realtime Database（新加坡）與匿名 Authentication，不需要個人帳號或密碼。

## 開發與發布

執行 `npm ci`、`npm run build:pages`。建置結果輸出至 `docs/`；提交並推送即可觸發 Pages。`npx tsc --noEmit` 可檢查型別。

`lib/firebase-config.ts` 是瀏覽器公開設定，不是管理員憑證。權限由 `database.rules.json` 控制，規則已同步至 Firebase。切勿提交服務帳戶私鑰或管理員憑證。

身分由使用者自行選擇；本版不提供領唱密碼。後端限制每個匿名身分只能設定自己的角色，樂手角色不能修改提示、房間名稱或其他人的角色。重新整理後須重新選擇房間。連線中斷會顯示最後收到的提示，重連後自動更新。房間目前沒有刪除介面。

`app/api`、`db` 與 Sites 設定保留先前私人原型，GitHub Pages 版本不使用這些 API，也不依賴 Sites 分享權限。Firebase 版本的同步檢查使用 `scripts/check-firebase.mjs`；舊 `scripts/check-sync.mjs` 僅適用原型。
