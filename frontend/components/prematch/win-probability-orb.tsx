"use client";

import React, { useMemo } from "react";

export function normalizeProbabilityValue(
  probability: number | null | undefined,
): number | null {
  if (probability === null || probability === undefined || Number.isNaN(probability)) {
    return null;
  }

  const finite = Number(probability);
  if (!Number.isFinite(finite)) return null;

  const ratio = finite > 1 ? finite / 100 : finite;
  if (Number.isNaN(ratio)) return null;

  if (ratio < 0) return 0;
  if (ratio > 1) return 1;

  return ratio;
}

export type WinProbabilityBarProps = {
  playerAName: string;
  playerBName: string;
  probabilityA: number | null | undefined;
};

export function WinProbabilityBar({ playerAName, playerBName, probabilityA }: WinProbabilityBarProps) {
  const { pctA, pctB, hasValue } = useMemo(() => {
    const normalized = normalizeProbabilityValue(probabilityA);
    if (normalized === null) {
      return { pctA: 50, pctB: 50, hasValue: false } as const;
    }
    const a = Math.round(normalized * 100);
    return { pctA: a, pctB: 100 - a, hasValue: true } as const;
  }, [probabilityA]);

  return (
    <div
      className="flex h-12 w-full overflow-hidden rounded-xl border border-white/10"
      role="img"
      aria-label={`${playerAName}: ${hasValue ? `${pctA}%` : "sin datos"}, ${playerBName}: ${hasValue ? `${pctB}%` : "sin datos"}`}
    >
      <div
        className="flex items-center justify-center bg-sky-600 text-sm font-bold text-white transition-all duration-500"
        style={{ width: `${pctA}%` }}
      >
        {hasValue ? `${pctA}%` : "—"}
      </div>
      <div
        className="flex items-center justify-center bg-rose-600 text-sm font-bold text-white transition-all duration-500"
        style={{ width: `${pctB}%` }}
      >
        {hasValue ? `${pctB}%` : "—"}
      </div>
    </div>
  );
}

export function getWinProbabilitySummary(probability: number | null | undefined) {
  const normalized = normalizeProbabilityValue(probability);
  if (normalized === null) {
    return {
      percent: null,
      percentOpponent: null,
    } as const;
  }
  const percent = Math.round(normalized * 100);
  return {
    percent,
    percentOpponent: 100 - percent,
  } as const;
}

