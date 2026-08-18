import type { Song, SongMeta } from "../types";
import { parseGestures, parseSongs, parseSong } from "./validate";

export interface LoadedSong {
  meta: SongMeta;
  song: Song;
  audioMissing: boolean;
}

export interface AppData {
  songs: LoadedSong[];
  gestures: string[];
}

async function fetchJson(path: string): Promise<unknown> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`無法載入 ${path}（HTTP ${res.status}）`);
  }
  return res.json();
}

export async function loadAppData(): Promise<AppData> {
  const [songsRaw, gesturesRaw] = await Promise.all([fetchJson("songs.json"), fetchJson("gestures.json")]);
  const metas = parseSongs(songsRaw);
  const gestures = parseGestures(gesturesRaw);

  const songs = await Promise.all(
    metas.map(async (meta) => {
      const raw = await fetchJson(meta.data);
      const song = parseSong(raw, gestures);
      let audioPath = song.audio;
      let audioRes = await fetch(audioPath, { method: "HEAD" });
      let isOk = audioRes.ok && !(audioRes.headers.get("content-type") ?? "").startsWith("text/html");

      // 如果預設路徑 (.m4a) 找不到，嘗試備選副檔名 (.mp3)
      if (!isOk && audioPath.endsWith(".m4a")) {
        const mp3Path = audioPath.replace(/\.m4a$/, ".mp3");
        const mp3Res = await fetch(mp3Path, { method: "HEAD" });
        if (mp3Res.ok && !(mp3Res.headers.get("content-type") ?? "").startsWith("text/html")) {
          audioPath = mp3Path;
          isOk = true;
        }
      }

      return { meta, song: { ...song, audio: audioPath }, audioMissing: !isOk };
    }),
  );

  return { songs, gestures };
}
