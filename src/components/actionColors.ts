import type { OuenAction, OuenActionType } from "../types";

export const ACTION_COLOR: Record<OuenActionType, string> = {
  chorus: "#b8a024",
  gesture: "#b85003",
  clap: "#c290b5",
};

export const ACTION_LABEL: Record<OuenActionType, string> = {
  chorus: "合唱",
  gesture: "手勢",
  clap: "拍手",
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