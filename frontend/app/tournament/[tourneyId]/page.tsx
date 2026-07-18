"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, ChevronRight, ArrowLeft, Flame, Star, Check, Loader2, BarChart3, Trophy, Medal, SlidersHorizontal, Maximize2, X, TrendingUp, House, Repeat, History } from "lucide-react";
import {
  WinProbabilityBar,
  normalizeProbabilityValue,
} from "@/components/prematch/win-probability-orb";
import { QuarterTabs } from "@/components/bracket/QuarterTabs";

const ADMIN_API_HEADERS: Record<string, string> = process.env.NEXT_PUBLIC_ADMIN_API_SECRET
  ? { "x-admin-key": process.env.NEXT_PUBLIC_ADMIN_API_SECRET }
  : {};

import type { Player, Match, Bracket } from "@/lib/bracket-types";

const byRound = (matches: Match[], round: Match["round"]) =>
  matches.filter((m) => m.round === round);

const shortenName = (fullName: string | null | undefined): string => {
  if (!fullName) return "TBD";
  const clean = fullName.trim();
  if (!clean) return "TBD";
  const parts = clean.split(/\s+/);
  return parts.length ? parts[parts.length - 1] : clean;
};

function MatchCard({
  m,
  onClick,
  onSelectWinner,
  disableSelection,
  isSaving,
  onOpenPlayerStats,
}: {
  m: Match;
  onClick?: (m: Match) => void;
  onSelectWinner?: (m: Match, winner: "top" | "bottom") => void;
  disableSelection?: boolean;
  isSaving?: boolean;
  onOpenPlayerStats?: (m: Match, player: Player) => void;
}) {
  const isTopWinner = m.winnerId === m.top.id;
  const isBottomWinner = m.winnerId === m.bottom.id;
  const selectionLocked = Boolean(disableSelection) || Boolean(isSaving);
  const isValidPlayer = (value: unknown) => {
    if (value === null || value === undefined) return false;
    const text = typeof value === "string" ? value : String(value);
    const normalized = text.trim().toUpperCase();
    if (!normalized) return false;
    return normalized !== "TBD" && normalized !== "BYE";
  };
  const topSelectable = isValidPlayer(m.top?.id);
  const bottomSelectable = isValidPlayer(m.bottom?.id);

  const handleSelect = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    slot: "top" | "bottom",
  ) => {
    event.stopPropagation();
    if (selectionLocked) return;
    onSelectWinner?.(m, slot);
  };

  const renderRow = (
    player: Player,
    slot: "top" | "bottom",
    isWinner: boolean,
    selectable: boolean,
  ) => {
    const statsAvailable = selectable && typeof onOpenPlayerStats === "function";
    const onStatsClick = (
      event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    ) => {
      event.stopPropagation();
      if (!statsAvailable) return;
      onOpenPlayerStats?.(m, player);
    };

    const buttonClasses = [
      "inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs transition",
      isWinner ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-700 text-slate-400 hover:bg-slate-800",
      selectable && !selectionLocked ? "cursor-pointer" : "cursor-not-allowed opacity-40",
    ].join(" ");

    return (
      <div
        className={`flex items-center justify-between gap-3 text-sm ${isWinner ? "font-semibold text-emerald-400" : "text-slate-100"}`}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={isWinner}
            aria-label={`Marcar ganador: ${player.name}`}
            className={buttonClasses}
            disabled={!selectable || selectionLocked}
            onClick={(event) => handleSelect(event, slot)}
          >
            {isWinner ? <Check className="h-3 w-3" /> : null}
          </button>
          <span className="truncate">
            {player.name}
            {player.seed ? ` (${player.seed})` : ""}
          </span>
          {statsAvailable && (
            <button
              type="button"
              aria-label={`Ver estadísticas de ${player.name}`}
              className="text-slate-500 transition hover:text-slate-200 focus-visible:outline-none"
              onClick={onStatsClick}
            >
              <BarChart3 className="h-4 w-4" />
            </button>
          )}
        </div>
        {isWinner && !isSaving && (
          <span className="text-xs font-medium text-emerald-400">Ganador</span>
        )}
        {isSaving && isWinner && (
          <Loader2 className="h-4 w-4 animate-spin text-emerald-300" />
        )}
      </div>
    );
  };

  return (
    <Card
      className={`rounded-2xl shadow-sm transition ${onClick ? "cursor-pointer hover:shadow" : ""}`}
      onClick={() => onClick?.(m)}
    >
      <CardContent className="space-y-3 p-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{m.round}</span>
          {isSaving && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Guardando...
            </span>
          )}
        </div>
        {renderRow(m.top, "top", isTopWinner, topSelectable)}
        {renderRow(m.bottom, "bottom", isBottomWinner, bottomSelectable)}
      </CardContent>
    </Card>
  );
}

function Column({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <div className="w-64 min-w-64">
      <div className="text-sm font-medium text-slate-400 mb-2 px-1">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

type PlayerPrematchStats = {
  win_pct_year: number | null;
  win_pct_surface: number | null;
  win_pct_month: number | null;
  win_pct_vs_top10: number | null;
  win_pct_fifth_set: number | null;
  court_speed_score: number | null;
  court_speed_edge?: number | null;
  win_score: number | null;
  win_probability: number | null;
  ranking: number | null;
  home_advantage: boolean | null;
  surface_change: boolean | null;
  days_since_last: number | null;
  defends_round?: string | null;
  ranking_score?: number | null;
  h2h_score?: number | null;
  rest_score?: number | null;
  motivation_score?: number | null;
  alerts?: string[];
  last_results?: string[];
  points_current?: number | null;
  points_previous?: number | null;
  points_delta?: number | null;
  next_tournament?: {
    name: string | null;
    level: string | null;
    country: string | null;
    last_year_round: string | null;
    is_category_upgrade: boolean;
    is_home: boolean;
  } | null;
  tournament_history?: {
    times_played: number | null;
    titles: number | null;
    finals_reached: number | null;
    semis_reached: number | null;
    label: string | null;
  } | null;
};

type OddsPlayerSummary = {
  price: number | null;
  implied_probability: number | null;
  value_diff: number | null;
  is_value: boolean;
};

type MatchOddsSummary = {
  sport_key: string;
  bookmaker: string;
  last_update: string | null;
  playerA: OddsPlayerSummary | null;
  playerB: OddsPlayerSummary | null;
  value_pick?: "playerA" | "playerB";
  value_message?: string;
};

type TournamentSummary = {
  name: string | null;
  surface: string | null;
  bucket: string | null;
  month: number | null;
};

type PrematchSummary = {
  prob_player: number | null;
  playerA: PlayerPrematchStats;
  playerB: PlayerPrematchStats;
  h2h: {
    total: number;
    wins: number;
    losses: number;
    last_meeting: string | null;
  };
  last_surface: string | null;
  defends_round: string | null;
  defends_round_opponent: string | null;
  court_speed: number | null;
  court_speed_rank?: number | null;
  court_speed_min?: number | null;
  court_speed_max?: number | null;
  surface?: string | null;
  surface_reported?: string | null;
  extras?: {
    country_p?: string | null;
    country_o?: string | null;
    display_p?: string | null;
    display_o?: string | null;
  };
  tournament?: TournamentSummary;
  odds?: MatchOddsSummary;
};

type PrematchSummaryResponse = {
  playerA: PlayerPrematchStats;
  playerB: PlayerPrematchStats;
  prob_player?: number | null;
  [key: string]: unknown;
};

const normalizePrematchSummary = (raw: unknown): PrematchSummary => {
  const asRecord = (value: unknown): Record<string, unknown> | null => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return null;
  };

  const data = asRecord(raw);
  const playerA = asRecord(data?.playerA) ?? null;
  const playerB = asRecord(data?.playerB) ?? null;
  type RawH2h = {
    wins?: unknown;
    losses?: unknown;
    last_meeting?: unknown;
  };

  const h2h = (asRecord(data?.h2h) as RawH2h | null) ?? ({} as RawH2h);
  const meta = (asRecord(data?.meta) ?? data ?? {}) as Record<string, unknown>;

  const asNumber = (value: unknown): number | null => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string" && value.trim() !== "") {
      const match = value.trim().match(/-?\d+(?:[.,]\d+)?/);
      if (!match) return null;
      const normalized = match[0].includes(",") && !match[0].includes(".")
        ? match[0].replace(",", ".")
        : match[0].replace(/,/g, "");
      const parsed = Number.parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const asStringLocal = (value: unknown): string | null => {
    if (typeof value === "string" && value.trim() !== "") return value;
    if (value == null) return null;
    if (typeof value === "number" && Number.isFinite(value)) return `${value}`;
    return null;
  };

  const asStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (typeof item === "string") {
            const clean = item.trim();
            return clean.length > 0 ? clean : null;
          }
          return null;
        })
        .filter((item): item is string => item !== null);
    }
    if (typeof value === "string" && value.trim() !== "") {
      return [value.trim()];
    }
    return [];
  };

  const buildPlayer = (p: Record<string, unknown> | null | undefined): PlayerPrematchStats => ({
    win_pct_year: asNumber(p?.win_pct_year),
    win_pct_surface: asNumber(p?.win_pct_surface),
    win_pct_month: asNumber(p?.win_pct_month),
    win_pct_vs_top10: asNumber(p?.win_pct_vs_top10),
    win_pct_fifth_set: asNumber(
      (p as any)?.win_pct_fifth_set ??
        (p as any)?.win_pct_5th_set ??
        (p as any)?.fifth_set_win_pct ??
        (p as any)?.win_pct_deciding_set ??
        (p as any)?.deciding_set_win_pct ??
        (p as any)?.win_pct_best_of_5 ??
        (p as any)?.win_pct_bo5,
    ),
    court_speed_score: asNumber(p?.court_speed_score),
    court_speed_edge: asNumber(p?.court_speed_edge),
    win_score: asNumber(p?.win_score),
    win_probability: asNumber(p?.win_probability),
    ranking: asNumber(p?.ranking),
    home_advantage:
      typeof p?.home_advantage === "boolean"
        ? p.home_advantage
        : typeof p?.home_advantage === "string"
        ? p.home_advantage.toLowerCase() === "true"
        : null,
    surface_change:
      typeof p?.surface_change === "boolean"
        ? p.surface_change
        : typeof p?.surface_change === "string"
        ? p.surface_change.toLowerCase() === "true"
        : null,
    days_since_last: asNumber(p?.days_since_last),
    defends_round:
      typeof p?.defends_round === "string" && p.defends_round.trim() !== ""
        ? p.defends_round
        : typeof p?.last_year_round === "string" && p.last_year_round.trim() !== ""
        ? p.last_year_round
        : undefined,
    ranking_score: asNumber(p?.ranking_score),
    h2h_score: asNumber(p?.h2h_score),
    rest_score: asNumber(p?.rest_score),
    motivation_score: asNumber(p?.motivation_score),
    points_current: asNumber(p?.points_current),
    points_previous: asNumber(p?.points_previous),
    points_delta: asNumber(p?.points_delta),
    alerts: (() => {
      const arr = asStringArray(p?.alerts);
      return arr.length ? arr : undefined;
    })(),
    last_results: (() => {
      const arr = asStringArray(p?.last_results);
      if (!arr.length) return undefined;
      const normalized = arr
        .map((item) => item.trim().toUpperCase())
        .map((item) => {
          if (item.startsWith("W")) return "W";
          if (item.startsWith("L")) return "L";
          return item;
        })
        .slice(0, 5);
      return normalized.length ? normalized : undefined;
    })(),
    next_tournament: (() => {
      const nt = asRecord(p?.next_tournament);
      if (!nt) return undefined;
      const isCategoryUpgrade =
        typeof nt.is_category_upgrade === "boolean" ? nt.is_category_upgrade : false;
      const isHome = typeof nt.is_home === "boolean" ? nt.is_home : false;
      const lastYearRound = asStringLocal(nt.last_year_round);
      if (!isCategoryUpgrade && !isHome && !lastYearRound) return undefined;
      return {
        name: asStringLocal(nt.name),
        level: asStringLocal(nt.level),
        country: asStringLocal(nt.country),
        last_year_round: lastYearRound,
        is_category_upgrade: isCategoryUpgrade,
        is_home: isHome,
      };
    })(),
    tournament_history: (() => {
      const th = asRecord(p?.tournament_history);
      if (!th) return undefined;
      const label = asStringLocal(th.label);
      if (!label) return undefined;
      return {
        times_played: asNumber(th.times_played),
        titles: asNumber(th.titles),
        finals_reached: asNumber(th.finals_reached),
        semis_reached: asNumber(th.semis_reached),
        label,
      };
    })(),
  });

  const wins = asNumber(h2h?.wins) ?? 0;
  const losses = asNumber(h2h?.losses) ?? 0;

  const extras = asRecord(data?.extras) ?? null;
  const tournamentRecord = asRecord(data?.tournament) ?? null;
  const tournament: TournamentSummary | undefined = tournamentRecord
    ? {
        name: asStringLocal(tournamentRecord?.name),
        surface: asStringLocal(tournamentRecord?.surface),
        bucket: asStringLocal(tournamentRecord?.bucket),
        month: asNumber(tournamentRecord?.month),
      }
    : undefined;

  const probabilityCandidates: Array<number | null> = [
    asNumber(data?.prob_player),
    asNumber(data?.probability),
    asNumber(playerA?.win_probability),
    asNumber(extras?.ytd_wr_p),
  ];

  let probability: number | null = null;
  for (const candidate of probabilityCandidates) {
    const normalized = normalizeProbabilityValue(candidate);
    if (normalized !== null) {
      probability = normalized;
      break;
    }
  }

  const playerAStats = buildPlayer(playerA);
  const playerBStats = buildPlayer(playerB);

  const metaDefendRound = asStringLocal(meta?.defends_round);
  const metaDefendOpponent = asStringLocal(meta?.defends_round_opponent);

  if (!playerAStats.defends_round && metaDefendRound) {
    playerAStats.defends_round = metaDefendRound;
  }
  if (!playerBStats.defends_round && metaDefendOpponent) {
    playerBStats.defends_round = metaDefendOpponent;
  }

  const normalizeOddsPlayer = (raw: unknown): OddsPlayerSummary | null => {
    const record = asRecord(raw);
    if (!record) return null;
    const price = asNumber(record.price);
    const implied = asNumber(record.implied_probability);
    const diff = asNumber(record.value_diff);
    const isValue = (() => {
      if (typeof record.is_value === "boolean") return record.is_value;
      if (typeof record.is_value === "string") {
        const lowered = record.is_value.toLowerCase();
        return lowered === "true" || lowered === "1";
      }
      if (typeof record.is_value === "number") return record.is_value !== 0;
      return false;
    })();
    return {
      price,
      implied_probability: implied,
      value_diff: diff,
      is_value: isValue,
    };
  };

  const oddsRecord = asRecord(data?.odds) ?? null;
  const odds: MatchOddsSummary | undefined = oddsRecord
    ? {
        sport_key: asStringLocal(oddsRecord?.sport_key) ?? "tennis_atp",
        bookmaker: asStringLocal(oddsRecord?.bookmaker) ?? "bookmaker",
        last_update: asStringLocal(oddsRecord?.last_update),
        playerA: normalizeOddsPlayer(oddsRecord?.playerA),
        playerB: normalizeOddsPlayer(oddsRecord?.playerB),
        value_pick:
          oddsRecord?.value_pick === "playerA" || oddsRecord?.value_pick === "playerB"
            ? oddsRecord.value_pick
            : undefined,
        value_message: asStringLocal(oddsRecord?.value_message) ?? undefined,
      }
    : undefined;

  return {
    prob_player: probability,
    playerA: playerAStats,
    playerB: playerBStats,
    h2h: {
      wins,
      losses,
      total: wins + losses,
      last_meeting: typeof h2h?.last_meeting === "string" ? h2h.last_meeting : null,
    },
    last_surface: typeof meta?.last_surface === "string" ? meta.last_surface : null,
    defends_round: metaDefendRound,
    defends_round_opponent: metaDefendOpponent,
    court_speed: asNumber(meta?.court_speed),
    court_speed_rank:
      asNumber(data?.court_speed_rank) ??
      asNumber((meta as any)?.court_speed_rank) ??
      asNumber(data?.court_speed),
    court_speed_min: asNumber(data?.court_speed_min),
    court_speed_max: asNumber(data?.court_speed_max),
    surface: asStringLocal(data?.surface),
    surface_reported:
      asStringLocal(data?.surface_reported) ??
      asStringLocal((meta as any)?.surface_reported) ??
      asStringLocal((meta as any)?.surface_reported_name),
    extras: {
      country_p: typeof (extras as any)?.country_p === "string" ? String((extras as any).country_p) : null,
      country_o: typeof (extras as any)?.country_o === "string" ? String((extras as any).country_o) : null,
      display_p: typeof (extras as any)?.display_p === "string" ? String((extras as any).display_p) : null,
      display_o: typeof (extras as any)?.display_o === "string" ? String((extras as any).display_o) : null,
    },
    tournament,
    odds,
  };
};

