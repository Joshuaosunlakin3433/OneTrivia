export const PACKAGE_ID =
  "0xd70eace167a55e9870b1a805c5841f67b50cbb7731782bc69f174ab9174d4f69";
export const MODULE_NAME = "game";
export const CREATE_GAME_FN = "create_game";
export const SUBMIT_ANSWER_FN = "submit_answer";
export const JOIN_GAME_FN = "join_game";

export const ANSWER_COLORS = [
  { id: "red", hex: "#ff1744", active: "#ff4569", label: "RED", index: 0 },
  { id: "blue", hex: "#2979ff", active: "#5393ff", label: "BLUE", index: 1 },
  {
    id: "yellow",
    hex: "#ffd700",
    active: "#ffe44d",
    label: "YELLOW",
    index: 2,
  },
  { id: "green", hex: "#00e676", active: "#4dff9a", label: "GREEN", index: 3 },
] as const;

export type AnswerColor = (typeof ANSWER_COLORS)[number];
