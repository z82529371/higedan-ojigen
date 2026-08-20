import type { OuenAction, OuenActionType } from "../types";

export const ACTION_COLOR: Record<OuenActionType, string> = {
  chorus: "#d97706",
  gesture: "#ea580c",
  clap: "#db2777",
};

export const ACTION_LABEL: Record<OuenActionType, string> = {
  chorus: "合唱",
  gesture: "手勢",
  clap: "拍手",
};

export const ACTION_PRIORITY: Record<OuenActionType, number> = {
  chorus: 3,
  gesture: 2,
  clap: 1,
};

export function actionLabel(action: OuenAction): string | null {
  switch (action.type) {
    case "gesture":
      return action.gesture;
    case "clap":
      return action.pattern;
    case "chorus":
      return action.text ?? null;
  }
}