type PlayerStatsMetrics = {
  aces_best_of_3: number | null;
  aces_same_surface: number | null;
  aces_previous_tournament: number | null;
  double_faults_best_of_3: number | null;
  double_faults_same_surface: number | null;
  double_faults_previous_tournament: number | null;
  aces_previous_minus_best_of_3: number | null;
  double_faults_previous_minus_best_of_3: number | null;
  opponent_aces_best_of_3_same_surface: number | null;
  opponent_double_faults_best_of_3_same_surface: number | null;
};

type PlayerStatsSamples = {
  aces_best_of_3: number;
  aces_same_surface: number;
  aces_previous_tournament: number;
  double_faults_best_of_3: number;
  double_faults_same_surface: number;
  double_faults_previous_tournament: number;
  opponent_aces_best_of_3_same_surface: number;
  opponent_double_faults_best_of_3_same_surface: number;
};

type PlayerStatsResponse = {
  player_id: string;
  filters: {
    surface: string | null;
    tourney_id: string | null;
    previous_tourney_id: string | null;
  };
  stats: PlayerStatsMetrics;
  samples: PlayerStatsSamples;
};

type TournamentHighs = {
  tourney_id: string | null;
  previous_tourney_id: string | null;
  aces_player_id: string | null;
  aces_player_name: string | null;
  aces_value: number | null;
  double_faults_player_id: string | null;
  double_faults_player_name: string | null;
  double_faults_value: number | null;
  received_aces_player_id: string | null;
  received_aces_player_name: string | null;
  received_aces_value: number | null;
  received_double_faults_player_id: string | null;
  received_double_faults_player_name: string | null;
  received_double_faults_value: number | null;
};

type MetricConfig = {
  key: string;
  label: string;
  defaultValue: number;
};

const WEIGHT_METRICS: MetricConfig[] = [
  { key: "win_pct_year", label: "Win % año (best of 3)", defaultValue: 0.15 },
  { key: "win_pct_surface", label: "Win % en superficie actual", defaultValue: 0.15 },
  { key: "win_pct_month", label: "Win % último mes", defaultValue: 0.1 },
  { key: "win_pct_vs_top10", label: "Win % vs top 10", defaultValue: 0.1 },
  { key: "court_speed_score", label: "Adaptación velocidad pista", defaultValue: 0 },
  { key: "rest_score", label: "Descanso relativo", defaultValue: 0.05 },
  { key: "ranking_score", label: "Ranking score", defaultValue: 0.3 },
  { key: "h2h_score", label: "Head-to-head score", defaultValue: 0.1 },
  { key: "motivation_score", label: "Motivación", defaultValue: 0.05 },
];

const WEIGHTS_DEFAULTS: Record<string, number> = WEIGHT_METRICS.reduce(
  (acc, item) => {
    acc[item.key] = item.defaultValue;
    return acc;
  },
  {} as Record<string, number>,
);

const METRIC_EXTRACTORS: Record<
  string,
  (player: PlayerPrematchStats | null | undefined) => number | null
> = {
  win_pct_year: (player) => player?.win_pct_year ?? null,
  win_pct_surface: (player) => player?.win_pct_surface ?? null,
  win_pct_month: (player) => player?.win_pct_month ?? null,
  win_pct_vs_top10: (player) => player?.win_pct_vs_top10 ?? null,
  court_speed_score: (player) => player?.court_speed_score ?? null,
  rest_score: (player) => player?.rest_score ?? null,
  ranking_score: (player) => player?.ranking_score ?? null,
  h2h_score: (player) => player?.h2h_score ?? null,
  motivation_score: (player) => player?.motivation_score ?? null,
};

function formatPct(value: number | null) {
  if (value == null) return "N/A";
  const ratio = Math.abs(value) <= 1 ? value * 100 : value;
  return `${ratio.toFixed(1)}%`;
}

function formatFloat(value: number | null, decimals = 1) {
  if (value == null) return "N/A";
  return `${Number(value).toFixed(decimals)}`;
}

function formatRank(value: number | null) {
  if (value == null) return "N/A";
  return `#${value}`;
}

function formatBool(value: boolean | null) {
  if (value == null) return "N/A";
  return value ? "Si" : "No";
}

function formatScorePercent(value: number | null) {
  if (value == null || Number.isNaN(value)) return "N/A";
  const clamped = Math.max(0, Math.min(1, value));
  return `${(clamped * 100).toFixed(0)}%`;
}

const formatDefendsRoundLabel = (value?: string | null) => {
  if (!value) return null;
  const clean = value.trim();
  if (!clean) return null;
  const normalized = clean.normalize("NFD").replace(/[̀-ͯ]/g, "");
  switch (normalized.toUpperCase()) {
    case "W":
    case "CAMPEON":
      return "Campeon";
    case "F":
    case "FINALISTA":
      return "Finalista";
    case "SF":
    case "SEMIFINALISTA":
      return "Semifinalista";
    case "QF":
      return "Cuartos de final";
    case "R16":
      return "Octavos de final";
    case "R32":
      return "32avos de final";
    case "R64":
      return "64avos de final";
    case "R128":
      return "128avos de final";
    default:
      return clean;
  }
};

const renderDefendChip = (value?: string | null) => {
  const label = formatDefendsRoundLabel(value);
  if (!label) return null;
  const normalized = label.normalize('NFD').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (normalized === 'CAMPEON') {
    return (
      <span
        key="defend"
        title="Defiende título"
        aria-label="Defiende título"
        className="inline-flex h-7 w-7 items-center justify-center text-amber-400"
      >
        <Trophy className="h-5 w-5" />
      </span>
    );
  }
  if (normalized === "FINALISTA") {
    return (
      <span
        key="defend"
        title="Defiende final"
        aria-label="Defiende final"
        className="inline-flex h-6 w-6 items-center justify-center text-slate-300"
      >
        <Medal className="h-4 w-4" />
      </span>
    );
  }
  if (normalized === "SEMIFINALISTA") {
    return (
      <span
        key="defend"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-700/30 text-[11px] font-semibold text-amber-200"
        title="Defiende semifinal"
      >
        SF
      </span>
    );
  }
  return (
    <span
      key="defend"
      className="inline-flex h-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-2 text-[11px] text-slate-200"
    >
      {label}
    </span>
  );
};

const describeCourtSpeed = (rank?: number | null) => {
  if (rank == null || Number.isNaN(rank)) return null;
  if (rank <= 15) return "Super fast";
  if (rank <= 30) return "Fast";
  if (rank <= 45) return "Medium";
  return "Slow";
};

type CourtSpeedTier = {
  stars: number;
  label: string;
  colorClass: string;
  percent: number;
};

const getCourtSpeedTier = (score?: number | null): CourtSpeedTier | null => {
  if (score == null || Number.isNaN(score)) return null;
  const rawPercent = score * 100;
  const percent = Math.round(Math.min(Math.max(rawPercent, 0), 100));
  if (rawPercent >= 80) {
    return { stars: 5, label: "Oro", colorClass: "text-amber-400", percent };
  }
  if (rawPercent >= 70) {
    return { stars: 4, label: "Plata", colorClass: "text-slate-200", percent };
  }
  if (rawPercent >= 60) {
    return { stars: 3, label: "Bronce", colorClass: "text-amber-600", percent };
  }
  if (rawPercent >= 50) {
    return { stars: 2, label: "Media", colorClass: "text-slate-400", percent };
  }
  return { stars: 1, label: "Baja", colorClass: "text-slate-500", percent };
};

// Frase interpretativa de la afinidad del jugador con este tipo de pista,
// para acompanar el court speed score ampliado (no solo el numero/estrellas).
const courtSpeedAffinityText = (tier: CourtSpeedTier): string => {
  const base = `Este jugador tiene un ${tier.percent}% de afinidad con este tipo de pista`;
  if (tier.percent >= 70) return `${base}: es uno de los terrenos donde mejor se desenvuelve.`;
  if (tier.percent >= 50) return `${base}: rinde de forma correcta en este terreno.`;
  return `${base}, no es donde mejor se desarrolla.`;
};

