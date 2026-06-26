"use client";

import React, { useMemo, useState } from "react";
import type { Match, Player } from "@/lib/bracket-types";
import { Button } from "@/components/ui/button";
import { BracketTree } from "./BracketTree";

const MATCHES_PER_ROUND: Record<Match["round"], number> = {
  R128: 64,
  R64: 32,
  R32: 16,
  R16: 8,
  QF: 4,
  SF: 2,
  F: 1,
};

const QUARTER_ROUNDS: Match["round"][] = ["R128", "R64", "R32", "R16", "QF"];
const FINALS_ROUNDS: Match["round"][] = ["QF", "SF", "F"];
const SINGLE_PAGE_THRESHOLD = 5;

const getMatchIndex = (id: string): number => {
  const parsed = Number.parseInt(id.split("-")[1] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

function quarterOf(round: Match["round"], index: number): 0 | 1 | 2 | 3 | null {
  const total = MATCHES_PER_ROUND[round];
  if (!total || total < 4) return null;
  const perQuarter = total / 4;
  return Math.floor((index - 1) / perQuarter) as 0 | 1 | 2 | 3;
}

export type QuarterTabsProps = {
  rounds: Match["round"][];
  matchesByRound: Partial<Record<Match["round"], Match[]>>;
  onSelectWinner?: (m: Match, winner: "top" | "bottom") => void;
  onOpenPrematch?: (m: Match) => void;
  onOpenPlayerStats?: (m: Match, player: Player) => void;
  savingMatchId?: string | null;
};

type TabKey = "Q1" | "Q2" | "Q3" | "Q4" | "Finales";

const TABS: { key: TabKey; label: string }[] = [
  { key: "Q1", label: "Cuarto 1" },
  { key: "Q2", label: "Cuarto 2" },
  { key: "Q3", label: "Cuarto 3" },
  { key: "Q4", label: "Cuarto 4" },
  { key: "Finales", label: "Finales" },
];

const QUARTER_INDEX: Record<string, number> = { Q1: 0, Q2: 1, Q3: 2, Q4: 3 };

export function QuarterTabs({ rounds, matchesByRound, ...handlers }: QuarterTabsProps) {
  const needsPagination = rounds.length > SINGLE_PAGE_THRESHOLD;
  const [activeTab, setActiveTab] = useState<TabKey>("Q1");

  const quarterRounds = useMemo(() => QUARTER_ROUNDS.filter((r) => rounds.includes(r)), [rounds]);
  const finalsRounds = useMemo(() => FINALS_ROUNDS.filter((r) => rounds.includes(r)), [rounds]);

  const finalsMatches = useMemo(() => {
    const result: Partial<Record<Match["round"], Match[]>> = {};
    for (const round of finalsRounds) {
      result[round] = matchesByRound[round] ?? [];
    }
    return result;
  }, [matchesByRound, finalsRounds]);

  const activeQuarterMatches = useMemo(() => {
    if (activeTab === "Finales") return finalsMatches;
    const quarterIndex = QUARTER_INDEX[activeTab];
    const result: Partial<Record<Match["round"], Match[]>> = {};
    for (const round of quarterRounds) {
      result[round] = (matchesByRound[round] ?? []).filter(
        (m) => quarterOf(round, getMatchIndex(m.id)) === quarterIndex,
      );
    }
    return result;
  }, [activeTab, finalsMatches, matchesByRound, quarterRounds]);

  if (!needsPagination) {
    return <BracketTree rounds={rounds} matchesByRound={matchesByRound} {...handlers} />;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Button
            key={tab.key}
            type="button"
            variant={activeTab === tab.key ? "default" : "outline"}
            size="sm"
            className="rounded-full"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>
      <BracketTree
        rounds={activeTab === "Finales" ? finalsRounds : quarterRounds}
        matchesByRound={activeQuarterMatches}
        {...handlers}
      />
    </div>
  );
}
