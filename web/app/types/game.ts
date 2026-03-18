export type GameState = "waiting" | "answering" | "result" | "complete";

export type AnswerResult = {
  correct: boolean;
  points: number;
  totalScore: number;
};

export type ArenaQuestion = {
  id: string;
  game_id: string;
  question_text: string;
  options: string[];
  correct_index: number;
};

export type ArenaGame = {
  id: string;
  onchain_game_id: string;
  status: "active" | "completed";
  created_at: string;
  questions: ArenaQuestion[];
};
