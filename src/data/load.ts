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
      const audioRes = await fetch(song.audio, { method: "HEAD" });
      const audioMissing =
        !audioRes.ok || (audioRes.headers.get("content-type") ?? "").startsWith("text/html");
      return { meta, song, audioMissing };
    }),
  );

  return { songs, gestures };
}
