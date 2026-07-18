"use client";

import React, { useMemo } from "react";
import { Check, Loader2, BarChart3 } from "lucide-react";
import type { Match, Player } from "@/lib/bracket-types";
import { acesDeltaColorClass } from "@/lib/stats-color";

const ROW_UNIT = 56; // vertical slot per match, sized off the densest (first) round
const CARD_HEIGHT = 44;
const COLUMN_WIDTH = 208;
const COLUMN_GAP = 56;

const shortenName = (fullName: string | null | undefined): string => {
  if (!fullName) return "TBD";
  const clean = fullName.trim();
  if (!clean) return "TBD";
  const parts = clean.split(/\s+/);
  return parts.length ? parts[parts.length - 1] : clean;
};

const isValidPlayer = (value: unknown) => {
  if (value === null || value === undefined) return false;
  const text = typeof value === "string" ? value : String(value);
  const normalized = text.trim().toUpperCase();
  if (!normalized) return false;
  return normalized !== "TBD" && normalized !== "BYE";
};

const getMatchIndex = (id: string): number => {
  const parsed = Number.parseInt(id.split("-")[1] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

function CompactMatchCard({
  m,
  onSelectWinner,
  onOpenPrematch,
  onOpenPlayerStats,
  disableSelection,
  isSaving,
  acesDeltaByPlayerId,
}: {
  m: Match;
  onSelectWinner?: (m: Match, winner: "top" | "bottom") => void;
  onOpenPrematch?: (m: Match) => void;
  onOpenPlayerStats?: (m: Match, player: Player) => void;
  disableSelection: boolean;
  isSaving: boolean;
  acesDeltaByPlayerId?: Record<string, number | null>;
}) {
  const isTopWinner = m.winnerId === m.top.id;
  const isBottomWinner = m.winnerId === m.bottom.id;

  const renderRow = (player: Player, slot: "top" | "bottom", isWinner: boolean) => {
    const selectable = isValidPlayer(player?.id);
    const statsAvailable = selectable && typeof onOpenPlayerStats === "function";
    const acesDelta = acesDeltaByPlayerId?.[String(player?.id)];
    const acesDeltaTitle =
      acesDelta != null
        ? `Aces vs misma superficie: ${acesDelta > 0 ? "+" : ""}${acesDelta.toFixed(1)}`
        : undefined;

    return (
      <div
        className={`flex items-center justify-between gap-1 text-[11px] leading-tight ${
          isWinner ? "font-semibold text-emerald-400" : "text-slate-200"
        }`}
      >
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            aria-pressed={isWinner}
            aria-label={`Marcar ganador: ${player.name}`}
            disabled={!selectable || disableSelection}
            onClick={(event) => {
              event.stopPropagation();
              if (disableSelection) return;
              onSelectWinner?.(m, slot);
            }}
            className={[
              "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] transition",
              isWinner
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-slate-600 text-slate-500 hover:bg-slate-800",
              selectable && !disableSelection ? "cursor-pointer" : "cursor-not-allowed opacity-40",
            ].join(" ")}
          >
            {isWinner ? <Check className="h-2.5 w-2.5" /> : null}
          </button>
          <span className="truncate">
            {shortenName(player.name)}
            {player.seed ? ` (${player.seed})` : ""}
          </span>
        </div>
        {statsAvailable && (
          <button
            type="button"
            aria-label={`Ver estadísticas de ${player.name}`}
            title={acesDeltaTitle}
            className={`shrink-0 transition ${acesDeltaColorClass(acesDelta)}`}
            onClick={(event) => {
              event.stopPropagation();
              onOpenPlayerStats?.(m, player);
            }}
          >
            <BarChart3 className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      style={{ height: CARD_HEIGHT }}
      onClick={() => onOpenPrematch?.(m)}
      className="flex w-full cursor-pointer flex-col justify-center gap-1 rounded-md border border-slate-700 bg-slate-900/90 px-2 py-1 shadow-sm transition hover:border-slate-500 hover:bg-slate-900"
    >
      {renderRow(m.top, "top", isTopWinner)}
      {renderRow(m.bottom, "bottom", isBottomWinner)}
      {isSaving && (
        <span className="inline-flex items-center gap-1 text-[9px] text-slate-400">
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
          Guardando...
        </span>
      )}
    </div>
  );
}

export type BracketTreeProps = {
  rounds: Match["round"][];
  matchesByRound: Partial<Record<Match["round"], Match[]>>;
  onSelectWinner?: (m: Match, winner: "top" | "bottom") => void;
  onOpenPrematch?: (m: Match) => void;
  onOpenPlayerStats?: (m: Match, player: Player) => void;
  savingMatchId?: string | null;
  acesDeltaByPlayerId?: Record<string, number | null>;
};

export function BracketTree({
  rounds,
  matchesByRound,
  onSelectWinner,
  onOpenPrematch,
  onOpenPlayerStats,
  savingMatchId,
  acesDeltaByPlayerId,
}: BracketTreeProps) {
  const columns = useMemo(
    () =>
      rounds.map((round) => {
        const matches = (matchesByRound[round] ?? [])
          .slice()
          .sort((a, b) => getMatchIndex(a.id) - getMatchIndex(b.id));
        return { round, matches };
      }),
    [rounds, matchesByRound],
  );

  const firstCount = columns[0]?.matches.length || 1;
  const height = ROW_UNIT * firstCount;
  const width = columns.length * COLUMN_WIDTH + Math.max(columns.length - 1, 0) * COLUMN_GAP;

  const centerOf = (count: number, index: number) => {
    const n = count || 1;
    return (height / n) * (index - 0.5);
  };

  const connectors = useMemo(() => {
    const paths: string[] = [];
    for (let k = 0; k < columns.length - 1; k++) {
      const sourceCount = columns[k].matches.length;
      const targetCount = columns[k + 1].matches.length;
      if (!sourceCount || !targetCount) continue;
      const rightX = k * (COLUMN_WIDTH + COLUMN_GAP) + COLUMN_WIDTH;
      const leftX = (k + 1) * (COLUMN_WIDTH + COLUMN_GAP);
      const midX = rightX + COLUMN_GAP / 2;

      for (let i = 1; i <= sourceCount; i++) {
        const targetIndex = Math.ceil(i / 2);
        if (targetIndex > targetCount) continue;
        const y = centerOf(sourceCount, i);
        const ty = centerOf(targetCount, targetIndex);
        paths.push(`M ${rightX} ${y} H ${midX} V ${ty} H ${leftX}`);
      }
    }
    return paths;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, height]);

  if (!columns.length) return null;

  return (
    <div>
      <div className="mb-2 flex" style={{ gap: COLUMN_GAP }}>
        {columns.map(({ round }) => (
          <div key={`title-${round}`} className="text-sm font-medium text-slate-400" style={{ width: COLUMN_WIDTH }}>
            {round}
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <div className="relative" style={{ width, height }}>
          <svg className="pointer-events-none absolute inset-0" width={width} height={height} aria-hidden="true">
            {connectors.map((d, idx) => (
              <path key={idx} d={d} fill="none" stroke="rgb(71 85 105)" strokeWidth={1.5} />
            ))}
          </svg>
          <div className="relative flex" style={{ gap: COLUMN_GAP }}>
            {columns.map(({ round, matches }) => (
              <div key={round} className="flex flex-col justify-around" style={{ width: COLUMN_WIDTH, height }}>
                {matches.map((m) => (
                  <CompactMatchCard
                    key={m.id}
                    m={m}
                    onSelectWinner={onSelectWinner}
                    onOpenPrematch={onOpenPrematch}
                    onOpenPlayerStats={onOpenPlayerStats}
                    disableSelection={Boolean(savingMatchId) && savingMatchId !== m.id}
                    isSaving={savingMatchId === m.id}
                    acesDeltaByPlayerId={acesDeltaByPlayerId}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
