import { useEffect, useState } from "react";
import { loadAppData, type AppData } from "./data/load";
import { Player } from "./components/Player";
import { SongList } from "./components/SongList";

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
    return (
      <Player
        audio={selected.song.audio}
        title={selected.song.title}
        lyrics={selected.song.lyrics}
        ouenPoints={selected.song.ouenPoints}
        audioMissing={selected.audioMissing}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return <SongList songs={data.songs} onSelect={setSelectedId} />;
}
