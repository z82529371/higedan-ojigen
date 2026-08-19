export type OuenActionType = "chorus" | "gesture" | "clap";

export interface ChorusAction {
  type: "chorus";
  text?: string;
  romaji?: string;
}

export interface GestureAction {
  type: "gesture";
  gesture: string;
  text?: string;
}

export interface ClapAction {
  type: "clap";
  pattern: string;
  text?: string;
}

export type OuenAction = ChorusAction | GestureAction | ClapAction;

export interface OuenTimeInterval {
  start: number;
  end: number;
}

/** 資料檔中的原始應援點形狀：start/end 或 times 二者擇一，載入時經 validate 展開。 */
export interface OuenPoint {
  start?: number;
  end?: number;
  times?: OuenTimeInterval[];
  actions: OuenAction[];
}

/** 載入展開後的應援點：times 已攤平成單一時間區間，start/end 恆為必填。 */
export interface ResolvedOuenPoint {
  start: number;
  end: number;
  actions: OuenAction[];
}

export interface LyricLine {
  start: number;
  end: number;
  text: string;
  romaji?: string;
}

export interface Song {
  id: string;
  title: string;
  audio: string;
  note?: string;
  lyrics: LyricLine[];
  ouenPoints: ResolvedOuenPoint[];
  lockedLines?: number[];
}

export interface SongMeta {
  id: string;
  title: string;
  data: string;
}

export interface SongsFile {
  songs: SongMeta[];
}

export interface GesturesFile {
  gestures: string[];
}
