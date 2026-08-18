export type OuenActionType = "chorus" | "gesture" | "clap";

export interface ChorusAction {
  type: "chorus";
  text?: string;
  romaji?: string;
}

export interface GestureAction {
  type: "gesture";
  gesture: string;
}

export interface ClapAction {
  type: "clap";
  pattern: string;
}

export type OuenAction = ChorusAction | GestureAction | ClapAction;

export interface OuenPoint {
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
  ouenPoints: OuenPoint[];
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
