export type Player = {
  id: string;
  name: string;
  seed?: number | null;
  entryType?: string | null;
  country?: string;
};

export type Match = {
  id: string;
  round: "R128" | "R64" | "R32" | "R16" | "QF" | "SF" | "F";
  top: Player;
  bottom: Player;
  winnerId?: string;
};

export type Bracket = {
  tourney_id: string;
  event: string;
  surface: string;
  drawSize: number;
  matches: Match[];
  speedRank?: number | null;
  speedMin?: number | null;
  speedMax?: number | null;
};