const renderCourtSpeedDetail = (
  score?: number | null,
  edge?: number | null,
  align: "left" | "right" = "left",
) => {
  const tier = getCourtSpeedTier(score);
  if (!tier) return <span className="text-slate-500">Sin datos</span>;
  const edgeTitle =
    typeof edge === "number" && Number.isFinite(edge)
      ? edge >= 0
        ? `${Math.round(edge * 100)}% mejor que su media de carrera en pistas de esta velocidad`
        : `${Math.round(Math.abs(edge) * 100)}% peor que su media de carrera en pistas de esta velocidad`
      : undefined;
  const isRight = align === "right";
  return (
    <div className={`flex flex-col gap-1.5 ${isRight ? "items-end text-right" : "items-start text-left"}`}>
      <div className={`flex items-center gap-1 ${isRight ? "flex-row-reverse" : ""}`} title={edgeTitle}>
        {Array.from({ length: 5 }).map((_, idx) => {
          const active = idx < tier.stars;
          return (
            <Star
              key={`court-speed-star-${idx}`}
              className={`h-6 w-6 ${active ? `${tier.colorClass}` : "text-slate-700"}`}
              fill={active ? "currentColor" : "none"}
              stroke="currentColor"
            />
          );
        })}
      </div>
      <div className="text-base font-semibold text-slate-100">
        {tier.percent}% <span className="text-sm font-normal text-slate-400">{tier.label}</span>
      </div>
      <p className="max-w-[220px] text-xs leading-snug text-slate-400">{courtSpeedAffinityText(tier)}</p>
    </div>
  );
};

// Colores extremo-a-extremo (flojo -> fuerte) segun la superficie, para la
// barra de % de victorias por superficie: arcilla/terracota para clay, verde
// para grass, azul para hard. Mismo criterio de matching que renderSurfaceChip.
const surfaceGradientColors = (surface?: string | null): [string, string] => {
  const lower = (surface ?? "").toLowerCase();
  if (lower.includes("grass")) return ["#e3f4df", "#166534"];
  if (lower.includes("clay") || lower.includes("terra") || lower.includes("arcilla")) {
    return ["#f1dcb8", "#a2571f"];
  }
  if (lower.includes("hard")) return ["#dbeafe", "#1d4ed8"];
  return ["#e2e8f0", "#475569"];
};

// La barra representa 0-100%: el color visible va del extremo "flojo" al
// extremo "fuerte" del degradado segun cuanto avance el relleno, no un color
// fijo. Por eso el degradado ocupa siempre el 100% del track y solo se tapa
// (con un panel del color de fondo) la parte que supera el % del jugador.
function SurfaceWinBar({ value, surface }: { value: number | null; surface?: string | null }) {
  const pct = normalizeRatio01(value) * 100;
  const [from, to] = surfaceGradientColors(surface);
  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-full border border-slate-800 bg-slate-900">
      <div
        className="absolute inset-y-0 left-0 w-full"
        style={{ background: `linear-gradient(90deg, ${from} 0%, ${to} 100%)` }}
      />
      <div className="absolute inset-y-0 right-0 bg-slate-900" style={{ width: `${100 - pct}%` }} />
    </div>
  );
}

// Posicion del torneo en el espectro de velocidad de pista de todos los
// torneos (rank bajo = pista rapida, ver describeCourtSpeed). Izquierda =
// mas lento, derecha = mas rapido.
function CourtSpeedPositionBar({
  rank,
  min,
  max,
}: {
  rank?: number | null;
  min?: number | null;
  max?: number | null;
}) {
  if (rank == null || min == null || max == null || !Number.isFinite(rank) || max <= min) {
    return null;
  }
  const clampedRank = Math.min(Math.max(rank, min), max);
  const position = ((max - clampedRank) / (max - min)) * 100;
  return (
    <div
      className="relative h-2.5 w-full overflow-hidden rounded-full border border-slate-800"
      style={{ background: "linear-gradient(90deg, #60a5fa 0%, #334155 50%, #f87171 100%)" }}
    >
      <div
        className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-100 shadow"
        style={{ left: `${position}%` }}
      />
    </div>
  );
}

const RECENT_FORM_LIMIT = 5;

const renderRecentForm = (
  results?: string[] | null,
  align: "left" | "right" | "center" = "center",
) => {
  const normalized = Array.from({ length: RECENT_FORM_LIMIT }, (_, idx) => {
    const raw = results?.[idx] ?? null;
    if (!raw) return null;
    const upper = raw.trim().toUpperCase();
    if (upper.startsWith("W")) return "W";
    if (upper.startsWith("L")) return "L";
    return upper;
  });

  const ariaLabel = normalized
    .map((outcome, idx) => {
      const position = idx === 0 ? "más reciente" : `#${idx + 1}`;
      if (outcome === "W") return `Victoria (${position})`;
      if (outcome === "L") return `Derrota (${position})`;
      return `Sin dato (${position})`;
    })
    .join(", ");

  const justifyClass =
    align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";

  return (
    <div
      className={`mt-1 flex ${justifyClass} gap-1`}
      role="img"
      aria-label={`Ultimos ${RECENT_FORM_LIMIT} partidos: ${ariaLabel}`}
    >
      {normalized.map((outcome, idx) => {
        const isWin = outcome === "W";
        const isLoss = outcome === "L";
        const colorClass = isWin
          ? "bg-emerald-500/20 text-emerald-400"
          : isLoss
          ? "bg-rose-500/20 text-rose-400"
          : "bg-slate-800 text-slate-600";
        const opacityClass = outcome ? "" : "opacity-40";
        const highlightClass = idx === 0 ? "ring-2 ring-offset-1 ring-white/40 ring-offset-slate-950" : "";
        const titleText =
          outcome === "W"
            ? idx === 0
              ? "Ultimo partido: victoria"
              : "Victoria"
            : outcome === "L"
            ? idx === 0
              ? "Ultimo partido: derrota"
              : "Derrota"
            : idx === 0
            ? "Ultimo partido: sin registro"
            : "Sin registro";
        return (
          <span
            key={`recent-form-${idx}`}
            className={`flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-bold ${colorClass} ${opacityClass} ${highlightClass}`}
            title={titleText}
            aria-hidden="true"
          >
            {isWin ? "W" : isLoss ? "L" : "-"}
          </span>
        );
      })}
    </div>
  );
};

const formatPointsValue = (value: number) =>
  new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(Math.round(value));

const renderPointsDelta = (stats?: {
  points_delta?: number | null;
  points_current?: number | null;
  points_previous?: number | null;
}) => {
  if (!stats) return null;
  const delta = stats.points_delta ?? null;
  const current = stats.points_current ?? null;
  const previous = stats.points_previous ?? null;

  if (delta == null && current == null && previous == null) {
    return (
      <div className="text-sm font-semibold text-slate-500" aria-hidden="true">
        —
      </div>
    );
  }

  let mainValue: string | null = null;
  let accentValue: string | null = null;
  let accentClass = "text-slate-400";

  if (delta != null) {
    const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
    accentValue = `${sign}${formatPointsValue(Math.abs(delta))} pts`;
    if (delta > 0) accentClass = "text-emerald-400";
    else if (delta < 0) accentClass = "text-rose-400";
  }

  if (current != null) {
    mainValue = `${formatPointsValue(current)} pts`;
  } else if (previous != null) {
    mainValue = `${formatPointsValue(previous)} pts`;
  }

  const titleParts: string[] = [];
  if (current != null) {
    titleParts.push(`Actual: ${formatPointsValue(current)} pts`);
  }
  if (previous != null) {
    titleParts.push(`Hace 1 año: ${formatPointsValue(previous)} pts`);
  }

  return (
    <div
      title={titleParts.length ? titleParts.join(" · ") : undefined}
      aria-label={
        titleParts.length
          ? `Balance de puntos. ${titleParts.join(". ")}.`
          : undefined
      }
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Puntos ATP</div>
      {mainValue ? <span className="text-base font-bold text-slate-100">{mainValue}</span> : null}
      {accentValue ? (
        <span className={`ml-2 inline-flex items-center gap-1 text-sm font-semibold ${accentClass}`}>
          {accentValue}
        </span>
      ) : null}
    </div>
  );
};

const formatOddsPrice = (value: number | null) => {
  if (value == null) return "N/A";
  return Number(value).toFixed(2);
};

const formatValueDiff = (value: number | null) => {
  if (value == null) return null;
  return `${(value * 100).toFixed(1)} pp`;
};

const renderOddsBox = (
  odds: MatchOddsSummary | undefined,
  side: "playerA" | "playerB",
  modelOdds: string,
  modelProbability: number | null,
) => {
  const target = odds ? (side === "playerA" ? odds.playerA : odds.playerB) : undefined;
  const hasMarket = target && target.price != null;
  const valueLabel = target?.is_value ? formatValueDiff(target.value_diff ?? null) : null;
  const modelPct =
    modelProbability != null ? `${Math.round(modelProbability * 100)}%` : null;
  const marketPct =
    target?.implied_probability != null ? `${Math.round(target.implied_probability * 100)}%` : null;
  return (
    <div className="flex w-full flex-col rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Modelo</span>
        <span className="font-semibold text-slate-100">
          {modelOdds}
          {modelPct ? <span className="ml-1.5 text-xs font-normal text-slate-400">({modelPct})</span> : null}
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-sm">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {odds?.bookmaker ?? "Mercado"}
        </span>
        <span className={`font-semibold ${target?.is_value ? "text-emerald-400" : "text-slate-100"}`}>
          {hasMarket ? formatOddsPrice(target!.price) : "N/A"}
          {marketPct ? <span className="ml-1.5 text-xs font-normal text-slate-400">({marketPct})</span> : null}
        </span>
      </div>
      <div
        className={
          valueLabel
            ? "mt-2 rounded-md bg-emerald-500/10 px-2 py-1 text-center text-[11px] font-semibold text-emerald-300"
            : "invisible mt-2 px-2 py-1 text-center text-[11px] font-semibold"
        }
      >
        {valueLabel ? `Valor +${valueLabel}` : "—"}
      </div>
    </div>
  );
};

const RETIRED_ALERT_RE = /se retir[oó] en su [uú]ltimo partido\.?/i;
const DEFENDS_TITLE_ALERT_RE = /^defiende .+ del a[nñ]o anterior\.?$/i;

// El chip de retiro y el icono de "defiende título/final" ya comunican esto
// visualmente; evitamos repetirlo como alerta de texto.
const splitPlayerAlerts = (alerts?: string[] | null) => {
  const list = alerts ?? [];
  const retired = list.some((a) => RETIRED_ALERT_RE.test(a));
  const rest = list.filter((a) => !RETIRED_ALERT_RE.test(a) && !DEFENDS_TITLE_ALERT_RE.test(a));
  return { retired, rest };
};

const renderAlertBadges = (alerts?: string[]) => {
  if (!alerts || alerts.length === 0) return null;
  return (
    <div className="mt-2 flex flex-col gap-1 text-xs">
      {alerts.map((alert, idx) => (
        <div
          key={`${alert}-${idx}`}
          className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-100"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="leading-tight">{alert}</span>
        </div>
      ))}
    </div>
  );
};

const NEXT_TOURNAMENT_LEVEL_LABELS: Record<string, string> = {
  G: "Grand Slam",
  M: "Masters 1000",
  F: "ATP Finals",
  A: "ATP Tour",
  C: "Challenger",
  D: "Copa Davis",
};

const NEXT_TOURNAMENT_ROUND_LABELS: Record<string, string> = {
  W: "campeón",
  F: "finalista",
  SF: "semifinalista",
};

const renderNextTournamentBadge = (nt?: PlayerPrematchStats["next_tournament"]) => {
  if (!nt) return null;
  const reasons: string[] = [];
  if (nt.last_year_round && NEXT_TOURNAMENT_ROUND_LABELS[nt.last_year_round]) {
    reasons.push(`defiende resultado de ${NEXT_TOURNAMENT_ROUND_LABELS[nt.last_year_round]}`);
  }
  if (nt.is_category_upgrade) {
    const levelLabel = nt.level ? NEXT_TOURNAMENT_LEVEL_LABELS[nt.level] ?? nt.level : "categoría superior";
    reasons.push(`sube a ${levelLabel}`);
  }
  if (nt.is_home) {
    reasons.push("juega en casa");
  }
  if (reasons.length === 0) return null;
  const tourneyLabel = nt.name ? ` en ${nt.name}` : "";
  return (
    <div className="mt-2 flex items-start gap-2 rounded-md border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-xs text-sky-100">
      <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="leading-tight">
        Semana que viene{tourneyLabel}: {reasons.join(", ")}.
      </span>
    </div>
  );
};

const renderTournamentHistoryBadge = (th?: PlayerPrematchStats["tournament_history"]) => {
  if (!th || !th.label) return null;
  return (
    <div className="mt-2 flex items-start gap-2 rounded-md border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-xs text-violet-100">
      <History className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="leading-tight">{th.label}</span>
    </div>
  );
};

