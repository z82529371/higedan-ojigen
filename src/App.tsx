import { useEffect, useState } from "react";
import { loadAppData, type AppData } from "./data/load";
import { Player } from "./components/Player";
import { SongList } from "./components/SongList";

function songIdFromHash(): string | null {
  const match = window.location.hash.match(/^#\/song\/(.+)$/);
  if (!match) {
    return null;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function navigateSong(id: string | null) {
  window.location.hash = id === null ? "#/" : `#/song/${id}`;
}

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(() => songIdFromHash());

  useEffect(() => {
    const onHash = () => setSelectedId(songIdFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadAppData()
      .then((loaded) => {
        if (!cancelled) {
          setData(loaded);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="setlist-page">
        <div className="song-notice">資料載入失敗：{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="setlist-page">
        <p>載入中…</p>
      </div>
    );
  }

  const selected = data.songs.find((s) => s.meta.id === selectedId);
  if (selected) {
    const index = data.songs.findIndex((s) => s.meta.id === selectedId);
    return (
      <Player
        key={selected.song.id}
        audio={selected.song.audio}
        title={selected.song.title}
        note={selected.song.note}
        lyrics={selected.song.lyrics}
        ouenPoints={selected.song.ouenPoints}
        initialLockedLines={selected.song.lockedLines}
        audioMissing={selected.audioMissing}
        songList={data.songs.map(({ meta, audioMissing: missing }) => ({
          id: meta.id,
          title: meta.title,
          audioMissing: missing,
        }))}
        currentId={selected.song.id}
        onPrev={index > 0 ? () => navigateSong(data.songs[index - 1].meta.id) : undefined}
        onNext={index < data.songs.length - 1 ? () => navigateSong(data.songs[index + 1].meta.id) : undefined}
        onSelectSong={(id) => navigateSong(id)}
        onBack={() => navigateSong(null)}
      />
    );
  }

  return <SongList songs={data.songs} onSelect={(id) => navigateSong(id)} />;
}
