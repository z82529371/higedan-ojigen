# 開發期 Vite API 寫入與 HMR 忽略機制

## 背景與問題
原架構設計 App 為純靜態 Web App，手寫 JSON 資料。但在實際對齊 31 首歌曲的歌詞秒數時，需要隨音樂播放即時進行微調（±0.1s ~ ±5s）並立即寫回硬碟，若手動編輯 JSON 效率極低。然而，Vite 預設會監聽 `public/` 資料夾下的變動並觸發 HMR (Hot Module Replacement) 全頁面重新整理，這會導致每次按按鈕微調時間時，音樂播放中斷並強制刷新頁面。

## 決策
1. 在 `vite.config.ts` 中新增 dev server 自訂中間件 API `POST /api/save-song-data`，直接將前端微調後的 `lyrics` 與 `lockedLines` 寫回本機 `public/data/<songId>.json`。
2. 配置 `server.watch.ignored: ["**/public/data/**"]`，防止 Vite 監聽到 `public/data/` 寫入時觸發頁面刷新，實現無縫且流暢的即時寫入。

## 後果
- **正面**：開發時點擊微調按鈕即可毫秒級自動持久化寫入硬碟 JSON，且音樂播放不中斷、頁面不重整。
- **負面**：手動在 VS Code 編輯 JSON 時，瀏覽器不會自動更新，需手動按 F5 刷頁；靜態部署至生產環境（如 GitHub Pages）時該 API 不可用（但生產環境本就不需要寫入）。
