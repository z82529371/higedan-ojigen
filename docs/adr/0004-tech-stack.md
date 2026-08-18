# 技術棧：Vite + React + Tailwind + HTML5 audio 的純前端

App 是純前端應用（無後端）：以 **Vite + React** 建置，**Tailwind CSS** 樣式，音檔用 **HTML5 `<audio>`** 播放、`requestAnimationFrame` 輪詢 `currentTime` 同步歌詞；`data/` 與 `audio/` 放在 `public/` 以 URL 引用。選 React 而非 Next 是因無伺服器需求，`<audio>` 的 `currentTime` 已足以支援前後 5 秒跳轉與點擊歌詞跳轉。