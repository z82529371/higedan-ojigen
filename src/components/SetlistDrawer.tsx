interface SetlistEntry {
  id: string;
  title: string;
  audioMissing: boolean;
}

interface SetlistDrawerProps {
  open: boolean;
  entries: SetlistEntry[];
  currentId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
}

export function SetlistDrawer({ open, entries, currentId, onClose, onSelect }: SetlistDrawerProps) {
  return (
    <div className={`setlist-drawer-backdrop${open ? " open" : ""}`} onClick={onClose} aria-hidden={!open} inert={!open}>
      <aside className="setlist-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="setlist-drawer-header">
          <h2>曲目</h2>
          <button type="button" className="setlist-drawer-close" onClick={onClose} aria-label="關閉歌單">
            ×
          </button>
        </div>
        <ul className="setlist-drawer-list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className={`setlist-drawer-item${entry.id === currentId ? " active" : ""}${entry.audioMissing ? " missing" : ""}`}
                onClick={() => onSelect(entry.id)}
              >
                <span className="setlist-drawer-name">{entry.title}</span>
                {entry.audioMissing && <span className="setlist-drawer-status">缺音檔</span>}
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}