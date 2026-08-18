# 資料檔格式：索引 + 每歌一檔的英文 JSON

31 首歌曲以手寫 JSON 資料檔維護。採用 `songs.json`（歌曲清單）+ `gestures.json`（手勢目錄）+ `data/{id}.json`（每歌一檔）三層結構；時間皆為音檔開始為零的秒數，欄位與型別值全英文（`chorus`/`gesture`/`clap`）。理由是手寫資料的編輯範圍要最小（改一首只動一檔），手勢目錄是領域資料而非程式碼，且英文欄位在各種工具中無編碼風險。

## Schema

**`songs.json`**
```json
{ "songs": [ { "id": "subtitle", "title": "Subtitle", "data": "data/subtitle.json" } ] }
```
- `songs[]` — 31 首。`id` 唯一（英文，也是資料檔檔名基準）；`title` 顯示用歌名；`data` 該歌資料檔相對路徑。

**`gestures.json`**
```json
{ "gestures": ["✌️", "🤣", "☝️", "🙆", "✊", "🙌"] }
```
- `gestures[]` — 可擴充目錄，目前 6 個 emoji；遇到新動作即追加。

**`data/{id}.json`**
```json
{
  "id": "subtitle",
  "title": "Subtitle",
  "audio": "audio/subtitle.mp3",
  "note": "開場有 intro，請提早準備應援",
  "lyrics": [
    { "start": 0.5, "end": 4.2, "text": "君は涙零しながら", "romaji": "kimi wa namida koboshi nagara" },
    { "start": 4.2, "end": 8.0, "text": "笑顔で僕に言った" }
  ],
  "ouenPoints": [
    { "start": 30.0, "end": 45.0,
      "actions": [
        { "type": "chorus" },
        { "type": "gesture", "gesture": "🙌" }
      ] },
    { "start": 90.0, "end": 96.0,
      "actions": [ { "type": "clap", "pattern": "👏 👏 👏" } ] },
    { "start": 120.0, "end": 126.0,
      "actions": [ { "type": "chorus", "text": "僕らの旅は続く！", "romaji": "bokura no tabi wa tsuzuku" } ] }
  ]
}
```
- `note`：選填的**演唱會提示**文字，於播放頁標題下顯示；不一定每首都有。
- `lyrics[]`：每行 `start`/`end`/`text` 必填（秒，`end > start`）；`romaji` 選填，只在合唱區間內的行需要。
- `ouenPoints[]`：`start`/`end` 必填，不得與其他應援點時間重疊。
- `actions[]`：至少 1 個，`type` 為 `chorus`/`gesture`/`clap`。
  - `chorus`：選填 `text` + `romaji`（補充文字）。
  - `gesture`：必填 `gesture`，值必須在 `gestures.json` 內。
  - `clap`：必填 `pattern`，視覺字串（👏 重複 + 空格標示拍點）。