function normalizeRatio01(value: number | null): number {
  if (value == null || Number.isNaN(value as any)) return 0;
  const v = Math.abs(value as number) <= 1 ? Number(value) : Number(value) / 100;
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

const isBestOfFiveTournament = (
  tournament?: TournamentSummary | null,
  eventName?: string | null,
): boolean => {
  const raw = [tournament?.bucket, tournament?.name, eventName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!raw) return false;
  if (raw.includes("grand slam") || raw.includes("grand_slam") || raw.includes("grand-slam")) {
    return true;
  }
  const known = [
    "australian open",
    "open de australia",
    "abierto de australia",
    "roland garros",
    "french open",
    "open de francia",
    "wimbledon",
    "us open",
    "open de estados unidos",
    "abierto de estados unidos",
  ];
  return known.some((name) => raw.includes(name));
};

// Diferencia (en puntos porcentuales) entre dos métricas comparadas: cuanto mayor
// la brecha, más "caliente" el color, independientemente de quién esté arriba.
function diffBand(diffPp: number): "blue" | "green" | "orange" | "red" {
  const d = Math.abs(diffPp);
  if (d >= 30) return "red";
  if (d >= 15) return "orange";
  if (d >= 5) return "green";
  return "blue";
}

function styleForBand(band: "blue" | "green" | "orange" | "red", intensity01: number) {
  const map: Record<string, { start: [number, number, number]; end: [number, number, number] }> = {
    blue: { start: [96, 165, 250], end: [37, 99, 235] },
    green: { start: [34, 197, 94], end: [22, 163, 74] },
    orange: { start: [245, 158, 11], end: [217, 119, 6] },
    red: { start: [239, 68, 68], end: [220, 38, 38] },
  };
  const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
  const alpha = clamp(0.35 + 0.65 * intensity01, 0.2, 0.95);
  const headAlpha = clamp(0.25 + 0.55 * intensity01, 0.2, 0.95);
  const toRgba = (rgb: [number, number, number], a: number) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
  const sw = map[band];
  const start = toRgba(sw.start, alpha);
  const end = toRgba(sw.end, alpha);
  const head = toRgba(sw.start, headAlpha);
  const border = toRgba(sw.end, 0.6);
  return { start, end, head, border };
}

// Barra única desde el centro: apunta hacia quien va mejor en esta métrica,
// con largo proporcional a la diferencia y color según cuán significativa es.
function DiffBar({ valueA, valueB }: { valueA: number | null; valueB: number | null }) {
  const rA = normalizeRatio01(valueA);
  const rB = normalizeRatio01(valueB);
  const diffPp = (rB - rA) * 100;
  const towardB = diffPp > 0;
  const magnitude = Math.min(46, Math.abs(diffPp));
  const band = diffBand(diffPp);
  const sw = styleForBand(band, magnitude / 50);

  return (
    <div className="relative h-10 overflow-hidden rounded-md border border-slate-800 bg-slate-950/40">
      <div className="absolute left-1/2 top-1/2 h-[2px] w-full -translate-x-1/2 -translate-y-1/2 bg-slate-700/30" />
      {magnitude > 0.5 && (
        <div
          className={
            towardB
              ? "absolute left-1/2 top-1/2 h-[3px] -translate-y-1/2 rounded-r-full"
              : "absolute right-1/2 top-1/2 h-[3px] -translate-y-1/2 rounded-l-full"
          }
          style={{
            width: `${magnitude}%`,
            background: `linear-gradient(90deg, ${sw.start} 0%, ${sw.end} 100%)`,
          }}
        />
      )}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
        style={{ left: towardB ? `calc(50% + ${magnitude}%)` : `calc(50% - ${magnitude}%)` }}
      >
        <div
          className="h-4 w-4 rounded-full"
          style={{
            border: `1px solid ${sw.border}`,
            background: `radial-gradient(circle, ${sw.head} 0%, rgba(15,23,42,0.2) 70%, transparent 100%)`,
          }}
        />
      </div>
    </div>
  );
}

function rankBadge(rank: number | null) {
  if (rank == null || !Number.isFinite(rank)) {
    return { label: "Rank N/A", className: "bg-slate-800 text-slate-300 border border-slate-700" };
  }
  const r = Math.round(rank);
  if (r >= 1 && r <= 5)
    return { label: `#${r} - TOP 5`, className: "bg-yellow-400/20 text-yellow-300 border border-yellow-400/40" };
  if (r <= 10)
    return { label: `#${r} - TOP 10`, className: "bg-slate-300/20 text-slate-200 border border-slate-300/40" };
  if (r <= 20)
    return { label: `#${r} - TOP 20`, className: "bg-amber-600/20 text-amber-400 border border-amber-600/40" };
  if (r <= 50)
    return { label: `#${r} - TOP 50`, className: "bg-orange-700/20 text-orange-400 border border-orange-700/40" };
  return { label: `#${r}`, className: "bg-slate-700/20 text-slate-300 border border-slate-600/40" };
}

const IOC_TO_ISO2: Record<string, string> = {
  ESP: "ES", ARG: "AR", USA: "US", GBR: "GB", UKR: "UA", GER: "DE", FRA: "FR", ITA: "IT",
  SUI: "CH", NED: "NL", BEL: "BE", SWE: "SE", NOR: "NO", DEN: "DK", CRO: "HR", SRB: "RS",
  BIH: "BA", POR: "PT", POL: "PL", CZE: "CZ", SVK: "SK", SLO: "SI", HUN: "HU", AUT: "AT",
  AUS: "AU", NZL: "NZ", CAN: "CA", MEX: "MX", COL: "CO", CHI: "CL", PER: "PE", ECU: "EC",
  URU: "UY", BOL: "BO", VEN: "VE", BRA: "BR", JPN: "JP", KOR: "KR", CHN: "CN", HKG: "HK",
  TPE: "TW", THA: "TH", VIE: "VN", IND: "IN", PAK: "PK", QAT: "QA", UAE: "AE", KAZ: "KZ",
  UZB: "UZ", GEO: "GE", ARM: "AM", TUR: "TR", GRE: "GR", CYP: "CY", ROU: "RO", BUL: "BG",
  LTU: "LT", LAT: "LV", EST: "EE", FIN: "FI", IRL: "IE", SCO: "GB", WAL: "GB",
};

// ISO-3166 alpha-2 (minuscula) para construir la URL de la imagen de bandera.
// Evitamos emoji de bandera: Windows no renderiza los "regional indicator"
// como banderas y se ven como dos letras sueltas.
function isoToIso2(iso?: string | null): string | null {
  if (!iso) return null;
  let code = iso.trim().toUpperCase();
  // Si llega como emoji de bandera (regional indicators), lo convertimos de vuelta a letras.
  if (/^[\u{1F1E6}-\u{1F1FF}]{2}$/u.test(code)) {
    const A = 0x1f1e6;
    const a = "A".charCodeAt(0);
    code = Array.from(code)
      .map((c) => String.fromCodePoint(a + (c.codePointAt(0)! - A)))
      .join("");
  }
  if (code.length === 3) {
    code = IOC_TO_ISO2[code] || code;
  }
  if (code.length !== 2) return null;
  return code.toLowerCase();
}

function CountryFlag({ iso, className }: { iso?: string | null; className?: string }) {
  const code = isoToIso2(iso);
  if (!code) return null;
  return (
    <img
      src={`https://flagcdn.com/24x18/${code}.png`}
      srcSet={`https://flagcdn.com/48x36/${code}.png 2x`}
      width={24}
      height={18}
      alt={code.toUpperCase()}
      className={className ?? "inline-block rounded-sm"}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

function decimalOdds(prob: number | null): string {
  if (prob == null) return "-";
  if (prob <= 0) return "-";
  if (prob >= 1) return "-";
  const d = 1 / prob;
  return d.toFixed(2);
}

function StatRow({
  label,
  playerA,
  playerB,
  alignPlayerA = "left",
  alignPlayerB = "right",
}: {
  label: string;
  playerA: React.ReactNode;
  playerB: React.ReactNode;
  alignPlayerA?: "left" | "right";
  alignPlayerB?: "left" | "right";
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-1.5 text-sm text-slate-200">
      <div className={alignPlayerA === "right" ? "text-right" : "text-left"}>{playerA}</div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 text-center">
        {label}
      </div>
      <div className={alignPlayerB === "left" ? "text-left" : "text-right"}>{playerB}</div>
    </div>
  );
}

function PrematchDialog({
  open,
  onOpenChange,
  match,
  bracket,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  match?: Match | null;
  bracket: Bracket;
}) {
  const [summary, setSummary] = useState<PrematchSummary | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!match) return;
    const playerAId = Number.parseInt(match.top.id, 10);
    const playerBId = Number.parseInt(match.bottom.id, 10);

    if (Number.isNaN(playerAId) || Number.isNaN(playerBId)) {
      setSummary(null);
      setError("Esperando a que se definan ambos jugadores para el prematch.");
      return;
    }
    const fetchPrematch = async () => {
      setLoading(true);
      setError(null);
      setSummary(null);
      try {
        const res = await fetch("/api/prematch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            playerA_id: playerAId,
            playerB_id: playerBId,
            tourney_id: bracket?.tourney_id,
            year: new Date().getFullYear(),
            playerA_name: match?.top?.name ?? null,
            playerB_name: match?.bottom?.name ?? null,
            event_name: bracket?.event ?? null,
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          setError(`Error del servidor: ${res.status} - ${text}`);
        } else {
          const data = await res.json();
          setSummary(normalizePrematchSummary(data));
        }
      } catch (err) {
        console.error("Error de red al obtener prematch", err);
        setError("Error de red al intentar analisis prematch.");
      } finally {
        setLoading(false);
      }
    };
    fetchPrematch();
  }, [match, bracket]);

  const probability = summary?.prob_player ?? null;

  const oddsA = useMemo(() => decimalOdds(probability), [probability]);
  const oddsB = useMemo(() => decimalOdds(probability != null ? 1 - probability : null), [probability]);
  const playerAAlerts = useMemo(() => splitPlayerAlerts(summary?.playerA?.alerts), [summary?.playerA?.alerts]);
  const playerBAlerts = useMemo(() => splitPlayerAlerts(summary?.playerB?.alerts), [summary?.playerB?.alerts]);
  const showFifthSetStat = useMemo(
    () => isBestOfFiveTournament(summary?.tournament ?? null, bracket?.event ?? null),
    [summary?.tournament, bracket?.event],
  );

const highlight = useMemo(() => {
  if (!summary || !match) return null as null | { text: string };
  const a = summary.playerA;
  const b = summary.playerB;
  type C = { key: keyof typeof a; label: string };
  const cands: C[] = [
    { key: "win_pct_month", label: "% victorias en el mes" },
    { key: "win_pct_vs_top10", label: "% victorias vs Top 10" },
  ];
  let best: { label: string; a: number; b: number } | null = null;
  for (const c of cands) {
    const va = (a as any)?.[c.key] as any;
    const vb = (b as any)?.[c.key] as any;
    if (typeof va === "number" && typeof vb === "number") {
      if (best === null || Math.abs(va - vb) > Math.abs(best.a - best.b)) {
        best = { label: c.label, a: va, b: vb };
      }
    }
  }
  if (!best) return null;
  const who = best.a > best.b ? "A" : best.b > best.a ? "B" : null;
  if (!who) return null;
  const left = formatPct(best.a);
  const right = formatPct(best.b);
  if (left === "N/A" || right === "N/A") return null;
  const topName = match.top.name;
  const bottomName = match.bottom.name;
  const text = (
    who === "A"
      ? `${topName} destaca en ${best.label}: ${left} vs ${right}`
      : `${bottomName} destaca en ${best.label}: ${right} vs ${left}`
  );
  return { text };
}, [summary, match]);
  if (!match) return null;
  const { top, bottom } = match;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] min-h-0 overflow-hidden border border-slate-800 bg-slate-950/95 p-0 text-slate-100 flex flex-col">
        <div className="flex max-h-full min-h-0 flex-col">
          <DialogHeader className="sr-only">
            <DialogTitle>
              Prematch: {top.name} vs {bottom.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-6 pt-8 min-h-0">
            <div className="space-y-4 text-sm">
              {loading && <div className="text-slate-400">Cargando analisis...</div>}
              {error && <div className="text-red-400">{error}</div>}

              {summary && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        {(() => {
                          const country = (match?.top?.country as any) ?? (summary?.extras?.country_p ?? null);
                          if (!isoToIso2(country)) return null;
                          const baseFlag = "inline-flex shrink-0 items-center justify-center rounded-sm p-0.5";
                          const flagClasses = summary.playerA.home_advantage
                            ? `${baseFlag} border border-yellow-400/80 bg-yellow-500/10`
                            : `${baseFlag} border border-slate-700/60 bg-slate-900/50`;
                          return (
                            <span className={flagClasses} title={summary.playerA.home_advantage ? "Jugador local" : undefined}>
                              <CountryFlag iso={country} />
                            </span>
                          );
                        })()}
                        <span className="truncate text-lg font-semibold text-slate-100">{top.name}</span>
                        {(() => {
                          const badge = rankBadge(summary?.playerA?.ranking ?? null);
                          return (
                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}>
                              {badge.label}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="flex min-w-0 items-center justify-end gap-2">
                        {(() => {
                          const badge = rankBadge(summary?.playerB?.ranking ?? null);
                          return (
                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}>
                              {badge.label}
                            </span>
                          );
                        })()}
                        <span className="truncate text-lg font-semibold text-slate-100">{bottom.name}</span>
                        {(() => {
                          const country = (match?.bottom?.country as any) ?? (summary?.extras?.country_o ?? null);
                          if (!isoToIso2(country)) return null;
                          const baseFlag = "inline-flex shrink-0 items-center justify-center rounded-sm p-0.5";
                          const flagClasses = summary.playerB.home_advantage
                            ? `${baseFlag} border border-yellow-400/80 bg-yellow-500/10`
                            : `${baseFlag} border border-slate-700/60 bg-slate-900/50`;
                          return (
                            <span className={flagClasses} title={summary.playerB.home_advantage ? "Jugador local" : undefined}>
                              <CountryFlag iso={country} />
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    <WinProbabilityBar playerAName={top.name} playerBName={bottom.name} probabilityA={probability} />

                    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-gradient-to-r from-slate-900/80 via-slate-800/50 to-slate-900/80 px-4 py-2.5">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Head to head</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold text-slate-100">
                          {summary.h2h.wins} - {summary.h2h.losses}
                        </span>
                        <span className="text-xs text-slate-400">
                          ({summary.h2h.total} partido{summary.h2h.total === 1 ? '' : 's'})
                        </span>
                      </div>
                      <div className="text-xs text-slate-300">
                        {summary.h2h.last_meeting ? (
                          <>Último duelo: <span className="font-medium text-slate-100">{summary.h2h.last_meeting}</span></>
                        ) : (
                          <span className="text-slate-500">Sin registro reciente</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                        {renderPointsDelta({
                          points_delta: summary?.playerA?.points_delta ?? null,
                          points_current: summary?.playerA?.points_current ?? null,
                          points_previous: summary?.playerA?.points_previous ?? null,
                        })}
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                        {renderPointsDelta({
                          points_delta: summary?.playerB?.points_delta ?? null,
                          points_current: summary?.playerB?.points_current ?? null,
                          points_previous: summary?.playerB?.points_previous ?? null,
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col items-center gap-2">
                        {renderOddsBox(summary?.odds, "playerA", oddsA, probability)}
                        {renderRecentForm(summary?.playerA?.last_results)}
                        {(() => {
                          const chips: any[] = [];
                          const seed = match?.top?.seed;
                          if (typeof seed === "number" && Number.isFinite(seed)) {
                            chips.push(
                              <span key="seed" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-[11px] text-slate-200">#{seed}</span>,
                            );
                          }
                          const et = match?.top?.entryType?.toUpperCase();
                          if (et === 'Q' || et === 'WC') {
                            chips.push(
                              <span key="et" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-[11px] text-slate-200">{et}</span>,
                            );
                          }
                          const defendChip = renderDefendChip(summary.playerA.defends_round);
                          if (defendChip) {
                            chips.push(defendChip);
                          }
                          if (summary.playerA.home_advantage) {
                            chips.push(
                              <span
                                key="home"
                                title="Juega en su país"
                                aria-label="Juega en su país"
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-yellow-500/60 bg-yellow-500/10 text-yellow-300"
                              >
                                <House className="h-3.5 w-3.5" />
                              </span>,
                            );
                          }
                          if (summary.playerA.surface_change) {
                            chips.push(
                              <span
                                key="surface-change"
                                title="Cambio de superficie respecto a su último torneo"
                                aria-label="Cambio de superficie respecto a su último torneo"
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-sky-500/60 bg-sky-500/10 text-sky-300"
                              >
                                <Repeat className="h-3.5 w-3.5" />
                              </span>,
                            );
                          }
                          if (playerAAlerts.retired) {
                            chips.push(
                              <span
                                key="injury"
                                title="Se retiró en su último partido"
                                aria-label="Se retiró en su último partido"
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-rose-500/60 bg-rose-500/10 text-sm text-rose-300"
                              >
                                ✚
                              </span>,
                            );
                          }
                          if (chips.length === 0) return null;
                          return <div className="flex items-center gap-2">{chips}</div>;
                        })()}
                        {renderAlertBadges(playerAAlerts.rest)}
                        {renderNextTournamentBadge(summary?.playerA?.next_tournament)}
                        {renderTournamentHistoryBadge(summary?.playerA?.tournament_history)}
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        {renderOddsBox(summary?.odds, "playerB", oddsB, probability != null ? 1 - probability : null)}
                        {renderRecentForm(summary?.playerB?.last_results)}
                        {(() => {
                          const chips: any[] = [];
                          const seed = match?.bottom?.seed;
                          if (typeof seed === "number" && Number.isFinite(seed)) {
                            chips.push(
                              <span key="seed" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-[11px] text-slate-200">#{seed}</span>,
                            );
                          }
                          const et = match?.bottom?.entryType?.toUpperCase();
                          if (et === 'Q' || et === 'WC') {
                            chips.push(
                              <span key="et" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-[11px] text-slate-200">{et}</span>,
                            );
                          }
                          const defendChip = renderDefendChip(summary.playerB.defends_round);
                          if (defendChip) {
                            chips.push(defendChip);
                          }
                          if (summary.playerB.home_advantage) {
                            chips.push(
                              <span
                                key="home"
                                title="Juega en su país"
                                aria-label="Juega en su país"
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-yellow-500/60 bg-yellow-500/10 text-yellow-300"
                              >
                                <House className="h-3.5 w-3.5" />
                              </span>,
                            );
                          }
                          if (summary.playerB.surface_change) {
                            chips.push(
                              <span
                                key="surface-change"
                                title="Cambio de superficie respecto a su último torneo"
                                aria-label="Cambio de superficie respecto a su último torneo"
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-sky-500/60 bg-sky-500/10 text-sky-300"
                              >
                                <Repeat className="h-3.5 w-3.5" />
                              </span>,
                            );
                          }
                          if (playerBAlerts.retired) {
                            chips.push(
                              <span
                                key="injury"
                                title="Se retiró en su último partido"
                                aria-label="Se retiró en su último partido"
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-rose-500/60 bg-rose-500/10 text-sm text-rose-300"
                              >
                                ✚
                              </span>,
                            );
                          }
                          if (chips.length === 0) return null;
                          return <div className="flex items-center gap-2">{chips}</div>;
                        })()}
                        {renderAlertBadges(playerBAlerts.rest)}
                        {renderNextTournamentBadge(summary?.playerB?.next_tournament)}
                        {renderTournamentHistoryBadge(summary?.playerB?.tournament_history)}
                      </div>
                    </div>
                  </div>

                  {highlight?.text && (
                    <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <div className="text-xs text-slate-300">Destacado: {highlight.text}</div>
                    </section>
                  )}

                  <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70">
                    <div className="border-b border-slate-800/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Comparativa de jugadores
                    </div>
                    <div className="divide-y divide-slate-800/60">
                      <StatRow
                        label="YTD"
                        playerA={formatPct(summary.playerA.win_pct_year)}
                        playerB={formatPct(summary.playerB.win_pct_year)}
                      />
                      <div className="px-4 pb-1.5">
                        <DiffBar valueA={summary.playerA.win_pct_year} valueB={summary.playerB.win_pct_year} />
                      </div>
                      <StatRow
                        label="% mes"
                        playerA={formatPct(summary.playerA.win_pct_month)}
                        playerB={formatPct(summary.playerB.win_pct_month)}
                      />
                      <div className="px-4 pb-1.5">
                        <DiffBar valueA={summary.playerA.win_pct_month} valueB={summary.playerB.win_pct_month} />
                      </div>
                      <StatRow
                        label="% superficie"
                        playerA={formatPct(summary.playerA.win_pct_surface)}
                        playerB={formatPct(summary.playerB.win_pct_surface)}
                      />
                      <div className="px-4 pb-1.5">
                        <DiffBar valueA={summary.playerA.win_pct_surface} valueB={summary.playerB.win_pct_surface} />
                      </div>
                      <div className="grid grid-cols-2 gap-3 px-4 pb-1.5">
                        <SurfaceWinBar
                          value={summary.playerA.win_pct_surface}
                          surface={summary.surface ?? summary.surface_reported ?? summary.tournament?.surface}
                        />
                        <SurfaceWinBar
                          value={summary.playerB.win_pct_surface}
                          surface={summary.surface ?? summary.surface_reported ?? summary.tournament?.surface}
                        />
                      </div>
                      <StatRow
                        label="% vs Top 10"
                        playerA={formatPct(summary.playerA.win_pct_vs_top10)}
                        playerB={formatPct(summary.playerB.win_pct_vs_top10)}
                      />
                      <div className="px-4 pb-1.5">
                        <DiffBar valueA={summary.playerA.win_pct_vs_top10} valueB={summary.playerB.win_pct_vs_top10} />
                      </div>
                      {showFifthSetStat && (
                        <>
                          <StatRow
                            label="% 5to set"
                            playerA={formatPct(summary.playerA.win_pct_fifth_set)}
                            playerB={formatPct(summary.playerB.win_pct_fifth_set)}
                          />
                          <div className="px-4 pb-1.5">
                            <DiffBar valueA={summary.playerA.win_pct_fifth_set} valueB={summary.playerB.win_pct_fifth_set} />
                          </div>
                        </>
                      )}

                      <StatRow label="Prob. victoria" playerA={formatPct(summary.playerA.win_probability)} playerB={formatPct(summary.playerB.win_probability)} />
                      <div className="px-4 pb-1.5">
                        <DiffBar valueA={summary.playerA.win_probability} valueB={summary.playerB.win_probability} />
                      </div>
                    </div>
                    <div className="border-t border-slate-800/60 px-4 py-4">
                      <div className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Court speed score
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {renderCourtSpeedDetail(summary.playerA.court_speed_score, summary.playerA.court_speed_edge, "left")}
                        {renderCourtSpeedDetail(summary.playerB.court_speed_score, summary.playerB.court_speed_edge, "right")}
                      </div>
                      {summary.court_speed_rank != null && (
                        <div className="mt-4">
                          <div className="mb-1 text-center text-xs text-slate-400">
                            {bracket?.event ? `${bracket.event} — ` : ""}Velocidad de esta pista: #{summary.court_speed_rank}
                            {describeCourtSpeed(summary.court_speed_rank) ? ` (${describeCourtSpeed(summary.court_speed_rank)})` : ""}
                          </div>
                          <CourtSpeedPositionBar
                            rank={summary.court_speed_rank}
                            min={summary.court_speed_min}
                            max={summary.court_speed_max}
                          />
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="border-t border-slate-800/60 bg-slate-950/90 px-6 py-4">
            <Button variant="secondary" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              Cerrar
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlayerStatsDialog({
  open,
  onOpenChange,
  player,
  match,
  bracket,
  data,
  loading,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player: Player | null;
  match: Match | null;
  bracket: Bracket | null;
  data: PlayerStatsResponse | null;
  loading: boolean;
  error: string | null;
}) {
  const playerName = player?.name ?? "Jugador";
  const playerSeed = player?.seed;
  const surfaceLabel = bracket?.surface ?? data?.filters.surface ?? null;
  const tournamentName = bracket?.event ?? data?.filters.tourney_id ?? null;
  const roundLabel = match?.round ?? null;

  type StatColumnKey = "best_of_3" | "same_surface" | "previous_tournament" | "opponent";

  const columns: Array<{ key: StatColumnKey; label: string }> = [
    { key: "best_of_3", label: "Bo3 (2 años)" },
    { key: "same_surface", label: "Misma superficie" },
    { key: "previous_tournament", label: "Torneo anterior" },
    { key: "opponent", label: "Rival (Bo3+superficie)" },
  ];

  const rows: Array<{
    key: "aces" | "double_faults";
    label: string;
    metricKeys: Record<StatColumnKey, keyof PlayerStatsMetrics>;
    sampleKeys: Record<StatColumnKey, keyof PlayerStatsSamples>;
    diffKeys: Partial<Record<StatColumnKey, keyof PlayerStatsMetrics>>;
  }> = [
    {
      key: "aces",
      label: "Aces",
      metricKeys: {
        best_of_3: "aces_best_of_3",
        same_surface: "aces_same_surface",
        previous_tournament: "aces_previous_tournament",
        opponent: "opponent_aces_best_of_3_same_surface",
      },
      sampleKeys: {
        best_of_3: "aces_best_of_3",
        same_surface: "aces_same_surface",
        previous_tournament: "aces_previous_tournament",
        opponent: "opponent_aces_best_of_3_same_surface",
      },
      diffKeys: { previous_tournament: "aces_previous_minus_best_of_3" },
    },
    {
      key: "double_faults",
      label: "Dobles faltas",
      metricKeys: {
        best_of_3: "double_faults_best_of_3",
        same_surface: "double_faults_same_surface",
        previous_tournament: "double_faults_previous_tournament",
        opponent: "opponent_double_faults_best_of_3_same_surface",
      },
      sampleKeys: {
        best_of_3: "double_faults_best_of_3",
        same_surface: "double_faults_same_surface",
        previous_tournament: "double_faults_previous_tournament",
        opponent: "opponent_double_faults_best_of_3_same_surface",
      },
      diffKeys: { previous_tournament: "double_faults_previous_minus_best_of_3" },
    },
  ];

  // Intensidad de color segun el valor DENTRO de la misma fila (Aces y
  // Dobles faltas tienen escalas muy distintas, asi que cada fila se
  // normaliza con su propio min/max) - mismo esquema de color (verde,
  // rampa de alpha) que la tabla de Analytics.
  const colorForValueInRow = (value: number | null, rowValues: Array<number | null>): string => {
    if (value === null) return "transparent";
    const nums = rowValues.filter((v): v is number => v !== null);
    if (nums.length === 0) return "transparent";
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const ratio = max === min ? 0.5 : (value - min) / (max - min);
    const alpha = 0.08 + ratio * 0.55;
    return `rgba(34, 197, 94, ${alpha.toFixed(3)})`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-2xl border border-slate-800 bg-slate-950/90 text-slate-100 backdrop-blur-md max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="space-y-1 px-6 pb-4 pt-6">
          <DialogTitle className="flex items-center gap-3 text-xl font-semibold text-slate-100">
            <BarChart3 className="h-5 w-5 text-emerald-400" />
            Estadísticas de {playerName}
            {typeof playerSeed === "number" ? (
              <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs text-slate-300">
                Seed {playerSeed}
              </span>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 px-6 pb-6 max-h-[70vh] overflow-y-auto">
          <div className="grid gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300 md:grid-cols-2">
            <div>
              <span className="text-slate-500">Torneo actual:</span>{" "}
              <span className="font-medium text-slate-100">
                {tournamentName ?? "N/A"}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Superficie:</span>{" "}
              <span className="font-medium text-slate-100">
                {surfaceLabel ?? "N/A"}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Ronda:</span>{" "}
              <span className="font-medium text-slate-100">
                {roundLabel ?? "N/A"}
              </span>
            </div>
            <div>
              <span className="text-slate-500">ID jugador:</span>{" "}
              <span className="font-mono text-slate-300">{player?.id ?? "N/A"}</span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6 text-sm text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cargando promedios...
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 rounded-xl border border-red-600/50 bg-red-950/40 p-3 text-sm text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <span>{error}</span>
            </div>
          ) : data ? (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Métrica</th>
                    {columns.map((col) => (
                      <th key={col.key} className="px-4 py-3 text-right font-semibold">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {rows.map((row) => {
                    const rowValues = columns.map((col) => data.stats?.[row.metricKeys[col.key]] ?? null);
                    return (
                      <tr key={row.key}>
                        <td className="px-4 py-3 font-medium text-slate-200">{row.label}</td>
                        {columns.map((col, idx) => {
                          const value = rowValues[idx];
                          const sample = data.samples?.[row.sampleKeys[col.key]] ?? 0;
                          const diffKey = row.diffKeys[col.key];
                          const diffValue = diffKey ? data.stats?.[diffKey] ?? null : null;
                          const titleParts = [
                            `Muestras: ${sample > 0 ? `${sample} partido${sample === 1 ? "" : "s"}` : "sin datos"}`,
                          ];
                          if (diffValue !== null) {
                            titleParts.push(
                              `Delta vs Bo3: ${diffValue > 0 ? "+" : ""}${diffValue.toFixed(2)}`,
                            );
                          }
                          return (
                            <td
                              key={col.key}
                              className="px-4 py-3 text-right tabular-nums font-semibold text-slate-100"
                              style={{ backgroundColor: colorForValueInRow(value, rowValues) }}
                              title={titleParts.join(" · ")}
                            >
                              {value !== null ? value.toFixed(1) : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-sm text-slate-400">
              Selecciona un jugador válido para ver sus estadísticas.
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-500">
            Los promedios se calculan a partir de <code>estratego_v1.matches_full</code>,
            considerando <span className="font-medium">best_of = 3</span> y los
            últimos 2 años (salvo "Torneo anterior", que se refiere siempre a esa
            edición concreta). Pasa el ratón sobre cada celda para ver muestras y
            variación. Los valores nulos no influyen en la media.
          </div>
        </div>

        <DialogFooter className="border-t border-slate-800/60 bg-slate-950/90 px-6 py-4 mt-auto">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HighsDialog({
  open,
  onOpenChange,
  data,
  loading,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: TournamentHighs | null;
  loading: boolean;
  error: string | null;
}) {
  const items = [
    {
      label: "Más aces en un partido",
      playerName: data?.aces_player_name ?? null,
      playerId: data?.aces_player_id ?? null,
      value: data?.aces_value ?? null,
    },
    {
      label: "Más dobles faltas en un partido",
      playerName: data?.double_faults_player_name ?? null,
      playerId: data?.double_faults_player_id ?? null,
      value: data?.double_faults_value ?? null,
    },
    {
      label: "Jugador que recibió más aces",
      playerName: data?.received_aces_player_name ?? null,
      playerId: data?.received_aces_player_id ?? null,
      value: data?.received_aces_value ?? null,
    },
    {
      label: "Jugador que recibió más dobles faltas",
      playerName: data?.received_double_faults_player_name ?? null,
      playerId: data?.received_double_faults_player_id ?? null,
      value: data?.received_double_faults_value ?? null,
    },
  ];

  const formatValue = (value: number | null): string =>
    value === null ? "Sin datos" : `${Number(value).toFixed(0)}`;

  const formatName = (name: string | null, id: string | null): string =>
    name?.trim()?.length
      ? name
      : id?.trim()?.length
        ? `Jugador ${id}`
        : "Sin datos";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl border border-slate-800 bg-slate-950/90 text-slate-100 backdrop-blur-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="space-y-1 px-5 pb-3 pt-5">
          <DialogTitle className="flex items-center gap-3 text-lg font-semibold text-slate-100">
            <Trophy className="h-5 w-5 text-amber-400" />
            Highs del torneo
          </DialogTitle>
          <div className="text-xs text-slate-400">
            Referencia: {data?.previous_tourney_id ?? "sin torneo anterior registrado"}
          </div>
        </DialogHeader>

        <div className="space-y-4 px-5 pb-5 max-h-[65vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-sm text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cargando highs...
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 rounded-xl border border-red-600/50 bg-red-950/40 p-3 text-sm text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <span>{error}</span>
            </div>
          ) : !data ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-400">
              Sin datos para el torneo anterior.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3"
                >
                  <div className="text-sm text-slate-300">{item.label}</div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <div className="text-base font-semibold text-white">
                      {formatName(item.playerName, item.playerId)}
                    </div>
                    <div className="text-lg font-semibold text-emerald-300">
                      {formatValue(item.value)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-800/60 bg-slate-950/90 px-5 py-4 mt-auto">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WeightsDialog({
  open,
  onOpenChange,
  weightsDraft,
  loading,
  saving,
  error,
  success,
  onChange,
  onReset,
  onSave,
  weightsSum,
  weightsDirty,
  preview,
  match,
  summary,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weightsDraft: Record<string, number> | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  success: string | null;
  onChange: (metric: string, value: number) => void;
  onReset: () => void;
  onSave: () => void;
  weightsSum: number;
  weightsDirty: boolean;
  preview: {
    playerAName: string;
    playerBName: string;
    scoreA: number;
    scoreB: number;
    probA: number | null;
    probB: number | null;
  } | null;
  match: Match | null;
  summary: PrematchSummaryResponse | null;
}) {
  const disableInputs = loading || !weightsDraft;
  const playerAName = preview?.playerAName ?? match?.top.name ?? "Jugador A";
  const playerBName = preview?.playerBName ?? match?.bottom.name ?? "Jugador B";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-2xl border border-slate-800 bg-slate-950/90 text-slate-100 backdrop-blur-md max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="space-y-1 px-6 pb-4 pt-6">
          <DialogTitle className="flex items-center gap-3 text-xl font-semibold text-slate-100">
            <SlidersHorizontal className="h-5 w-5 text-sky-400" />
            Ajustar pesos prematch
          </DialogTitle>
          <div className="text-xs text-slate-400">
            Modifica los pesos usados en la probabilidad y prueba con los últimos jugadores consultados.
          </div>
        </DialogHeader>

        <div className="space-y-5 px-6 pb-5 max-h-[68vh] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-6 text-sm text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cargando pesos...
            </div>
          )}

          {!loading && !weightsDraft && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-400">
              No se pudieron cargar los pesos actuales.
            </div>
          )}

          {!loading && weightsDraft && (
            <>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-500">
                Suma total: <span className="font-semibold text-slate-200">{weightsSum.toFixed(2)}</span>
                <button
                  type="button"
                  className="ml-3 text-xs text-sky-400 hover:underline"
                  disabled={disableInputs}
                  onClick={onReset}
                >
                  Restablecer por defecto
                </button>
              </div>

              <div className="space-y-4">
                {WEIGHT_METRICS.map((metric) => {
                  const current = weightsDraft[metric.key] ?? WEIGHTS_DEFAULTS[metric.key] ?? 0;
                  return (
                    <div key={metric.key} className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
                      <div className="mb-2 flex items-center justify-between text-sm text-slate-200">
                        <span>{metric.label}</span>
                        <span className="text-xs text-slate-500">{current.toFixed(2)}</span>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={current}
                          disabled={disableInputs}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            onChange(metric.key, Number.isFinite(value) ? value : 0);
                          }}
                          className="flex-1"
                        />
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.01}
                          value={current.toFixed(2)}
                          disabled={disableInputs}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            onChange(metric.key, Number.isFinite(value) ? value : 0);
                          }}
                          className="w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
            <div className="text-sm text-slate-200">Vista previa con jugadores recientes</div>
            {summary ? (
              preview ? (
                <div className="grid gap-2 text-sm text-slate-300">
                  <div className="flex items-center justify-between">
                    <span>{playerAName}</span>
                    <span className="font-semibold text-emerald-300">
                      {preview.probA == null ? "N/A" : `${(preview.probA * 100).toFixed(1)}%`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{playerBName}</span>
                    <span className="font-semibold text-emerald-300">
                      {preview.probB == null ? "N/A" : `${(preview.probB * 100).toFixed(1)}%`}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400">No se pudo calcular la vista previa con los datos actuales.</div>
              )
            ) : (
              <div className="text-xs text-slate-400">Abre primero un modal prematch para disponer de datos y previsualizar la probabilidad.</div>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-600/50 bg-red-950/40 p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-emerald-600/40 bg-emerald-950/40 p-3 text-sm text-emerald-200">
              {success}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-800/60 bg-slate-950/90 px-6 py-4 mt-auto">
          <div className="flex w-full flex-col justify-end gap-2 sm:flex-row sm:items-center">
            <Button variant="outline" onClick={onReset} disabled={disableInputs || saving}>
              Restablecer
            </Button>
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
                Cerrar
              </Button>
              <Button onClick={onSave} disabled={!weightsDraft || !weightsDirty || saving}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TournamentBracketPage() {
  const router = useRouter();
  const params = useParams<{ tourneyId: string }>();
  const tParam = params?.tourneyId ?? "";
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [bracketError, setBracketError] = useState<string | null>(null);
  const [pmOpen, setPmOpen] = useState(false);
  const [pmMatch, setPmMatch] = useState<Match | null>(null);
  const [multiSimLoading, setMultiSimLoading] = useState(false);
  const [multiSimProgress, setMultiSimProgress] = useState<{ done: number; total: number } | null>(null);
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [playerStatsOpen, setPlayerStatsOpen] = useState(false);
  const [playerStatsTarget, setPlayerStatsTarget] = useState<{ match: Match; player: Player } | null>(null);
  const [playerStatsData, setPlayerStatsData] = useState<PlayerStatsResponse | null>(null);
  const [playerStatsLoading, setPlayerStatsLoading] = useState(false);
  const [playerStatsError, setPlayerStatsError] = useState<string | null>(null);
  const [highsOpen, setHighsOpen] = useState(false);
  const [highsData, setHighsData] = useState<TournamentHighs | null>(null);
  const [highsLoading, setHighsLoading] = useState(false);
  const [highsError, setHighsError] = useState<string | null>(null);
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [weightsData, setWeightsData] = useState<Record<string, number> | null>(null);
  const [weightsDraft, setWeightsDraft] = useState<Record<string, number> | null>(null);
  const [weightsLoading, setWeightsLoading] = useState(false);
  const [weightsSaving, setWeightsSaving] = useState(false);
  const [weightsError, setWeightsError] = useState<string | null>(null);
  const [weightsSuccess, setWeightsSuccess] = useState<string | null>(null);
  const [compactDrawOpen, setCompactDrawOpen] = useState(false);
  const [lastPrematchSummary, setLastPrematchSummary] = useState<PrematchSummaryResponse | null>(null);
  const [lastPrematchMatch, setLastPrematchMatch] = useState<Match | null>(null);
  const [simulationRunCount, setSimulationRunCount] = useState<number | null>(null);
  const [simulationStatusLoading, setSimulationStatusLoading] = useState(false);

  const refreshSimulationStatus = useCallback(
    async (signal?: AbortSignal) => {
      if (!tParam) return null;
      try {
        const res = await fetch(
          `/api/simulation/${encodeURIComponent(tParam)}/status`,
          { signal },
        );
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `HTTP ${res.status}`);
        }
        const payload = await res.json().catch(() => ({}));
        if (signal?.aborted) {
          return payload ?? null;
        }
        const count =
          typeof payload?.run_count === "number" && Number.isFinite(payload.run_count)
            ? payload.run_count
            : 0;
        setSimulationRunCount(count);
        return payload ?? null;
      } catch (err) {
        if (signal?.aborted) {
          return null;
        }
        console.warn("No se pudo cargar estado de simulaciones:", err);
        setSimulationRunCount(null);
        return null;
      }
    },
    [tParam],
  );

  useEffect(() => {
    if (!tParam) return;
    const controller = new AbortController();
    setSimulationStatusLoading(true);
    setSimulationRunCount(null);
    refreshSimulationStatus(controller.signal).finally(() => {
      if (!controller.signal.aborted) {
        setSimulationStatusLoading(false);
      }
    });
    return () => controller.abort();
  }, [tParam, refreshSimulationStatus]);

  useEffect(() => {
    if (!tParam) return;
    const load = async () => {
      setBracketError(null);
      try {
        const res = await fetch(`/api/tournament/${tParam}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Bracket = await res.json();
        setBracket(data);
      } catch (err) {
        console.warn("Fallo cargando torneo", err);
        setBracket(null);
        setBracketError(err instanceof Error ? err.message : String(err));
      }
    };
    load();
  }, [tParam]);

  const rounds: Match["round"][] = useMemo(
    () => ["R128", "R64", "R32", "R16", "QF", "SF", "F"],
    [],
  );

  const weightsKeys = useMemo(() => WEIGHT_METRICS.map((m) => m.key), []);

  const weightsSum = useMemo(() => {
    if (!weightsDraft) return 0;
    return weightsKeys.reduce((total, key) => total + (weightsDraft[key] ?? 0), 0);
  }, [weightsDraft, weightsKeys]);

  const weightsDirty = useMemo(() => {
    if (!weightsDraft || !weightsData) return false;
    return weightsKeys.some((key) => {
      const base = weightsData[key] ?? WEIGHTS_DEFAULTS[key] ?? 0;
      const current = weightsDraft[key] ?? 0;
      return Math.abs(base - current) > 1e-6;
    });
  }, [weightsDraft, weightsData, weightsKeys]);

  const analyticsAvailable = useMemo(
    () => (simulationRunCount ?? 0) > 0,
    [simulationRunCount],
  );

  const weightsPreview = useMemo(() => {
    if (!weightsDraft || !lastPrematchSummary) return null;
    let scoreA = 0;
    let scoreB = 0;
    for (const key of weightsKeys) {
      const weight = weightsDraft[key] ?? 0;
      if (!Number.isFinite(weight) || weight === 0) continue;
      const extractor = METRIC_EXTRACTORS[key];
      if (!extractor) continue;
      const valueA = extractor(lastPrematchSummary.playerA) ?? 0;
      const valueB = extractor(lastPrematchSummary.playerB) ?? 0;
      scoreA += weight * valueA;
      scoreB += weight * valueB;
    }
    const total = scoreA + scoreB;
    if (!Number.isFinite(total) || total <= 0) {
      return {
        playerAName: lastPrematchMatch?.top.name ?? "Jugador A",
        playerBName: lastPrematchMatch?.bottom.name ?? "Jugador B",
        scoreA,
        scoreB,
        probA: null,
        probB: null,
      };
    }
    const probA = scoreA / total;
    const probB = scoreB / total;
    return {
      playerAName: lastPrematchMatch?.top.name ?? "Jugador A",
      playerBName: lastPrematchMatch?.bottom.name ?? "Jugador B",
      scoreA,
      scoreB,
      probA,
      probB,
    };
  }, [weightsDraft, lastPrematchSummary, lastPrematchMatch, weightsKeys]);

  const matchesByRound = useMemo(() => {
    const map: Record<string, Match[]> = {};
    for (const r of rounds) {
      map[r] = bracket?.matches
        ? byRound(bracket.matches, r).sort((a, b) => {
            const numA = parseInt(a.id.split("-")[1]);
            const numB = parseInt(b.id.split("-")[1]);
            return numA - numB;
          })
        : [];
    }
    return map;
  }, [bracket, rounds]);

  const visibleRounds = useMemo(() => {
    const firstWithMatches = rounds.find((r) => (matchesByRound[r] ?? []).length > 0);
    const drawSize = bracket?.drawSize ?? 64;
    const expectedFirst =
      drawSize >= 128
        ? "R128"
        : drawSize >= 64
          ? "R64"
          : drawSize >= 32
            ? "R32"
            : drawSize >= 16
              ? "R16"
              : drawSize >= 8
                ? "QF"
                : drawSize >= 4
                  ? "SF"
                  : "F";

    const startRound = firstWithMatches ?? expectedFirst;
    const startIdx = rounds.indexOf(startRound);
    const idx = startIdx >= 0 ? startIdx : 0;
    return rounds.slice(idx);
  }, [rounds, matchesByRound, bracket?.drawSize]);

  useEffect(() => {
    if (!playerStatsOpen || !playerStatsTarget || !bracket) {
      return;
    }

    const rawId = playerStatsTarget.player?.id;
    const normalizedId =
      typeof rawId === "string"
        ? rawId.trim()
        : rawId !== null && rawId !== undefined
          ? String(rawId).trim()
          : "";

    if (!normalizedId) {
      setPlayerStatsError("Jugador sin identificador valido.");
      setPlayerStatsData(null);
      setPlayerStatsLoading(false);
      return;
    }

    const controller = new AbortController();
    setPlayerStatsLoading(true);
    setPlayerStatsError(null);
    setPlayerStatsData(null);

    const payload = {
      player_id: normalizedId,
      surface: bracket.surface ?? null,
      tourney_id: bracket.tourney_id ?? null,
    };

    (async () => {
      try {
        const response = await fetch("/api/player/stats", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) {
          let message = `Error ${response.status}`;
          try {
            const data = await response.json();
            if (data && typeof data.error === "string" && data.error.trim()) {
              message = data.error.trim();
            }
          } catch {
            const text = await response.text();
            if (text.trim()) {
              message = text.trim();
            }
          }
          if (!controller.signal.aborted) {
            setPlayerStatsError(message);
          }
          return;
        }

        const payloadJson = (await response.json()) as PlayerStatsResponse;
        if (!controller.signal.aborted) {
          setPlayerStatsData(payloadJson);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setPlayerStatsError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!controller.signal.aborted) {
          setPlayerStatsLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [
    playerStatsOpen,
    playerStatsTarget,
    bracket?.surface,
    bracket?.tourney_id,
  ]);

  useEffect(() => {
    if (!highsOpen || !bracket?.tourney_id) {
      return;
    }

    const controller = new AbortController();
    setHighsLoading(true);
    setHighsError(null);
    setHighsData(null);

    (async () => {
      try {
        const response = await fetch(
          `/api/tournament/${encodeURIComponent(bracket.tourney_id)}/highs`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          let message = `Error ${response.status}`;
          try {
            const payload = await response.json();
            if (payload && typeof payload.error === "string" && payload.error.trim()) {
              message = payload.error.trim();
            }
          } catch {
            const text = await response.text();
            if (text.trim()) {
              message = text.trim();
            }
          }
          if (!controller.signal.aborted) {
            setHighsError(message);
          }
          return;
        }

        const payload = (await response.json()) as TournamentHighs | null;
        if (!controller.signal.aborted) {
          setHighsData(payload ?? null);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setHighsError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!controller.signal.aborted) {
          setHighsLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [highsOpen, bracket?.tourney_id]);

  useEffect(() => {
    if (!weightsOpen) {
      return;
    }

    const controller = new AbortController();
    setWeightsLoading(true);
    setWeightsError(null);
    setWeightsSuccess(null);

    (async () => {
      try {
        const res = await fetch("/api/prematch/weights", { signal: controller.signal });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Error ${res.status}`);
        }
        const payload = await res.json();
        const list = Array.isArray((payload as any)?.weights) ? (payload as any).weights : [];
        const merged: Record<string, number> = { ...WEIGHTS_DEFAULTS };
        for (const item of list) {
          if (item && typeof item.metric === "string") {
            const num = Number(item.weight);
            if (Number.isFinite(num)) {
              merged[item.metric.trim()] = num;
            }
          }
        }
        if (!controller.signal.aborted) {
          setWeightsData(merged);
          setWeightsDraft({ ...merged });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setWeightsError(err instanceof Error ? err.message : String(err));
        setWeightsData({ ...WEIGHTS_DEFAULTS });
        setWeightsDraft({ ...WEIGHTS_DEFAULTS });
      } finally {
        if (!controller.signal.aborted) {
          setWeightsLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [weightsOpen]);

  const onSelectWinner = async (match: Match, slot: "top" | "bottom") => {
    if (!bracket) return;
    if (savingMatchId) return;

    const player = slot === "top" ? match.top : match.bottom;
    const rawId = player?.id;
    const winnerId =
      typeof rawId === "string"
        ? rawId.trim()
        : rawId !== null && rawId !== undefined
          ? String(rawId).trim()
          : "";
    if (!winnerId) return;
    const normalized = winnerId.toUpperCase();
    if (normalized === "TBD" || normalized === "BYE") return;
    if (match.winnerId && match.winnerId === winnerId) return;

    setSavingMatchId(match.id);

    try {
      const response = await fetch("/api/draw/winner", {
        method: "POST",
        headers: { "content-type": "application/json", ...ADMIN_API_HEADERS },
        body: JSON.stringify({
          tourney_id: bracket.tourney_id,
          match_id: match.id,
          winner_id: winnerId,
        }),
      });

      if (!response.ok) {
        let message = "No se pudo guardar el ganador.";
        try {
          const payload = await response.json();
          if (payload && typeof (payload as any).error === "string") {
            const trimmed = ((payload as any).error as string).trim();
            if (trimmed) {
              message = trimmed;
            }
          }
        } catch {
          // no-op si la respuesta no es JSON
        }
        alert(message);
        return;
      }

      const latest = await fetch(`/api/tournament/${bracket.tourney_id}`);
      if (latest.ok) {
        const data = (await latest.json()) as Bracket;
        setBracket(data);
        setPmMatch((prev) => {
          if (!prev || prev.id !== match.id) return prev;
          const updated = data.matches.find((item) => item.id === match.id);
          return updated ?? prev;
        });
      } else {
        console.warn("No se pudo recargar el cuadro tras marcar ganador.");
      }
    } catch (err) {
      console.error("Error al guardar ganador:", err);
      alert("Ocurrio un error al guardar el ganador.");
    } finally {
      setSavingMatchId(null);
    }
  };

  const onOpenPlayerStats = (match: Match, player: Player) => {
    const rawId = player?.id;
    const normalizedId =
      typeof rawId === "string"
        ? rawId.trim()
        : rawId !== null && rawId !== undefined
          ? String(rawId).trim()
          : "";
    if (!normalizedId) return;
    const upper = normalizedId.toUpperCase();
    if (!upper || upper === "TBD" || upper === "BYE") return;
    setPlayerStatsTarget({
      match,
      player: { ...player, id: normalizedId },
    });
    setPlayerStatsOpen(true);
  };

  const handlePlayerStatsOpenChange = (open: boolean) => {
    if (!open) {
      setPlayerStatsOpen(false);
      setPlayerStatsTarget(null);
      setPlayerStatsData(null);
      setPlayerStatsError(null);
      setPlayerStatsLoading(false);
    } else if (playerStatsTarget) {
      setPlayerStatsOpen(true);
    }
  };

  const handleHighsOpenChange = (open: boolean) => {
    if (!open) {
      setHighsOpen(false);
      setHighsData(null);
      setHighsError(null);
      setHighsLoading(false);
    } else {
      setHighsOpen(true);
    }
  };

  const handleWeightsOpenChange = (open: boolean) => {
    if (!open) {
      setWeightsOpen(false);
      setWeightsError(null);
      setWeightsSuccess(null);
      setWeightsLoading(false);
      setWeightsSaving(false);
    } else {
      setWeightsOpen(true);
    }
  };

  const handleWeightChange = (metric: string, value: number) => {
    setWeightsDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, [metric]: value };
    });
    setWeightsSuccess(null);
  };

  const handleWeightsReset = () => {
    setWeightsDraft({ ...WEIGHTS_DEFAULTS });
    setWeightsSuccess(null);
  };

  const handleWeightsSave = async () => {
    if (!weightsDraft) return;
    setWeightsSaving(true);
    setWeightsError(null);
    setWeightsSuccess(null);
    try {
      const payload = {
        weights: WEIGHT_METRICS.map((metric) => ({
          metric: metric.key,
          weight: weightsDraft[metric.key] ?? 0,
        })),
      };
      const res = await fetch("/api/prematch/weights", {
        method: "POST",
        headers: { "content-type": "application/json", ...ADMIN_API_HEADERS },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const textResponse = await res.text();
        throw new Error(textResponse || `Error ${res.status}`);
      }
      setWeightsData(weightsDraft ? { ...weightsDraft } : null);
      setWeightsSuccess("Pesos guardados correctamente.");
    } catch (err) {
      setWeightsError(err instanceof Error ? err.message : String(err));
    } finally {
      setWeightsSaving(false);
    }
  };

  const onSimulateMultiple = async () => {
    if (!bracket || multiSimLoading) return;
    const defaultRuns = 100;
    const input = window.prompt(
      "¿Cuántas simulaciones quieres ejecutar?",
      String(defaultRuns),
    );

    if (input === null) {
      return;
    }

    const runs = Number.parseInt(input, 10);
    if (!Number.isFinite(runs) || runs <= 0) {
      alert("Introduce un número válido de runs (entero positivo).");
      return;
    }

    setMultiSimLoading(true);
    setMultiSimProgress({ done: 0, total: runs });

    try {
      let processed = 0;
      let reset = true;
      const baseChunkSize = 4;
      let chunkSize = Math.min(baseChunkSize, runs);

      const runChunk = async (chunkRuns: number, resetChunk: boolean) => {
        const payload = {
          tourney_id: bracket.tourney_id,
          runs: chunkRuns,
          year: new Date().getFullYear(),
          reset: resetChunk,
        };

        try {
          const res = await fetch("/api/simulate/multiple", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            const text = await res.text();
            let message = text || `${res.status}`;
            try {
              const parsed = JSON.parse(text);
              if (parsed && typeof parsed.error === "string") {
                message = parsed.error;
              }
            } catch {
              // ignore parse errors
            }
            return { ok: false as const, error: message };
          }

          const data = await res.json().catch(() => undefined);
          const runsCompleted =
            data && typeof data.runsCompleted === "number" ? data.runsCompleted : chunkRuns;
          return { ok: true as const, runsCompleted };
        } catch (err) {
          return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
        }
      };

      while (processed < runs) {
        const remaining = runs - processed;
        chunkSize = Math.min(chunkSize, remaining);
        const result = await runChunk(chunkSize, reset);

        if (!result.ok) {
          const errMsg = result.error ?? "Error desconocido";
          console.error("Error en simulate/multiple:", errMsg);

          const lowerErr = errMsg.toLowerCase();
          const isTimeoutError =
            lowerErr.includes("statement timeout") ||
            lowerErr.includes("timeout") ||
            lowerErr.includes("timed out") ||
            lowerErr.includes("504");

          if (chunkSize > 1 && isTimeoutError) {
            chunkSize = 1;
            continue;
          }

          alert(`Fallo al correr las simulaciones: ${errMsg}`);
          break;
        }

        const completed = Math.max(1, Math.min(result.runsCompleted, chunkSize));
        processed += completed;
        reset = false;
        setMultiSimProgress({ done: processed, total: runs });
        chunkSize = Math.min(baseChunkSize, runs - processed);

        await new Promise((resolve) => setTimeout(resolve, 120));
      }

      if (processed > 0 && processed === runs) {
        setSimulationStatusLoading(true);
        try {
          await refreshSimulationStatus();
        } finally {
          setSimulationStatusLoading(false);
        }
        router.push(
          `/simulation/${encodeURIComponent(bracket.tourney_id)}/analytics`,
        );
      }
    } catch (err) {
      console.error("Error ejecutando simulaciones múltiples:", err);
      alert("Ocurrió un error al ejecutar las simulaciones múltiples.");
    } finally {
      setMultiSimLoading(false);
      setMultiSimProgress(null);
    }
  };

  const onReset = async () => {
    if (!bracket?.tourney_id) return;
    if (!window.confirm("¿Seguro que quieres resetear este torneo? Se perderá el progreso del draw.")) return;

    await fetch("/api/reset", {
      method: "POST",
      headers: { "content-type": "application/json", ...ADMIN_API_HEADERS },
      body: JSON.stringify({ tourney_id: bracket.tourney_id }),
    });

    const res = await fetch(`/api/tournament/${bracket.tourney_id}`);
    const data: Bracket = await res.json();
    setBracket(data);
  };

  const fetchPrematch = async (m: Match) => {
    if (!bracket) return;

    const playerAId = Number.parseInt(m.top.id, 10);
    const playerBId = Number.parseInt(m.bottom.id, 10);

    if (Number.isNaN(playerAId) || Number.isNaN(playerBId)) {
      console.info("Prematch omitido: jugadores sin definir", {
        top: m.top.id,
        bottom: m.bottom.id,
      });
      return;
    }

    const payload = {
      playerA_id: playerAId,
      playerB_id: playerBId,
      tourney_id: bracket.tourney_id,
      year: new Date().getFullYear(),
      playerA_name: m.top?.name ?? null,
      playerB_name: m.bottom?.name ?? null,
      event_name: bracket.event ?? null,
    };

    try {
      const res = await fetch("/api/prematch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const summary = await res.json();
      setLastPrematchSummary(summary);
      setLastPrematchMatch(m);
    } catch (err) {
      console.error("Error en prematch", err);
    }
  };

  function onOpenPrematch(m: Match) {
    setPmMatch(m);
    setPmOpen(true);
    fetchPrematch(m);
  }

  if (!bracket) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-sm text-slate-400">
        {bracketError ? (
          <>
            <div className="text-red-300">No se pudo cargar el torneo "{tParam}": {bracketError}</div>
            <Button variant="secondary" onClick={() => router.push("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a buscar
            </Button>
          </>
        ) : (
          "Cargando torneo..."
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a buscar
        </Button>
        <div className="text-xs text-slate-500">Torneo: {tParam}</div>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-semibold">{bracket.event}</h1>
            {bracket.speedRank != null && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">
                  Velocidad #{bracket.speedRank}
                  {describeCourtSpeed(bracket.speedRank) ? ` (${describeCourtSpeed(bracket.speedRank)})` : ""}
                </span>
                <div className="w-28">
                  <CourtSpeedPositionBar rank={bracket.speedRank} min={bracket.speedMin} max={bracket.speedMax} />
                </div>
              </div>
            )}
          </div>
          <p className="text-sm text-slate-400">
            Draw {bracket.drawSize} - Superficie: {bracket.surface}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={onSimulateMultiple}
            disabled={multiSimLoading}
          >
            <Flame className="w-4 h-4 mr-2" />
            {multiSimLoading ? "Simulando..." : "Simular xN"}
          </Button>
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={() => router.push(`/simulation/${encodeURIComponent(bracket.tourney_id)}/analytics`)}
            disabled={!analyticsAvailable || simulationStatusLoading || !bracket}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </Button>
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={() => setWeightsOpen(true)}
            disabled={weightsLoading}
          >
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            Pesos
          </Button>
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={() => setHighsOpen(true)}
            disabled={highsLoading || !bracket}
          >
            <Trophy className="w-4 h-4 mr-2" />
            Highs
          </Button>
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={() => router.push(`/tournament/${encodeURIComponent(bracket.tourney_id)}/valuebets`)}
            disabled={!bracket}
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            ValueBet
          </Button>
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={() => setCompactDrawOpen(true)}
            disabled={!bracket}
          >
            <Maximize2 className="w-4 h-4 mr-2" />
            Draw compacto
          </Button>
          <Button variant="destructive" className="rounded-2xl" onClick={onReset}>
            Resetear
          </Button>
        </div>
      </div>

      {compactDrawOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div>
              <div className="text-sm uppercase tracking-wide text-slate-400">Vista compacta</div>
              <div className="text-lg font-semibold text-slate-100">{bracket?.event ?? "Cuadro"}</div>
            </div>
            <Button variant="secondary" onClick={() => setCompactDrawOpen(false)}>
              <X className="w-4 h-4 mr-2" />
              Cerrar
            </Button>
          </div>
          <div className="mx-auto max-w-6xl overflow-auto px-4 pb-6">
            <div className="flex gap-3">
              {visibleRounds.map((r) => (
                <div key={`compact-${r}`} className="min-w-[160px] flex-1 space-y-2">
                  <div className="rounded-md bg-slate-800 px-2 py-1 text-center text-xs font-semibold uppercase text-slate-100">
                    {r}
                  </div>
                  {matchesByRound[r].length ? (
                    matchesByRound[r].map((m) => {
                      const topWin = m.winnerId === m.top.id;
                      const botWin = m.winnerId === m.bottom.id;
                      return (
                        <div
                          key={`compact-${m.id}`}
                          className="rounded-md border border-slate-800 bg-slate-900/90 px-2 py-1 text-[12px] text-slate-50"
                        >
                          <div className={`flex items-center justify-between ${topWin ? "text-emerald-200" : "text-slate-100"}`}>
                            <span className="truncate">{shortenName(m.top.name)}</span>
                            {m.top.seed ? (
                              <span className="ml-1 text-[10px] text-slate-400">({m.top.seed})</span>
                            ) : null}
                          </div>
                          <div className={`flex items-center justify-between ${botWin ? "text-emerald-200" : "text-slate-100"}`}>
                            <span className="truncate">{shortenName(m.bottom.name)}</span>
                            {m.bottom.seed ? (
                              <span className="ml-1 text-[10px] text-slate-400">({m.bottom.seed})</span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-md border border-dashed border-slate-800 px-2 py-3 text-center text-[11px] text-slate-500">
                      Sin partidos
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {multiSimProgress && (
        <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
          Ejecutando simulaciones {multiSimProgress.done}/{multiSimProgress.total} (
          {Math.round((multiSimProgress.done / multiSimProgress.total) * 100)}%). Puedes seguir navegando; revisa la vista de analytics para ver los resultados cuando termine.
        </div>
      )}

      <div className="overflow-x-auto md:hidden">
        <div className="flex gap-6">
          {visibleRounds.map((r: Match["round"], idx) => (
            <React.Fragment key={r}>
              <Column title={r}>
                {matchesByRound[r].length ? (
                  matchesByRound[r].map((m) => (
                    <MatchCard
                      key={m.id}
                      m={m}
                      onClick={onOpenPrematch}
                      onSelectWinner={onSelectWinner}
                      onOpenPlayerStats={onOpenPlayerStats}
                      disableSelection={Boolean(savingMatchId) && savingMatchId !== m.id}
                      isSaving={savingMatchId === m.id}
                    />
                  ))
                ) : (
                  <EmptyRound />
                )}
              </Column>
              {idx < visibleRounds.length - 1 && (
                <div className="flex items-center">
                  <ChevronRight className="text-gray-400" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="hidden md:block">
        <QuarterTabs
          rounds={visibleRounds}
          matchesByRound={matchesByRound}
          onSelectWinner={onSelectWinner}
          onOpenPrematch={onOpenPrematch}
          onOpenPlayerStats={onOpenPlayerStats}
          savingMatchId={savingMatchId}
        />
      </div>

      <PrematchDialog open={pmOpen} onOpenChange={setPmOpen} match={pmMatch} bracket={bracket} />
      <HighsDialog
        open={highsOpen}
        onOpenChange={handleHighsOpenChange}
        data={highsData}
        loading={highsLoading}
        error={highsError}
      />
      <WeightsDialog
        open={weightsOpen}
        onOpenChange={handleWeightsOpenChange}
        weightsDraft={weightsDraft}
        loading={weightsLoading}
        saving={weightsSaving}
        error={weightsError}
        success={weightsSuccess}
        onChange={handleWeightChange}
        onReset={handleWeightsReset}
        onSave={handleWeightsSave}
        weightsSum={weightsSum}
        weightsDirty={weightsDirty}
        preview={weightsPreview}
        match={lastPrematchMatch}
        summary={lastPrematchSummary}
      />
      <PlayerStatsDialog
        open={playerStatsOpen}
        onOpenChange={handlePlayerStatsOpenChange}
        player={playerStatsTarget?.player ?? null}
        match={playerStatsTarget?.match ?? null}
        bracket={bracket}
        data={playerStatsData}
        loading={playerStatsLoading}
        error={playerStatsError}
      />
    </div>
  );
}

function EmptyRound() {
  return <div className="text-xs text-slate-400 italic px-1">(esperando simulacion)</div>;
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-400">Cargando...</div>}>
      <TournamentBracketPage />
    </Suspense>
  );
}
