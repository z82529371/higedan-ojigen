import { useMemo, useState } from "react";
import type { LoadedSong } from "../data/load";

interface SongListProps {
  songs: LoadedSong[];
  onSelect: (id: string) => void;
}

export function SongList({ songs, onSelect }: SongListProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return songs;
    }
    return songs.filter(({ meta }) => meta.title.toLowerCase().includes(q));
  }, [songs, query]);

  return (
    <div className="setlist-page">
      <section className="setlist-header">
        <p className="card-label">Practice Library</p>
        <h1>Official髭男dism 完整歌單</h1>
        <input
          type="search"
          className="song-search"
          placeholder="搜尋歌曲..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </section>

      {filtered.length === 0 ? (
        <p className="text-gray-500">找不到符合「{query}」的歌曲。</p>
      ) : (
        <div className="song-list">
          {filtered.map(({ meta, audioMissing }, i) => (
            <button key={meta.id} type="button" className="song-item" onClick={() => onSelect(meta.id)}>
              <span className="song-number">{String(i + 1).padStart(2, "0")}</span>
              <span className="song-name">{meta.title}</span>
              {audioMissing && <span className="song-status missing">缺音檔</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}